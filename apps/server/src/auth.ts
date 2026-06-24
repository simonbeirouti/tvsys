import { bearerAuthorization, extractBearerToken, type AuthContext, type AuthenticatedUser, type CafeRow } from "@tvsys/shared";
import type { DisplayTokenPayload } from "./activation.js";
import type { ServerConfig } from "./config.js";
import type { Store } from "./store.js";

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export class AuthService {
  constructor(
    private readonly config: ServerConfig,
    private readonly store: Store
  ) {}

  async authenticateHeader(header: string | string[] | undefined): Promise<AuthContext> {
    const token = extractBearerToken(header);
    if (!token) throw new HttpError(401, "Missing bearer token");
    return this.authenticateToken(token);
  }

  async authenticateToken(token: string | undefined): Promise<AuthContext> {
    if (!token) throw new HttpError(401, "Missing bearer token");
    const response = await fetch(`${this.config.supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
      headers: {
        apikey: this.config.supabasePublishableKey,
        authorization: bearerAuthorization(token)
      }
    });
    if (!response.ok) throw new HttpError(401, "Invalid bearer token");
    const body = (await response.json()) as { id?: string; email?: string };
    if (!body.id) throw new HttpError(401, "Invalid bearer token");
    const user: AuthenticatedUser = { id: body.id, email: body.email };
    const cafe: CafeRow = await this.store.ensureCafe(user);
    return { user, cafe };
  }

  async authenticateDisplayToken(token: string | undefined): Promise<AuthContext> {
    const payload = await this.authenticateDisplayTokenPayload(token);
    const user: AuthenticatedUser = { id: payload.ownerUserId };
    const cafe: CafeRow = await this.store.ensureCafe(user);
    return { user, cafe };
  }

  async authenticateDisplayHeader(header: string | string[] | undefined): Promise<{ context: AuthContext; display: DisplayTokenPayload }> {
    const payload = await this.authenticateDisplayTokenPayload(extractBearerToken(header));
    const user: AuthenticatedUser = { id: payload.ownerUserId };
    const cafe: CafeRow = await this.store.ensureCafe(user);
    return { context: { user, cafe }, display: payload };
  }

  private async authenticateDisplayTokenPayload(token: string | undefined): Promise<DisplayTokenPayload> {
    if (!token) throw new HttpError(401, "Missing display token");
    const session = await this.store.authenticateDisplaySession(token);
    if (!session) throw new HttpError(401, "Invalid display token");
    return {
      ownerUserId: session.ownerUserId,
      displayId: session.displayId,
      installationId: session.installationId
    };
  }
}
