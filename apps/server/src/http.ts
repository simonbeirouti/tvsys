import http from "node:http";
import { validateScene, type AuthContext, type Scene } from "@tvsys/shared";
import { normalizeCode, type ActivationService } from "./activation.js";
import { HttpError, type AuthService } from "./auth.js";
import type { Store } from "./store.js";
import type { SignageHub } from "./ws.js";

export const createRequestHandler = (store: Store, auth: AuthService, activation: ActivationService, getHub: () => SignageHub | undefined) => {
  return async (request: http.IncomingMessage, response: http.ServerResponse) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

      if (request.method === "OPTIONS") return sendNoContent(response);
      setCors(response);

      if (request.method === "GET" && url.pathname === "/api/health") {
        return sendJson(response, { ok: true, at: new Date().toISOString() });
      }

      if (request.method === "GET" && url.pathname === "/api/tv/current-scene") {
        const { context, display } = await auth.authenticateDisplayHeader(request.headers.authorization);
        const current = await store.getCurrentSceneForDisplay(context.user.id, display.displayId);
        return sendJson(response, current ?? { scene: null, sceneVersion: 0 });
      }

      const context = await auth.authenticateHeader(request.headers.authorization);

      if (request.method === "GET" && url.pathname === "/api/me") {
        return sendJson(response, { user: context.user, cafe: context.cafe });
      }

      if (request.method === "GET" && url.pathname === "/api/displays") {
        return sendJson(response, { displays: await store.listDisplays(context.user.id) });
      }

      if (request.method === "POST" && url.pathname === "/api/displays") {
        const body = await readJson<{ id?: string; name?: string; groupName?: string; positionLabel?: string }>(request);
        const display = await store.createDisplay(context.user.id, body);
        getHub()?.broadcastStatus(display);
        return sendJson(response, { display }, 201);
      }

      if (request.method === "POST" && url.pathname === "/api/tv/register") {
        const body = await readJson<{
          installationId: string;
          name?: string;
          groupName?: string;
          positionLabel?: string;
          appVersion: string;
          capabilities: unknown;
        }>(request);
        if (!body.installationId?.trim()) return sendJson(response, { error: "Installation id is required" }, 400);
        if (!body.appVersion?.trim()) return sendJson(response, { error: "App version is required" }, 400);
        const capabilities = body.capabilities as Parameters<typeof store.registerTv>[0]["capabilities"];
        const display = await store.registerTv({
          ownerUserId: context.user.id,
          installationId: body.installationId.trim(),
          name: body.name,
          groupName: body.groupName,
          positionLabel: body.positionLabel,
          appVersion: body.appVersion,
          capabilities
        });
        getHub()?.broadcastStatus(display);
        return sendJson(response, { display }, 201);
      }

      if (request.method === "POST" && url.pathname === "/api/tv/activation/start") {
        const body = await readJson<{
          installationId: string;
          appVersion: string;
          capabilities: unknown;
        }>(request);
        if (!body.installationId?.trim()) return sendJson(response, { error: "Installation id is required" }, 400);
        if (!body.appVersion?.trim()) return sendJson(response, { error: "App version is required" }, 400);
        const result = activation.create({
          tvUser: context.user,
          installationId: body.installationId.trim(),
          appVersion: body.appVersion,
          capabilities: body.capabilities as Parameters<typeof activation.create>[0]["capabilities"]
        });
        return sendJson(response, result, 201);
      }

      if (request.method === "GET" && url.pathname === "/api/tv/activation/status") {
        const code = normalizeCode(url.searchParams.get("code") ?? "");
        if (!code) return sendJson(response, { error: "Linking code is required" }, 400);
        return sendJson(response, activation.status(context.user, code));
      }

      if (request.method === "POST" && url.pathname === "/api/tv/activation/claim") {
        const body = await readJson<{ code: string }>(request);
        const code = normalizeCode(body.code ?? "");
        if (!code) return sendJson(response, { error: "Linking code is required" }, 400);
        const result = await activation.claim(store, context.user, code);
        getHub()?.broadcastStatus(result.display);
        return sendJson(response, result, 201);
      }

      const displayMatch = url.pathname.match(/^\/api\/displays\/([^/]+)$/);
      if (displayMatch && request.method === "PATCH") {
        const displayId = decodeURIComponent(displayMatch[1]);
        const body = await readJson<{ name?: string; groupName?: string; positionLabel?: string }>(request);
        const display = await store.updateDisplay(context.user.id, displayId, body);
        if (!display) return sendJson(response, { error: `Unknown display: ${displayId}` }, 404);
        getHub()?.broadcastStatus(display);
        return sendJson(response, { display });
      }

      if (request.method === "GET" && url.pathname === "/api/scenes") {
        return sendJson(response, { scenes: await store.listScenes(context.user.id) });
      }

      if (request.method === "POST" && url.pathname === "/api/scenes") {
        const body = await readJson<{ scene: Scene; title?: string }>(request);
        const result = validateScene(body.scene);
        if (!result.ok || !result.value) return sendJson(response, { errors: result.errors }, 400);
        return sendJson(response, { scene: await store.saveScene(context.user.id, result.value, body.title) }, 201);
      }

      const displaySceneMatch = url.pathname.match(/^\/api\/displays\/([^/]+)\/scene$/);
      if (request.method === "POST" && displaySceneMatch) {
        const displayId = decodeURIComponent(displaySceneMatch[1]);
        const body = await readJson<{ scene: Scene; title?: string }>(request);
        const result = validateScene(body.scene);
        if (!result.ok || !result.value) return sendJson(response, { errors: result.errors }, 400);
        const delivery = await getHub()?.sendSceneToDisplay(context.user.id, displayId, result.value, body.title);
        if (!delivery) return sendJson(response, { error: `Unknown display: ${displayId}` }, 404);
        return sendJson(response, delivery);
      }

      if (request.method === "POST" && url.pathname === "/api/broadcast/scene") {
        const body = await readJson<{ scene: Scene; title?: string }>(request);
        const result = validateScene(body.scene);
        if (!result.ok || !result.value) return sendJson(response, { errors: result.errors }, 400);
        const deliveries = (await getHub()?.broadcastScene(context.user.id, result.value, body.title)) ?? [];
        return sendJson(response, { deliveries });
      }

      const assetUploadMatch = url.pathname.match(/^\/api\/assets\/([^/]+)$/);
      if (request.method === "PUT" && assetUploadMatch) {
        const filename = decodeURIComponent(assetUploadMatch[1]);
        const mimeType = request.headers["content-type"] ?? "application/octet-stream";
        const body = await readBuffer(request);
        const asset = await store.saveAsset(context.user.id, { filename, mimeType, body });
        return sendJson(response, { asset }, 201);
      }

      return sendJson(response, { error: "Not found" }, 404);
    } catch (error) {
      if (error instanceof HttpError) return sendJson(response, { error: error.message }, error.statusCode);
      const message = error instanceof Error ? error.message : "Unexpected server error";
      console.error("[http] request failed", message);
      return sendJson(response, { error: message }, 500);
    }
  };
};

export const sendJson = (response: http.ServerResponse, payload: unknown, statusCode = 200): void => {
  setCors(response);
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
};

const readJson = async <T>(request: http.IncomingMessage): Promise<T> => {
  const buffer = await readBuffer(request);
  return JSON.parse(buffer.toString("utf8")) as T;
};

const readBuffer = async (request: http.IncomingMessage): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const sendNoContent = (response: http.ServerResponse): void => {
  setCors(response);
  response.writeHead(204);
  response.end();
};

const setCors = (response: http.ServerResponse): void => {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,OPTIONS");
  response.setHeader("access-control-allow-headers", "authorization,content-type");
};
