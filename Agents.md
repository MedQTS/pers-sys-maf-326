<!-- SECTION\_TOC\_START -->

\## SECTION TOC



\- PURPOSE => # PURPOSE

\- REPOSITORY\_PURPOSE => # REPOSITORY PURPOSE

\- GOVERNANCE\_MODEL => # GOVERNANCE MODEL

\- EXECUTION\_BOUNDARIES => # EXECUTION BOUNDARIES

\- REPOSITORY\_STRUCTURE => # REPOSITORY STRUCTURE

\- BRANCH\_DISCIPLINE => # BRANCH DISCIPLINE

\- PR\_DISCIPLINE => # PR DISCIPLINE

\- OPERATIONAL\_SAFETY\_FOR\_THIS\_REPO => # OPERATIONAL SAFETY FOR THIS REPO

\- MIGRATION\_CONFIG\_SAFETY => # MIGRATION / CONFIG SAFETY

\- AUTOMATION\_SAFETY => # AUTOMATION SAFETY

\- DOCUMENTATION\_AUTHORITY => # DOCUMENTATION AUTHORITY

\- VERIFICATION\_EXPECTATIONS => # VERIFICATION EXPECTATIONS

\- FORBIDDEN\_ACTIONS => # FORBIDDEN ACTIONS

\- CODEX\_OUTPUT\_SUMMARY\_FORMAT => # CODEX OUTPUT SUMMARY FORMAT

\- FINAL\_PRINCIPLE => # FINAL PRINCIPLE



<!-- SECTION\_TOC\_END -->



<!-- START: PURPOSE -->

\# PURPOSE



This file provides repo-local execution rules for AI coding agents working inside this repository.



It is intentionally shorter than the global builder or Codex governor and focuses on repository-level execution safety, scope control, and verification discipline for this specific codebase.



The global governance layer controls planning and orchestration.  

This file controls how agents behave when inspecting or editing this repository.



\---



<!-- END: PURPOSE -->



<!-- START: REPOSITORY\_PURPOSE -->

\# REPOSITORY PURPOSE



This repository implements a Supabase-backed AFL betting and signals runner with a React-based operator UI. It includes repository code for fixture and odds ingestion, feature building, systems evaluation, watcher automation, alert generation, and settlement flows. Because these paths can affect signals, stake-related behavior, alerts, bankroll-related logic, and database state, the repository must be treated as operationally sensitive.



\---



<!-- END: REPOSITORY\_PURPOSE -->



<!-- START: GOVERNANCE\_MODEL -->

\# GOVERNANCE MODEL



Two governance layers exist:



Global builder / ChatGPT governance



\- planning

\- sequencing

\- merge readiness

\- task shaping



`Governance - Agents.md`, this file



\- repository execution rules

\- scope boundaries

\- operational safety

\- verification expectations



Agents must follow both.



\---



<!-- END: GOVERNANCE\_MODEL -->



<!-- START: EXECUTION\_BOUNDARIES -->

\# EXECUTION BOUNDARIES



Agents working in this repository must:



\- follow the narrow-PR workflow

\- preserve repository structure

\- avoid unrelated changes

\- avoid speculative refactors

\- produce clear summaries of work performed

\- apply extra caution on side-effect and automation surfaces



Agents must not make broad structural, behavioral, or operational changes unless explicitly instructed.



\---



<!-- END: EXECUTION\_BOUNDARIES -->



<!-- START: REPOSITORY\_STRUCTURE -->

\# REPOSITORY STRUCTURE



Agents should inspect the repository before making assumptions.



Do not rely on stale documentation, generic scaffold files, or assumed paths.



Key repository areas include:



\- `src/` for the React operator UI and frontend logic

\- `supabase/functions/` for Edge Functions and operational pipeline logic

\- `supabase/migrations/` for schema and configuration changes

\- `docs/` for audit and operational analysis documents



When a task touches evaluator logic, watcher behavior, alerting, settlement, staking, or schema/config behavior, inspect the relevant files directly before proposing changes.



\---



<!-- END: REPOSITORY\_STRUCTURE -->



<!-- START: BRANCH\_DISCIPLINE -->

\# BRANCH DISCIPLINE



All changes must follow this pattern:



start from main  

create one clean branch  

implement one focused change  

open a draft PR



Rules:



\- one logical change per branch

\- avoid mixing policy, schema, and logic changes unless the task explicitly requires it

\- avoid multi-subsystem edits in a single PR



\---



<!-- END: BRANCH\_DISCIPLINE -->



<!-- START: PR\_DISCIPLINE -->

\# PR DISCIPLINE



A valid PR must:



\- have a single clear purpose

\- change minimal files

\- avoid unrelated edits

\- include migrations when required

\- keep operational risk easy to review



Agents must not merge directly.



All merges must occur through PR review.



\---



<!-- END: PR\_DISCIPLINE -->



<!-- START: OPERATIONAL\_SAFETY\_FOR\_THIS\_REPO -->

\# OPERATIONAL SAFETY FOR THIS REPO



The following surfaces are operationally sensitive and must be treated with extra caution:



