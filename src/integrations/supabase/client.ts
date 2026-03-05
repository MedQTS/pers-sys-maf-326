import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function getEnv(names: string[], label: string): string {
  for (const name of names) {
    const val = (import.meta.env as any)[name];
    if (val) return val;
  }
  throw new Error(
    `Missing env var for ${label}. Tried: ${names.join(", ")}. ` +
    `Set one of these in your .env file or hosting environment.`
  );
}

function getSupabaseUrl(): string {
  const explicitUrl =
    (import.meta.env as any).VITE_SUPABASE_URL ??
    (import.meta.env as any).SUPABASE_URL;
  if (explicitUrl) return explicitUrl;

  const projectId = (import.meta.env as any).VITE_SUPABASE_PROJECT_ID;
  if (projectId) return `https://${projectId}.supabase.co`;

  throw new Error(
    "Missing env var for Supabase URL. Tried: VITE_SUPABASE_URL, SUPABASE_URL, and VITE_SUPABASE_PROJECT_ID (derived URL)."
  );
}

const SUPABASE_URL = getSupabaseUrl();

const SUPABASE_KEY = getEnv(
  ["VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"],
  "Supabase anon key"
);

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: globalThis.localStorage ?? undefined,
    persistSession: true,
    autoRefreshToken: true,
  }
});
