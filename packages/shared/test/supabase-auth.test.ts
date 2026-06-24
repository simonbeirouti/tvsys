import { describe, expect, it } from "vitest";
import { bearerAuthorization, extractBearerToken, isSessionExpired } from "../src/index.js";

describe("Supabase auth helpers", () => {
  it("extracts bearer tokens", () => {
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
    expect(extractBearerToken("bearer abc123")).toBe("abc123");
    expect(extractBearerToken("Basic abc123")).toBeUndefined();
  });

  it("builds bearer authorization headers", () => {
    expect(bearerAuthorization("token")).toBe("Bearer token");
  });

  it("detects expired sessions with skew", () => {
    expect(isSessionExpired({ expires_at: Math.floor(Date.now() / 1000) - 1 })).toBe(true);
    expect(isSessionExpired({ expires_at: Math.floor(Date.now() / 1000) + 3600 })).toBe(false);
  });
});
