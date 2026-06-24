import type { DisplayCapabilities, Scene } from "./scene.js";

export interface RegisterDisplayMessage {
  type: "register_display";
  displayId: string;
  installationId: string;
  appVersion: string;
  capabilities: DisplayCapabilities;
}

export interface HeartbeatMessage {
  type: "heartbeat";
  displayId: string;
  at: string;
}

export interface SceneUpdateMessage {
  type: "scene_update";
  displayId: string;
  sceneVersion: number;
  scene: Scene;
  sentAt: string;
}

export interface PartialUpdateMessage {
  type: "partial_update";
  displayId: string;
  sceneVersion: number;
  layerId: string;
  patch: Record<string, unknown>;
  sentAt: string;
}

export interface RenderAckMessage {
  type: "render_ack";
  displayId: string;
  sceneVersion: number;
  renderedAt: string;
}

export interface RenderErrorMessage {
  type: "render_error";
  displayId: string;
  sceneVersion?: number;
  message: string;
  details?: unknown;
  occurredAt: string;
}

export interface ControllerHelloMessage {
  type: "controller_hello";
}

export interface RequestStatusMessage {
  type: "request_status";
}

export interface ControllerSendSceneMessage {
  type: "send_scene";
  target: "all" | { displayId: string };
  scene: Scene;
  title?: string;
}

export interface DisplayStatusMessage {
  type: "display_status";
  display: DisplayStatus;
}

export interface StatusSnapshotMessage {
  type: "status_snapshot";
  displays: DisplayStatus[];
}

export interface SceneDeliveryMessage {
  type: "scene_delivery";
  displayId: string;
  sceneVersion: number;
  delivered: boolean;
  sentAt: string;
}

export interface ServerErrorMessage {
  type: "server_error";
  message: string;
}

export interface DisplayStatus {
  id: string;
  name?: string;
  groupName?: string;
  positionLabel?: string;
  online: boolean;
  currentSceneId?: string;
  currentSceneVersion: number;
  lastHeartbeatAt?: string;
  lastAckVersion?: number;
  lastError?: string;
  appVersion?: string;
  capabilities?: DisplayCapabilities;
}

export type DisplayToServerMessage =
  | RegisterDisplayMessage
  | HeartbeatMessage
  | RenderAckMessage
  | RenderErrorMessage;

export type ControllerToServerMessage =
  | ControllerHelloMessage
  | RequestStatusMessage
  | ControllerSendSceneMessage;

export type ServerToDisplayMessage = SceneUpdateMessage | PartialUpdateMessage | ServerErrorMessage;

export type ServerToControllerMessage =
  | DisplayStatusMessage
  | StatusSnapshotMessage
  | SceneDeliveryMessage
  | ServerErrorMessage;

export type SocketMessage =
  | DisplayToServerMessage
  | ControllerToServerMessage
  | ServerToDisplayMessage
  | ServerToControllerMessage;
