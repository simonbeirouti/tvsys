import { describe, expect, it, vi } from "vitest";
import { ActivationService } from "../src/activation.js";

const capabilities = {
  canvas: { width: 1920, height: 1080 },
  supportsVideo: true,
  supportsPixi: true
};

describe("activation display sessions", () => {
  it("creates a display session when claiming a new TV", async () => {
    const activation = new ActivationService();
    const { code } = activation.create({ appVersion: "0.1.0", capabilities, installationId: "install-1", tvUser: { id: "tv-user" } });
    const store = {
      registerTv: vi.fn(async () => ({ id: "display-1", ownerUserId: "owner-1", installationId: "install-1", online: true, currentSceneVersion: 0 })),
      createDisplaySession: vi.fn(async () => ({
        displayToken: "display_token",
        expiresAt: "2026-09-01T00:00:00.000Z",
        session: {}
      }))
    };

    await expect(activation.claim(store as never, { id: "owner-1" }, code)).resolves.toMatchObject({
      display: { id: "display-1" },
      displayToken: "display_token",
      displayTokenExpiresAt: "2026-09-01T00:00:00.000Z"
    });
    expect(store.registerTv).toHaveBeenCalled();
    expect(store.createDisplaySession).toHaveBeenCalledWith("owner-1", "display-1");
  });

  it("relinks an activation to an existing display", async () => {
    const activation = new ActivationService();
    const { code } = activation.create({ appVersion: "0.1.0", capabilities, installationId: "install-2", tvUser: { id: "tv-user" } });
    const store = {
      relinkTv: vi.fn(async () => ({ id: "display-2", ownerUserId: "owner-1", installationId: "install-2", online: true, currentSceneVersion: 0 })),
      createDisplaySession: vi.fn(async () => ({
        displayToken: "display_relinked",
        expiresAt: "2026-09-01T00:00:00.000Z",
        session: {}
      }))
    };

    await activation.claim(store as never, { id: "owner-1" }, code, "display-2");

    expect(store.relinkTv).toHaveBeenCalledWith({
      ownerUserId: "owner-1",
      displayId: "display-2",
      installationId: "install-2",
      appVersion: "0.1.0",
      capabilities
    });
    expect(store.createDisplaySession).toHaveBeenCalledWith("owner-1", "display-2");
  });
});
