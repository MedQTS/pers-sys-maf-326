Repository: pers-sys-maf-326
Branch: main
Codex environment: continue in existing container
Ensure compliance with the repo-local approved agents file as defined by the verified active governance; if no approved repo-local agents file is present in the target repository, do not proceed further and advise that it is not present.

Task Label: IMPLEMENT

Goal:
Create a new repo-local Governance - Agents.md as a single focused change, using the completed inspection summary as the evidence base.

Constraints:
- This task is only to create Governance - Agents.md.
- Do not modify any other file.
- Do not refactor, rename, move, or delete anything.
- Do not create a PR yet unless explicitly requested after file creation.
- Keep the file concise, execution-focused, and specific to this repository.
- Do not use generic placeholder text where the inspection already provides repo-specific detail.
- Where something remains uncertain, keep wording cautious rather than guessing.
- The file must reflect that this repo is operationally sensitive because it includes:
  - Supabase Edge Functions
  - migrations
  - betting/signals logic
  - watcher automation
  - alert/email sending
  - settlement and bankroll-related paths
- Prefer narrow safety rules over long prose.

Required file:
- Governance - Agents.md at repository root

Required content shape:
1. PURPOSE
   - repo-local execution rules for this repository

2. REPOSITORY PURPOSE
   - short repo-specific paragraph based on inspection:
     Supabase-backed AFL betting/signals runner with React operator UI and Edge Functions for ingestion, evaluation, watchers, alerts, and settlement

3. GOVERNANCE MODEL
   - builder/global governance + this local file

4. EXECUTION BOUNDARIES
   - narrow PRs
   - preserve structure
   - no speculative refactors
   - extra caution on live-data / side-effect surfaces

5. REPOSITORY STRUCTURE
   - require inspection before assumptions
   - mention key areas:
     - src/
     - supabase/functions/
     - supabase/migrations/
     - docs/

6. BRANCH DISCIPLINE
   - one focused change from main
   - draft PR workflow

7. PR DISCIPLINE
   - minimal files
   - no mixed subsystem edits
   - no direct merges

8. OPERATIONAL SAFETY FOR THIS REPO
   - treat these as sensitive:
     - evaluator logic
     - staking logic
     - bankroll-related logic
     - watcher timing/orchestration
     - alert/email functions
     - settlement paths
     - odds/fixture ingestion
   - do not change these casually
   - verify downstream effects before merge recommendation

9. MIGRATION / CONFIG SAFETY
   - schema/config drift is a known risk
   - verify migrations, seeds, and code alignment
   - do not assume live DB state
   - if code expects DB state not created by migrations, fix the repo, not the assumption

10. AUTOMATION SAFETY
    - preserve OPEN / T60 / T30 / T10 semantics if present
    - preserve idempotency/dedupe expectations
    - avoid introducing duplicate watcher or alert paths

11. DOCUMENTATION AUTHORITY
    - docs/ audit files are important operational context
    - generic README must not override code + docs evidence

12. VERIFICATION EXPECTATIONS
    - before merge readiness, verify:
      - affected execution path
      - migration/config alignment
      - no duplicate side effects
      - no unintended alert/stake/settlement behavior
      - no legacy/v2 registry confusion where relevant

13. FORBIDDEN ACTIONS
    - no repo restructuring
    - no unrelated refactors
    - no casual changes to staking or settlement semantics
    - no deletion of migrations without explicit instruction
    - no assuming production behavior from local inference

14. CODEX OUTPUT SUMMARY FORMAT
    - what changed
    - why
    - files changed
    - migrations changed
    - what was not changed
    - risk assessment

15. FINAL PRINCIPLE
    - small, safe, reversible changes
    - correctness and reproducibility over speed

Required return format:
1. Confirm file created path
2. Paste the full Governance - Agents.md content
3. State whether any other files were changed
4. State any wording that was intentionally cautious due to inspection unknowns

## Architecture References

Before planning, reviewing, or proposing changes, consult the root-level `Architecture/` folder in this repository.

Use the files in `Architecture/` to understand:
- intended system design
- module boundaries
- delivery gates
- current planned scope
- naming and terminology
- non-goals, deferred items, and architecture direction

Treat the root-level `Architecture/` folder as the design-intent reference for this repository.

However:
- do not assume the codebase fully matches the files in `Architecture/`
- verify actual implementation from repository files before claiming something is implemented
- if repository reality differs from `Architecture/`, state the mismatch explicitly
- use repository code and current files as implementation truth, and `Architecture/` as intended-direction guidance
