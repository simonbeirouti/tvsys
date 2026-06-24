import { describe, expect, it } from "vitest";
import { HttpError } from "../src/auth.js";

describe("server auth errors", () => {
  it("carries HTTP status codes", () => {
    const error = new HttpError(401, "Missing bearer token");

    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Missing bearer token");
  });
});
