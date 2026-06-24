import crypto from "node:crypto";
import { createTvsysSupabaseClient, normalizeScene, type AssetRow, type AuthenticatedUser, type CafeRow, type DeviceRow, type DisplayCapabilities, type OwnedAsset, type OwnedDisplayStatus, type OwnedScene, type Scene, type SceneRow } from "@tvsys/shared";
import { assetFromRow, displayStatusFromDeviceRow, sceneFromRow } from "@tvsys/shared";
import type { ServerConfig } from "./config.js";

export type DisplayRecord = OwnedDisplayStatus;
export type SceneRecord = OwnedScene;
export type AssetRecord = OwnedAsset;

export class Store {
  private readonly supabase: ReturnType<typeof createTvsysSupabaseClient>;
  private readonly db: any;
  private readonly supabaseUrl: string;

  constructor(private readonly config: ServerConfig) {
    this.supabaseUrl = config.supabaseUrl.replace(/\/$/, "");
    this.supabase = createTvsysSupabaseClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    this.db = this.supabase as any;
  }

  close(): void {}

  async ensureCafe(user: AuthenticatedUser): Promise<CafeRow> {
    const existing = await this.selectOne<CafeRow>("cafes", { owner_user_id: user.id });
    if (existing) return existing;
    const name = user.email ? `${user.email.split("@")[0]} Cafe` : "Cafe";
    return this.insertOne<CafeRow>("cafes", { owner_user_id: user.id, name });
  }

  async createDisplay(
    ownerUserId: string,
    input: { id?: string; name?: string; groupName?: string; positionLabel?: string; installationId?: string }
  ): Promise<DisplayRecord> {
    const id = input.id?.trim() || crypto.randomUUID();
    const inputRow = {
      id,
      owner_user_id: ownerUserId,
      installation_id: input.installationId ?? null,
      name: input.name ?? null,
      group_name: input.groupName ?? null,
      position_label: input.positionLabel ?? null
    };
    const { data, error } = await this.db.from("devices").insert(inputRow).select("*").single();
    if (error) {
      if (!isUniqueViolation(error)) throw new Error(error.message);
      const existing = await this.selectOne<DeviceRow>("devices", { id, owner_user_id: ownerUserId });
      if (existing) return displayStatusFromDeviceRow(existing);
      throw new Error(`Display id is already in use: ${id}`);
    }
    const row = data as DeviceRow;
    return displayStatusFromDeviceRow(row);
  }

  async registerTv(input: {
    ownerUserId: string;
    installationId: string;
    name?: string;
    groupName?: string;
    positionLabel?: string;
    appVersion: string;
    capabilities: DisplayCapabilities;
  }): Promise<DisplayRecord> {
    const existing = await this.findDeviceByInstallation(input.ownerUserId, input.installationId);
    if (existing) return this.updateRegisteredTv(existing, input);

    const now = new Date().toISOString();
    const rowInput = {
      id: crypto.randomUUID(),
      owner_user_id: input.ownerUserId,
      installation_id: input.installationId,
      name: input.name ?? "New TV",
      group_name: input.groupName ?? null,
      position_label: input.positionLabel ?? null,
      online: true,
      last_heartbeat_at: now,
      app_version: input.appVersion,
      capabilities_json: input.capabilities,
      last_error: null,
      updated_at: now
    };
    const { data, error } = await this.db.from("devices").insert(rowInput).select("*").single();
    if (error) {
      if (!isUniqueViolation(error)) throw new Error(error.message);
      const raced = await this.findDeviceByInstallation(input.ownerUserId, input.installationId);
      if (raced) return this.updateRegisteredTv(raced, input);
      throw new Error(error.message);
    }
    return displayStatusFromDeviceRow(data as DeviceRow);
  }

