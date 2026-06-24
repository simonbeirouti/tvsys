import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const serverEnvPath = resolve(dirname(fileURLToPath(import.meta.url)), "../.env");

if (existsSync(serverEnvPath)) {
  process.loadEnvFile(serverEnvPath);
}

export interface ServerConfig {
  port: number;
  host: string;
  unauthenticatedSocketTimeoutMs: number;
  heartbeatTimeoutMs: number;
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseServiceRoleKey: string;
  supabaseAssetBucket: string;
  supabaseSignedUrlTtlSeconds: number;
}

export const loadConfig = (): ServerConfig => ({
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? "0.0.0.0",
  unauthenticatedSocketTimeoutMs: Number(process.env.UNAUTHENTICATED_SOCKET_TIMEOUT_MS ?? 5000),
  heartbeatTimeoutMs: Number(process.env.HEARTBEAT_TIMEOUT_MS ?? 90_000),
  supabaseUrl: requireEnv("SUPABASE_URL"),
  supabasePublishableKey: requireEnv("SUPABASE_PUBLISHABLE_KEY"),
  supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  supabaseAssetBucket: process.env.SUPABASE_ASSET_BUCKET ?? "tvsys-assets",
  supabaseSignedUrlTtlSeconds: Number(process.env.SUPABASE_SIGNED_URL_TTL_SECONDS ?? 3600)
});

const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};
