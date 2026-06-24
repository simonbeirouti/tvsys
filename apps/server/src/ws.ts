import http from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import {
  parseJsonMessage,
  validateCapabilities,
  validateScene,
  type AuthContext,
  type ControllerToServerMessage,
  type DisplayToServerMessage,
  type RegisterDisplayMessage,
  type Scene,
  type ServerToControllerMessage,
  type ServerToDisplayMessage
} from "@tvsys/shared";
import type { AuthService } from "./auth.js";
import type { ServerConfig } from "./config.js";
import type { DisplayRecord, Store } from "./store.js";

interface DisplayClient {
  ownerUserId: string;
  displayId: string;
  socket: WebSocket;
}

interface ControllerClient {
  ownerUserId: string;
  socket: WebSocket;
}

export class SignageHub {
  private readonly wss = new WebSocketServer({ noServer: true });
  private readonly displayClients = new Map<string, DisplayClient>();
  private readonly controllerClients = new Map<WebSocket, ControllerClient>();
  private readonly staleTimer: NodeJS.Timeout;

  constructor(
    private readonly server: http.Server,
    private readonly store: Store,
    private readonly config: ServerConfig,
    private readonly auth: AuthService
  ) {
    this.server.on("upgrade", (request, socket, head) => {
      void this.handleUpgrade(request, socket, head);
    });

    this.staleTimer = setInterval(() => {
      void this.expireStaleDisplays();
    }, 15_000);
  }

  close(): void {
    clearInterval(this.staleTimer);
    this.wss.close();
  }

  broadcastStatus(display: DisplayRecord): void {
    this.sendToControllers(display.ownerUserId, { type: "display_status", display: stripOwner(display) });
  }

  async sendSceneToDisplay(
    ownerUserId: string,
    displayId: string,
    scene: Scene,
    title = scene.title
  ): Promise<{ displayId: string; sceneVersion: number; delivered: boolean } | undefined> {
    const assignment = await this.store.assignScene(ownerUserId, displayId, scene, title);
    if (!assignment) return undefined;
    const deliveryScene = await this.store.resolveSceneAssets(ownerUserId, scene);
    const delivered = this.pushCurrentScene(ownerUserId, assignment.display.id, deliveryScene, assignment.display.currentSceneVersion);
    this.broadcastStatus(assignment.display);
    this.sendToControllers(ownerUserId, {
      type: "scene_delivery",
      displayId,
      sceneVersion: assignment.display.currentSceneVersion,
      delivered,
      sentAt: new Date().toISOString()
    });
    return { displayId, sceneVersion: assignment.display.currentSceneVersion, delivered };
  }

  async broadcastScene(ownerUserId: string, scene: Scene, title = scene.title): Promise<Array<{ displayId: string; sceneVersion: number; delivered: boolean }>> {
    const displays = await this.store.listDisplays(ownerUserId);
    const deliveries = await Promise.all(displays.map((display) => this.sendSceneToDisplay(ownerUserId, display.id, scene, title)));
    return deliveries.filter(Boolean) as Array<{ displayId: string; sceneVersion: number; delivered: boolean }>;
  }

  private async handleUpgrade(request: http.IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (url.pathname !== "/ws/display" && url.pathname !== "/ws/controller") {
      socket.destroy();
      return;
    }

    const accessToken = url.searchParams.get("access_token") ?? undefined;
    let context: AuthContext;
    try {
      context = await this.auth.authenticateToken(accessToken);
    } catch {
      socket.destroy();
      return;
    }

    this.wss.handleUpgrade(request, socket, head, (ws) => {
      if (url.pathname === "/ws/display") this.acceptDisplay(ws, context);
      if (url.pathname === "/ws/controller") void this.acceptController(ws, context);
    });
  }

  private acceptDisplay(socket: WebSocket, context: AuthContext): void {
    let authenticatedDisplayId: string | undefined;
    const authTimer = setTimeout(() => {
      if (!authenticatedDisplayId) socket.close(4001, "Display registration timed out");
    }, this.config.unauthenticatedSocketTimeoutMs);

    socket.on("message", (raw) => {
      void (async () => {
        const parsed = parseJsonMessage(raw.toString());
        if (!parsed.ok) {
          this.sendToDisplaySocket(socket, { type: "server_error", message: parsed.errors.join(", ") });
          return;
        }

        const message = parsed.value as DisplayToServerMessage;
        if (!authenticatedDisplayId) {
          if (message.type !== "register_display") {
            socket.close(4002, "First display message must be register_display");
            return;
          }
          authenticatedDisplayId = await this.registerDisplay(socket, context, message);
          if (authenticatedDisplayId) clearTimeout(authTimer);
          return;
        }

        if ("displayId" in message && message.displayId !== authenticatedDisplayId) {
          socket.close(4003, "Display id changed during connection");
          return;
        }

        await this.handleDisplayMessage(context, message);
      })();
    });

    socket.on("close", () => {
      void (async () => {
        clearTimeout(authTimer);
        if (!authenticatedDisplayId) return;
        this.displayClients.delete(clientKey(context.user.id, authenticatedDisplayId));
        const display = await this.store.markDisplayOffline(context.user.id, authenticatedDisplayId);
        if (display) this.broadcastStatus(display);
        console.log(`[ws] display disconnected ${authenticatedDisplayId}`);
      })();
    });
  }

