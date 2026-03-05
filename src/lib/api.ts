import { supabase } from "@/integrations/supabase/client";

function getEnv(names: string[], label: string): string {
  for (const name of names) {
    const val = (import.meta.env as any)[name];
    if (val) return val;
  }
  throw new Error(`Missing env var for ${label}. Tried: ${names.join(", ")}.`);
}

const SUPABASE_URL = getEnv(["VITE_SUPABASE_URL", "SUPABASE_URL"], "Supabase URL");

const ANON_KEY = getEnv(
  ["VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"],
  "Supabase anon key"
);

export async function invokeEdgeFunction(
  functionName: string,
  body?: Record<string, unknown>
) {
  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "apikey": ANON_KEY,
      "Authorization": `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body ?? {}),
  });

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Edge function ${functionName} failed (${resp.status}): ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

export { supabase };
