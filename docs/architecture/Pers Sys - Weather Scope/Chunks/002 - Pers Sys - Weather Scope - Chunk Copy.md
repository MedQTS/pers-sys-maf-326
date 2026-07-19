CHUNK_ID: 002
DOC_ID: pers-sys-weather-scope
DOC_TITLE: Pers Sys - Weather Scope
SECTION_RANGE: auto
PREVIOUS_CHUNK: 001
NEXT_CHUNK: 003
SOURCE_OF_TRUTH: true

### 4.3 WX_SYS10A_ALT_TOTAL_OVER_STD

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

- suppress or reduce exposure where wind/rain materially damages alternate-total over clearance probability
- support SYS_10A alt-total over / pairing decisions
- keep SYS_10A separate from SYS_8 so thresholds can diverge later

### 4.4 Shared policy interpretation

| Weather verdict | Betting interpretation |
|---|---|
| FULL_STAKE | No weather adjustment |
| HALF_STAKE | Weather risk present; reduce exposure |
| PASS | Weather materially damages bet premise; suppress bet |
| NOT_APPLICABLE | Indoor/roofed venue; no weather effect applied |

## 5. Time handling rules

All weather processing must follow the existing engine pattern:

- all stored timestamps are UTC
- kickoff is read as UTC
- weather window is derived in UTC
- API times are parsed as UTC
- no Melbourne local time is stored in the subsystem

Match window:

- window_start = kickoff
- window_end = kickoff + 150 minutes

## 6. API choice

Use Open-Meteo.

Required forecast fields:

- precipitation
- wind_speed_10m
- wind_gusts_10m

Required units:

- precipitation in mm
- wind speed in km/h
- wind gusts in km/h

Reason:

- free
- simple
- no key required
- sufficient for current weather policy

Implementation note:

- do not use stale field names `windspeed_10m` or `windgusts_10m`
- use the current Open-Meteo field naming style with underscores

## 7. Out of scope for this phase

Do not include yet:

- evaluator wiring
- watcher wiring
- auto-email integration
- UI display
- generic multi-policy admin UI
- historical backfill
- alternate weather providers
- dynamic roof-open / roof-closed logic
- automatic live suppression of existing SYS_8 or SYS_10A signals

This phase is weather subsystem only, tested in isolation.

## 8. Deliverables

### 8.1 Database

Required database work:

- systems table alteration
- venue weather table
- weather snapshots table
- weather assessments table
- indexes / unique constraints
- updated_at trigger support

### 8.2 Functions

Required function work:

- weather snapshot fetch/upsert function
- weather assessment/upsert function

### 8.3 Seed data

Required seed data:

- AFL venue rows with coordinates and outdoor flag
- raw venue aliases for Pers Sys game venue strings
- at minimum: Docklands, Marvel Stadium, M.C.G., MCG, Adelaide Oval, Perth Stadium

### 8.4 Weather policies

Required policy coverage:

- WX_SYS4_STD
- WX_SYS8_TOTALS_OVER_STD
- WX_SYS10A_ALT_TOTAL_OVER_STD

### 8.5 Test pack

Manual test cases for:

- indoor / roofed venue bypass
- clear outdoor game
- half-stake wind
- half-stake rain
- pass gust
- pass sustained wind
- pass wind/rain combo
- SYS_8 totals-over assessment
- SYS_10A alt-total-over assessment
- SYS_4 assessment

## 9. Success criteria

The scope is complete when the operator or developer can:

1. choose a game
2. fetch weather for that game
3. store a normalized snapshot
4. assess the policy for SYS_8
5. assess the policy for SYS_10A
6. assess the policy for SYS_4
7. store the verdicts
8. confirm the result without touching evaluator or watcher

Initial proof target:

- reproduce a stored weather assessment for the Fremantle v Gold Coast SYS_8 case from Round 16, 2026
- classify the weather verdict as FULL_STAKE, HALF_STAKE, PASS, or NOT_APPLICABLE
- preserve the manual weather-veto explanation as an operational decision, not a pipeline failure

## 10. Estimated effort

Schema and seed data:

- 45 to 60 minutes

Fetch function:

- 45 to 60 minutes

Assessment function:

- 20 to 30 minutes

Manual testing:

- 30 to 45 minutes

Total:

- about 2.5 to 3.25 hours

## 11. Recommended build order

1. Alter systems table.
2. Create venue table.
3. Seed venue rows and aliases.
4. Create snapshot table.
5. Create assessment table.
6. Implement weather policy codes.
7. Build fetch function.
8. Build assess function.
9. Test isolated SYS_8 assessment.
10. Test isolated SYS_10A assessment.
11. Test isolated SYS_4 assessment.
12. Only then decide evaluator or watcher wiring.

## 12. Governance and architecture notes

This file is a scoped implementation brief for weather only.

It should remain separate from:

- Pers Sys - Canonical Architecture.md
- Pers Sys - Project Snapshot.md
- Pers Sys - Delivery Gates.md
- Pers Sys - Live Operation and Audit Map.md

Weather should not be treated as part of the current no-bet audit interpretation unless and until evaluator wiring is explicitly added.

Before any live evaluator integration, the weather subsystem must first prove isolated correctness through stored weather snapshots and weather assessments.

The weather subsystem should explain manual weather vetoes, but it must not silently mutate live signal interpretation until evaluator wiring is separately approved.

## 13. Update rule

Update this file if any of the following changes:

- weather provider changes
- weather policy thresholds change
- SYS_4 weather policy changes
- SYS_8 weather policy changes
- SYS_10A weather policy changes
- SYS_8 weather use is added or removed
- SYS_10A weather use is added or removed
- venue mapping changes
- evaluator wiring is brought into scope
- watcher wiring is brought into scope
- T30/T10 gate treatment changes
- dynamic roof status becomes available
- stored timestamp policy changes

## 14. Current closeout addendum - SYS_10A email disclosure boundary

This addendum records the current weather-related closeout position after the SYS_10A email review.
