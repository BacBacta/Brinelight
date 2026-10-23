# The early game: Lighthouse 1 to 10

**The owner chose A + C on 23 October: it is in the game since (`docs/tasks/early-start.md`).** This study was measured on the rules before, and is kept as it was; run again, `early-run.ts` would play today's rules.

A study only (owner's request, 23 October: "my city is at Lighthouse 2, and the start feels too slow"). It changes no value: it measures what the rules of `shared/` give a new city up to Lighthouse 10, what holds each level back, and three options to speed the start up, played by the balance's simulator. The owner decides; nothing goes into the game without that.

## How it is measured

- **The players** are the balance's (`docs/balance.md`, "How the players play"): casual (3 sessions a day: 8:00, 13:00, 21:00), regular (6) and dedicated (10, every 1 h 40 from 7:00). The city is founded on day 1 at 8:00, in a first session. A session is instant: the player starts everything the rules allow, then leaves. The tables below take the casual player as "occasional" and the dedicated one as "active".
- **A time to reach** a level is real time from the founding, nights and hours away included: what a new player lives.
- **Where a level's time goes**, from the level before to this one:
  - *waiting for you*: from the level before until the player's next session;
  - *short of resources*: from that session until the one where the Lighthouse could be started (the simulator tries the Lighthouse first at every session, so only its cost holds it back; the resource it lacked at each of those sessions is counted);
  - *building it*: its build time.
- **The first hour**: a new player who stays the whole first hour (a session every minute from 8:00 to 9:00), then plays as the casual one.
- **The options** are played in place of the rules by the study alone. `tools/balance/early-rules.ts` is the rules of `shared/` word for word, except what an option changes; the simulator gets it in place of `@brinelight/shared` only when the study runs (`early-hooks.mjs`). Without an option, the run is checked to give the milestones of `docs/balance.md` exactly, or the study stops.
- **The milestones of week 6** are the days of `tools/balance/balance.test.ts` (Lighthouse 5, 10, 15, 20, 25, 30), with the owner's limit of 18 October: a change of the rules must keep 15 to 30 within 10 % of them. Lighthouse 5 and 10 are what an option is meant to move.

Reproduce: `npx tsx tools/balance/early-run.ts` (about 20 seconds). It writes the tables below.

## What the rules give today

- **Nothing finishes in the first 30 minutes.** The first session starts the Lighthouse's level 3 (1 h 38) and the Barracks' level 1 (48 min); then both builders are busy, and the first thing that finishes is the Barracks, at 48 minutes. The Lighthouse's level 3 comes at 1 h 38, when a new player has usually left.
- **Lighthouse 5 comes the next day** (26 to 27 hours) for every player, and **Lighthouse 10 on day 5.6 to 7.6.**
- **Build times are a quarter to a third of the wait.** Over levels 3 to 10: casual player, 26 % building, 18 % waiting for the player, 56 % short of resources; regular and dedicated players, 35 % building, 9 to 10 % waiting for the player, 55 to 56 % short of resources. Shorter builds alone cannot make the start much faster.
- **Wood holds the regular and dedicated players back** at almost every level; **oil holds the casual player back** at Lighthouse 6 (32 hours short of oil). Checked by hand: the Refinery's level 1 makes 11 oil an hour and the Lighthouse burns 2.5 an hour a level, so at Lighthouse 5 with the Refinery still at 1 the city loses 1.5 oil an hour, and its oil comes from the wrecks only. A Lumberyard level makes 42 wood an hour; the Lighthouse's level 7 asks 1,360.
- **Against the genre** (Whiteout Survival's Furnace, from the wostools.net players' wiki, read on 23 October; not the game's own figures): its levels 2 to 5 take under a minute to 10 minutes, ours 1 h 13 to 3 h; its level 10 takes 6 h, ours 13 h 24. The genre's markers: the first upgrades in seconds or minutes (ours: 48 minutes at the soonest), a milestone in the first 30 to 60 minutes (ours: none; Lighthouse 5 is the next day), a reason to come back the next day (ours: yes, the Lighthouse's level 4 or 5 is building or ready, and Lighthouse 5 is the first proof on Solana, sealed the night after).
- **The owner's city at Lighthouse 2** has never started its level 3: every city starts at 2, and the level 3 costs 350 wood and 240 oil out of the 520 and 380 a city starts with. Wood spent on another building first leaves less than 350, and the first Lumberyard makes 42 an hour.

## Three options (none is in the game)

Each one is for every new city, the same for all, only at the start: never a reward, never anything for sale (`CLAUDE.md`). Each is a change of balance values the owner would have to agree to, value by value.

- **A. Quick first levels.** An upgrade to a level up to 5, of any building, takes at most 1 minute (levels 1 and 2), 2 minutes (3), 5 minutes (4) or 15 minutes (5); from level 6, the rules' times. The Lighthouse's level 3 in 2 minutes, its 5 in 15, close to the genre.
- **B. The first days' harvest.** While the Lighthouse is below level 6, the island's buildings make three times their oil, fish and wood (not the loot of the sea).
- **C. A richer start.** A new city starts with 2,000 wood, 1,400 oil and 800 fish instead of 520, 380 and 420: enough for the Lighthouse's levels 3, 4 and 5 (1,530 wood and 1,030 oil) and a few buildings.

What they give (tables below):

- **A alone** changes the first minutes (Lighthouse 3 in 2 minutes) and little else: with 520 wood at the start, Lighthouse 4 still waits on wood until the evening. Lighthouse 5 comes 3 hours sooner (23 to 24 hours); the regular player's Lighthouse 20 comes 11 % before week 6.
- **B alone** changes nothing in the first hour, and the first days a lot for the regular and dedicated players: Lighthouse 5 in 12 to 14 hours, Lighthouse 10 on day 4.5 to 4.6 (20 % sooner). The casual player's Lighthouse 5 stays the next morning. The dedicated player's Lighthouse 15 comes 10 % before week 6, just past the limit.
- **C alone** gives Lighthouse 5 the first day (8 to 16 hours), Lighthouse 10 3 to 14 % sooner, and keeps 15 to 30 within 10 % for all three players. Nothing more in the first hour.
- **A + C** is the only one that gives the genre's first session: in the first hour, 13 upgrades finish, **Lighthouse 5 at 22 minutes**, and Lighthouse 6 within the first day. Its milestones from 15 on stay within 10 % for the casual and dedicated players, not for the regular one (Lighthouse 15 13 % sooner, 20 15 % sooner).
- **A + B + C**: the same first hour, Lighthouse 7 after 24 hours; 15 to 30 within 10 % for the casual and regular players, not for the dedicated one (Lighthouse 15 10 % sooner).
- **A carried on to level 9** (not proposed): quicker builds let the other buildings spend the wood the Lighthouse needs; the regular player's Lighthouse 10 comes 21 % later and 15 24 % later. Faster timers past the first levels slow the Lighthouse down.

What to keep in mind:

- From Lighthouse 15 on, the options move the milestones by a few percent either way, often near the 10 % line, because a level that ends a little sooner or later changes which session starts the next one (as noted on 22 October for the Leviathan's hour). A difference of 1 or 2 % there is not a finding.
- B's extra production leaves out the Mist's cut (30 % of the production while the Lighthouse is not lit in a Mist): at most a little more than a real rule would give.
- The simulated player always builds the lowest building first and keeps the Lighthouse's cost aside; a real player may choose otherwise, mostly in the first minutes.
- In the genre, short builds are often finished for free with a tap or with the alliance's help; that is option A seen from the screen, and needs no new rule beyond A.

## Tables

<!-- early:generated:start (npx tsx tools/balance/early-run.ts) -->

### The Lighthouse, level by level (the rules alone)

| Level | Cost of the level (from the one before) | Build time | Total build time from level 2 | Whiteout Survival's Furnace |
| --- | --- | --- | --- | --- |
| 1 | (none) | (none) | | |
| 2 | 250 wood + 170 oil (every city starts at level 2) | 1 h 13 |  | under 1 min |
| 3 | 350 wood + 240 oil | 1 h 38 | 1 h 38 | 1 min |
| 4 | 490 wood + 330 oil | 2 h 13 | 3 h 51 | 3 min |
| 5 | 690 wood + 460 oil | 2 h 59 | 6 h 51 | 10 min |
| 6 | 970 wood + 650 oil | 4 h 02 | 10 h 53 | 30 min |
| 7 | 1,360 wood + 900 oil | 5 h 27 | 16 h 20 | 1 h |
| 8 | 1,900 wood + 1,260 oil | 7 h 21 | 23 h 41 | 2 h 30 |
| 9 | 2,660 wood + 1,770 oil | 9 h 56 | 33 h 37 | 4 h 30 |
| 10 | 3,720 wood + 2,480 oil | 13 h 24 | 47 h 01 | 6 h |

### Where each level's time goes, today

#### Casual (3 sessions)

| Level | Reached (after the founding) | Since the level before | Building it | Waiting for you | Short of resources | What it lacked (sessions) |
| --- | --- | --- | --- | --- | --- | --- |
| 3 | 1 h 38 (day 0.1) | 1 h 38 | 1 h 38 | 0 min | 0 min | nothing |
| 4 | 15 h 13 (day 0.6) | 13 h 34 | 2 h 13 | 3 h 22 | 8 h | wood 1 |
| 5 | 26 h 59 (day 1.1) | 11 h 47 | 2 h 59 | 8 h 47 | 0 min | nothing |
| 6 | 2 d 17 h (day 2.7) | 38 h 03 | 4 h 02 | 2 h 01 | 32 h | oil 4, wood 1 |
| 7 | 3 d 10 h (day 3.4) | 17 h 25 | 5 h 27 | 6 h 58 | 5 h | oil 1 |
| 8 | 4 d 7 h (day 4.3) | 20 h 54 | 7 h 21 | 2 h 33 | 11 h | oil 1 |
| 9 | 5 d 9 h (day 5.4) | 26 h 34 | 9 h 56 | 5 h 39 | 11 h | wood 1 |
| 10 | 7 d 13 h (day 7.6) | 2 d 3 h | 13 h 24 | 3 h 04 | 35 h | oil 2, wood 4 |

#### Regular (6 sessions)

| Level | Reached (after the founding) | Since the level before | Building it | Waiting for you | Short of resources | What it lacked (sessions) |
| --- | --- | --- | --- | --- | --- | --- |
| 3 | 1 h 38 (day 0.1) | 1 h 38 | 1 h 38 | 0 min | 0 min | nothing |
| 4 | 13 h 13 (day 0.6) | 11 h 34 | 2 h 13 | 22 min | 9 h | wood 3 |
| 5 | 25 h 59 (day 1.1) | 12 h 47 | 2 h 59 | 47 min | 9 h | wood 1 |
| 6 | 39 h 02 (day 1.6) | 13 h 03 | 4 h 02 | 1 min | 9 h | wood 3 |
| 7 | 2 d 10 h (day 2.4) | 19 h 25 | 5 h 27 | 7 h 58 | 6 h | wood 2 |
| 8 | 3 d 6 h (day 3.3) | 19 h 54 | 7 h 21 | 33 min | 12 h | wood 2 |
| 9 | 4 d 8 h (day 4.4) | 26 h 34 | 9 h 56 | 1 h 39 | 15 h | wood 3 |
| 10 | 5 d 15 h (day 5.6) | 30 h 29 | 13 h 24 | 2 h 04 | 15 h | wood 3 |

#### Dedicated (10 sessions)

| Level | Reached (after the founding) | Since the level before | Building it | Waiting for you | Short of resources | What it lacked (sessions) |
| --- | --- | --- | --- | --- | --- | --- |
| 3 | 1 h 38 (day 0.1) | 1 h 38 | 1 h 38 | 0 min | 0 min | nothing |
| 4 | 14 h 33 (day 0.6) | 12 h 54 | 2 h 13 | 42 min | 10 h | wood 6 |
| 5 | 25 h 59 (day 1.1) | 11 h 27 | 2 h 59 | 8 h 27 | 0 min | nothing |
| 6 | 37 h 02 (day 1.5) | 11 h 03 | 4 h 02 | 21 min | 6 h 40 | wood 4 |
| 7 | 2 d 4 h (day 2.2) | 15 h 25 | 5 h 27 | 58 min | 9 h | wood 1 |
| 8 | 3 d 6 h (day 3.3) | 25 h 54 | 7 h 21 | 1 h 13 | 17 h 20 | wood 6 |
| 9 | 4 d 8 h (day 4.4) | 26 h 34 | 9 h 56 | 59 min | 15 h 40 | wood 5 |
| 10 | 5 d 15 h (day 5.7) | 30 h 49 | 13 h 24 | 4 min | 17 h 20 | wood 6 |

### The first hour, by option

A new player who stays the whole first hour (a session every minute from 8:00 to 9:00), then plays as the casual one.

| Option | What finishes in the first hour | Lighthouse after 1 h | after 24 h |
| --- | --- | --- | --- |
| The rules today | barracks 1 at 48 min | 2 | 4 |
| A. Quick first levels | barracks 1 at 1 min; lighthouse 3 at 2 min; lumberyard 2 at 2 min | 3 | 4 |
| B. The first days' harvest | barracks 1 at 48 min | 2 | 4 |
| C. A richer start | barracks 1 at 48 min | 2 | 5 |
| A + C | barracks 1 at 1 min; lighthouse 3 at 2 min; observatory 1 at 2 min; harbor 1 at 3 min; infirmary 1 at 4 min; refinery 2 at 5 min; lumberyard 2 at 6 min; lighthouse 4 at 7 min; fishery 2 at 7 min; shelters 2 at 8 min; lumberyard 3 at 10 min; lumberyard 4 at 15 min; lighthouse 5 at 22 min | 5 | 6 |
| A + B + C | barracks 1 at 1 min; lighthouse 3 at 2 min; observatory 1 at 2 min; harbor 1 at 3 min; infirmary 1 at 4 min; refinery 2 at 5 min; lumberyard 2 at 6 min; lighthouse 4 at 7 min; fishery 2 at 7 min; shelters 2 at 8 min; lumberyard 3 at 10 min; lumberyard 4 at 15 min; lighthouse 5 at 22 min | 5 | 7 |
| A to level 9 (not proposed) | barracks 1 at 1 min; lighthouse 3 at 2 min; lumberyard 2 at 2 min | 3 | 4 |

### The milestones, by option (week 6's days in `tools/balance/balance.test.ts`)

| Option | Profile | Lighthouse 3 | 4 | 5 | 6 | 10 | 15 | 20 | 25 | 30 | 15 to 30 within 10 % of week 6 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| The rules today | Casual (3 sessions) | 1 h 38 | 15 h 13 | 26 h 59 | 2 d 17 h | day 7.6 (-1 %) | day 26.5 (+2 %) | day 62.0 (-2 %) | day 147.0 (-4 %) | day 369.6 (0 %) | yes |
| The rules today | Regular (6 sessions) | 1 h 38 | 13 h 13 | 25 h 59 | 39 h 02 | day 5.6 (-3 %) | day 18.1 (-8 %) | day 48.6 (-8 %) | day 119.5 (-3 %) | day 318.0 (-1 %) | yes |
| The rules today | Dedicated (10 sessions) | 1 h 38 | 14 h 33 | 25 h 59 | 37 h 02 | day 5.7 (-1 %) | day 17.1 (-2 %) | day 43.0 (-5 %) | day 115.0 (-4 %) | day 324.8 (0 %) | yes |
| A. Quick first levels | Casual (3 sessions) | 2 min | 13 h 05 | 24 h 15 | 2 d 4 h | day 7.1 (-7 %) | day 27.5 (+6 %) | day 67.6 (+7 %) | day 156.0 (+2 %) | day 375.0 (+1 %) | yes |
| A. Quick first levels | Regular (6 sessions) | 2 min | 11 h 05 | 23 h 15 | 39 h 02 | day 5.6 (-3 %) | day 18.6 (-6 %) | day 47.0 (-11 %) | day 116.7 (-5 %) | day 315.0 (-2 %) | **no** |
| A. Quick first levels | Dedicated (10 sessions) | 2 min | 12 h 25 | 23 h 15 | 37 h 02 | day 5.5 (-3 %) | day 17.5 (0 %) | day 47.0 (+4 %) | day 119.9 (0 %) | day 323.5 (-1 %) | yes |
| B. The first days' harvest | Casual (3 sessions) | 1 h 38 | 7 h 13 | 26 h 59 | 41 h 02 | day 6.6 (-14 %) | day 24.7 (-5 %) | day 61.6 (-2 %) | day 149.7 (-2 %) | day 372.4 (0 %) | yes |
| B. The first days' harvest | Regular (6 sessions) | 1 h 38 | 7 h 13 | 13 h 59 | 27 h 02 | day 4.6 (-20 %) | day 19.5 (-1 %) | day 52.3 (0 %) | day 122.5 (0 %) | day 318.9 (-1 %) | yes |
| B. The first days' harvest | Dedicated (10 sessions) | 1 h 38 | 6 h 13 | 11 h 59 | 18 h 02 | day 4.5 (-21 %) | day 15.7 (-10 %) | day 44.5 (-2 %) | day 117.4 (-2 %) | day 323.6 (-1 %) | **no** |
| C. A richer start | Casual (3 sessions) | 1 h 38 | 7 h 13 | 15 h 59 | 33 h 02 | day 6.8 (-11 %) | day 25.5 (-2 %) | day 63.6 (+1 %) | day 148.0 (-3 %) | day 373.0 (0 %) | yes |
| C. A richer start | Regular (6 sessions) | 1 h 38 | 4 h 13 | 7 h 59 | 33 h 02 | day 5.0 (-14 %) | day 20.1 (+2 %) | day 52.0 (-1 %) | day 122.7 (0 %) | day 321.4 (0 %) | yes |
| C. A richer start | Dedicated (10 sessions) | 1 h 38 | 4 h 33 | 10 h 19 | 27 h 02 | day 5.5 (-3 %) | day 15.9 (-9 %) | day 44.1 (-2 %) | day 117.0 (-2 %) | day 327.4 (0 %) | yes |
| A + C | Casual (3 sessions) | 2 min | 5 h 05 | 13 h 15 | 33 h 02 | day 6.8 (-11 %) | day 25.5 (-2 %) | day 64.6 (+2 %) | day 153.0 (0 %) | day 350.4 (-6 %) | yes |
| A + C | Regular (6 sessions) | 2 min | 2 h 05 | 5 h 15 | 33 h 02 | day 4.9 (-16 %) | day 17.1 (-13 %) | day 44.5 (-15 %) | day 115.4 (-6 %) | day 313.6 (-2 %) | **no** |
| A + C | Dedicated (10 sessions) | 2 min | 45 min | 2 h 35 | 27 h 02 | day 5.6 (-2 %) | day 16.7 (-5 %) | day 46.0 (+2 %) | day 119.6 (0 %) | day 326.4 (0 %) | yes |
| A + B + C | Casual (3 sessions) | 2 min | 5 h 05 | 13 h 15 | 28 h 02 | day 6.6 (-14 %) | day 25.5 (-2 %) | day 64.0 (+2 %) | day 152.0 (0 %) | day 349.4 (-6 %) | yes |
| A + B + C | Regular (6 sessions) | 2 min | 2 h 05 | 5 h 15 | 18 h 02 | day 5.5 (-5 %) | day 21.0 (+6 %) | day 49.3 (-6 %) | day 119.0 (-3 %) | day 317.5 (-1 %) | yes |
| A + B + C | Dedicated (10 sessions) | 2 min | 45 min | 2 h 35 | 14 h 42 | day 4.5 (-21 %) | day 15.7 (-10 %) | day 45.0 (-1 %) | day 116.8 (-2 %) | day 326.6 (0 %) | **no** |
| A to level 9 (not proposed) | Casual (3 sessions) | 2 min | 13 h 05 | 24 h 15 | 2 d | day 7.1 (-7 %) | day 27.5 (+6 %) | day 70.0 (+11 %) | day 150.0 (-2 %) | day 379.0 (+2 %) | **no** |
| A to level 9 (not proposed) | Regular (6 sessions) | 2 min | 11 h 05 | 23 h 15 | 35 h 45 | day 7.0 (+21 %) | day 24.5 (+24 %) | day 55.0 (+5 %) | day 125.8 (+3 %) | day 325.7 (+1 %) | **no** |
| A to level 9 (not proposed) | Dedicated (10 sessions) | 2 min | 12 h 25 | 23 h 15 | 33 h 45 | day 4.9 (-15 %) | day 17.1 (-2 %) | day 48.0 (+6 %) | day 122.0 (+2 %) | day 317.4 (-3 %) | yes |

<!-- early:generated:end -->
