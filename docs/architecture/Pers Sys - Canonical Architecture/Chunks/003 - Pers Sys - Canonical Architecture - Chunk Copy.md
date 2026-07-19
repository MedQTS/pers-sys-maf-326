CHUNK_ID: 003
DOC_ID: pers-sys-canonical-architecture
DOC_TITLE: Pers Sys - Canonical Architecture
SECTION_RANGE: auto
PREVIOUS_CHUNK: 002
NEXT_CHUNK: 004
SOURCE_OF_TRUTH: true

## 12. Verification model

The canonical architecture must be understood through three separate truth layers:

### Repo-confirmed

What repository code, migrations, docs, and configuration explicitly support.

### Live-confirmed

What has actually been verified in the deployed Supabase environment.

### Still assumed / pending verification

What is intended or inferred but not yet proven in the live environment.

This separation is mandatory because:

- repo remediation does not itself prove live deployment parity
- live objects may exist without clean migration provenance
- deployed functions may lag repo state
- scheduler wiring and secrets may still be incomplete

Signal-read verification must use latest-state completed-game audit rows, not raw historical audit counts. Raw audit rows can include legitimate early evaluations before later T30/T10 snapshots exist, which can make historical `missing_model_data` rows appear misleading after snapshots arrive. Latest-state audit by system and game is the correct diagnostic surface for determining whether low signal volume reflects data failure or model selectivity.

The current latest-state completed-round review showed the evaluator and signal pipeline are alive. SYS_2 and SYS_6 are the main current signal producers, SYS_7 is live but sparse, and SYS_3, SYS_5, SYS_8, and SYS_9 were mostly no-pass under current criteria. This supports the conclusion that low signal volume to date is mainly model selectivity rather than broad read failure, while still requiring future post-hotfix signal verification.

## 13. Current known unresolved architecture items

These are not delivery tasks. They are architecture items that remain open or require hard confirmation:

- watcher dispatcher cron is now activated in live production, but watcher cadence and tolerance-window rules are still not finally locked
- duplicate handling expectations across repeated watcher hits need explicit verification
- pre-bet dollar stake source is effectively aligned for active inspected paths, but post-hotfix staking output requires verification after fresh evaluator runs
- final accept/log duplicate-protection behavior must be confirmed to be per-leg, not coarse per-game across broader future market scope
- outbound email provider decision/path must remain explicit
- live migration provenance may remain unclear even when objects exist

## 14. Canonical design position

The system should be understood as:

    A Supabase-based AFL betting orchestration system that schedules high-level orchestration entrypoints, maintains ordered nightly preparation, performs timed pre-game refreshes at T60/T30/T10, enforces leg-level suppression and duplicate rules, uses latest-state audit rows for signal-read diagnosis, maintains staking-risk controls separately from model eligibility, and separates repository truth, live-environment truth, and unverified assumptions.

## 15. Final principle

The canonical architecture is not:

- one cron per low-level action
- one coarse game-level suppression rule
- one mixed bucket of repo findings and live assumptions
- raw historical audit counts treated as final read-quality truth

It is:

- orchestration-led
- sequence-sensitive
- leg-specific
- duplicate-aware
- environment-aware
- latest-state-audit aware
- explicit about unresolved contracts

## 16. Current architecture addendum - signal materialisation and manual-guide boundaries

This addendum records stable architecture guardrails arising from the SYS_7, SYS_10A and SYS_12 closeout work.

### 16.1 Audit-to-signal materialisation rule

The evaluator audit layer and actionable signal layer are separate architecture layers.

Canonical interpretation:

- `pers_sys_signal_audit_v2` records evaluator outcome and diagnostic reasoning.
- `pers_sys_signals_v2` records actionable signal materialisation.
- FAIL audit rows can legitimately explain why no actionable signal exists.
- READY audit rows are different: a READY audit row in an action-capable path must either materialise into `pers_sys_signals_v2` or have a deliberate, explicit suppression or materialisation explanation.
- A READY audit row with no matching signal row is not a normal no-bet outcome.
- A READY audit row with no matching signal row must be treated as an audit-to-signal bridge issue until proven otherwise.

Non-action diagnostic modes remain allowed to be signal-silent. The required distinction is between diagnostic/precheck evaluation and action-capable evaluation.

### 16.2 SYS_7 T30-action alignment rule

SYS_7 is an action system only when its evaluator timing, signal materialisation and alert path align to the active T30-action pathway.

Architecture rule:

- SYS_7 must not become operationally READY in a timing mode that cannot write the corresponding actionable signal.
- If SYS_7 is eligible for live action, the evaluator mode and signal-creation mode must be aligned.
- If SYS_7 is evaluated in a non-action or closeout-style mode, the resulting audit evidence must not be interpreted as a missed betting signal unless the action pathway was supposed to run.

Known closeout lesson:

- A SYS_7 READY audit outcome without a signal/email exposed an audit-to-signal alignment problem.
- The intended architecture is that eligible SYS_7 live-action cases resolve either to a signal row or to a clean fail/suppression reason.

### 16.3 SYS_7 operator exclusion overlay

SYS_7 includes an operator exclusion overlay for selected home teams.

Excluded selected-home teams:

- Gold Coast
- Port Adelaide
- North Melbourne
- GWS

Architecture rule:

- SYS_7 selects the home side.
- If the selected home side is on the operator exclusion list, the system should fail before actionable signal creation.
- Expected fail code: `operator_excluded_team`.
- Operator exclusion is model-gating logic for SYS_7, not an alert-layer suppression workaround.
