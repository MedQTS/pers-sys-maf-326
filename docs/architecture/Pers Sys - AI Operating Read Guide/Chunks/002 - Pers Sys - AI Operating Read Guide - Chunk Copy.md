CHUNK_ID: 002
DOC_ID: pers-sys-ai-operating-read-guide
DOC_TITLE: Pers Sys - AI Operating Read Guide
SECTION_RANGE: auto
PREVIOUS_CHUNK: 001
NEXT_CHUNK: 003
SOURCE_OF_TRUTH: true

### No-bet / signal / T30 / watcher diagnosis

Read:

1. Pers Sys - Live Operation and Audit Map.md
2. Pers Sys - Project Snapshot.md
3. SQL/log outputs supplied in the current thread
4. Repo/live evidence if implementation proof is required

### Weather question

Read:

1. Pers Sys - Weather Scope.md
2. Pers Sys - Canonical Architecture.md if integration with the broader system is being considered
3. Pers Sys - Delivery Gates.md if weather affects readiness

### Build / code change question

Read:

1. The relevant architecture/status doc for context
2. The actual repo files
3. Relevant migrations
4. Relevant function source
5. Relevant execution logs or SQL evidence

Do not produce implementation packets from Drive docs alone where repo truth is required.

## 9. Weather reuse rule

Weather is a first-pattern subsystem build.

Once the first weather module is built and verified, future weather additions should not be treated as greenfield.

Future AI assistants should reuse:

- venue weather lookup table
- weather snapshot table
- weather assessment table
- Open-Meteo fetch/upsert pattern
- assessment/upsert function pattern
- policy_code driven assessment logic
- T30 as live weather gate unless changed
- UTC-only timestamp handling
- isolated manual test pattern before evaluator/watcher wiring

Later additions should mostly be:

- new policy rules
- new system configuration
- small assessment-function extension
- isolated test cases
- optional evaluator wiring

They should not rebuild the weather subsystem from scratch unless a provider change, schema redesign, watcher redesign, or evaluator rewrite is explicitly required.

## 10. Avoid these mistakes

Do not:

- infer pipeline failure from empty `pers_sys_signals_v2`
- skip `pers_sys_signal_audit_v2` during no-bet diagnosis
- treat raw historical audit counts as latest-state proof
- confuse audit rows with actionable signal rows
- treat watcher cron activation as full trusted automation
- treat repo remediation as live deployment proof
- treat live object presence as clean migration provenance
- reactivate deprecated systems without explicit instruction
- mix Weather Scope into active evaluator behavior before wiring is proven
- use Drive docs as proof of deployed code

## 11. Current documentation status

The Pers Sys documentation set is currently adequate for human continuity and substantially adequate for future AI orientation, provided this read guide is followed.

The documentation set covers:

- architecture
- project status
- delivery gates
- live/no-bet audit diagnosis
- weather subsystem scope

Remaining proof-dependent work must still be grounded in repo and live-environment evidence.

## 12. Update rule

Update this guide whenever:

- a new primary Pers Sys architecture document is created
- a document is renamed or superseded
- the no-bet diagnostic chain changes
- key table names change
- active or deprecated system status changes
- Weather Scope moves from isolated subsystem to evaluator-integrated live behavior
- a new domain-specific scope document is added
- the correct AI read order changes
- a repeated AI failure shows this guide is missing an important guardrail

## 13. Current closeout addendum - SYS_7, SYS_10A, and SYS_12

This addendum supplements the active/relevant system and diagnostic guardrails above until the next full guide consolidation.

### 13.1 SYS_12 read-status guardrail

Treat SYS_12 as an active/relevant Pers Sys system where current work or review refers to the bottom-2/3 fade multi basket.

Current locked status from thread closeout:

- SYS_12 Phase 1A is candidate-leg evaluator and audit only.
- Phase 1A does not include basket construction.
- Phase 1A does not include staking allocation.
- Phase 1A does not include SYS_10A pairing.
- Phase 1A does not include watcher, T30 action, alerting, or bet placement.
- Any future SYS_12 basket, stake, SYS_10A integration, watcher, or alert work requires fresh repo/live evidence and a separate governed change.

When reviewing SYS_12, do not infer live betting automation from Phase 1A audit evidence alone.

### 13.2 SYS_7 audit-to-signal bridge guardrail

A READY audit row and an actionable signal row are distinct evidence layers.

For SYS_7 and other action systems:

- `pers_sys_signal_audit_v2` proves evaluator outcome.
- `pers_sys_signals_v2` proves actionable signal materialisation.
- A READY audit row with no matching signal row is not the same as a legitimate no-bet outcome.
- A READY audit row with no matching signal row requires audit-to-signal materialisation diagnosis.

Known SYS_7 lesson from thread closeout:

- SYS_7 produced a READY audit row for Gold Coast v Collingwood.
- No signal/email materialised.
- Diagnosis: SYS_7 had been able to become READY in a closeout-style timing path while signal materialisation remained gated to ACTION_T30.
- Fix deployed: SYS_7 was aligned to the T30-action signal path.
- Runtime verification remains pending until a future eligible SYS_7 case proves either clean signal creation or clean model failure.

When diagnosing this pattern, check:

1. game and snapshot state
2. latest audit row
3. evaluator mode / watcher mode
4. model_snapshot and execution_snapshot
5. audit_status
6. signal row presence or absence
7. alert/suppression state only after a signal row exists

### 13.3 SYS_7 operator exclusion guardrail

SYS_7 now has an operator exclusion overlay.

Excluded selected-home teams:

- Gold Coast
- Port Adelaide
- North Melbourne
- GWS

Operational expectation:

- SYS_7 selects the home side.
- If the selected home team is excluded, the evaluator should fail the candidate before signal creation.
- Expected fail code: `operator_excluded_team`.
- No actionable SYS_7 signal should be written for excluded selected-home teams.

Runtime verification remains pending until a post-deploy eligible run proves the exclusion path in fresh audit output.
