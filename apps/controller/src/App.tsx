import { cryptoRandomId, type DisplayStatus, type Scene } from "@tvsys/shared";
import { createTvsysSupabaseClient } from "@tvsys/shared";
import { Alert, AlertDescription, AlertTitle } from "@tvsys/ui/components/alert";
import { Badge } from "@tvsys/ui/components/badge";
import { Button } from "@tvsys/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@tvsys/ui/components/card";
import { Input } from "@tvsys/ui/components/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@tvsys/ui/components/input-otp";
import { Label } from "@tvsys/ui/components/label";
import { Separator } from "@tvsys/ui/components/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@tvsys/ui/components/sidebar";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { LogOut, Monitor, Plus } from "lucide-react";
import type * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { ControllerApi } from "./api.js";
import { controllerQueryKeys, upsertDisplay } from "./query.js";
import { addImageLayer, createEditableScene, getCapabilityCanvas, sceneAssetReference } from "./sceneFactory.js";
import { connectControllerSocket } from "./ws.js";
import { AppSidebar, type Company } from "./components/app-sidebar.js";
import { SceneEditor } from "./SceneEditor.js";

const DEFAULT_SERVER_URL = "http://localhost:8787";
export const DEFAULT_COMPANY_ID = "owned";

const AUTH_REDIRECT_SEARCH_PARAMS = ["code", "error", "error_code", "error_description"];
const AUTH_REDIRECT_HASH_PARAMS = ["access_token", "expires_at", "expires_in", "refresh_token", "token_type", "type"];

export type ScreenFilter = "all" | "online" | "offline";

export const isScreenFilter = (value: unknown): value is ScreenFilter =>
  value === "all" || value === "online" || value === "offline";

type AssetUploadInput = {
  file: File;
  position?: { x: number; y: number };
};

type SessionState = {
  accessToken: string;
  user: {
    id: string;
    email?: string;
  };
};

