CHUNK_ID: 001
DOC_ID: pers-sys-weather-scope
DOC_TITLE: Pers Sys - Weather Scope
SECTION_RANGE: auto
PREVIOUS_CHUNK: none
NEXT_CHUNK: 002
SOURCE_OF_TRUTH: true

# Pers Sys - Weather Scope

## 1. Objective

Add a reusable weather subsystem that:

- pulls forecast data for a game venue
- converts it into match-relevant metrics
- stores both the raw weather result and the betting decision
- supports T30 as the live weather gate
- leaves T10 as ledger-only

Initial weather-supported systems:

- SYS_4
- SYS_8
- SYS_10A

Primary immediate driver:

- SYS_8 and SYS_10A totals-over decisions require a weather veto / stake-adjustment layer before live trust.

The design must also remain reusable for later systems if needed.

## 2. Scope position

This document defines the implementation scope for the weather subsystem only.

It is not the canonical Pers Sys architecture document, not the project snapshot, and not the delivery gate register.

The weather subsystem is a supporting component that can later be wired into evaluation and watcher flow, but evaluator and watcher wiring are out of scope for this phase.

This phase proves isolated correctness only:

- weather venue mapping
- weather fetch
- normalized weather snapshot storage
- system-specific weather assessment storage
- manual verification of the stored weather verdict

Weather should not be treated as part of the current no-bet audit interpretation unless and until evaluator wiring is explicitly added.

## 3. In scope

### 3.1 System-level weather configuration

Extend the systems table so a system can declare:

- whether weather applies
- which weather policy to use
- which snapshot stage is the live gate

Suggested fields on the systems table:

- weather_enabled
- weather_policy_code
- weather_gate_snapshot

Initial setup:

| System | weather_enabled | weather_policy_code | weather_gate_snapshot |
|---|---:|---|---|
| SYS_4 | true | WX_SYS4_STD | T30 |
| SYS_8 | true | WX_SYS8_TOTALS_OVER_STD | T30 |
| SYS_10A | true | WX_SYS10A_ALT_TOTAL_OVER_STD | T30 |

Rules:

- T30 is the live decision gate.
- T10 is ledger-only unless separately approved.
- SYS_8 and SYS_10A must use separate policy codes even if v1 thresholds are identical.
- Separate policy codes allow SYS_8 and SYS_10A to diverge later without remodelling the subsystem.

### 3.2 Venue weather lookup table

Create a venue metadata table to hold:

- canonical venue code
- venue name
- raw venue aliases
- latitude
- longitude
- outdoor / indoor flag
- match duration minutes
- active flag

Rule for v1:

- Marvel Stadium / Docklands = not outdoor
- all other AFL venues = outdoor unless specifically configured otherwise

Minimum alias coverage required from current Pers Sys game data:

| Raw venue text | Canonical venue | Outdoor? |
|---|---|---:|
| Docklands | Marvel Stadium / Docklands | false |
| Marvel Stadium | Marvel Stadium / Docklands | false |
| M.C.G. | MCG | true |
| MCG | MCG | true |
| Adelaide Oval | Adelaide Oval | true |
| Perth Stadium | Perth Stadium | true |

Purpose:

- map game venue text to API coordinates
- support weather bypass for indoor or roofed venue
- avoid failure where game data says Docklands but policy text says Marvel Stadium

Dynamic roof-open / roof-closed logic is out of scope for v1.

### 3.3 Weather snapshot storage

Create a weather snapshot table that stores:

- game
- snapshot stage
- source
- venue code
- match window start and end
- max sustained wind during match
- max gust during match
- total rain during match
- points matched from forecast
- raw API payload
- checked timestamp

Purpose:

- preserve normalized weather inputs
- allow reassessment later without re-calling the API
- separate weather facts from betting-policy decisions

The weather snapshot table must not contain system-specific betting policy logic.

### 3.4 Weather assessment storage

Create a weather assessment table that stores:

- game
- system code
- assessment stage
- policy code
- outcome
- reason code
- copied weather metrics
- link back to snapshot
- assessed timestamp

Allowed outcomes:

- FULL_STAKE
- HALF_STAKE
- PASS
- NOT_APPLICABLE

Purpose:

- hold the per-game, per-system weather decision
- provide a clean handoff to evaluator later
- allow SYS_4, SYS_8, and SYS_10A to interpret the same weather snapshot differently if required

### 3.5 Weather fetch function

Build a function that:

- loads the game
- resolves venue coordinates
- builds the match window from kickoff
- calls Open-Meteo
- parses hourly weather data
- computes wind_kmh_max
- computes gust_kmh_max
- computes rain_mm_total
- upserts the snapshot row

Inputs:

- game_id
- snapshot_stage default T30

Output:

- current weather snapshot row

### 3.6 Weather assessment function

Build a function that:

- reads system weather config
- reads the latest weather snapshot
- checks whether venue is outdoor
- applies the selected policy rules
- upserts the weather assessment row

Inputs:

- game_id
- system_code
- assessment_stage default T30

Output:

- assessment row with final verdict

## 4. Locked policy logic

### 4.1 WX_SYS4_STD

For outdoor venues only:

| Condition | Outcome |
|---|---|
| gust >= 35 km/h | PASS |
| wind >= 30 km/h | PASS |
| rain during match >= 5 mm | PASS |
| wind >= 25 km/h and rain >= 2 mm | PASS |
| wind >= 25 km/h | HALF_STAKE |
| rain during match >= 3 mm | HALF_STAKE |
| otherwise | FULL_STAKE |

For indoor / roofed venues:

- NOT_APPLICABLE

Rain is:

- total rainfall during the match window
- not a single hourly rain value

### 4.2 WX_SYS8_TOTALS_OVER_STD

For outdoor venues only:

| Condition | Outcome |
|---|---|
| gust >= 35 km/h | PASS |
| wind >= 30 km/h | PASS |
| rain during match >= 5 mm | PASS |
| wind >= 25 km/h and rain >= 2 mm | PASS |
| wind >= 25 km/h | HALF_STAKE |
| rain during match >= 3 mm | HALF_STAKE |
| otherwise | FULL_STAKE |

For indoor / roofed venues:

- NOT_APPLICABLE

Purpose:

- suppress or reduce exposure where wind/rain materially damages over probability
- support SYS_8 main-total over momentum signals
- preserve a stored explanation for manual weather vetoes
