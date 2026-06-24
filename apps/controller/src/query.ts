import type { DisplayStatus } from "@tvsys/shared";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { get, set, del } from "idb-keyval";

export const controllerQueryKeys = {
  all: (userId: string) => ["controller", userId] as const,
  me: (userId: string) => [...controllerQueryKeys.all(userId), "me"] as const,
  displays: (userId: string) => [...controllerQueryKeys.all(userId), "displays"] as const,
  scenes: (userId: string) => [...controllerQueryKeys.all(userId), "scenes"] as const,
  assets: (userId: string) => [...controllerQueryKeys.all(userId), "assets"] as const
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24,
      staleTime: 1000 * 10,
      retry: 1
    }
  }
});

export const queryPersister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => get<string>(key),
    setItem: (key, value) => set(key, value),
    removeItem: (key) => del(key)
  },
  key: "tvsys-controller-query-cache"
});

export const upsertDisplay = (displays: DisplayStatus[] | undefined, display: DisplayStatus): DisplayStatus[] =>
  [...(displays ?? []).filter((item) => item.id !== display.id), display].sort((a, b) => a.id.localeCompare(b.id));
