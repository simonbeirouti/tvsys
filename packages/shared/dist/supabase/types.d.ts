import type { DisplayCapabilities, Scene } from "../scene.js";
export type Json = string | number | boolean | null | {
    [key: string]: Json | undefined;
} | Json[];
export interface Database {
    public: {
        Tables: {
            cafes: {
                Row: {
                    id: string;
                    owner_user_id: string;
                    name: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    owner_user_id: string;
                    name?: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    owner_user_id?: string;
                    name?: string;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            devices: {
                Row: {
                    id: string;
                    owner_user_id: string;
                    installation_id: string | null;
                    name: string | null;
                    group_name: string | null;
                    position_label: string | null;
                    online: boolean;
                    current_scene_id: string | null;
                    current_scene_version: number;
                    last_heartbeat_at: string | null;
                    last_ack_version: number | null;
                    last_error: string | null;
                    app_version: string | null;
                    capabilities_json: DisplayCapabilities | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    owner_user_id: string;
                    installation_id?: string | null;
                    name?: string | null;
                    group_name?: string | null;
                    position_label?: string | null;
                    online?: boolean;
                    current_scene_id?: string | null;
                    current_scene_version?: number;
                    last_heartbeat_at?: string | null;
                    last_ack_version?: number | null;
                    last_error?: string | null;
                    app_version?: string | null;
                    capabilities_json?: DisplayCapabilities | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: Partial<Database["public"]["Tables"]["devices"]["Insert"]>;
            };
            assets: {
                Row: {
                    id: string;
                    owner_user_id: string;
                    filename: string;
                    mime_type: string;
                    storage_bucket: string;
                    storage_path: string;
                    size_bytes: number;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    owner_user_id: string;
                    filename: string;
                    mime_type: string;
                    storage_bucket: string;
                    storage_path: string;
                    size_bytes: number;
                    created_at?: string;
                };
                Update: Partial<Database["public"]["Tables"]["assets"]["Insert"]>;
            };
            scenes: {
                Row: {
                    id: string;
                    owner_user_id: string;
                    title: string;
                    version: number;
                    payload_json: Scene;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    owner_user_id: string;
                    title: string;
                    version?: number;
                    payload_json: Scene;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: Partial<Database["public"]["Tables"]["scenes"]["Insert"]>;
            };
            delivery_history: {
                Row: {
                    id: string;
                    owner_user_id: string;
                    device_id: string;
                    scene_id: string;
                    scene_version: number;
                    delivered_at: string;
                    acknowledged_at: string | null;
                    error: string | null;
                };
                Insert: {
                    id?: string;
                    owner_user_id: string;
                    device_id: string;
                    scene_id: string;
                    scene_version: number;
                    delivered_at?: string;
                    acknowledged_at?: string | null;
                    error?: string | null;
                };
                Update: Partial<Database["public"]["Tables"]["delivery_history"]["Insert"]>;
            };
        };
        Views: Record<string, never>;
        Functions: Record<string, never>;
        Enums: Record<string, never>;
        CompositeTypes: Record<string, never>;
    };
}
export type CafeRow = Database["public"]["Tables"]["cafes"]["Row"];
export type CafeInsert = Database["public"]["Tables"]["cafes"]["Insert"];
export type DeviceRow = Database["public"]["Tables"]["devices"]["Row"];
export type DeviceInsert = Database["public"]["Tables"]["devices"]["Insert"];
export type DeviceUpdate = Database["public"]["Tables"]["devices"]["Update"];
export type AssetRow = Database["public"]["Tables"]["assets"]["Row"];
export type AssetInsert = Database["public"]["Tables"]["assets"]["Insert"];
export type SceneRow = Database["public"]["Tables"]["scenes"]["Row"];
export type SceneInsert = Database["public"]["Tables"]["scenes"]["Insert"];
export type DeliveryHistoryRow = Database["public"]["Tables"]["delivery_history"]["Row"];
export type DeliveryHistoryInsert = Database["public"]["Tables"]["delivery_history"]["Insert"];
//# sourceMappingURL=types.d.ts.map