  private async registerDisplay(socket: WebSocket, context: AuthContext, message: RegisterDisplayMessage): Promise<string | undefined> {
    if (!validateCapabilities(message.capabilities)) {
      socket.close(4004, "Invalid capabilities");
      return undefined;
    }

    const display = await this.store.markDisplayOnline({
      ownerUserId: context.user.id,
      displayId: message.displayId,
      installationId: message.installationId,
      appVersion: message.appVersion,
      capabilities: message.capabilities
    });
    if (!display) {
      socket.close(4005, "Display does not belong to this user");
      return undefined;
    }

    const key = clientKey(context.user.id, message.displayId);
    this.displayClients.get(key)?.socket.close(4006, "Display reconnected elsewhere");
    this.displayClients.set(key, { ownerUserId: context.user.id, displayId: message.displayId, socket });
    this.broadcastStatus(display);
    console.log(`[ws] display connected ${message.displayId}`);

    if (display.currentSceneId) {
      const scene = await this.store.getScene(context.user.id, display.currentSceneId);
      if (scene) {
        const resolved = await this.store.resolveSceneAssets(context.user.id, scene.scene);
        this.pushCurrentScene(context.user.id, display.id, resolved, display.currentSceneVersion);
      }
    }

    return message.displayId;
  }

  private async handleDisplayMessage(context: AuthContext, message: DisplayToServerMessage): Promise<void> {
    if (message.type === "heartbeat") {
      const display = await this.store.updateHeartbeat(context.user.id, message.displayId);
      if (display) this.broadcastStatus(display);
      return;
    }

    if (message.type === "render_ack") {
      const display = await this.store.saveRenderAck(context.user.id, message.displayId, message.sceneVersion);
      if (display) this.broadcastStatus(display);
      return;
    }

    if (message.type === "render_error") {
      const display = await this.store.saveRenderError(context.user.id, message.displayId, message.message, message.sceneVersion);
      console.error(`[render_error] ${message.displayId}: ${message.message}`);
      if (display) this.broadcastStatus(display);
    }
  }

  private async acceptController(socket: WebSocket, context: AuthContext): Promise<void> {
    this.controllerClients.set(socket, { ownerUserId: context.user.id, socket });
    this.sendToControllerSocket(socket, {
      type: "status_snapshot",
      displays: (await this.store.listDisplays(context.user.id)).map(stripOwner)
    });

    socket.on("message", (raw) => {
      void (async () => {
        const parsed = parseJsonMessage(raw.toString());
        if (!parsed.ok) {
          this.sendToControllerSocket(socket, { type: "server_error", message: parsed.errors.join(", ") });
          return;
        }
        await this.handleControllerMessage(context, socket, parsed.value as ControllerToServerMessage);
      })();
    });

    socket.on("close", () => {
      this.controllerClients.delete(socket);
    });
  }

  private async handleControllerMessage(context: AuthContext, socket: WebSocket, message: ControllerToServerMessage): Promise<void> {
    if (message.type === "request_status" || message.type === "controller_hello") {
      this.sendToControllerSocket(socket, {
        type: "status_snapshot",
        displays: (await this.store.listDisplays(context.user.id)).map(stripOwner)
      });
      return;
    }

    if (message.type === "send_scene") {
      const result = validateScene(message.scene);
      if (!result.ok || !result.value) {
        this.sendToControllerSocket(socket, { type: "server_error", message: result.errors.join(", ") });
        return;
      }
      if (message.target === "all") {
        await this.broadcastScene(context.user.id, result.value, message.title);
      } else {
        await this.sendSceneToDisplay(context.user.id, message.target.displayId, result.value, message.title);
      }
    }
  }

  private pushCurrentScene(ownerUserId: string, displayId: string, scene: Scene, sceneVersion: number): boolean {
    const client = this.displayClients.get(clientKey(ownerUserId, displayId));
    if (!client || client.socket.readyState !== WebSocket.OPEN) return false;
    this.sendToDisplaySocket(client.socket, {
      type: "scene_update",
      displayId,
      sceneVersion,
      scene,
      sentAt: new Date().toISOString()
    });
    return true;
  }

  private sendToDisplaySocket(socket: WebSocket, message: ServerToDisplayMessage): void {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }

  private sendToControllers(ownerUserId: string, message: ServerToControllerMessage): void {
    for (const client of this.controllerClients.values()) {
      if (client.ownerUserId === ownerUserId) this.sendToControllerSocket(client.socket, message);
    }
  }

  private sendToControllerSocket(socket: WebSocket, message: ServerToControllerMessage): void {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }

  private async expireStaleDisplays(): Promise<void> {
    const staleDisplays = await this.store.expireStaleDisplays(this.config.heartbeatTimeoutMs);
    for (const display of staleDisplays) {
      this.displayClients.delete(clientKey(display.ownerUserId, display.id));
      this.broadcastStatus(display);
    }
  }
}

const clientKey = (ownerUserId: string, displayId: string): string => `${ownerUserId}:${displayId}`;

const stripOwner = (display: DisplayRecord) => ({
  id: display.id,
  name: display.name,
  groupName: display.groupName,
  positionLabel: display.positionLabel,
  online: display.online,
  currentSceneId: display.currentSceneId,
  currentSceneVersion: display.currentSceneVersion,
  lastHeartbeatAt: display.lastHeartbeatAt,
  lastAckVersion: display.lastAckVersion,
  lastError: display.lastError,
  appVersion: display.appVersion,
  capabilities: display.capabilities
});
