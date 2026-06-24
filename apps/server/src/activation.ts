import crypto from "node:crypto";
import type { AuthenticatedUser, DisplayCapabilities } from "@tvsys/shared";
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
  displayTokenExpiresAt?: string;
  installationId: string;
  tvUserId: string;
}

const ACTIVATION_TTL_MS = 10 * 60 * 1000;

export class ActivationService {
  private readonly pendingByCode = new Map<string, PendingActivation>();
  private readonly codeByInstallation = new Map<string, string>();

  constructor() {}

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

  async claim(store: Store, ownerUser: AuthenticatedUser, code: string, displayId?: string): Promise<{ display: DisplayRecord; displayToken: string; displayTokenExpiresAt: string }> {
    this.pruneExpired();
    const activation = this.pendingByCode.get(normalizeCode(code));
    if (!activation) throw new Error("Unknown or expired linking code");

    const display = displayId
      ? await store.relinkTv({
          ownerUserId: ownerUser.id,
          displayId,
          installationId: activation.installationId,
          appVersion: activation.appVersion,
          capabilities: activation.capabilities
        })
      : await store.registerTv({
          ownerUserId: ownerUser.id,
          installationId: activation.installationId,
          name: "New TV",
          appVersion: activation.appVersion,
          capabilities: activation.capabilities
        });
    if (!display) throw new Error(`Unknown display: ${displayId}`);
    const session = await store.createDisplaySession(ownerUser.id, display.id);
    if (!session) throw new Error(`Could not create display session for ${display.id}`);
    activation.display = display;
    activation.displayToken = session.displayToken;
    activation.displayTokenExpiresAt = session.expiresAt;
    return { display, displayToken: session.displayToken, displayTokenExpiresAt: session.expiresAt };
  }

  status(tvUser: AuthenticatedUser, code: string): { display?: DisplayRecord; displayToken?: string; displayTokenExpiresAt?: string; status: "claimed" | "pending" } {
    this.pruneExpired();
    const activation = this.pendingByCode.get(normalizeCode(code));
    if (!activation || activation.tvUserId !== tvUser.id) throw new Error("Unknown or expired linking code");
    if (activation.display && activation.displayToken && activation.displayTokenExpiresAt) {
      this.pendingByCode.delete(activation.code);
      this.codeByInstallation.delete(activation.installationId);
      return {
        status: "claimed",
        display: activation.display,
        displayToken: activation.displayToken,
        displayTokenExpiresAt: activation.displayTokenExpiresAt
      };
    }
    return { status: "pending" };
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
