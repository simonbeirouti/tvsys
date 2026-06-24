import { bearerAuthorization, type CafeRow, type DisplayStatus, type Scene } from "@tvsys/shared";

export interface DisplayCreateResponse {
  display: DisplayStatus;
}

export interface DisplaysResponse {
  displays: DisplayStatus[];
}

export interface AssetResponse {
  asset: {
    id: string;
    filename: string;
    mimeType: string;
    url: string;
    sizeBytes: number;
  };
}

export interface MeResponse {
  user: { id: string; email?: string };
  cafe: CafeRow;
}

export class ControllerApi {
  constructor(
    readonly serverUrl: string,
    private readonly getAccessToken: () => Promise<string | undefined>
  ) {}

  async me(): Promise<MeResponse> {
    const response = await this.fetchAuth("/api/me");
    return (await response.json()) as MeResponse;
  }

  async listDisplays(): Promise<DisplayStatus[]> {
    const response = await this.fetchAuth("/api/displays");
    const body = (await response.json()) as DisplaysResponse;
    return body.displays;
  }

  async createDisplay(input: { id: string; name?: string; groupName?: string; positionLabel?: string }): Promise<DisplayCreateResponse["display"]> {
    const response = await this.fetchAuth("/api/displays", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
    if (!response.ok) throw new Error(await response.text());
    const body = (await response.json()) as DisplayCreateResponse;
    return body.display;
  }

  async updateDisplay(displayId: string, input: { name?: string; groupName?: string; positionLabel?: string }): Promise<DisplayStatus> {
    const response = await this.fetchAuth(`/api/displays/${encodeURIComponent(displayId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
    if (!response.ok) throw new Error(await response.text());
    const body = (await response.json()) as { display: DisplayStatus };
    return body.display;
  }

  async uploadAsset(file: File): Promise<string> {
    const response = await this.fetchAuth(`/api/assets/${encodeURIComponent(file.name)}`, {
      method: "PUT",
      headers: { "content-type": file.type || "application/octet-stream" },
      body: file
    });
    if (!response.ok) throw new Error(await response.text());
    const body = (await response.json()) as AssetResponse;
    return isAbsoluteUrl(body.asset.url) ? body.asset.url : `${this.serverUrl}${body.asset.url}`;
  }

  async sendScene(displayId: string, scene: Scene): Promise<void> {
    const response = await this.fetchAuth(`/api/displays/${encodeURIComponent(displayId)}/scene`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scene, title: scene.title })
    });
    if (!response.ok) throw new Error(await response.text());
  }

  async broadcastScene(scene: Scene): Promise<void> {
    const response = await this.fetchAuth("/api/broadcast/scene", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scene, title: scene.title })
    });
    if (!response.ok) throw new Error(await response.text());
  }

  private async fetchAuth(pathname: string, init: RequestInit = {}): Promise<Response> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) throw new Error("Not signed in");
    const headers = new Headers(init.headers);
    headers.set("authorization", bearerAuthorization(accessToken));
    const response = await fetch(`${this.serverUrl}${pathname}`, { ...init, headers });
    if (!response.ok) throw new Error(await response.text());
    return response;
  }
}

const isAbsoluteUrl = (value: string): boolean => /^https?:\/\//i.test(value);
