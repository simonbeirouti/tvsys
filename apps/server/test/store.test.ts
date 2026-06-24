import { describe, expect, it } from "vitest";
import { AuthService, HttpError } from "../src/auth.js";

describe("server auth errors", () => {
  it("carries HTTP status codes", () => {
    const error = new HttpError(401, "Missing bearer token");

    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Missing bearer token");
  });

  it("authenticates display sessions through the store", async () => {
    const auth = new AuthService(
      {
        supabaseUrl: "http://supabase.test",
        supabasePublishableKey: "publishable",
        supabaseServiceRoleKey: "secret"
      } as never,
      {
        authenticateDisplaySession: async (token: string) =>
          token === "display_valid"
            ? {
                ownerUserId: "owner-1",
                displayId: "display-1",
                installationId: "install-1",
                session: {}
              }
            : undefined,
        ensureCafe: async () => ({ id: "cafe-1", owner_user_id: "owner-1", name: "Cafe" })
      } as never
    );

    await expect(auth.authenticateDisplayToken("display_valid")).resolves.toMatchObject({ user: { id: "owner-1" } });
    await expect(auth.authenticateDisplayToken("display_invalid")).rejects.toMatchObject({ statusCode: 401 });
  });
});
