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

const SUPABASE_URL = getEnv(
  ["VITE_SUPABASE_URL", "SUPABASE_URL"],
  "Supabase URL"
);

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
