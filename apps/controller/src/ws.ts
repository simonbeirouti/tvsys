import type { DisplayStatus, ServerToControllerMessage } from "@tvsys/shared";

export const connectControllerSocket = (
  serverUrl: string,
  accessToken: string,
  onDisplays: (displays: DisplayStatus[]) => void,
  onDisplay: (display: DisplayStatus) => void,
  onLog: (message: string) => void
): (() => void) => {
  let closed = false;
  let socket: WebSocket | undefined;
  let attempt = 0;

  const open = () => {
    const wsUrl = `${serverUrl.replace(/^http/, "ws").replace(/\/$/, "")}/ws/controller?access_token=${encodeURIComponent(accessToken)}`;
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      attempt = 0;
      socket?.send(JSON.stringify({ type: "controller_hello" }));
      onLog("Controller connected");
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as ServerToControllerMessage;
      if (message.type === "status_snapshot") onDisplays(message.displays);
      if (message.type === "display_status") onDisplay(message.display);
      if (message.type === "scene_delivery") {
        onLog(`Scene v${message.sceneVersion} sent to ${message.displayId}${message.delivered ? "" : " (queued)"}`);
      }
      if (message.type === "server_error") onLog(message.message);
    };

    socket.onclose = () => {
      if (closed) return;
      attempt += 1;
      const delay = Math.min(1000 * 2 ** attempt, 10_000);
      onLog(`Controller socket reconnecting in ${Math.round(delay / 1000)}s`);
      window.setTimeout(open, delay);
    };
  };

  open();

  return () => {
    closed = true;
    socket?.close();
  };
};
