import type { DisplayStatus } from "../protocol.js";
import type { Scene } from "../scene.js";
import type { AssetRow, CafeRow, DeliveryHistoryRow, DeviceRow, SceneRow } from "./types.js";

export type OwnerUserId = string;
export type InstallationId = string;
export type DeviceId = string;
export type AssetId = string;
export type SceneId = string;

export interface AuthenticatedUser {
  id: OwnerUserId;
  email?: string;
}

export interface AuthContext {
  user: AuthenticatedUser;
  cafe: CafeRow;
}

export interface OwnedDisplayStatus extends DisplayStatus {
  ownerUserId: OwnerUserId;
  installationId?: InstallationId;
}

export interface OwnedAsset {
  id: AssetId;
  ownerUserId: OwnerUserId;
  filename: string;
  mimeType: string;
  url: string;
  storageBucket: string;
  storagePath: string;
  sizeBytes: number;
  createdAt: string;
}

export interface OwnedScene {
  id: SceneId;
  ownerUserId: OwnerUserId;
  title: string;
  version: number;
  scene: Scene;
  createdAt: string;
  updatedAt: string;
}

export interface TvRegistration {
  installationId: InstallationId;
  name?: string;
  groupName?: string;
  positionLabel?: string;
  appVersion: string;
}

export const displayStatusFromDeviceRow = (row: DeviceRow): OwnedDisplayStatus => ({
  id: row.id,
  ownerUserId: row.owner_user_id,
  installationId: row.installation_id ?? undefined,
  name: row.name ?? undefined,
  groupName: row.group_name ?? undefined,
  positionLabel: row.position_label ?? undefined,
  online: row.online,
  currentSceneId: row.current_scene_id ?? undefined,
  currentSceneVersion: row.current_scene_version,
  lastHeartbeatAt: row.last_heartbeat_at ?? undefined,
  lastAckVersion: row.last_ack_version ?? undefined,
  lastError: row.last_error ?? undefined,
  appVersion: row.app_version ?? undefined,
  capabilities: row.capabilities_json ?? undefined
});

export const assetFromRow = (row: AssetRow, url: string): OwnedAsset => ({
  id: row.id,
  ownerUserId: row.owner_user_id,
  filename: row.filename,
  mimeType: row.mime_type,
  url,
  storageBucket: row.storage_bucket,
  storagePath: row.storage_path,
  sizeBytes: row.size_bytes,
  createdAt: row.created_at
});

export const sceneFromRow = (row: SceneRow): OwnedScene => ({
  id: row.id,
  ownerUserId: row.owner_user_id,
  title: row.title,
  version: row.version,
  scene: row.payload_json,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const deliveryFromRow = (row: DeliveryHistoryRow) => ({
  id: row.id,
  ownerUserId: row.owner_user_id,
  deviceId: row.device_id,
  sceneId: row.scene_id,
  sceneVersion: row.scene_version,
  deliveredAt: row.delivered_at,
  acknowledgedAt: row.acknowledged_at ?? undefined,
  error: row.error ?? undefined
});