  async updateDisplay(
    ownerUserId: string,
    id: string,
    input: { name?: string; groupName?: string; positionLabel?: string }
  ): Promise<DisplayRecord | undefined> {
    const existing = await this.getDisplay(ownerUserId, id);
    if (!existing) return undefined;
    const row = await this.updateOne<DeviceRow>("devices", id, {
      name: input.name ?? null,
      group_name: input.groupName ?? null,
      position_label: input.positionLabel ?? null,
      updated_at: new Date().toISOString()
    });
    if (row.owner_user_id !== ownerUserId) return undefined;
    return displayStatusFromDeviceRow(row);
  }

  async listDisplays(ownerUserId: string): Promise<DisplayRecord[]> {
    const { data, error } = await this.supabase.from("devices").select("*").eq("owner_user_id", ownerUserId).order("id");
    if (error) throw new Error(error.message);
    return ((data ?? []) as DeviceRow[]).map(displayStatusFromDeviceRow);
  }

  async listAllOnlineDisplays(): Promise<DisplayRecord[]> {
    const { data, error } = await this.supabase.from("devices").select("*").eq("online", true);
    if (error) throw new Error(error.message);
    return ((data ?? []) as DeviceRow[]).map(displayStatusFromDeviceRow);
  }

  async getDisplay(ownerUserId: string, id: string): Promise<DisplayRecord | undefined> {
    const row = await this.selectOne<DeviceRow>("devices", { id, owner_user_id: ownerUserId });
    return row ? displayStatusFromDeviceRow(row) : undefined;
  }

  async markDisplayOnline(input: {
    ownerUserId: string;
    displayId: string;
    installationId: string;
    appVersion: string;
    capabilities: DisplayCapabilities;
  }): Promise<DisplayRecord | undefined> {
    const existing = await this.getDisplay(input.ownerUserId, input.displayId);
    if (!existing || existing.installationId !== input.installationId) return undefined;
    const row = await this.updateOne<DeviceRow>("devices", input.displayId, {
      online: true,
      last_heartbeat_at: new Date().toISOString(),
      app_version: input.appVersion,
      capabilities_json: input.capabilities,
      last_error: null,
      updated_at: new Date().toISOString()
    });
    return displayStatusFromDeviceRow(row);
  }

  async markDisplayOffline(ownerUserId: string, displayId: string): Promise<DisplayRecord | undefined> {
    const existing = await this.getDisplay(ownerUserId, displayId);
    if (!existing) return undefined;
    const row = await this.updateOne<DeviceRow>("devices", displayId, {
      online: false,
      updated_at: new Date().toISOString()
    });
    return displayStatusFromDeviceRow(row);
  }