export const App = () => {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { companyId?: string; displayId?: string };
  const search = useSearch({ strict: false }) as Partial<{ filter: ScreenFilter }>;
  const queryClient = useQueryClient();
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem("tvsys.serverUrl") ?? DEFAULT_SERVER_URL);
  const [session, setSession] = useState<SessionState | undefined>();
  const [authEmail, setAuthEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [authError, setAuthError] = useState("");
  const [linkingCode, setLinkingCode] = useState("");
  const [newDisplay, setNewDisplay] = useState({ id: "", name: "", groupName: "", positionLabel: "" });
  const [selectedDraft, setSelectedDraft] = useState({ name: "", groupName: "", positionLabel: "" });
  const [scene, setScene] = useState<Scene>(() => createEditableScene());
  const [assetPreviewUrls, setAssetPreviewUrls] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<string[]>([]);
  const selectedDisplayId = params.displayId ?? "";
  const screenFilter = isScreenFilter(search.filter) ? search.filter : "all";
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

  const userId = session?.user.id ?? "anonymous";
  const api = useMemo(
    () =>
      new ControllerApi(serverUrl.replace(/\/$/, ""), async () => {
        const fresh = await supabase?.auth.getSession();
        return fresh?.data.session?.access_token ?? session?.accessToken;
      }),
    [serverUrl, session?.accessToken, supabase]
  );

  const addLog = (message: string) => {
    setLogs((current) => [`${new Date().toLocaleTimeString()} ${message}`, ...current].slice(0, 8));
  };

  useEffect(() => {
    localStorage.setItem("tvsys.serverUrl", serverUrl);
  }, [serverUrl]);

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
          setOtp("");
          setOtpSent(false);
          setSession({ accessToken: data.session.access_token, user: { id: data.session.user.id, email: data.session.user.email } });
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
          setOtp("");
          setOtpSent(false);
          setSession({ accessToken: data.session.access_token, user: { id: data.session.user.id, email: data.session.user.email } });
          return;
        }
      }
      const { data } = await supabase.auth.getSession();
      const current = data.session;
      if (mounted && current) setSession({ accessToken: current.access_token, user: { id: current.user.id, email: current.user.email } });
    };
    void hydrateSession();
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession) {
        setOtp("");
        setOtpSent(false);
        setAuthError("");
        setSession({ accessToken: nextSession.access_token, user: { id: nextSession.user.id, email: nextSession.user.email } });
      } else {
        setSession(undefined);
        queryClient.clear();
      }
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient, supabase]);

  const meQuery = useQuery({
    queryKey: controllerQueryKeys.me(userId),
    queryFn: () => api.me(),
    enabled: Boolean(session)
  });

  const displaysQuery = useQuery({
    queryKey: controllerQueryKeys.displays(userId),
    queryFn: () => api.listDisplays(),
    enabled: Boolean(session)
  });

  const scenesQuery = useQuery({
    queryKey: controllerQueryKeys.scenes(userId),
    queryFn: () => api.listScenes(),
    enabled: Boolean(session)
  });

  const displays = displaysQuery.data ?? [];
  const routeCompanyId = params.companyId ?? DEFAULT_COMPANY_ID;
  const cafe = meQuery.data?.cafe;
  const companyId = cafe?.id ?? DEFAULT_COMPANY_ID;
  const selectedCompanyId = routeCompanyId === DEFAULT_COMPANY_ID ? companyId : routeCompanyId;
  const groups = useMemo(
    () =>
      Array.from(
        new Set(
          displays
            .map((display) => display.groupName)
            .filter((groupName): groupName is string => Boolean(groupName)),
        ),
      ),
    [displays],
  );
  const companies = useMemo<Company[]>(
    () => [
      {
        id: companyId,
        name: cafe?.name ?? "Cafe",
        plan: "Standard",
        region: "Local",
        groups,
        deviceIds: displays.map((display) => display.id),
      },
    ],
    [cafe?.name, companyId, displays, groups],
  );
  const companyDisplays = useMemo(
    () => ({ [companyId]: displays }),
    [companyId, displays],
  );
  const selected = displays.find((display) => display.id === selectedDisplayId);
  const activityQuery = useQuery({
    queryKey: [...controllerQueryKeys.displays(userId), selectedDisplayId, "activity"] as const,
    queryFn: () => api.listDisplayActivity(selectedDisplayId),
    enabled: Boolean(session && selectedDisplayId && selected)
  });
  const filteredDisplays = displays.filter((display) => {
    if (screenFilter === "online") return display.online;
    if (screenFilter === "offline") return !display.online;
    return true;
  });
  const selectedCapabilityCanvas = getCapabilityCanvas(selected?.capabilities);
  const trimmedAuthEmail = authEmail.trim();
  const trimmedOtp = otp.trim();
  const canRequestOtp = Boolean(trimmedAuthEmail);
  const canVerifyOtp = canRequestOtp && trimmedOtp.length === 6;

  useEffect(() => {
    if (!session) return;
    return connectControllerSocket(
      serverUrl,
      session.accessToken,
      (nextDisplays) => queryClient.setQueryData(controllerQueryKeys.displays(userId), nextDisplays),
      (display) => queryClient.setQueryData(controllerQueryKeys.displays(userId), (current: DisplayStatus[] | undefined) => upsertDisplay(current, display)),
      addLog
    );
  }, [queryClient, serverUrl, session, userId]);

  useEffect(() => {
    if (!selected) return;
    setSelectedDraft({
      name: selected.name ?? "",
      groupName: selected.groupName ?? "",
      positionLabel: selected.positionLabel ?? ""
    });
  }, [selected]);

  const createDisplayMutation = useMutation({
    mutationFn: () =>
      api.createDisplay({
        id: newDisplay.id.trim(),
        name: newDisplay.name.trim() || undefined,
        groupName: newDisplay.groupName.trim() || undefined,
        positionLabel: newDisplay.positionLabel.trim() || undefined
      }),
    onSuccess: (display) => {
      queryClient.setQueryData(controllerQueryKeys.displays(userId), (current: DisplayStatus[] | undefined) => upsertDisplay(current, display));
      setNewDisplay({ id: "", name: "", groupName: "", positionLabel: "" });
      addLog(`Created ${display.name ?? display.id}`);
      void navigate({ to: "/companies/$companyId/displays/$displayId", params: { companyId: selectedCompanyId, displayId: display.id }, search: { filter: "all" } });
    },
    onError: (error) => addLog(error instanceof Error ? error.message : "Could not create display")
  });

  const linkTvMutation = useMutation({
    mutationFn: () => api.linkTv(linkingCode.trim()),
    onSuccess: (display) => {
      queryClient.setQueryData(controllerQueryKeys.displays(userId), (current: DisplayStatus[] | undefined) => upsertDisplay(current, display));
      setLinkingCode("");
      addLog(`Linked ${display.name ?? display.id}`);
      void navigate({ to: "/companies/$companyId/displays/$displayId", params: { companyId: selectedCompanyId, displayId: display.id }, search: { filter: "all" } });
    },
    onError: (error) => addLog(error instanceof Error ? error.message : "Could not link TV")
  });

  const relinkTvMutation = useMutation({
    mutationFn: (code: string) => {
      if (!selected) throw new Error("Select a display first");
      return api.linkTv(code, selected.id);
    },
    onSuccess: (display) => {
      queryClient.setQueryData(controllerQueryKeys.displays(userId), (current: DisplayStatus[] | undefined) => upsertDisplay(current, display));
      addLog(`Relinked ${display.name ?? display.id}`);
    },
    onError: (error) => addLog(error instanceof Error ? error.message : "Could not relink TV")
  });

  const updateDisplayMutation = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("Select a display first");
      return api.updateDisplay(selected.id, selectedDraft);
    },
    onSuccess: (display) => {
      queryClient.setQueryData(controllerQueryKeys.displays(userId), (current: DisplayStatus[] | undefined) => upsertDisplay(current, display));
      addLog(`Updated ${display.name ?? display.id}`);
    },
    onError: (error) => addLog(error instanceof Error ? error.message : "Could not update display")
  });

  const uploadAssetMutation = useMutation({
    mutationFn: (input: AssetUploadInput) => api.uploadAsset(input.file),
    onSuccess: (asset, input) => {
      const assetReference = sceneAssetReference(asset.id);
      setAssetPreviewUrls((current) => ({ ...current, [assetReference]: asset.url }));
      setScene((current) => addImageLayer(current, assetReference, input.position, input.file.type.startsWith("video/") ? "video" : "image"));
      addLog(`Uploaded ${input.file.name}`);
    },
    onError: (error) => addLog(error instanceof Error ? error.message : "Could not upload asset")
  });

  const saveSceneMutation = useMutation({
    mutationFn: (input?: Scene) => api.saveScene(input ?? scene),
    onSuccess: (savedScene) => {
      setScene(savedScene.scene);
      queryClient.setQueryData(controllerQueryKeys.scenes(userId), (current: typeof scenesQuery.data | undefined) => {
        const next = [savedScene, ...(current ?? []).filter((item) => item.id !== savedScene.id)];
        return next.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      });
      addLog(`Saved ${savedScene.title}`);
    },
    onError: (error) => addLog(error instanceof Error ? error.message : "Could not save screen")
  });

  const sendSceneMutation = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("Select a display first");
      return api.sendScene(selected.id, scene);
    },
    onSuccess: () => {
      addLog(`Sent scene to ${selected?.name ?? selected?.id}`);
      queryClient.invalidateQueries({ queryKey: [...controllerQueryKeys.displays(userId), selectedDisplayId, "activity"] });
    },
    onError: (error) => addLog(error instanceof Error ? error.message : "Could not send scene")
  });

  const broadcastSceneMutation = useMutation({
    mutationFn: () => api.broadcastScene(scene),
    onSuccess: () => addLog("Broadcast scene to all owned displays"),
    onError: (error) => addLog(error instanceof Error ? error.message : "Could not broadcast scene")
  });

  const sendOtp = async () => {
    if (!supabase) return;
    setAuthError("");
    setOtp("");
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedAuthEmail,
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

  const verifyOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setAuthError("");
    const { data, error } = await supabase.auth.verifyOtp({ email: trimmedAuthEmail, token: trimmedOtp, type: "email" });
    if (error) {
      setAuthError(error.message);
      return;
    }
    if (data.session) {
      setOtp("");
      setOtpSent(false);
      setSession({ accessToken: data.session.access_token, user: { id: data.session.user.id, email: data.session.user.email } });
    }
  };

  const changeAuthEmail = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAuthEmail(event.target.value);
    setOtp("");
    setOtpSent(false);
    setAuthError("");
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    queryClient.clear();
    setSession(undefined);
  };

  const newScene = () => {
    setScene(createEditableScene());
    addLog("Started a new screen");
  };

  const loadScene = (nextScene: Scene) => {
    setScene(nextScene);
    addLog(`Loaded ${nextScene.title}`);
  };

  const saveSceneAsCopy = () => {
    const copy = {
      ...scene,
      id: cryptoRandomId("scene"),
      title: scene.title.endsWith(" copy") ? scene.title : `${scene.title} copy`,
      createdAt: undefined,
      updatedAt: undefined
    };
    setScene(copy);
    saveSceneMutation.mutate(copy);
  };

  if (!supabase) {
    return (
      <main className="grid min-h-svh place-items-center p-6">
        <Alert className="max-w-xl">
          <AlertTitle>Supabase is not configured</AlertTitle>
          <AlertDescription>Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY for the controller.</AlertDescription>
        </Alert>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="grid min-h-svh place-items-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sign in to TVSys</CardTitle>
            <CardDescription>Use your cafe email, then enter the code or open the sign-in link Supabase sends you.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={otpSent ? verifyOtp : requestOtp}>
              <Field label="Server URL" htmlFor="server-url">
                <Input id="server-url" value={serverUrl} onChange={(event) => setServerUrl(event.target.value)} />
              </Field>
              <Field label="Email" htmlFor="email">
                <Input id="email" type="email" value={authEmail} onChange={changeAuthEmail} />
              </Field>
              {otpSent ? (
                <div className="grid gap-2">
                  <Label>Six-digit code</Label>
                  <p className="text-sm text-muted-foreground">Enter the code sent to {trimmedAuthEmail}.</p>
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      {[0, 1, 2, 3, 4, 5].map((index) => (
                        <InputOTPSlot index={index} key={index} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                  <Button
                    type="button"
                    variant="ghost"
                    className="justify-self-start px-0"
                    onClick={() => void sendOtp()}
                  >
                    Send a new code
                  </Button>
                </div>
              ) : null}
              {authError ? <p className="text-sm text-destructive">{authError}</p> : null}
              <Button type="submit" disabled={otpSent ? !canVerifyOtp : !canRequestOtp}>
                {otpSent ? "Verify code" : "Send code"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  const sidebarUser = {
    name: cafe?.name ?? session.user.email?.split("@")[0] ?? "TVSys",
    email: session.user.email ?? "Signed in",
  };
  const viewTitle = selectedDisplayId ? selected?.name ?? selectedDisplayId : cafe?.name ?? "Devices";

  return (
    <SidebarProvider>
      <AppSidebar
        companies={companies}
        companyDisplays={companyDisplays}
        onSignOut={() => void signOut()}
        screenFilter={screenFilter}
        selectedCompanyId={selectedCompanyId}
        selectedDisplayId={selectedDisplayId}
        user={sidebarUser}
      />
      <SidebarInset className="h-svh overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-medium">{viewTitle}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {selectedDisplayId ? "Display editor" : `${filteredDisplays.length} of ${displays.length} devices`}
            </p>
          </div>
          <Input
            className="hidden h-8 w-64 md:block"
            value={serverUrl}
            onChange={(event) => setServerUrl(event.target.value)}
            aria-label="Server URL"
          />
          <Button variant="outline" size="sm" onClick={() => void signOut()}>
            <LogOut />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
          {selectedDisplayId ? (
            selected ? (
              <SceneEditor
                activity={activityQuery.data ?? []}
                assetPreviewUrls={assetPreviewUrls}
                display={selected}
                displayDraft={selectedDraft}
                displaysCount={displays.length}
                isBroadcasting={broadcastSceneMutation.isPending}
                isSavingScene={saveSceneMutation.isPending}
                isSending={sendSceneMutation.isPending}
                isRelinking={relinkTvMutation.isPending}
                isUpdatingDisplay={updateDisplayMutation.isPending}
                isUploadingAsset={uploadAssetMutation.isPending}
                logs={logs}
                onBroadcast={() => broadcastSceneMutation.mutate()}
                onLoadScene={loadScene}
                onNewScene={newScene}
                onSaveAsCopy={saveSceneAsCopy}
                onSaveDevice={() => updateDisplayMutation.mutate()}
                onSaveScene={() => saveSceneMutation.mutate(undefined)}
                onSend={() => sendSceneMutation.mutate()}
                onRelink={(code) => relinkTvMutation.mutate(code)}
                onUpdateDisplayDraft={setSelectedDraft}
                onUploadAsset={(file, position) => uploadAssetMutation.mutate({ file, position })}
                savedScenes={scenesQuery.data ?? []}
                scene={scene}
                selectedCapabilityCanvas={selectedCapabilityCanvas}
                setScene={setScene}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Device not found</CardTitle>
                  <CardDescription>That display is not in the current device list.</CardDescription>
                </CardHeader>
              </Card>
            )
          ) : (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <section className="grid content-start gap-4">
                <Card>
                  <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>{cafe?.name ?? "Cafe"} devices</CardTitle>
                      <CardDescription>{displays.length} owned devices</CardDescription>
                    </div>
                    <div className="flex gap-1">
                      {(["all", "online", "offline"] as const).map((filter) => (
                        <Button
                          key={filter}
                          size="sm"
                          variant={screenFilter === filter ? "secondary" : "ghost"}
                          onClick={() => void navigate({ to: "/companies/$companyId", params: { companyId: selectedCompanyId }, search: { filter } })}
                        >
                          {filter}
                        </Button>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {filteredDisplays.length ? (
                      <div className="grid gap-2 md:grid-cols-2">
                        {filteredDisplays.map((display) => (
                          <Button asChild className="h-auto justify-start gap-3 p-3" key={display.id} variant="outline">
                            <Link to="/companies/$companyId/displays/$displayId" params={{ companyId: selectedCompanyId, displayId: display.id }} search={{ filter: screenFilter }}>
                              <Monitor />
                              <span className="grid min-w-0 flex-1 text-left">
                                <span className="truncate font-medium">{display.name ?? display.id}</span>
                                <span className="truncate text-xs text-muted-foreground">{display.groupName || display.positionLabel || display.id}</span>
                              </span>
                              <Badge variant={display.online ? "default" : "outline"}>{display.online ? "online" : "offline"}</Badge>
                            </Link>
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                        No devices match the current filter.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Activity</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-2">
                    {logs.length ? logs.map((log) => <p className="text-sm text-muted-foreground" key={log}>{log}</p>) : <p className="text-sm text-muted-foreground">No activity yet.</p>}
                  </CardContent>
                </Card>
              </section>

              <aside className="grid content-start gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Add devices</CardTitle>
                    <CardDescription>Link a TV or create a device manually.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <Input placeholder="TV linking code" value={linkingCode} onChange={(event) => setLinkingCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
                    <Button disabled={linkingCode.trim().length !== 6} onClick={() => linkTvMutation.mutate()}>
                      <Plus />
                      Link TV
                    </Button>
                    <Separator />
                    <Input placeholder="Manual device id" value={newDisplay.id} onChange={(event) => setNewDisplay({ ...newDisplay, id: event.target.value })} />
                    <Input placeholder="Name" value={newDisplay.name} onChange={(event) => setNewDisplay({ ...newDisplay, name: event.target.value })} />
                    <Input placeholder="Group" value={newDisplay.groupName} onChange={(event) => setNewDisplay({ ...newDisplay, groupName: event.target.value })} />
                    <Input placeholder="Position" value={newDisplay.positionLabel} onChange={(event) => setNewDisplay({ ...newDisplay, positionLabel: event.target.value })} />
                    <Button disabled={!newDisplay.id.trim()} onClick={() => createDisplayMutation.mutate()}>
                      <Plus />
                      Add device
                    </Button>
                  </CardContent>
                </Card>
              </aside>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

const Field = ({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) => (
  <div className="grid gap-2">
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
  </div>
);

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
