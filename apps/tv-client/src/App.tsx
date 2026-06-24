import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as React from "react";
import { bearerAuthorization, createTvsysSupabaseClient, DEFAULT_CANVAS, type DisplayCapabilities, type DisplayStatus, type Scene } from "@tvsys/shared";
import { Badge } from "@tvsys/ui/components/badge";
import { Button } from "@tvsys/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@tvsys/ui/components/card";
import { Input } from "@tvsys/ui/components/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@tvsys/ui/components/input-otp";
import { Label } from "@tvsys/ui/components/label";
import {
  clearDisplayConfig,
  clearInstallationId,
  loadDisplayConfig,
  loadOrCreateInstallationId,
  saveDisplayConfig,
  shouldApplySceneVersion,
  type DisplayConfig
} from "./connection.js";
import { SceneAnimationStyles, SceneRenderer } from "./SceneRenderer.js";
import { connectDisplaySocket } from "./socket.js";

const APP_VERSION = "0.1.0";
const PENDING_SETUP_KEY = "tvsys.pendingDisplaySetup";
const AUTH_REDIRECT_SEARCH_PARAMS = ["code", "error", "error_code", "error_description"];
const AUTH_REDIRECT_HASH_PARAMS = ["access_token", "expires_at", "expires_in", "refresh_token", "token_type", "type"];

interface PendingDisplaySetup {
  code?: string;
  email: string;
  serverUrl: string;
}

