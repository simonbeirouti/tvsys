import { afterEach, describe, expect, it, vi } from "vitest";
import { ControllerApi } from "../src/api.js";

describe("ControllerApi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps absolute Supabase signed asset URLs intact", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          asset: {
            id: "asset-1",
            filename: "menu.png",
            mimeType: "image/png",
            url: "https://project.supabase.co/storage/v1/object/sign/tvsys-assets/user/asset-1/menu.png?token=signed",
            sizeBytes: 123
          }
        })
      )
    );

    const api = new ControllerApi("http://localhost:8787", async () => "access-token");
    const asset = await api.uploadAsset(new File(["body"], "menu.png", { type: "image/png" }));

    expect(asset).toMatchObject({
      id: "asset-1",
      url: "https://project.supabase.co/storage/v1/object/sign/tvsys-assets/user/asset-1/menu.png?token=signed"
    });
  });

  it("prefixes relative asset URLs with the TVSys server URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          asset: {
            id: "asset-1",
            filename: "menu.png",
            mimeType: "image/png",
            url: "/assets/asset-1",
            sizeBytes: 123
          }
        })
      )
    );

    const api = new ControllerApi("http://localhost:8787", async () => "access-token");
    const asset = await api.uploadAsset(new File(["body"], "menu.png", { type: "image/png" }));

    expect(asset).toMatchObject({
      id: "asset-1",
      url: "http://localhost:8787/assets/asset-1"
    });
  });

  it("sends an optional display id when relinking a TV", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        display: {
          id: "display-1",
          online: true,
          currentSceneVersion: 0
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const api = new ControllerApi("http://localhost:8787", async () => "access-token");
    await api.linkTv("123456", "display-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8787/api/tv/activation/claim",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ code: "123456", displayId: "display-1" })
      })
    );
  });
});
