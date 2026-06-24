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
export declare const displayStatusFromDeviceRow: (row: DeviceRow) => OwnedDisplayStatus;
export declare const assetFromRow: (row: AssetRow, url: string) => OwnedAsset;
export declare const sceneFromRow: (row: SceneRow) => OwnedScene;
export declare const deliveryFromRow: (row: DeliveryHistoryRow) => {
    id: string;
    ownerUserId: string;
    deviceId: string;
    sceneId: string;
    sceneVersion: number;
    deliveredAt: string;
    acknowledgedAt: string | undefined;
    error: string | undefined;
};
//# sourceMappingURL=ownership.d.ts.map