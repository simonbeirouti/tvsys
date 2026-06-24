import { createClient, type SupabaseClient, type SupabaseClientOptions } from "@supabase/supabase-js";
import type { Database } from "./types.js";

export type TvsysSupabaseClientOptions = SupabaseClientOptions<"public">;

export type TvsysSupabaseClient = SupabaseClient<Database>;

export const createTvsysSupabaseClient = (url: string, key: string, options: TvsysSupabaseClientOptions = {}): TvsysSupabaseClient =>
  createClient<Database>(url, key, options);