\- evaluator logic

\- staking logic

\- bankroll-related behavior

\- watcher timing and orchestration

\- alert and email functions

\- settlement paths

\- odds and fixture ingestion

\- database writes tied to signals, bets, alerts, or ledger outcomes



Agents must not change these casually.



Before recommending merge readiness for changes touching these areas, agents must verify likely downstream effects and identify any operational dependencies or side effects.



When uncertain, agents must use cautious wording rather than assume live behavior.



\---



<!-- END: OPERATIONAL\_SAFETY\_FOR\_THIS\_REPO -->



<!-- START: MIGRATION\_CONFIG\_SAFETY -->

\# MIGRATION / CONFIG SAFETY



Schema and configuration drift are known risks in this repository.



Agents must ensure:



\- code, migrations, seeds, and config expectations align

\- migrations remain the source of reproducible schema behavior

\- configuration assumptions are verified against repository evidence where possible

\- live database state is never assumed from local code alone



If code expects database state not created by migrations or repo-controlled configuration, fix the repository-side gap rather than normalizing the assumption.



Additive, deterministic migration changes are preferred over destructive ones.



\---



<!-- END: MIGRATION\_CONFIG\_SAFETY -->



<!-- START: AUTOMATION\_SAFETY -->

\# AUTOMATION SAFETY



This repository contains automation and orchestration logic.



Agents must preserve:



\- OPEN / T60 / T30 / T10 timing semantics where present

\- watcher idempotency and dedupe expectations

\- separation between manual runner flows and automated watcher or maintenance flows

\- clear orchestration boundaries between ingestion, snapshotting, evaluation, alerting, and settlement



Agents must avoid introducing:



\- duplicate watcher paths

\- duplicate alert paths

\- duplicate settlement side effects

\- ambiguous orchestration between manual and automated flows



Where scheduler wiring, secrets, or live triggers are not confirmed in repository content, agents must state that uncertainty explicitly.



\---



<!-- END: AUTOMATION\_SAFETY -->



<!-- START: DOCUMENTATION\_AUTHORITY -->

\# DOCUMENTATION AUTHORITY



Audit and operational documents under `docs/` are important repository context when working on evaluator, staking, watcher, automation, alerting, or settlement behavior.



However:



\- repository code remains the primary execution truth

\- migrations remain the primary schema truth

\- generic scaffold documentation must not override repo-specific code and audit evidence



If docs and code disagree, agents must state the discrepancy clearly and avoid assuming that either one alone is authoritative without verification.



\---



<!-- END: DOCUMENTATION\_AUTHORITY -->



<!-- START: VERIFICATION\_EXPECTATIONS -->

\# VERIFICATION EXPECTATIONS



Before recommending merge readiness, agents must verify as appropriate for the task:



\- the affected execution path

\- migration and config alignment

\- no duplicate side effects were introduced

\- no unintended alert, stake, settlement, or watcher behavior was introduced

\- no legacy versus v2 registry confusion remains in the changed path, when relevant

\- the change did not create new ambiguity around operational sequencing



Verification may be performed through inspection, existing tests, or targeted review, depending on the task scope.



If confidence is limited because live infra, secrets, schedulers, or database state are not present in the repository, agents must say so explicitly.



\---



<!-- END: VERIFICATION\_EXPECTATIONS -->



<!-- START: FORBIDDEN\_ACTIONS -->

\# FORBIDDEN ACTIONS



Agents must never:



\- restructure the repository without explicit approval

\- introduce unrelated refactors

\- rename major directories

\- move files across subsystems without explicit instruction

\- make casual changes to staking or settlement semantics

\- delete migrations without explicit instruction

\- assume production behavior from local inference alone

\- treat a generic scaffold README as operational authority



Repository restructuring or operational-semantics changes require explicit approval.



\---



<!-- END: FORBIDDEN\_ACTIONS -->



<!-- START: CODEX\_OUTPUT\_SUMMARY\_FORMAT -->

\# CODEX OUTPUT SUMMARY FORMAT



When completing a change, agents must provide a concise summary:



What changed  

Why the change was necessary  

Files modified  

Migrations added or modified  

What was intentionally NOT changed  

Risk assessment



Example style:



What changed  

Adjusted watcher dedupe handling in one function.



Why  

The change reduced duplicate execution risk in a time-window path.



Files changed  

`supabase/functions/...`



Migrations changed  

None.



What was not changed  

Evaluator logic, staking logic, and settlement behavior untouched.



Risk  

Moderate - automation path change, requires verification of downstream side effects.



\---



<!-- END: CODEX\_OUTPUT\_SUMMARY\_FORMAT -->



<!-- START: FINAL\_PRINCIPLE -->

\# FINAL PRINCIPLE



Small, safe, reversible changes are always preferred.



Agents should prioritize:



correctness  

reproducibility  

minimal scope  

repository stability  

operational safety



When a change touches signals, staking, alerts, watchers, settlement, or schema/config alignment, safety and verification take priority over speed.



\---



<!-- END: FINAL\_PRINCIPLE -->