  async updateHeartbeat(ownerUserId: string, displayId: string): Promise<DisplayRecord | undefined> {
    const existing = await this.getDisplay(ownerUserId, displayId);
    if (!existing) return undefined;
    const row = await this.updateOne<DeviceRow>("devices", displayId, {
      online: true,
      last_heartbeat_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    return displayStatusFromDeviceRow(row);
  }

  async saveRenderAck(ownerUserId: string, displayId: string, sceneVersion: number): Promise<DisplayRecord | undefined> {
    const existing = await this.getDisplay(ownerUserId, displayId);
    if (!existing) return undefined;
    const now = new Date().toISOString();
    await this.db
      .from("delivery_history")
      .update({ acknowledged_at: now })
      .eq("owner_user_id", ownerUserId)
      .eq("device_id", displayId)
      .eq("scene_version", sceneVersion);
    const row = await this.updateOne<DeviceRow>("devices", displayId, {
      last_ack_version: sceneVersion,
      last_error: null,
      updated_at: now
    });
    return displayStatusFromDeviceRow(row);
  }

  async saveRenderError(ownerUserId: string, displayId: string, message: string, sceneVersion?: number): Promise<DisplayRecord | undefined> {
    const existing = await this.getDisplay(ownerUserId, displayId);
    if (!existing) return undefined;
    if (sceneVersion) {
      await this.db
        .from("delivery_history")
        .update({ error: message })
        .eq("owner_user_id", ownerUserId)
        .eq("device_id", displayId)
        .eq("scene_version", sceneVersion);
    }
    const row = await this.updateOne<DeviceRow>("devices", displayId, {
      last_error: message,
      updated_at: new Date().toISOString()
    });
    return displayStatusFromDeviceRow(row);
  }

  async expireStaleDisplays(heartbeatTimeoutMs: number): Promise<DisplayRecord[]> {
    const online = await this.listAllOnlineDisplays();
    const cutoff = Date.now() - heartbeatTimeoutMs;
    const stale = online.filter((display) => display.lastHeartbeatAt && new Date(display.lastHeartbeatAt).getTime() <= cutoff);
    const expired: DisplayRecord[] = [];
    for (const display of stale) {
      const next = await this.markDisplayOffline(display.ownerUserId, display.id);
      if (next) expired.push(next);
    }
    return expired;
  }

  async saveScene(ownerUserId: string, scene: Scene, title = scene.title): Promise<SceneRecord> {
    const normalized = normalizeScene({ ...scene, title });
    const existing = normalized.id ? await this.selectOne<SceneRow>("scenes", { id: normalized.id, owner_user_id: ownerUserId }) : undefined;
    const version = existing ? existing.version + 1 : 1;
    const now = new Date().toISOString();
    const row = existing
      ? await this.updateOne<SceneRow>("scenes", existing.id, {
          title,
          version,
          payload_json: normalized,
          updated_at: now
        })
      : await this.insertOne<SceneRow>("scenes", {
          id: normalized.id,
          owner_user_id: ownerUserId,
          title,
          version,
          payload_json: normalized,
          created_at: now,
          updated_at: now
        });
    return sceneFromRow(row);
  }

  async listScenes(ownerUserId: string): Promise<SceneRecord[]> {
    const { data, error } = await this.supabase.from("scenes").select("*").eq("owner_user_id", ownerUserId).order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as SceneRow[]).map(sceneFromRow);
  }

  async getScene(ownerUserId: string, id: string): Promise<SceneRecord | undefined> {
    const row = await this.selectOne<SceneRow>("scenes", { id, owner_user_id: ownerUserId });
    return row ? sceneFromRow(row) : undefined;
  }

  async assignScene(ownerUserId: string, displayId: string, scene: Scene, title = scene.title): Promise<{ display: DisplayRecord; scene: SceneRecord } | undefined> {
    const display = await this.getDisplay(ownerUserId, displayId);
    if (!display) return undefined;
    const sceneRecord = await this.saveScene(ownerUserId, scene, title);
    const nextVersion = display.currentSceneVersion + 1;
    const now = new Date().toISOString();
    await this.insertOne("delivery_history", {
      owner_user_id: ownerUserId,
      device_id: displayId,
      scene_id: sceneRecord.id,
      scene_version: nextVersion,
      delivered_at: now
    });
    const row = await this.updateOne<DeviceRow>("devices", displayId, {
      current_scene_id: sceneRecord.id,
      current_scene_version: nextVersion,
      updated_at: now
    });
    return { display: displayStatusFromDeviceRow(row), scene: sceneRecord };
  }

  async getCurrentSceneForDisplay(ownerUserId: string, displayId: string): Promise<{ scene: Scene; sceneVersion: number } | undefined> {
    const display = await this.getDisplay(ownerUserId, displayId);
    if (!display?.currentSceneId) return undefined;
    const scene = await this.getScene(ownerUserId, display.currentSceneId);
    if (!scene) return undefined;
    return {
      scene: await this.resolveSceneAssets(ownerUserId, scene.scene),
      sceneVersion: display.currentSceneVersion
    };
  }

  async saveAsset(ownerUserId: string, input: { filename: string; mimeType: string; body: Buffer }): Promise<AssetRecord> {
    const id = crypto.randomUUID();
    const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${ownerUserId}/${id}/${safeName}`;
    const { error: uploadError } = await this.supabase.storage
      .from(this.config.supabaseAssetBucket)
      .upload(storagePath, input.body, {
        contentType: input.mimeType,
        upsert: false
      });
    if (uploadError) throw new Error(uploadError.message);
    const row = await this.insertOne<AssetRow>("assets", {
      id,
      owner_user_id: ownerUserId,
      filename: safeName,
      mime_type: input.mimeType,
      storage_bucket: this.config.supabaseAssetBucket,
      storage_path: storagePath,
      size_bytes: input.body.byteLength
    });
    return assetFromRow(row, await this.createSignedAssetUrl(row));
  }

  async getAsset(ownerUserId: string, id: string): Promise<AssetRecord | undefined> {
    const row = await this.selectOne<AssetRow>("assets", { id, owner_user_id: ownerUserId });
    return row ? assetFromRow(row, await this.createSignedAssetUrl(row)) : undefined;
  }

  async resolveSceneAssets(ownerUserId: string, scene: Scene): Promise<Scene> {
    const cloned = structuredClone(scene) as Scene;
    for (const layer of cloned.layers) {
      if (!("assetUrl" in layer) || !layer.assetUrl) continue;
      const assetId = extractAssetId(layer.assetUrl);
      if (!assetId) continue;
      const asset = await this.getAsset(ownerUserId, assetId);
      if (asset) layer.assetUrl = asset.url;
    }
    return cloned;
  }

  private async createSignedAssetUrl(row: AssetRow): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(row.storage_bucket)
      .createSignedUrl(row.storage_path, this.config.supabaseSignedUrlTtlSeconds);
    if (error) throw new Error(error.message);
    return data.signedUrl;
  }

  private async selectOne<TRow>(table: string, filters: Record<string, string | number | boolean | null>): Promise<TRow | undefined> {
    let query = this.db.from(table).select("*").limit(1);
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    return (data ?? undefined) as TRow | undefined;
  }

  private async insertOne<TRow>(table: string, input: Record<string, unknown>): Promise<TRow> {
    const { data, error } = await this.db.from(table).insert(input).select("*").single();
    if (error) throw new Error(error.message);
    return data as TRow;
  }

  private async updateOne<TRow>(table: string, id: string, input: Record<string, unknown>): Promise<TRow> {
    const { data, error } = await this.db.from(table).update(input).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    return data as TRow;
  }

  private async findDeviceByInstallation(ownerUserId: string, installationId: string): Promise<DeviceRow | undefined> {
    return this.selectOne<DeviceRow>("devices", {
      owner_user_id: ownerUserId,
      installation_id: installationId
    });
  }

  private async updateRegisteredTv(
    existing: DeviceRow,
    input: {
      name?: string;
      groupName?: string;
      positionLabel?: string;
      appVersion: string;
      capabilities: DisplayCapabilities;
    }
  ): Promise<DisplayRecord> {
    const row = await this.updateOne<DeviceRow>("devices", existing.id, {
      name: input.name ?? existing.name,
      group_name: input.groupName ?? existing.group_name,
      position_label: input.positionLabel ?? existing.position_label,
      online: true,
      last_heartbeat_at: new Date().toISOString(),
      app_version: input.appVersion,
      capabilities_json: input.capabilities,
      last_error: null,
      updated_at: new Date().toISOString()
    });
    return displayStatusFromDeviceRow(row);
  }
}

const isUniqueViolation = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: unknown; message?: unknown };
  return maybeError.code === "23505" || (typeof maybeError.message === "string" && maybeError.message.includes("duplicate key value violates unique constraint"));
};

const extractAssetId = (value: string): string | undefined => {
  const directAssetMatch = value.match(/^asset:([^/?#]+)$/);
  if (directAssetMatch?.[1]) return directAssetMatch[1];

  const tvsysAssetMatch = value.match(/\/assets\/([^/?#]+)/);
  if (tvsysAssetMatch?.[1]) return decodeURIComponent(tvsysAssetMatch[1]);

  const storageAssetMatch = value.match(/\/storage\/v1\/object\/(?:sign|public|authenticated)\/[^/]+\/[^/]+\/([^/?#]+)/);
  if (storageAssetMatch?.[1]) return decodeURIComponent(storageAssetMatch[1]);

  return undefined;
};
