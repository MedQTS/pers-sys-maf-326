import { supabase } from "@/integrations/supabase/client";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

export async function invokeEdgeFunction(
  functionName: string,
  body?: Record<string, unknown>
) {
  const url = `https://${PROJECT_ID}.supabase.co/functions/v1/${functionName}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: body ? JSON.stringify(body) : "{}",
  });
  return resp.json();
}

export { supabase };
