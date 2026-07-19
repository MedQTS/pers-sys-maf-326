CHUNK_ID: 004
DOC_ID: pers-sys-canonical-architecture
DOC_TITLE: Pers Sys - Canonical Architecture
SECTION_RANGE: auto
PREVIOUS_CHUNK: 003
NEXT_CHUNK: none
SOURCE_OF_TRUTH: true

### 16.4 SYS_10A manual-guide and weather boundary

SYS_10A is a manual total / alt-over guide unless separate active wiring is proven.

Architecture rule:

- SYS_10A email wording does not create active weather decisioning.
- Historical weather assessment rows or policy codes do not prove current SYS_10A email weather integration.
- If SYS_10A weather evaluator, watcher, email or active-decision wiring is added later, it must be proven through repo and live-environment evidence.
- Until then, SYS_10A output is base model guidance with manual weather checking for outdoor venues.
- Docklands / Marvel may be treated as roof or indoor where venue identification is reliable.
- SYS_10A must not create ACTION NOW alerts or place bets unless a later governed architecture change explicitly authorises that behaviour.

### 16.5 SYS_12 phase boundary

SYS_12 is a separate bottom-2/3 fade multi basket architecture item.

Current architectural boundary:

- SYS_12 Phase 1A is candidate-leg evaluator and audit only.
- Phase 1A does not include basket construction.
- Phase 1A does not include staking allocation.
- Phase 1A does not include SYS_10A total-leg pairing.
- Phase 1A does not include watcher, T30 action, alerting, or bet placement.

Any future SYS_12 basket construction, stake allocation, SYS_10A pairing, watcher integration, alerting or bet-placement behaviour requires a separate governed change and separate repo/live proof.

### 16.6 Current unresolved architecture items added by this closeout

The following items remain architecture-relevant until proven closed:

- SYS_7 post-fix runtime verification: prove that future eligible cases either materialise into signals or fail cleanly under the operator exclusion path.
- SYS_7 `operator_excluded_team` audit verification: prove fresh audit output after deployment.
- SYS_10A weather boundary: prove any future weather-integrated behaviour before treating the email as weather-adjusted.
- SYS_12 phase boundary: keep Phase 1A candidate-only until basket/stake/action phases are separately designed and approved.

## 17. Current architecture addendum - SYS_10A W1 display and manual-warning boundary

This addendum updates the canonical SYS_10A boundary after the July 2026 W1 display and warning work.

### 17.1 SYS_10A manual-guide architecture

SYS_10A remains a manual guide system.

Architecture rule:

- SYS_10A report/notify may display model guidance, weather information and warning states.
- Display does not equal active decisioning.
- SYS_10A must not create ACTION NOW alerts.
- SYS_10A must not place bets.
- SYS_10A must not silently become part of watcher automation.
- Any later active logic requires a separate governed architecture decision.

### 17.2 Weather display architecture

SYS_10A W1 weather display is now a proven operator-display integration.

Architecture rule:

- The report path may read existing weather assessment rows.
- Weather assessment rows must be created out of band.
- The report path must not fetch weather or write assessment rows.
- The notify path may render weather outcomes for operator awareness.
- Weather display must not alter pick, stake, suppression, alert or bet-placement behaviour in W1.

Current supported operator workflow:

1. Seed weather rows for SYS_10A.
2. Dry-run SYS_10A notify.
3. Review weather and warning output.
4. Send if manually accepted.

### 17.3 Warning-state architecture

SYS_10A may present operator warning states without becoming automated betting logic.

Current proven warning state:

- RECENT FORM WARNING / PRICE CHECK ONLY.

Current unproven warning state:

- CONFLICT PASS.

Architecture rule:

- Warning states may alter operator-facing guide wording.
- Warning states may present `0u default`, pass-preferred or price-check-only language.
- Warning states do not create ACTION NOW alerts.
- Warning states do not place bets.
- Warning states do not close automation gates.

### 17.4 Current unresolved architecture items

The following remain architecture-relevant:

- prove CONFLICT PASS rendering when a valid trigger exists;
- keep SYS_10A weather W1 display separate from active weather decisioning;
- keep report paths read-only;
- do not add report-time weather fetch/assess coupling;
- require separate governed approval before any weather outcome affects candidate qualification, stake, suppression, alerting or bet placement.
