import { createClient } from "@supabase/supabase-js";
export const createTvsysSupabaseClient = (url, key, options = {}) => createClient(url, key, options);
