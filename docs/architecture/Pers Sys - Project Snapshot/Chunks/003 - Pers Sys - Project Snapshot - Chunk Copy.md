CHUNK_ID: 003
DOC_ID: pers-sys-project-snapshot
DOC_TITLE: Pers Sys - Project Snapshot
SECTION_RANGE: auto
PREVIOUS_CHUNK: 002
NEXT_CHUNK: 004
SOURCE_OF_TRUTH: true

### 8.7 Bankroll staking risk

Resolved at hotfix level; verification pending.

The latest staking review found that the previous live recommendations were too aggressive for validation use:

- SYS_6 produced five historical signals at 2.5% bankroll each.
- SYS_7 produced one historical signal at 6.0% bankroll.
- SYS_2 remained modest and unchanged.

The evaluator replacement content was updated as a staking-only hotfix:

- SYS_6: compressed ladder to 0.75 / 1.0 / 1.25, smaller amplifiers, hard cap 1.5%.
- SYS_7: compressed tier ladder to 1.0 / 1.5 / 2.0 units, smaller amplifiers, hard cap 2.5 units.

This change reduces bankroll risk without changing model qualification criteria.

## 9. Watcher status

Watch windows recognized:

- T60
- T30
- T10

Current watcher position:

Watcher architecture exists in repo and live deployment, and watcher automation is now active through the dispatcher cron model.

What is now confirmed:

- The dispatcher cron path has been activated in production.
- The T30 watcher path has fired operationally.
- The cron -> dispatcher -> run-watcher -> send-t30-alert chain is therefore confirmed live at least for T30.

Still pending for watcher trust:

- dispatcher cadence
- tolerance window width
- expected behavior on repeated hits inside the same window
- duplicate prevention expectations across repeated runs
- duplicate alert prevention under repeated scheduling
- full watcher behavior across all watch windows

Current stance:

Watcher automation is no longer "off."

It is active but not yet fully trusted.

## 10. Email and external dependency status

Known architectural reality:

Supabase provides:

- database
- functions
- cron orchestration

But outbound email still requires a delivery provider path such as:

- Postmark
- or equivalent

Current status:

The provider dependency is understood as operationally required.

Later thread work also confirmed that T30 outbound email is operationally firing in production.

Still pending:

Secrets and operational readiness for:

- alert/email path
- odds/data-provider path

should still be explicitly confirmed unless already verified outside this snapshot.

## 11. What is confirmed vs pending

### Confirmed

- architecture shape is coherent
- repo blocker set largely remediated
- live key schema columns present
- live SYS_8 present and active
- live staking RPC overloads present
- live core Edge Functions deployed
- pg_cron enabled
- pg_net enabled
- nightly maintenance cron active
- open-nightly cron active
- watcher dispatcher cron active
- orchestration-first cron model clarified
- T30 live alert path operationally observed
- shared preview stake path aligned across UI, T30, and accept logic for current live use
- placed-bet identity separated from change-detection identity in T30
- leg-level suppression behavior confirmed for the active inspected market scope
- specific SYS_2 linked-base-leg T30 alert behavior now confirmed in the active live path
- latest-state completed-game signal-read audit supports that evaluator/pipeline is alive
- Round 16 no-bet review confirmed no READY rows can be legitimate when audit fail rows explain system rejection
- low signal volume to date appears mostly model-selective, not broad read failure
- SYS_6/SYS_7 staking-risk hotfix applied at evaluator replacement-content level

### Pending

- nightly sequencing confidence over time
- secrets verification
- watcher cadence/tolerance lock
- watcher behavior across repeated hits verification
- duplicate-side-effect verification across repeated watcher hits
- full watcher verification across T60/T30/T10
- final trusted automation readiness
- duplicate staking RPC cleanup if desired
- TOTALS parity review before live activation of that market
- T30 repeated-live-cycle behavior confirmed over time
- post-hotfix SYS_6/SYS_7 staking output verification after fresh evaluator rows are generated

## 12. Immediate next-step chain

The narrow next-step sequence should be:

1. Verify watcher dispatcher cadence and tolerance model.
2. Verify watcher logs and side effects across repeated window hits.
3. Verify no duplicate alerts or duplicate signal creation from repeated window hits.
4. Verify required odds/email secrets are present if not already closed elsewhere.
5. Review duplicate staking RPC overload risk and simplify when safe.
6. Review TOTALS parity before activating that market in live automation.
7. Trigger or wait for fresh evaluator execution and verify post-hotfix SYS_6/SYS_7 bankroll caps.
8. Only then treat the system as trusted for end-to-end automation.
