import { useCallback, useEffect, useMemo, useState } from "react";
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

export const App = () => {
  const [config, setConfig] = useState<DisplayConfig | undefined>(() => loadDisplayConfig());
  const [serverUrl, setServerUrl] = useState(() => config?.serverUrl ?? "http://localhost:8787");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [authError, setAuthError] = useState("");
  const [accessToken, setAccessToken] = useState<string | undefined>();
  const [scene, setScene] = useState<Scene | undefined>();
  const [sceneVersion, setSceneVersion] = useState(0);
  const [status, setStatus] = useState("Not configured");
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  const supabase = useMemo(
    () =>
      supabaseUrl && supabaseKey
        ? createTvsysSupabaseClient(supabaseUrl, supabaseKey, {
            auth: { autoRefreshToken: true, persistSession: true }
          })
        : undefined,
    [supabaseKey, supabaseUrl]
  );

  const renderScene = useCallback(
    async (incomingScene: Scene, incomingVersion: number) => {
      if (!shouldApplySceneVersion(incomingVersion, sceneVersion)) return;
      setScene(incomingScene);
      setSceneVersion(incomingVersion);
    },
    [sceneVersion]
  );

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setAccessToken(data.session.access_token);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token);
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!config) return;
    const handle = connectDisplaySocket({
      config,
      getAccessToken: async () => {
        const fresh = await supabase?.auth.getSession();
        return fresh?.data.session?.access_token ?? accessToken;
      },
      onScene: renderScene,
      onStatus: setStatus
    });
    return () => handle.close();
  }, [accessToken, config, renderScene, supabase]);

  const requestOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setAuthError("");
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
    if (error) {
      setAuthError(error.message);
      return;
    }
    setOtpSent(true);
  };

  const verifyAndRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setAuthError("");
    const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: otp, type: "email" });
    if (error) {
      setAuthError(error.message);
      return;
    }
    const token = data.session?.access_token;
    if (!token) {
      setAuthError("Supabase did not return a session");
      return;
    }
    const installationId = loadOrCreateInstallationId();
    const display = await registerTv(serverUrl, token, installationId);
    const clean = {
      serverUrl: serverUrl.trim(),
      displayId: display.id,
      installationId
    };
    saveDisplayConfig(clean);
    setAccessToken(token);
    setConfig(clean);
    setStatus("Registered");
  };

  const reset = async () => {
    await supabase?.auth.signOut();
    clearDisplayConfig();
    clearInstallationId();
    setConfig(undefined);
    setAccessToken(undefined);
    setScene(undefined);
    setSceneVersion(0);
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
            <CardDescription>Sign in with the cafe email and six-digit code to link this TV.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={otpSent ? verifyAndRegister : requestOtp}>
              <Field label="Server URL" htmlFor="server-url">
                <Input id="server-url" value={serverUrl} onChange={(event) => setServerUrl(event.target.value)} />
              </Field>
              <Field label="Cafe email" htmlFor="email">
                <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </Field>
              {otpSent ? (
                <div className="grid gap-2">
                  <Label>Six-digit code</Label>
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      {[0, 1, 2, 3, 4, 5].map((index) => (
                        <InputOTPSlot index={index} key={index} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              ) : null}
              {authError ? <p className="text-sm text-destructive">{authError}</p> : null}
              <Button size="lg" type="submit" disabled={!serverUrl || !email || (otpSent && otp.length !== 6)}>
                {otpSent ? "Verify and link TV" : "Send code"}
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

const registerTv = async (serverUrl: string, accessToken: string, installationId: string): Promise<DisplayStatus> => {
  const response = await fetch(`${serverUrl.replace(/\/$/, "")}/api/tv/register`, {
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
  const body = (await response.json()) as { display: DisplayStatus };
  return body.display;
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
