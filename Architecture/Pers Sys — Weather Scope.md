Weather API Implementation Scope
Objective

Add a reusable weather subsystem that:

pulls forecast data for a game venue
converts it into match-relevant metrics
stores both the raw weather result and the betting decision
supports T30 as the live gate
leaves T10 as ledger-only

Initial target:

SYS_4
design should also support SYS_8 later if needed
In Scope
1. System-level weather configuration

Extend the systems table so a system can declare:

whether weather applies
which weather policy to use
which snapshot stage is the live gate

Suggested fields on the systems table:

weather_enabled
weather_policy_code
weather_gate_snapshot

Initial setup:

SYS_4 = enabled
policy_code = WX_SYS4_STD
gate_snapshot = T30
2. Venue weather lookup table

Create a venue metadata table to hold:

canonical venue code
venue name
latitude
longitude
outdoor/indoor flag
match duration minutes
active flag

Rule for v1:

Marvel Stadium = not outdoor
all other AFL venues = outdoor

Purpose:

map game venue text to API coordinates
support weather bypass for indoor/roofed venue
3. Weather snapshot storage

Create a weather snapshot table that stores:

game
snapshot stage
source
match window start/end
max sustained wind during match
max gust during match
total rain during match
points matched from forecast
raw API payload
checked timestamp

Purpose:

preserve normalized weather inputs
allow reassessment later without re-calling the API
4. Weather assessment storage

Create a weather assessment table that stores:

game
system code
assessment stage
policy code
outcome
reason code
copied weather metrics
link back to snapshot
assessed timestamp

Allowed outcomes:

FULL_STAKE
HALF_STAKE
PASS
NOT_APPLICABLE

Purpose:

hold the per-game, per-system weather decision
provide a clean handoff to evaluator later
5. Weather fetch function

Build a function that:

loads the game
resolves venue coordinates
builds the match window from kickoff
calls Open-Meteo
parses hourly weather data
computes:
wind_kmh_max
gust_kmh_max
rain_mm_total
upserts the snapshot row

Inputs:

game_id
snapshot_stage default T30

Output:

current weather snapshot row
6. Weather assessment function

Build a function that:

reads system weather config
reads the latest weather snapshot
checks whether venue is outdoor
applies the policy rules
upserts the weather assessment row

Inputs:

game_id
system_code
assessment_stage default T30

Output:

assessment row with final verdict
Locked Policy Logic for WX_SYS4_STD

For outdoor venues only:

gust >= 35 km/h → PASS
wind >= 30 km/h → PASS
rain during match >= 5 mm → PASS
wind >= 25 km/h and rain >= 2 mm → PASS
wind >= 25 km/h → HALF_STAKE
rain during match >= 3 mm → HALF_STAKE
otherwise → FULL_STAKE

For Marvel:

NOT_APPLICABLE

Rain is:

total rainfall during the match window
not a single hourly rain value
Time Handling Rules

All weather processing must follow the existing engine pattern:

all stored timestamps are UTC
kickoff is read as UTC
weather window is derived in UTC
API times are parsed as UTC
no Melbourne local time is stored in the subsystem

Match window:

window_start = kickoff
window_end = kickoff + 150 minutes
API Choice

Use Open-Meteo.

Required forecast fields:

precipitation
windspeed_10m
windgusts_10m

Reason:

free
simple
no key required
sufficient for current weather policy
Out of Scope for This Phase

Do not include yet:

evaluator wiring
watcher wiring
auto-email integration
UI display
generic multi-policy admin UI
historical backfill
alternate weather providers
dynamic roof-open/roof-closed logic

This phase is weather subsystem only, tested in isolation.

Deliverables
Database
systems table alteration
venue weather table
weather snapshots table
weather assessments table
indexes / unique constraints
updated_at trigger support
Functions
weather snapshot fetch/upsert function
weather assessment/upsert function
Seed data
AFL venue rows with coords and outdoor flag
Test pack

Manual test cases for:

Marvel
clear outdoor game
half-stake wind
half-stake rain
pass gust
pass wind/rain combo
Success Criteria

The scope is complete when you can:

choose a game
fetch weather for that game
store a normalized snapshot
assess the policy for SYS_4
store the verdict
confirm the result without touching evaluator or watcher
Estimated Effort

Schema and seed data:

45–60 min

Fetch function:

45–60 min

Assessment function:

20–30 min

Manual testing:

20–30 min

Total:

about 2.25 to 3 hours
Recommended Build Order
alter systems table
create venue table
seed venues
create snapshot table
create assessment table
build fetch function
build assess function
test manually

If you want, I can turn this into a clean developer-ready implementation brief next.