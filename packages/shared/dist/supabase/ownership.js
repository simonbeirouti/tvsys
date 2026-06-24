export const displayStatusFromDeviceRow = (row) => ({
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
export const assetFromRow = (row, url) => ({
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
export const sceneFromRow = (row) => ({
    id: row.id,
    ownerUserId: row.owner_user_id,
    title: row.title,
    version: row.version,
    scene: row.payload_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at
});
export const deliveryFromRow = (row) => ({
    id: row.id,
    ownerUserId: row.owner_user_id,
    deviceId: row.device_id,
    sceneId: row.scene_id,
    sceneVersion: row.scene_version,
    deliveredAt: row.delivered_at,
    acknowledgedAt: row.acknowledged_at ?? undefined,
    error: row.error ?? undefined
});
