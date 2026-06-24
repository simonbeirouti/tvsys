import {
  DEFAULT_CANVAS,
  type DisplayCapabilities,
  type RenderAckMessage,
  type RenderErrorMessage,
  type Scene,
  type ServerToDisplayMessage
} from "@tvsys/shared";
import { buildDisplayWsUrlWithToken, nextReconnectDelay, type DisplayConfig } from "./connection.js";

export interface DisplaySocketOptions {
  config: DisplayConfig;
  getAccessToken: () => Promise<string | undefined>;
  onScene: (scene: Scene, sceneVersion: number) => Promise<void>;
  onStatus: (status: string) => void;
}

export interface DisplaySocketHandle {
  close: () => void;
}

const APP_VERSION = "0.1.0";

export const connectDisplaySocket = (options: DisplaySocketOptions): DisplaySocketHandle => {
  let closed = false;
  let socket: WebSocket | undefined;
  let reconnectAttempt = 0;
  let heartbeatTimer: number | undefined;

  const open = async () => {
    const accessToken = await options.getAccessToken();
    if (!accessToken) {
      options.onStatus("Signed out");
      return;
    }
    const wsUrl = buildDisplayWsUrlWithToken(options.config.serverUrl, accessToken);
    socket = new WebSocket(wsUrl);
    options.onStatus("Connecting");

    socket.onopen = () => {
      reconnectAttempt = 0;
      options.onStatus("Connected");
      socket?.send(
        JSON.stringify({
          type: "register_display",
          displayId: options.config.displayId,
          installationId: options.config.installationId,
          appVersion: APP_VERSION,
          capabilities: detectCapabilities()
        })
      );
      heartbeatTimer = window.setInterval(sendHeartbeat, 30_000);
      sendHeartbeat();
    };

    socket.onmessage = (event) => {
      void handleMessage(event.data);
    };

    socket.onclose = (event) => {
      if (heartbeatTimer) window.clearInterval(heartbeatTimer);
      if (closed) return;
      reconnectAttempt += 1;
      const delay = nextReconnectDelay(reconnectAttempt);
      options.onStatus(`Disconnected (${event.reason || event.code}); retry in ${Math.round(delay / 1000)}s`);
      window.setTimeout(() => void open(), delay);
    };

    socket.onerror = () => {
      options.onStatus("Connection error");
    };
  };

  const sendHeartbeat = () => {
    send({
      type: "heartbeat",
      displayId: options.config.displayId,
      at: new Date().toISOString()
    });
  };

  const handleMessage = async (raw: string) => {
    const message = JSON.parse(raw) as ServerToDisplayMessage;
    if (message.type === "scene_update") {
      try {
        await options.onScene(message.scene, message.sceneVersion);
        send({
          type: "render_ack",
          displayId: options.config.displayId,
          sceneVersion: message.sceneVersion,
          renderedAt: new Date().toISOString()
        });
      } catch (error) {
        const renderError: RenderErrorMessage = {
          type: "render_error",
          displayId: options.config.displayId,
          sceneVersion: message.sceneVersion,
          message: error instanceof Error ? error.message : "Unknown render error",
          occurredAt: new Date().toISOString()
        };
        send(renderError);
      }
    }
  };

  const send = (message: RenderAckMessage | RenderErrorMessage | { type: "heartbeat"; displayId: string; at: string }) => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  };

  void open();

  return {
    close: () => {
      closed = true;
      if (heartbeatTimer) window.clearInterval(heartbeatTimer);
      socket?.close();
    }
  };
};

const detectCapabilities = (): DisplayCapabilities => ({
  canvas: { ...DEFAULT_CANVAS },
  supportsVideo: Boolean(document.createElement("video").canPlayType),
  supportsPixi: true
});
