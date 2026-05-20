import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnv, requireServiceRole } from "./env.js";

let publicClient: SupabaseClient | null = null;
let adminClient: SupabaseClient | null = null;

export function getPublicClient(): SupabaseClient {
  if (publicClient) return publicClient;
  const env = loadEnv();
  publicClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });
  return publicClient;
}

export function getAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;
  const env = loadEnv();
  adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, requireServiceRole(), {
    auth: { persistSession: false }
  });
  return adminClient;
}
