

## Deprecating `pers-sys-evaluate-systems`

### Current State
- The old `pers-sys-evaluate-systems` function exists at `supabase/functions/pers-sys-evaluate-systems/index.ts`
- **No code references it** — all callers (Dashboard, run-watcher, run-open-nightly, run-nightly-maintenance) already use `pers-sys-evaluate-systems-v2`
- It's dead code

### Best Approach

**Don't archive — just delete it.** Here's why:

- Supabase deploys every top-level folder under `supabase/functions/` as an edge function. An `archive/` subfolder approach won't work — Supabase doesn't support nested function directories
- Renaming to `pers-sys-evaluate-systems-legacy` would still deploy it as a live edge function, wasting resources and creating a confusing endpoint
- Since nothing references it, deletion is the cleanest option. Git history preserves the code if you ever need it

### Plan

1. **Delete** `supabase/functions/pers-sys-evaluate-systems/index.ts` (and its folder)
2. **Delete the deployed function** from Supabase using the delete edge functions tool, so it stops being served
3. No other files need changes — zero references exist to the old function

