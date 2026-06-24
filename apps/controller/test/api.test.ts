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
    const url = await api.uploadAsset(new File(["body"], "menu.png", { type: "image/png" }));

    expect(url).toBe("https://project.supabase.co/storage/v1/object/sign/tvsys-assets/user/asset-1/menu.png?token=signed");
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
    const url = await api.uploadAsset(new File(["body"], "menu.png", { type: "image/png" }));

    expect(url).toBe("http://localhost:8787/assets/asset-1");
  });
});
