CHUNK_ID: 003
DOC_ID: pers-sys-delivery-gates
DOC_TITLE: Pers Sys - Delivery Gates
SECTION_RANGE: auto
PREVIOUS_CHUNK: 002
NEXT_CHUNK: 004
SOURCE_OF_TRUTH: true

### 14.2 Gate 6 update - SYS_7 T30-action alignment

Gate 6 remains partially passed.

Additional Gate 6 finding:

- A SYS_7 READY audit outcome existed without matching signal/email materialisation.
- The issue was diagnosed as a timing/materialisation alignment problem: SYS_7 could become READY in a path that did not align with ACTION_T30 signal creation.
- A targeted fix has been deployed to align SYS_7 with the T30-action path.

Gate interpretation:

Watcher automation is active and the SYS_7 alignment fix is deployed, but Gate 6 is not fully closed until a future eligible SYS_7 run proves clean behaviour.

Required proof before Gate 6 can advance:

- fresh post-fix SYS_7 audit evidence;
- proof that eligible SYS_7 READY outcomes materialise into actionable signal rows; or
- proof that ineligible SYS_7 candidates fail cleanly before signal creation.

### 14.3 Gate 6 update - SYS_7 operator exclusion overlay

SYS_7 now has an operator exclusion overlay.

Excluded selected-home teams:

- Gold Coast
- Port Adelaide
- North Melbourne
- GWS

Expected behaviour:

- SYS_7 selects the home side.
- If the selected home side is excluded, the evaluator should fail before actionable signal creation.
- Expected fail code: operator_excluded_team.
- No actionable SYS_7 signal should be written for excluded selected-home teams.

Gate interpretation:

The operator exclusion overlay is deployed, but still requires fresh runtime audit verification before it can be treated as fully proven.

### 14.4 Gate 7 update - READY audit materialisation requirement

Gate 7 remains OPEN.

Additional Gate 7 requirement:

A READY audit row in an action-capable path must either:

- materialise into pers_sys_signals_v2; or
- have an explicit, deliberate suppression or materialisation explanation.

A READY audit row with no matching signal row is not a normal no-bet outcome.

It is an audit-to-signal materialisation issue until proven otherwise.

Gate 7 cannot close until future live evidence proves:

- READY rows are not missed by signal creation;
- signal rows are not missed by alerting;
- SYS_7 post-fix materialisation behaves correctly;
- SYS_7 operator-excluded teams fail cleanly;
- repeated watcher hits do not create duplicate side effects;
- no-bet outcomes remain traceable through snapshots, audit rows and signal rows.

### 14.5 SYS_12 phase gate status

SYS_12 is recognised as a current system concept, but only Phase 1A has been implemented.

Current SYS_12 Phase 1A status:

- candidate-leg evaluator and audit only;
- no basket construction;
- no staking allocation;
- no SYS_10A pairing;
- no watcher integration;
- no T30 action;
- no alerting;
- no bet placement.

Gate interpretation:

SYS_12 Phase 1A does not move Gate 6 or Gate 7 toward trusted automation. It is a candidate/audit proof phase only.

Future SYS_12 phases require separate gate treatment for:

- basket construction;
- stake allocation;
- SYS_10A pairing;
- watcher/T30 integration;
- alerting;
- bet-placement boundaries.

### 14.6 Updated gate summary overlay

Additional current status overlay:

| Area | Status | Gate impact |
|---|---|---|
| SYS_7 T30-action alignment | DEPLOYED / VERIFICATION PENDING | Gate 6 remains partial; Gate 7 remains open. |
| SYS_7 operator exclusion | DEPLOYED / VERIFICATION PENDING | Gate 6 requires fresh fail-path proof. |
| SYS_10A email wording | DEPLOYED / DRY-RUN VERIFIED | Improves disclosure only; does not close automation gates. |
| SYS_10A weather integration | NOT PROVEN ACTIVE | Manual weather check remains required for outdoor venues. |
| SYS_12 Phase 1A | IMPLEMENTED / ACCEPTED | Candidate/audit only; no automation gate closure. |

### 14.7 Updated immediate gate-focused next steps

Add these to the current gate-focused next-step chain:

1. Verify fresh SYS_7 post-fix runtime behaviour.
2. Verify SYS_7 READY audit outcomes materialise into signal rows when action-capable.
3. Verify SYS_7 excluded selected-home teams fail with operator_excluded_team.
4. Confirm SYS_10A remains manual/disclosure-only unless a later governed weather-integration phase is opened.
5. Keep SYS_12 at Phase 1A candidate/audit status until basket, stake and action phases are separately designed and approved.

Gate 7 remains open until these items are proven alongside the existing repeated-cycle, duplicate-side-effect, alerting and post-hotfix staking checks.

## 15. Current closeout addendum - SYS_10A W1 gate impact

This addendum records gate impacts from the July 2026 SYS_10A weather-display, seed-precheck and warning-rendering closeout.

### 15.1 Gate 5 update - manual guide safety and warning rendering

Gate 5 remains mostly passed for active inspected stake-source and suppression paths, with SYS_10A still outside automated betting.

Additional Gate 5 position:

- SYS_10A remains a manual totals guide.
- SYS_10A does not create ACTION NOW alerts.
- SYS_10A does not place bets.
- SYS_10A weather is display-only in W1.
- Weather does not alter pick logic, stake logic, suppression logic or alerting.
- RECENT FORM WARNING email rendering has been dry-run verified.
- Warning-state output can change operator-facing stake guidance to `0u default` and price-check/pass-preferred language.
- This is manual guide wording, not automated bet suppression.

Gate interpretation:

SYS_10A operator disclosure and warning rendering are materially improved. This improves manual safety but does not close any automation gate.
