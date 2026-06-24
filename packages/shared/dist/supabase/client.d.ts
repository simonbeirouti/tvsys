import { type SupabaseClient, type SupabaseClientOptions } from "@supabase/supabase-js";
import type { Database } from "./types.js";
export type TvsysSupabaseClientOptions = SupabaseClientOptions<"public">;
export type TvsysSupabaseClient = SupabaseClient<Database>;
export declare const createTvsysSupabaseClient: (url: string, key: string, options?: TvsysSupabaseClientOptions) => TvsysSupabaseClient;
//# sourceMappingURL=client.d.ts.map