import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;
let _initPromise: Promise<SupabaseClient> | null = null;

async function initSupabase(): Promise<SupabaseClient> {
  const res = await fetch("/api/config");
  const config = await res.json();
  _supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
  return _supabase;
}

export function getSupabasePromise(): Promise<SupabaseClient> {
  if (_supabase) return Promise.resolve(_supabase);
  if (!_initPromise) {
    _initPromise = initSupabase();
  }
  return _initPromise;
}

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    throw new Error("Supabase not initialized yet. Use getSupabasePromise() first.");
  }
  return _supabase;
}
