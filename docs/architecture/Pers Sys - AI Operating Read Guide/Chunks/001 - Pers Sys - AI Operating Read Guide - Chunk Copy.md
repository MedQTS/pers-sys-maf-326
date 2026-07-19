CHUNK_ID: 001
DOC_ID: pers-sys-ai-operating-read-guide
DOC_TITLE: Pers Sys - AI Operating Read Guide
SECTION_RANGE: auto
PREVIOUS_CHUNK: none
NEXT_CHUNK: 002
SOURCE_OF_TRUTH: true

# Pers Sys - AI Operating Read Guide

## 1. Purpose

This file is the front-door read guide for future AI assistants, developer agents, and human operators working on the Pers System AFL Betting project.

Its purpose is to stop future work from starting in the wrong document, making stale assumptions, or treating one project document as the complete source of truth.

This file does not replace:

- Pers Sys - Canonical Architecture.md
- Pers Sys - Project Snapshot.md
- Pers Sys - Delivery Gates.md
- Pers Sys - Live Operation and Audit Map.md
- Pers Sys - Weather Scope.md

It tells the reader which source to read first for the task at hand.

## 2. Mandatory orientation rule

Do not answer Pers Sys architecture, status, readiness, no-bet, signal, watcher, weather, or implementation questions from memory alone.

Start with the document that matches the task type.

If implementation proof is required, Drive architecture documents are not enough. Read repo files, Supabase outputs, SQL results, logs, migrations, or pasted execution evidence.

## 3. Document map

### 3.1 Canonical architecture

Read first:

- Pers Sys - Canonical Architecture.md

Use for questions about:

- overall system architecture
- orchestration model
- cron architecture
- pipeline layers
- signal/evaluation architecture
- suppression model
- staking architecture
- stable design principles

Do not use this as the only source for current implementation status.

### 3.2 Current project status

Read first:

- Pers Sys - Project Snapshot.md

Use for questions about:

- what is currently confirmed
- what is pending
- what is live versus repo-confirmed
- current overall readiness
- live caveats
- recent operational status

Do not use this as the only source for stable architecture rules.

### 3.3 Delivery readiness and gates

Read first:

- Pers Sys - Delivery Gates.md

Use for questions about:

- what must happen next
- whether the system is trusted for automation
- which gates are passed, partial, or open
- readiness sequencing
- repeated-cycle verification
- no-bet traceability as a delivery gate

Do not treat an open gate as closed unless the supporting evidence has been read.

### 3.4 Live operation and audit diagnosis

Read first:

- Pers Sys - Live Operation and Audit Map.md

Use for questions about:

- no-bet diagnosis
- T60 / T30 / T10 checks
- signal audit interpretation
- why no READY rows appeared
- market snapshot evidence
- evaluator fail/pass evidence
- signal rows versus audit rows
- Round 16 no-bet review
- completed-game diagnostic workflow

This is the primary document for operational diagnosis.

### 3.5 Weather

Read first:

- Pers Sys - Weather Scope.md

Use for questions about:

- weather subsystem scope
- Open-Meteo integration
- venue weather lookup
- SYS_4 weather policy
- future SYS_8 weather support
- weather build estimates
- weather reuse pattern
- what is in scope or out of scope for weather

Do not treat weather as active evaluator logic unless evaluator wiring has been explicitly added and proven.

## 4. Core diagnostic rule

An empty `pers_sys_signals_v2` result does not prove the pipeline failed.

For no-bet diagnosis, read the evidence in this order:

1. `pers_sys_games`
2. `pers_sys_market_snapshots`
3. `pers_sys_signal_audit_v2`
4. `pers_sys_signals_v2`
5. alert / suppression state
6. accepted / logged bet state

Interpretation rule:

- `pers_sys_market_snapshots` proves odds/window ingestion.
- `pers_sys_signal_audit_v2` proves evaluator pass/fail and diagnostic reason.
- `pers_sys_signals_v2` contains actionable READY signal output.

Therefore, no READY rows can be legitimate when audit rows show valid fail diagnostics.

## 5. Current no-bet audit lesson

The Round 16 no-bet review established a standing diagnostic rule.

Completed games had:

- T60 / T30 / T10 market snapshots
- evaluator audit rows
- no READY signal rows
- valid fail codes

Observed fail codes included:

- h2h_band
- line_clv
- odds_band
- totals_move_lt_3
- excluded_team

Conclusion:

No-bet outcomes must be diagnosed through audit rows before inferring pipeline failure.

## 6. System table and function naming guardrails

Do not invent table names.

Known live diagnostic distinction:

- `pers_sys_signals_v2` = actionable signal table
- `pers_sys_signal_audit_v2` = evaluator audit / diagnostic table
- `pers_sys_market_snapshots` = odds/window snapshot table

Do not use or invent these as current tables unless proven live:

- `pers_sys_evaluation_audit_v2`
- `pers_sys_system_eval_audit_v2`

Do not treat deprecated systems as active unless explicitly reactivated.

Known deprecated or inactive systems:

- SYS_6
- SYS_9

Known active or relevant systems include:

- SYS_1
- SYS_2
- SYS_3
- SYS_4
- SYS_5
- SYS_7
- SYS_8
- SYS_10 / SYS_10A where relevant

Confirm live registry state before implementation changes.

## 7. Implementation proof rule

Drive documents explain intended architecture and current recorded status.

They do not prove that the repo or live Supabase environment currently matches the docs.

For implementation proof, inspect:

- repository files
- Supabase migrations
- Supabase Edge Function source
- live SQL results
- pg_cron entries
- pg_net availability
- function deployment list
- function logs
- market snapshot rows
- audit rows
- signal rows
- alert outputs
- accepted/logged bet rows

Never claim live proof from architecture docs alone.

## 8. Read order by task type

### Architecture question

Read:

1. Pers Sys - Canonical Architecture.md
2. Pers Sys - Project Snapshot.md if current status matters
3. Pers Sys - Delivery Gates.md if readiness matters

### Current status question

Read:

1. Pers Sys - Project Snapshot.md
2. Pers Sys - Delivery Gates.md
3. Pers Sys - Live Operation and Audit Map.md if no-bet or signal status is involved

### Readiness / next-step question

Read:

1. Pers Sys - Delivery Gates.md
2. Pers Sys - Project Snapshot.md
3. Supporting evidence or logs for any claimed gate closure
