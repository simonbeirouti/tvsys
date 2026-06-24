import type http from "node:http";
import { describe, expect, it } from "vitest";
import { createRequestHandler } from "../src/http.js";

describe("http activity routes", () => {
  it("returns owner-scoped display activity", async () => {
    const response = await requestWithStore({
      listDisplayActivity: async () => [
        {
          id: "delivery_1",
          ownerUserId: "user_1",
          deviceId: "display_1",
          sceneId: "scene_1",
          sceneVersion: 3,
          deliveredAt: "2026-06-25T00:00:00.000Z"
        }
      ]
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      activity: [
        {
          id: "delivery_1",
          ownerUserId: "user_1",
          deviceId: "display_1",
          sceneId: "scene_1",
          sceneVersion: 3,
          deliveredAt: "2026-06-25T00:00:00.000Z"
        }
      ]
    });
  });

  it("returns 404 for unknown display activity", async () => {
    const response = await requestWithStore({
      listDisplayActivity: async () => undefined
    });

    expect(response.statusCode).toBe(404);
  });

  it("refreshes display sessions through the TV endpoint", async () => {
    const response = await requestWithStore(
      {
        rotateDisplaySession: async () => ({
          displayToken: "display_new",
          expiresAt: "2026-09-01T00:00:00.000Z"
        })
      },
      {
        authorization: "Bearer display_old",
        method: "POST",
        url: "/api/tv/session/refresh"
      }
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      displayToken: "display_new",
      expiresAt: "2026-09-01T00:00:00.000Z"
    });
  });
});

const requestWithStore = async (
  store: Record<string, unknown>,
  input: { authorization?: string; method?: string; url?: string } = {}
): Promise<MockResponse> => {
  const auth = {
    authenticateHeader: async () => ({ user: { id: "user_1" }, cafe: { id: "cafe_1", owner_user_id: "user_1", name: "Cafe" } })
  };
  const handler = createRequestHandler(store as never, auth as never, () => undefined);
  const request = {
    method: input.method ?? "GET",
    url: input.url ?? "/api/displays/display_1/activity",
    headers: { host: "localhost", authorization: input.authorization ?? "Bearer token" }
  } as http.IncomingMessage;
  const response = new MockResponse();
  await handler(request, response as unknown as http.ServerResponse);
  return response;
};

class MockResponse {
  body = "";
  headers = new Map<string, number | string | string[]>();
  statusCode = 200;

  setHeader(name: string, value: number | string | string[]): this {
    this.headers.set(name.toLowerCase(), value);
    return this;
  }

  writeHead(statusCode: number): this {
    this.statusCode = statusCode;
    return this;
  }

  end(payload?: string): this {
    this.body = payload ?? "";
    return this;
  }
}
