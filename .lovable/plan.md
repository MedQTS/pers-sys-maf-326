

## Plan: Fix Supabase client boot with env-var fallbacks

### Root Cause
`.env` was deleted and gitignored. `import.meta.env.VITE_SUPABASE_URL` is undefined, so `createClient()` throws at boot.

### Changes

**1. `src/integrations/supabase/client.ts`**
- Add `getEnv()` helper with fallback chain
- URL: `VITE_SUPABASE_URL` → `SUPABASE_URL`
- Key: `VITE_SUPABASE_PUBLISHABLE_KEY` → `VITE_SUPABASE_ANON_KEY` → `SUPABASE_ANON_KEY`
- Hard fail with descriptive error if missing
- Optional: guard `localStorage` with `globalThis.localStorage` check

**2. `src/lib/api.ts`**
- Use same `getEnv()` fallback chain (not `(supabase as any).supabaseUrl`)
- Add `Authorization: Bearer <anon>` and `Accept: application/json` headers
- Handle non-2xx responses with `throw new Error(...)` instead of silent `resp.json()`
- Use exact code pattern provided by user

### Constraints enforced
- Zero hardcoded keys/URLs
- Fallbacks = alternative env var names only
- Hard fail with clear error if all miss
- `VITE_SUPABASE_PROJECT_ID` eliminated

