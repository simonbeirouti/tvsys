export interface DisplayConfig {
  serverUrl: string;
  displayId: string;
  installationId: string;
}

const STORAGE_KEY = "tvsys.displayConfig";

export const loadDisplayConfig = (): DisplayConfig | undefined => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as DisplayConfig;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return undefined;
  }
};

export const saveDisplayConfig = (config: DisplayConfig): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
};

export const clearDisplayConfig = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

export const buildDisplayWsUrl = (serverUrl: string): string =>
  `${serverUrl.replace(/^http/, "ws").replace(/\/$/, "")}/ws/display`;

export const buildDisplayWsUrlWithToken = (serverUrl: string, accessToken: string): string =>
  `${buildDisplayWsUrl(serverUrl)}?access_token=${encodeURIComponent(accessToken)}`;

export const nextReconnectDelay = (attempt: number): number => Math.min(1000 * 2 ** attempt, 10_000);

export const shouldApplySceneVersion = (incomingVersion: number, currentVersion: number): boolean =>
  Number.isFinite(incomingVersion) && incomingVersion > currentVersion;

export const loadOrCreateInstallationId = (): string => {
  const key = "tvsys.installationId";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem(key, next);
  return next;
};

export const clearInstallationId = (): void => {
  localStorage.removeItem("tvsys.installationId");
};
