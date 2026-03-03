

## Plan

Two surgical edits to `supabase/functions/pers-sys-pull-squiggle/index.ts`:

1. **Lines 25-30**: Replace the team select/mapping to use `squiggle_team_id` (integer) instead of `squiggle_name` (string).

2. **Lines 45-48**: Replace the lookup to use `teamBySquiggleId[Number(...)]` instead of `teamBySquiggle[hteam]`.

No other files affected. Deploy the function after editing.