export const App = () => {
  const [config, setConfig] = useState<DisplayConfig | undefined>(() => loadDisplayConfig());
  const [serverUrl, setServerUrl] = useState(() => config?.serverUrl ?? loadPendingDisplaySetup()?.serverUrl ?? "http://localhost:8787");
  const [email, setEmail] = useState(() => loadPendingDisplaySetup()?.email ?? "");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [activationCode, setActivationCode] = useState(() => loadPendingDisplaySetup()?.code ?? "");
  const [authError, setAuthError] = useState("");
  const [accessToken, setAccessToken] = useState<string | undefined>();
  const [scene, setScene] = useState<Scene | undefined>();
  const [sceneVersion, setSceneVersion] = useState(0);
  const sceneVersionRef = useRef(0);
  const [status, setStatus] = useState("Not configured");
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  const supabase = useMemo(
    () =>
      supabaseUrl && supabaseKey
        ? createTvsysSupabaseClient(supabaseUrl, supabaseKey, {
            auth: { autoRefreshToken: true, detectSessionInUrl: false, persistSession: true }
          })
        : undefined,
    [supabaseKey, supabaseUrl]
  );
  const trimmedServerUrl = serverUrl.trim();
  const trimmedEmail = email.trim();
  const trimmedOtp = otp.trim();
  const canRequestOtp = Boolean(trimmedServerUrl && trimmedEmail);
  const canVerifyOtp = canRequestOtp && trimmedOtp.length === 6;
  const canStartActivation = Boolean(accessToken && trimmedServerUrl);

  const renderScene = useCallback(async (incomingScene: Scene, incomingVersion: number) => {
    if (!shouldApplySceneVersion(incomingVersion, sceneVersionRef.current)) return;
    sceneVersionRef.current = incomingVersion;
    setScene(incomingScene);
    setSceneVersion(incomingVersion);
  }, []);

  const startActivation = useCallback(
    async (token: string, nextServerUrl = trimmedServerUrl) => {
      const cleanServerUrl = nextServerUrl.trim();
      if (!cleanServerUrl) {
        setAuthError("Enter the TVSys server URL before creating a linking code.");
        return;
      }
      try {
        const installationId = loadOrCreateInstallationId();
        const activation = await createActivation(cleanServerUrl, token, installationId);
        setAccessToken(token);
        setServerUrl(cleanServerUrl);
        setOtp("");
        setOtpSent(false);
        setActivationCode(activation.code);
        savePendingDisplaySetup({ email: trimmedEmail, serverUrl: cleanServerUrl, code: activation.code });
        setStatus("Waiting for controller link");
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "Could not create linking code");
        setStatus("Linking code failed");
      }
    },
    [trimmedEmail, trimmedServerUrl]
  );

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    const hydrateSession = async () => {
      const callback = getAuthCallbackParams();
      if (callback.error) {
        setAuthError(callback.error);
        cleanAuthCallbackUrl();
        return;
      }
      if (callback.code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(callback.code);
        cleanAuthCallbackUrl();
        if (!mounted) return;
        if (error) {
          setAuthError(error.message);
          return;
        }
        if (data.session) {
          const pending = loadPendingDisplaySetup();
          if (!config) await startActivation(data.session.access_token, pending?.serverUrl ?? trimmedServerUrl);
          else setAccessToken(data.session.access_token);
          return;
        }
      }
      if (callback.accessToken && callback.refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: callback.accessToken,
          refresh_token: callback.refreshToken
        });
        cleanAuthCallbackUrl();
        if (!mounted) return;
        if (error) {
          setAuthError(error.message);
          return;
        }
        if (data.session) {
          const pending = loadPendingDisplaySetup();
          if (!config) await startActivation(data.session.access_token, pending?.serverUrl ?? trimmedServerUrl);
          else setAccessToken(data.session.access_token);
          return;
        }
      }
      const { data } = await supabase.auth.getSession();
      if (mounted && data.session) setAccessToken(data.session.access_token);
    };
    void hydrateSession().catch((error) => {
      setAuthError(error instanceof Error ? error.message : "Could not complete sign-in");
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [config, startActivation, supabase, trimmedServerUrl]);

  useEffect(() => {
    if (!activationCode || !accessToken || config) return;
    let stopped = false;
    const poll = async () => {
      try {
        const result = await getActivationStatus(trimmedServerUrl, accessToken, activationCode);
        if (stopped || result.status !== "claimed" || !result.display || !result.displayToken) return;
        const installationId = loadOrCreateInstallationId();
        const clean = {
          serverUrl: trimmedServerUrl,
          displayId: result.display.id,
          displayAuthToken: result.displayToken,
          installationId
        };
        saveDisplayConfig(clean);
        clearPendingDisplaySetup();
        setConfig(clean);
        setActivationCode("");
        setStatus("Registered");
      } catch (error) {
        if (!stopped) setAuthError(error instanceof Error ? error.message : "Could not check linking code");
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [accessToken, activationCode, config, trimmedServerUrl]);

  useEffect(() => {
    if (!config) return;
    const handle = connectDisplaySocket({
      config,
      getAccessToken: async () => config.displayAuthToken,
      onScene: renderScene,
      onStatus: setStatus
    });
    return () => handle.close();
  }, [config, renderScene]);

  useEffect(() => {
    if (!config) return;
    const { serverUrl, displayAuthToken } = config;
    let stopped = false;
    const pollCurrentScene = async () => {
      try {
        const current = await getCurrentScene(serverUrl, displayAuthToken);
        if (!stopped && current.scene) await renderScene(current.scene, current.sceneVersion);
      } catch (error) {
        if (!stopped) setStatus(error instanceof Error ? `Scene poll failed: ${error.message}` : "Scene poll failed");
      }
    };
    void pollCurrentScene();
    const timer = window.setInterval(() => void pollCurrentScene(), 20_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [config, renderScene]);

  const sendOtp = async () => {
    if (!supabase) return;
    setAuthError("");
    setOtp("");
    savePendingDisplaySetup({ email: trimmedEmail, serverUrl: trimmedServerUrl, code: activationCode || undefined });
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: {
        emailRedirectTo: getAuthRedirectTo()
      }
    });
    if (error) {
      setAuthError(error.message);
      return;
    }
    setOtpSent(true);
  };

  const requestOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendOtp();
  };

  const verifyAndRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setAuthError("");
    const { data, error } = await supabase.auth.verifyOtp({ email: trimmedEmail, token: trimmedOtp, type: "email" });
    if (error) {
      setAuthError(error.message);
      return;
    }
    const token = data.session?.access_token;
    if (!token) {
      setAuthError("Supabase did not return a session");
      return;
    }
    await startActivation(token);
  };

  const createLinkingCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken) return;
    setAuthError("");
    await startActivation(accessToken);
  };

  const changeServerUrl = (event: React.ChangeEvent<HTMLInputElement>) => {
    setServerUrl(event.target.value);
    setAuthError("");
  };

  const changeEmail = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value);
    setOtp("");
    setOtpSent(false);
    setActivationCode("");
    setAuthError("");
  };

  const reset = async () => {
    await supabase?.auth.signOut();
    clearDisplayConfig();
    clearInstallationId();
    clearPendingDisplaySetup();
    setConfig(undefined);
    setAccessToken(undefined);
    setScene(undefined);
    sceneVersionRef.current = 0;
    setSceneVersion(0);
    setActivationCode("");
    setStatus("Not configured");
  };

  if (!supabase) {
    return (
      <main className="grid min-h-svh place-items-center bg-background p-6 text-foreground">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Supabase is not configured</CardTitle>
            <CardDescription>Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY before packaging the TV app.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (!config) {
    return (
      <main className="grid min-h-svh place-items-center bg-background p-6 text-foreground">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>TVSys Display Setup</CardTitle>
            <CardDescription>Sign in, then enter this TV's linking code in the controller.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={accessToken ? createLinkingCode : otpSent ? verifyAndRegister : requestOtp}>
              <Field label="Server URL" htmlFor="server-url">
                <Input id="server-url" value={serverUrl} onChange={changeServerUrl} />
              </Field>
              <Field label="Cafe email" htmlFor="email">
                <Input id="email" type="email" value={email} onChange={changeEmail} />
              </Field>
              {otpSent ? (
                <div className="grid gap-2">
                  <Label>Six-digit code</Label>
                  <p className="text-sm text-muted-foreground">Enter the code sent to {trimmedEmail}.</p>
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      {[0, 1, 2, 3, 4, 5].map((index) => (
                        <InputOTPSlot index={index} key={index} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                  <Button type="button" variant="ghost" className="justify-self-start px-0" onClick={() => void sendOtp()}>
                    Send a new code
                  </Button>
                </div>
              ) : null}
              {activationCode ? (
                <div className="grid gap-2 rounded-md border p-4 text-center">
                  <Label>Linking code</Label>
                  <p className="font-mono text-5xl font-semibold tracking-widest">{activationCode}</p>
                  <p className="text-sm text-muted-foreground">Enter this code in the controller to link this TV.</p>
                </div>
              ) : null}
              {authError ? <p className="text-sm text-destructive">{authError}</p> : null}
              <Button size="lg" type="submit" disabled={accessToken ? !canStartActivation : otpSent ? !canVerifyOtp : !canRequestOtp}>
                {accessToken ? "Create linking code" : otpSent ? "Verify and create code" : "Send code"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="display-app">
      {scene ? (
        <>
          <SceneAnimationStyles scene={scene} />
          <SceneRenderer scene={scene} />
        </>
      ) : (
        <section className="flex h-svh w-screen flex-col items-center justify-center gap-4 bg-slate-950 p-8 text-center text-white">
          <h1 className="max-w-full truncate text-6xl font-semibold">{config.displayId}</h1>
          <p className="max-w-full truncate text-2xl text-slate-300">{status}</p>
        </section>
      )}
      <aside className="fixed bottom-4 right-4 z-[9999] flex items-center gap-2 rounded-lg border bg-background/90 p-2 text-sm text-foreground opacity-10 shadow-sm backdrop-blur transition-opacity hover:opacity-100">
        <strong className="max-w-56 truncate">{status}</strong>
        <Badge variant="outline">v{sceneVersion}</Badge>
        <Button variant="secondary" size="sm" onClick={() => void reset()}>
          Reset
        </Button>
      </aside>
    </main>
  );
};

const createActivation = async (serverUrl: string, accessToken: string, installationId: string): Promise<{ code: string; expiresAt: string }> => {
  const response = await fetch(`${serverUrl.replace(/\/$/, "")}/api/tv/activation/start`, {
    method: "POST",
    headers: {
      authorization: bearerAuthorization(accessToken),
      "content-type": "application/json"
    },
    body: JSON.stringify({
      installationId,
      appVersion: APP_VERSION,
      capabilities: detectCapabilities()
    })
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as { code: string; expiresAt: string };
};

const getActivationStatus = async (
  serverUrl: string,
  accessToken: string,
  code: string
): Promise<{ display?: DisplayStatus; displayToken?: string; status: "claimed" | "pending" }> => {
  const response = await fetch(`${serverUrl.replace(/\/$/, "")}/api/tv/activation/status?code=${encodeURIComponent(code)}`, {
    headers: {
      authorization: bearerAuthorization(accessToken)
    }
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as { display?: DisplayStatus; displayToken?: string; status: "claimed" | "pending" };
};

const getCurrentScene = async (
  serverUrl: string,
  displayAuthToken: string
): Promise<{ scene: Scene | null; sceneVersion: number }> => {
  const response = await fetch(`${serverUrl.replace(/\/$/, "")}/api/tv/current-scene`, {
    headers: {
      authorization: bearerAuthorization(displayAuthToken)
    }
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as { scene: Scene | null; sceneVersion: number };
};

const detectCapabilities = (): DisplayCapabilities => ({
  canvas: { ...DEFAULT_CANVAS },
  supportsVideo: Boolean(document.createElement("video").canPlayType),
  supportsPixi: true
});

const Field = ({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) => (
  <div className="grid gap-2">
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
  </div>
);

const loadPendingDisplaySetup = (): PendingDisplaySetup | undefined => {
  const raw = localStorage.getItem(PENDING_SETUP_KEY);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingDisplaySetup>;
    return typeof parsed.email === "string" && typeof parsed.serverUrl === "string"
      ? { code: typeof parsed.code === "string" ? parsed.code : undefined, email: parsed.email, serverUrl: parsed.serverUrl }
      : undefined;
  } catch {
    localStorage.removeItem(PENDING_SETUP_KEY);
    return undefined;
  }
};

const savePendingDisplaySetup = (setup: PendingDisplaySetup): void => {
  localStorage.setItem(PENDING_SETUP_KEY, JSON.stringify(setup));
};

const clearPendingDisplaySetup = (): void => {
  localStorage.removeItem(PENDING_SETUP_KEY);
};

const getAuthRedirectTo = (): string => {
  const url = new URL(window.location.href);
  AUTH_REDIRECT_SEARCH_PARAMS.forEach((param) => url.searchParams.delete(param));
  url.hash = "";
  return url.toString();
};

const getAuthCallbackParams = (): { accessToken?: string; code?: string; error?: string; refreshToken?: string } => {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  const error = url.searchParams.get("error_description") ?? url.searchParams.get("error") ?? hash.get("error_description") ?? hash.get("error") ?? undefined;
  return {
    accessToken: hash.get("access_token") ?? undefined,
    code: url.searchParams.get("code") ?? undefined,
    error,
    refreshToken: hash.get("refresh_token") ?? undefined
  };
};

const cleanAuthCallbackUrl = () => {
  const url = new URL(window.location.href);
  AUTH_REDIRECT_SEARCH_PARAMS.forEach((param) => url.searchParams.delete(param));
  const hash = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  AUTH_REDIRECT_HASH_PARAMS.forEach((param) => hash.delete(param));
  const nextHash = hash.toString();
  url.hash = nextHash ? `#${nextHash}` : "";
  window.history.replaceState(window.history.state, "", url.toString());
};
