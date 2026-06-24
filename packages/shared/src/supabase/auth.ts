import type { AuthenticatedUser } from "./ownership.js";

export interface SupabaseSession {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  token_type?: string;
  user?: AuthenticatedUser & Record<string, unknown>;
}

export interface OtpVerificationResponse {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  token_type?: string;
  user?: AuthenticatedUser & Record<string, unknown>;
}

export const extractBearerToken = (value: string | string[] | null | undefined): string | undefined => {
  const header = Array.isArray(value) ? value[0] : value;
  if (!header) return undefined;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || undefined;
};

export const bearerAuthorization = (accessToken: string): string => `Bearer ${accessToken}`;

export const isSessionExpired = (session: Pick<SupabaseSession, "expires_at"> | undefined, skewSeconds = 60): boolean => {
  if (!session?.expires_at) return false;
  return session.expires_at <= Math.floor(Date.now() / 1000) + skewSeconds;
};

export const getSessionAccessToken = (session: Pick<SupabaseSession, "access_token"> | undefined): string | undefined =>
  session?.access_token?.trim() || undefined;
