import crypto from "node:crypto";
import type { AuthenticatedUser, DisplayCapabilities } from "@tvsys/shared";
import type { ServerConfig } from "./config.js";
import type { DisplayRecord, Store } from "./store.js";

export interface DisplayTokenPayload {
  displayId: string;
  installationId: string;
  ownerUserId: string;
}

interface PendingActivation {
  appVersion: string;
  capabilities: DisplayCapabilities;
  code: string;
  createdAt: number;
  display?: DisplayRecord;
  displayToken?: string;
  installationId: string;
  tvUserId: string;
}

const ACTIVATION_TTL_MS = 10 * 60 * 1000;

export class ActivationService {
  private readonly pendingByCode = new Map<string, PendingActivation>();
  private readonly codeByInstallation = new Map<string, string>();

  constructor(private readonly config: ServerConfig) {}

  create(input: {
    appVersion: string;
    capabilities: DisplayCapabilities;
    installationId: string;
    tvUser: AuthenticatedUser;
  }): { code: string; expiresAt: string } {
    this.pruneExpired();
    const existingCode = this.codeByInstallation.get(input.installationId);
    if (existingCode) this.pendingByCode.delete(existingCode);

    const code = this.createCode();
    const activation: PendingActivation = {
      appVersion: input.appVersion,
      capabilities: input.capabilities,
      code,
      createdAt: Date.now(),
      installationId: input.installationId,
      tvUserId: input.tvUser.id
    };
    this.pendingByCode.set(code, activation);
    this.codeByInstallation.set(input.installationId, code);
    return { code, expiresAt: new Date(activation.createdAt + ACTIVATION_TTL_MS).toISOString() };
  }

  async claim(store: Store, ownerUser: AuthenticatedUser, code: string): Promise<{ display: DisplayRecord }> {
    this.pruneExpired();
    const activation = this.pendingByCode.get(normalizeCode(code));
    if (!activation) throw new Error("Unknown or expired linking code");

    const display = await store.registerTv({
      ownerUserId: ownerUser.id,
      installationId: activation.installationId,
      name: "New TV",
      appVersion: activation.appVersion,
      capabilities: activation.capabilities
    });
    activation.display = display;
    activation.displayToken = this.signDisplayToken({
      ownerUserId: ownerUser.id,
      displayId: display.id,
      installationId: activation.installationId
    });
    return { display };
  }

  status(tvUser: AuthenticatedUser, code: string): { display?: DisplayRecord; displayToken?: string; status: "claimed" | "pending" } {
    this.pruneExpired();
    const activation = this.pendingByCode.get(normalizeCode(code));
    if (!activation || activation.tvUserId !== tvUser.id) throw new Error("Unknown or expired linking code");
    if (activation.display && activation.displayToken) {
      this.pendingByCode.delete(activation.code);
      this.codeByInstallation.delete(activation.installationId);
      return { status: "claimed", display: activation.display, displayToken: activation.displayToken };
    }
    return { status: "pending" };
  }

  signDisplayToken(payload: DisplayTokenPayload): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const signature = crypto.createHmac("sha256", this.config.supabaseServiceRoleKey).update(encodedPayload).digest("base64url");
    return `display_${encodedPayload}.${signature}`;
  }

  verifyDisplayToken(token: string): DisplayTokenPayload | undefined {
    if (!token.startsWith("display_")) return undefined;
    const [encodedPayload, signature] = token.slice("display_".length).split(".");
    if (!encodedPayload || !signature) return undefined;
    const expected = crypto.createHmac("sha256", this.config.supabaseServiceRoleKey).update(encodedPayload).digest("base64url");
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (signatureBuffer.byteLength !== expectedBuffer.byteLength || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return undefined;
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<DisplayTokenPayload>;
    if (!payload.ownerUserId || !payload.displayId || !payload.installationId) return undefined;
    return { ownerUserId: payload.ownerUserId, displayId: payload.displayId, installationId: payload.installationId };
  }

  private createCode(): string {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
      if (!this.pendingByCode.has(code)) return code;
    }
    return crypto.randomUUID().slice(0, 6).toUpperCase();
  }

  private pruneExpired(): void {
    const cutoff = Date.now() - ACTIVATION_TTL_MS;
    for (const [code, activation] of this.pendingByCode) {
      if (activation.createdAt >= cutoff) continue;
      this.pendingByCode.delete(code);
      this.codeByInstallation.delete(activation.installationId);
    }
  }
}

export const normalizeCode = (code: string): string => code.replace(/\D/g, "").slice(0, 6);
