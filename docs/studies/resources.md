# Resources: the wood of the second day (study)

A study only (owner's request, 23 October, the first point of week 10 in `docs/tasks/roadmap.md`). It changes no value: it measures why the builders wait on day 2 with A + C (about 44 hours of 48), what the storage and the sea do today, and four options, alone and together, played by the balance's simulator. **Nothing goes into the game without the owner's agreement, value by value.**

## How it is measured

- **The players.**
  - The balance's three: casual (3 sessions a day), regular (6) and dedicated (10, the "active" player).
  - A player who **follows the quests**: there every minute from 8:00 to 22:00, the current quest's own action first. It is measured on its first 3 days.
  - A player on the **island only**: the regular player's sessions, but never a fleet at sea (no wreck, no camp, no hunt).
  - The city is founded on day 1 at 8:00. Day 2 is the calendar day after.
- **The study's players keep the Lighthouse's reserve only on what a spending uses** (`reserveOnSpent` in `tools/balance/simulate.ts`). The balance's players of today hold the whole reserve: no spending at all while the Lighthouse waits for any resource. Finding 0 below says why this matters. Every option is played by the study's players.
- **Builders waiting for resources**:
  - a builder left free at the end of a session (nothing it could pay for, or the Lighthouse's reserve) waits for resources until the next session;
  - a builder whose work ends while the player is away waits for the player.
  - Two builders: 48 hours a day at most.
- **A morning** is the first session after a night (6 hours or more without one), before noon. A morning **fails** when a builder is free and neither the Lighthouse nor a producer below it can be paid for.
- **Where a resource comes from**:
  - the island's buildings (what they make, before what is eaten and burned);
  - the sea: the wrecks (and, with C, the isles and the shoals);
  - the camps' loot;
  - the rewards (objectives and chests).
- **The options are played in place of the rules by the study alone.**
  - `tools/balance/resources-hooks.mjs` loads four modules of `shared/` with a few calls to the study's knobs: the production, the storage, the builders, and the isles and shoals.
  - `tools/balance/resources-rules.ts` sets the knobs and writes down the measures.
  - Without an option, the rules are word for word the game's. Each patch must find its text once, or the study stops. The balance's players are checked to give the milestones of `docs/balance.md` exactly.
- **Reproduce:** `npx tsx tools/balance/resources-run.ts` (about a minute). It writes the tables below.

## What it finds: the causes

0. **Half of day 2's wait comes from how the simulated players save, not from the rules.**
   - Today's players keep the whole reserve of the Lighthouse's next level. When its wood is short, they start nothing else, even the Lumberyard, which is paid in fish and oil. On day 2 the regular player has the Lighthouse at 6 and the Lumberyard at 2: 84 wood an hour, for a level 7 that asks 1,360.
   - Held only on what each spending uses, the same rules give 12 to 13 hours of wait on day 2 to the regular and dedicated players (36 to 38 before), and 11 to the casual one (16). The player who follows the quests stays at 36: it trains troops all day, and its fish runs out.
   - The island-only player was stuck at Lighthouse 5 for good: with no oil, the reserve held back the Refinery itself. Saving this way, it reaches Lighthouse 10 on day 11.8 and Lighthouse 25 on day 309.
   - **Proposal:** play the balance's players this way from now on. This changes the simulator only, not the game, but it moves the reference of `docs/balance.md` (table 0), so it is the owner's call.
1. **Production grows by a level, costs by a power.**
   - A producer's level adds the same production each time (42 wood, 11 oil, 14 fish an hour), while the costs grow 1.4 times a level for the Lighthouse and 1.6 for the other buildings. The builds grow almost as fast (1.35 and 1.5), so what a builder spends per hour grows slowly.
   - The gap is widest at levels 5 to 8, which is day 2. There, the Lumberyard covers 47 to 65 % of the wood two builders spend, and the Refinery 24 to 34 % of the oil; the wrecks bring the rest of the oil. The Fishery covers 86 to 113 % of the fish.
   - From level 10, the wood is 74 to 86 % covered (table 1).
2. **The storage never cuts a night.**
   - It holds 62 hours or more of wood production at every level, and 229 or more of oil or fish (table 2). A night of 8 to 10 hours is never cut off.
   - What it does cut is the wrecks' oil for the dedicated player: 6,146 oil a day left at sea, the oil full 25 % of the time. It also cuts the island-only player's wood, piled up while the Lighthouse waits for oil.
3. **The sea gives oil, never wood or fish.**
   - The wrecks bring 53 to 92 % of the oil at every Lighthouse band. The wood comes from the island, apart from the camps' loot (2 to 20 %). The fish comes from the island, apart from the first quests' rewards.
   - The Wooded Isles (5) and Fish Shoals (6) are on the map, but the rules refuse a fleet there ("You cannot send a fleet there yet").

## The options

- **A, production:** a producer of level L makes what the rules' producer of level L + min(L, 5) makes. That is double up to level 5, then five levels more: the Lumberyard 10 makes what the 15 makes today. It applies to the Lumberyard, the Refinery and the Fishery alike. From level 5 to 20, it covers 95 to 115 % of the wood two builders spend (the rules: 47 to 86 %), and 48 to 62 % of the oil (table 1). Above level 15 the rules' growth goes on unchanged, five levels ahead.
- **B, storage:** never cut before 10 hours of production offline, at every level. The storage already holds much more at every level, with or without A, so **B changes nothing**.
- **C, isles and shoals:** the fleets harvest them as the wrecks: a trip, the harvest, the way back, and a wait once emptied.
  - Wood from an isle, fish from a shoal, no troops needed. What a fleet brings back fills the storage and no more.
  - An isle or a shoal holds its amount on the map (360 to 600) times 1 + 0.1 × (Lighthouse − 1), and fills again 8 hours after it is emptied (a wreck: 2 hours). The longer wait holds the frequent players back; the casual player is held back by their sessions.
  - The wrecks stay the source of the oil.
- **D, builders:** 2 at the start, a third at Lighthouse 10, a fourth at 20. Never for sale.
- **E, the best combination: A + C.** B does nothing and D slows the Lighthouse down. "E, A without the Fishery" is the same with the Fishery left as it is.

## What each option gives

- **Goal 1, day 2 (16 hours at most):**
  - E meets it for every player: 14.7 h following the quests, 6.7 h dedicated, 0 h regular, 16 h casual.
  - The island-only player waits 23 hours. Its target is to progress, not this one.
  - A alone fails for the quest follower (26.9 h), and C alone too (30.2 h). B and D change nothing on day 2.
- **Goal 2, mornings:** with the rules, 3 to 7 mornings a year fail for each player. With A or E, none, apart from one of the island-only player's. D makes them fail: with D alone, 162 to 170 mornings a year have a builder free with nothing to pay for.
- **Goal 3, milestones (against the rules, the same players):**
  - E brings Lighthouse 10 forward by 3 to 21 %, 15 by 15 to 23 %, 20 by 11 to 16 %, 25 by 12 to 16 %, and 30 by 13 to 22 % (day 256 to 299).
  - Against the balance's players of today (`docs/balance.md`): Lighthouse 30 on day 257.6 instead of 313.6 for the regular player.
  - D pushes Lighthouse 20 back by 13 to 28 %, and the regular and dedicated players no longer reach Lighthouse 30 within a year.
- **Goal 4, the sea's share from Lighthouse 10 (30 to 50 % of the wood and the fish):**
  - E gives 34 to 35 % of the wood and 44 to 46 % of the fish to the regular and dedicated players.
  - The casual player stays below: 13 % of the wood, 24 % of the fish. Three sessions a day leave their fleets few trips, and they also go to the wrecks.
  - C without A gives 45 to 46 % of the wood and 54 to 55 % of the fish to the frequent players.
- **The island-only player:** with E, it reaches Lighthouse 10 on day 6.0, 20 on day 73 and 25 on day 211. It progresses, more slowly, and is never stuck.
- **Goal 5, survival:** with A (and E), no Mist is ever missed. With the rules, the island-only player misses 2: the Refinery 1 makes 11 oil an hour against the 18.75 that the stoked Lighthouse 5 burns. With A, the Refinery that keeps the stoked Lighthouse lit is about half as high (table 2).
- **Nothing to buy, no speed-up given:** the options change production, the sea and the builders, for every city, played or not. Nothing is sold, no reward is a speed-up, and the island never runs out (decision of 21 October).
- **Its cost: a surplus.**
  - With E, the frequent players' storage is full of wood 23 to 25 % of the run, and of fish 42 to 43 %. The storage cuts off about 21,000 to 27,000 a day (production and cargo).
  - From the middle of the game, they wait on the builds' durations more than on the resources.
  - "E, A without the Fishery" keeps less fish (36 %), but the quest follower then waits 23.6 hours on day 2: it needs the fish for its troops.

## The late game's wall (measured, not corrected)

- The Lighthouse's last levels are long by their builds alone: 25 to 26 builds for 20.9 days, 29 to 30 for 43.4. From 25 to 30, that is about 156 days of building, and the Pearls of 26 to 30 come on top.
- With E, the regular player goes from Lighthouse 25 to 30 in 156 days (205 with the rules). The wall is the build time, no longer the resources.
- Lighthouse 30 comes on day 256 to 299 with E, against 320 to 343 with the rules (the study's players), and 314 to 350 in `docs/balance.md`.
- C alone brings the dedicated player's Lighthouse 30 forward by 22 %, but the casual player's back by 3 %.
- D pushes Lighthouse 25 back by 11 to 34 %.

## What C needs in the game

- **`shared/` (rules, tests first):**
  - `sea.ts`: a fleet may sail to an isle or a shoal as to a wreck, with no troops; the harvest is wood or fish, up to the hold; the amount follows the Lighthouse; the wait before it fills again.
  - The sea's world: the isles' and shoals' amounts and waits, read back by `parseState`. It refuses an unknown wait today, so it must accept these, and a stored city gets them through a new shape.
  - The simulator sends its fleets to the resource it holds least of (already in this study's `simulate.ts`).
- **The client:**
  - the sheet of an isle and of a shoal (what it holds, the trip, "Send a fleet", the wait when emptied);
  - the fleet's return.
  - The map already draws the 5 isles and the 6 shoals at their places (`client/src/sea/map.ts`).
- **The server:** no code of its own. It applies the rules of `shared/`, and the sites are already in `SEA_SITES`, with their places and amounts. There is no new data on the sea map and no new table in the database.

## Recommendation (for the owner's decision, value by value)

1. **E = A + C:**
   - **A:** the Lumberyard, the Refinery and the Fishery make, at level L, what level L + min(L, 5) makes today.
   - **C:** the Wooded Isles and Fish Shoals open to the fleets. Each holds its map amount × (1 + 0.1 × (Lighthouse − 1)) and fills again 8 hours after it is emptied. No troops; the wrecks keep the oil.
2. **Not B:** the storage already holds more than 10 hours at every level.
3. **Not D:** more builders spend in parallel what the Lighthouse needs. The mornings fail and Lighthouse 20 to 30 come later.
4. **The balance's players save as the study's do** (simulator only, not the game). It moves `docs/balance.md`'s reference.
5. **Open points:**
   - the surplus of fish (A on the Fishery or not);
   - the casual player's sea share, below 30 %;
   - the late game's wall, which E shortens by about a fifth without changing its nature: build times.

## The measures

<!-- resources:generated:start (npx tsx tools/balance/resources-run.ts) -->

### 0. Day 2: how the simulated players spend

Builder hours left free on day 2 for lack of resources (two builders: up to 48), and in brackets the hours a builder finished while the player was away. Both rows play the same rules.

| Players | Follows the quests | Dedicated (10) | Regular (6) | Casual (3) | Island only |
| --- | --- | --- | --- | --- | --- |
| The balance's, today (all the reserve held) | 37.9 h (away 0.0) | 38.0 h (away 5.9) | 36.0 h (away 7.9) | 16.0 h (away 27.9) | 48.0 h (away 0.0) |
| The study's (the reserve held only on what is spent) | 36.0 h (away 0.0) | 13.3 h (away 24.8) | 12.0 h (away 24.2) | 11.0 h (away 32.9) | 38.0 h (away 9.9) |

The same players' milestones, the rules unchanged:

| Players | Profile | Lighthouse 5 | 10 | 15 | 20 | 25 | 30 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| today's | Dedicated (10) | day 0.1 | day 5.6 | day 16.7 | day 46.0 | day 119.6 | day 326.4 |
| today's | Regular (6) | day 0.2 | day 4.9 | day 17.1 | day 44.5 | day 115.4 | day 313.6 |
| today's | Casual (3) | day 0.6 | day 6.8 | day 25.5 | day 64.6 | day 153.0 | day 350.4 |
| today's | Island only | day 0.2 | not reached | not reached | not reached | not reached | not reached |
| the study's | Dedicated (10) | day 0.1 | day 3.5 | day 14.8 | day 41.5 | day 115.0 | day 329.0 |
| the study's | Regular (6) | day 0.2 | day 3.6 | day 14.7 | day 43.2 | day 115.0 | day 319.7 |
| the study's | Casual (3) | day 0.6 | day 5.6 | day 19.7 | day 51.2 | day 139.4 | day 342.6 |
| the study's | Island only | day 0.2 | day 11.8 | day 39.5 | day 111.0 | day 309.4 | not reached |

### 1. Production per level against what the builders spend

Every producer at the level, no research. Two builders spend: the Lighthouse's next level and the average other building's, each per hour of its build.

| Level | Wood / h | Oil / h | Fish / h | Lighthouse to the next: wood, oil (build) | Hours of the Lumberyard to pay its wood | Two builders spend / h: wood, oil, fish | Covered today: wood, oil, fish | Covered with A: wood, oil, fish |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 5 | 210 | 55 | 70 | 970, 650 (4.0 h) | 4.6 | 443, 228, 81 | 47 %, 24 %, 86 % | 95 %, 48 %, 172 % |
| 6 | 252 | 66 | 84 | 1,360, 900 (5.4 h) | 5.4 | 466, 236, 87 | 54 %, 28 %, 97 % | 99 %, 51 %, 177 % |
| 7 | 294 | 77 | 98 | 1,900, 1,260 (7.4 h) | 6.5 | 489, 248, 93 | 60 %, 31 %, 106 % | 103 %, 53 %, 181 % |
| 8 | 336 | 88 | 112 | 2,660, 1,770 (9.9 h) | 7.9 | 514, 260, 99 | 65 %, 34 %, 113 % | 106 %, 55 %, 184 % |
| 9 | 378 | 99 | 126 | 3,720, 2,480 (13.4 h) | 9.8 | 540, 272, 106 | 70 %, 36 %, 119 % | 109 %, 57 %, 186 % |
| 10 | 420 | 110 | 140 | 5,210, 3,470 (18.1 h) | 12.4 | 568, 284, 113 | 74 %, 39 %, 124 % | 111 %, 58 %, 186 % |
| 11 | 462 | 121 | 154 | 7,290, 4,860 (24.4 h) | 15.8 | 597, 297, 120 | 77 %, 41 %, 128 % | 113 %, 59 %, 186 % |
| 12 | 504 | 132 | 168 | 10,200, 6,800 (33.0 h) | 20.2 | 628, 311, 128 | 80 %, 42 %, 131 % | 114 %, 60 %, 186 % |
| 13 | 546 | 143 | 182 | 14,290, 9,520 (44.5 h) | 26.2 | 661, 326, 137 | 83 %, 44 %, 133 % | 114 %, 61 %, 184 % |
| 14 | 588 | 154 | 196 | 20,000, 13,330 (60.1 h) | 34.0 | 695, 341, 146 | 85 %, 45 %, 134 % | 115 %, 61 %, 182 % |
| 15 | 630 | 165 | 210 | 28,000, 18,670 (81.1 h) | 44.4 | 732, 358, 156 | 86 %, 46 %, 135 % | 115 %, 62 %, 180 % |
| 20 | 840 | 220 | 280 | 103,970, 69,310 (201.9 h) | 123.8 | 1,049, 519, 215 | 80 %, 42 %, 130 % | 100 %, 53 %, 163 % |

### 2. The storage

Hours of production to fill the storage from empty, every producer at the Lighthouse's level: wood as made, oil after what the Lighthouse burns, fish after what a full town eats.

| Lighthouse | Storage | Hours to fill: wood, oil, fish (today) | With A | The lowest Refinery that keeps the stoked Lighthouse lit: today, with A |
| --- | --- | --- | --- | --- |
| 5 | 14,000 | 66.7 h, 329.4 h, 257.4 h | 33.3 h, 143.6 h, 112.5 h | level 2, level 1 |
| 6 | 16,500 | 65.5 h, 323.5 h, 250.0 h | 35.7 h, 155.7 h, 121.3 h | level 3, level 2 |
| 8 | 21,500 | 64.0 h, 316.2 h, 241.0 h | 39.4 h, 174.8 h, 135.1 h | level 3, level 2 |
| 10 | 26,500 | 63.1 h, 311.8 h, 235.8 h | 42.1 h, 189.3 h, 145.3 h | level 4, level 2 |
| 12 | 31,500 | 62.5 h, 308.8 h, 232.3 h | 44.1 h, 200.6 h, 153.2 h | level 5, level 3 |
| 15 | 39,000 | 61.9 h, 305.9 h, 228.9 h | 46.4 h, 213.7 h, 162.2 h | level 6, level 3 |
| 18 | 76,900 | 101.7 h, 502.6 h, 374.8 h | 79.6 h, 369.7 h, 279.4 h | level 7, level 4 |
| 20 | 129,963 | 154.7 h, 764.5 h, 569.0 h | 123.8 h, 577.6 h, 435.5 h | level 7, level 4 |
| 25 | 482,538 | 459.6 h, 2270.8 h, 1684.8 h | 383.0 h, 1803.9 h, 1353.9 h | level 9, level 5 |
| 30 | 1,791,650 | 1421.9 h, 7026.1 h, 5202.2 h | 1218.8 h, 5779.5 h, 4323.5 h | level 11, level 6 |

What the storage cut off, for the study's players (today's rules):

| Profile | Production cut off a day (oil, fish, wood): days 1–30 | 31–90 | 91–365 | Brought back and left at sea a day, days 1–365 | Hours full (oil, fish, wood), share of the run |
| --- | --- | --- | --- | --- | --- |
| Dedicated (10) | 523, 0, 0 | 258, 0, 0 | 871, 0, 0 | 6,146, 0, 0 | 25 %, 0 %, 0 % |
| Regular (6) | 146, 0, 0 | 8, 0, 0 | 0, 0, 0 | 68, 0, 0 | 1 %, 0 %, 0 % |
| Casual (3) | 0, 0, 0 | 0, 0, 0 | 0, 0, 0 | 0, 0, 0 | 0 %, 0 %, 0 % |
| Island only | 0, 0, 180 | 0, 0, 1,620 | 0, 0, 2,298 | 0, 0, 0 | 0 %, 0 %, 15 % |

### 3. Where each resource comes from, today

Share of what came in at each Lighthouse band, for the study's players: the island's buildings, the sea (wrecks), the camps' loot, the rewards (objectives and chests).

| Profile | Lighthouse | Wood: island / sea / camps / rewards (%) | Oil | Fish |
| --- | --- | --- | --- | --- |
| Dedicated (10) | 1–4 | 100 / 0 / 0 / 0 | 8 / 92 / 0 / 0 | 100 / 0 / 0 / 0 |
| Dedicated (10) | 5–9 | 88 / 0 / 5 / 7 | 10 / 79 / 5 / 6 | 59 / 0 / 0 / 41 |
| Dedicated (10) | 10–14 | 80 / 0 / 20 / 0 | 19 / 58 / 23 / 0 | 100 / 0 / 0 / 0 |
| Dedicated (10) | 15–19 | 81 / 0 / 19 / 0 | 23 / 53 / 24 / 0 | 100 / 0 / 0 / 0 |
| Dedicated (10) | 20–24 | 88 / 0 / 12 / 0 | 23 / 64 / 14 / 0 | 100 / 0 / 0 / 0 |
| Dedicated (10) | 25–30 | 94 / 0 / 6 / 0 | 21 / 73 / 6 / 0 | 100 / 0 / 0 / 0 |
| Regular (6) | 1–4 | 100 / 0 / 0 / 0 | 14 / 86 / 0 / 0 | 100 / 0 / 0 / 0 |
| Regular (6) | 5–9 | 87 / 0 / 6 / 7 | 13 / 72 / 8 / 8 | 61 / 0 / 0 / 39 |
| Regular (6) | 10–14 | 85 / 0 / 15 / 0 | 19 / 63 / 18 / 0 | 100 / 0 / 0 / 0 |
| Regular (6) | 15–19 | 92 / 0 / 8 / 0 | 24 / 66 / 10 / 0 | 100 / 0 / 0 / 0 |
| Regular (6) | 20–24 | 94 / 0 / 6 / 0 | 28 / 64 / 8 / 0 | 100 / 0 / 0 / 0 |
| Regular (6) | 25–30 | 96 / 0 / 4 / 0 | 21 / 76 / 4 / 0 | 100 / 0 / 0 / 0 |
| Casual (3) | 1–4 | 100 / 0 / 0 / 0 | 27 / 73 / 0 / 0 | 100 / 0 / 0 / 0 |
| Casual (3) | 5–9 | 93 / 0 / 2 / 4 | 20 / 70 / 3 / 7 | 78 / 0 / 0 / 22 |
| Casual (3) | 10–14 | 92 / 0 / 8 / 1 | 32 / 55 / 12 / 1 | 97 / 0 / 0 / 3 |
| Casual (3) | 15–19 | 93 / 0 / 7 / 0 | 32 / 57 / 11 / 0 | 100 / 0 / 0 / 0 |
| Casual (3) | 20–24 | 96 / 0 / 4 / 0 | 34 / 61 / 5 / 0 | 100 / 0 / 0 / 0 |
| Casual (3) | 25–30 | 98 / 0 / 2 / 0 | 21 / 77 / 2 / 0 | 100 / 0 / 0 / 0 |

### The options: their values

A, the producers' curve (the Lumberyard, the Refinery and the Fishery alike):

| Level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rules: makes as level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
| A: makes as level | 2 | 4 | 6 | 8 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
| A: wood / h | 84 | 168 | 252 | 336 | 420 | 462 | 504 | 546 | 588 | 630 | 672 | 714 | 756 | 798 | 840 |

C, what an isle or a shoal holds (the map's amounts are 360 to 600), refilled 8 hours after it is emptied:

| Lighthouse | Wooded Isles (5): holds, each | Fish Shoals (6): holds, each |
| --- | --- | --- |
| 1 | 360 to 600 | 360 to 600 |
| 5 | 504 to 840 | 504 to 840 |
| 10 | 684 to 1,140 | 684 to 1,140 |
| 15 | 864 to 1,440 | 864 to 1,440 |
| 20 | 1,044 to 1,740 | 1,044 to 1,740 |
| 25 | 1,224 to 2,040 | 1,224 to 2,040 |
| 30 | 1,404 to 2,340 | 1,404 to 2,340 |

### Goal 1: builders waiting for resources on day 2 (at most 16 h)

| Variant | Follows the quests | Dedicated (10) | Regular (6) | Casual (3) | Island only |
| --- | --- | --- | --- | --- | --- |
| A + C (the rules) | 36.0 h | 13.3 h | 12.0 h | 11.0 h | 38.0 h |
| A | 26.9 h | 3.3 h | 2.0 h | 16.0 h | 23.0 h |
| B | 36.0 h | 13.3 h | 12.0 h | 11.0 h | 38.0 h |
| C | 30.2 h | 8.3 h | 10.0 h | 5.0 h | 38.0 h |
| D | 36.0 h | 13.3 h | 12.0 h | 11.0 h | 38.0 h |
| A+B | 26.9 h | 3.3 h | 2.0 h | 16.0 h | 23.0 h |
| A+D | 26.9 h | 3.3 h | 2.0 h | 16.0 h | 23.0 h |
| B+C | 30.2 h | 8.3 h | 10.0 h | 5.0 h | 38.0 h |
| C+D | 30.2 h | 8.3 h | 10.0 h | 5.0 h | 38.0 h |
| A+B+C | 14.7 h | 6.7 h | 0.0 h | 16.0 h | 23.0 h |
| A+B+C+D | 14.7 h | 6.7 h | 0.0 h | 16.0 h | 23.0 h |
| E (A + C) | 14.7 h | 6.7 h | 0.0 h | 16.0 h | 23.0 h |
| E, A without the Fishery | 23.6 h | 6.7 h | 6.0 h | 16.0 h | 23.0 h |

### Goal 2: mornings when a builder is free and nothing can be paid for (the Lighthouse or a producer)

Mornings: the first session after a night of 6 hours or more, before noon, over the whole run.

| Variant | Follows the quests | Dedicated (10) | Regular (6) | Casual (3) | Island only |
| --- | --- | --- | --- | --- | --- |
| A + C (the rules) | 0 of 2 | 4 of 364 | 7 of 364 | 3 of 399 | 7 of 364 |
| A | 0 of 2 | 0 of 364 | 0 of 364 | 0 of 399 | 1 of 364 |
| B | 0 of 2 | 4 of 364 | 7 of 364 | 3 of 399 | 7 of 364 |
| C | 0 of 2 | 0 of 364 | 0 of 364 | 3 of 399 | 7 of 364 |
| D | 0 of 2 | 170 of 364 | 166 of 364 | 162 of 399 | 81 of 364 |
| A+B | 0 of 2 | 0 of 364 | 0 of 364 | 0 of 399 | 1 of 364 |
| A+D | 0 of 2 | 161 of 364 | 155 of 364 | 174 of 399 | 102 of 364 |
| B+C | 0 of 2 | 0 of 364 | 0 of 364 | 3 of 399 | 7 of 364 |
| C+D | 0 of 2 | 45 of 364 | 54 of 364 | 118 of 399 | 81 of 364 |
| A+B+C | 0 of 2 | 0 of 364 | 0 of 364 | 0 of 399 | 1 of 364 |
| A+B+C+D | 0 of 2 | 15 of 364 | 17 of 364 | 79 of 399 | 102 of 364 |
| E (A + C) | 0 of 2 | 0 of 364 | 0 of 364 | 0 of 399 | 1 of 364 |
| E, A without the Fishery | 0 of 2 | 0 of 364 | 0 of 364 | 0 of 399 | 5 of 364 |

### Goal 3: the Lighthouse's milestones

In brackets: against the rules (A + C), for the same players.

| Variant | Profile | Lighthouse 5 | Lighthouse 10 | Lighthouse 15 | Lighthouse 20 | Lighthouse 25 | Lighthouse 30 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A + C (the rules) | Dedicated (10) | day 0.1 | day 3.5 | day 14.8 | day 41.5 | day 115.0 | day 329.0 |
| A + C (the rules) | Regular (6) | day 0.2 | day 3.6 | day 14.7 | day 43.2 | day 115.0 | day 319.7 |
| A + C (the rules) | Casual (3) | day 0.6 | day 5.6 | day 19.7 | day 51.2 | day 139.4 | day 342.6 |
| A + C (the rules) | Island only | day 0.2 | day 11.8 | day 39.5 | day 111.0 | day 309.4 | not reached |
| A | Dedicated (10) | day 0.1 (0 %) | day 3.1 (-12.6 %) | day 10.9 (-26.1 %) | day 36.2 (-12.6 %) | day 102.4 (-11 %) | day 277.6 (-15.6 %) |
| A | Regular (6) | day 0.2 (0 %) | day 3.1 (-13.7 %) | day 12.0 (-18.7 %) | day 38.0 (-12.1 %) | day 104.8 (-8.9 %) | day 285.4 (-10.8 %) |
| A | Casual (3) | day 0.6 (0 %) | day 4.1 (-26.2 %) | day 16.0 (-18.6 %) | day 43.0 (-16 %) | day 116.0 (-16.8 %) | day 312.4 (-8.8 %) |
| A | Island only | day 0.2 (0 %) | day 6.0 (-48.9 %) | day 22.0 (-44.3 %) | day 73.0 (-34.2 %) | day 211.0 (-31.8 %) | not reached (–) |
| B | Dedicated (10) | day 0.1 (0 %) | day 3.5 (0 %) | day 14.8 (0 %) | day 41.5 (0 %) | day 115.0 (0 %) | day 329.0 (0 %) |
| B | Regular (6) | day 0.2 (0 %) | day 3.6 (0 %) | day 14.7 (0 %) | day 43.2 (0 %) | day 115.0 (0 %) | day 319.7 (0 %) |
| B | Casual (3) | day 0.6 (0 %) | day 5.6 (0 %) | day 19.7 (0 %) | day 51.2 (0 %) | day 139.4 (0 %) | day 342.6 (0 %) |
| B | Island only | day 0.2 (0 %) | day 11.8 (0 %) | day 39.5 (0 %) | day 111.0 (0 %) | day 309.4 (0 %) | not reached (–) |
| C | Dedicated (10) | day 0.1 (0 %) | day 3.5 (0 %) | day 12.5 (-15.8 %) | day 38.0 (-8.4 %) | day 101.0 (-12.2 %) | day 257.0 (-21.9 %) |
| C | Regular (6) | day 0.2 (0 %) | day 4.0 (+10.3 %) | day 15.5 (+5.1 %) | day 41.0 (-5.2 %) | day 108.4 (-5.8 %) | day 284.4 (-11.1 %) |
| C | Casual (3) | day 0.6 (0 %) | day 6.6 (+18 %) | day 21.5 (+9.1 %) | day 56.0 (+9.4 %) | day 141.7 (+1.6 %) | day 353.0 (+3 %) |
| C | Island only | day 0.2 (0 %) | day 11.8 (0 %) | day 39.5 (0 %) | day 111.0 (0 %) | day 309.4 (0 %) | not reached (–) |
| D | Dedicated (10) | day 0.1 (0 %) | day 3.5 (0 %) | day 15.5 (+4.4 %) | day 51.4 (+24 %) | day 154.5 (+34.4 %) | not reached (–) |
| D | Regular (6) | day 0.2 (0 %) | day 3.6 (0 %) | day 16.5 (+11.9 %) | day 55.1 (+27.5 %) | day 153.4 (+33.4 %) | not reached (–) |
| D | Casual (3) | day 0.6 (0 %) | day 5.6 (0 %) | day 20.5 (+4 %) | day 58.0 (+13.3 %) | day 155.0 (+11.1 %) | day 437.4 (+27.7 %) |
| D | Island only | day 0.2 (0 %) | day 11.8 (0 %) | day 39.6 (+0.3 %) | day 117.0 (+5.4 %) | day 324.5 (+4.9 %) | not reached (–) |
| A+B | Dedicated (10) | day 0.1 (0 %) | day 3.1 (-12.6 %) | day 10.9 (-26.1 %) | day 36.2 (-12.6 %) | day 102.4 (-11 %) | day 277.6 (-15.6 %) |
| A+B | Regular (6) | day 0.2 (0 %) | day 3.1 (-13.7 %) | day 12.0 (-18.7 %) | day 38.0 (-12.1 %) | day 104.8 (-8.9 %) | day 285.4 (-10.8 %) |
| A+B | Casual (3) | day 0.6 (0 %) | day 4.1 (-26.2 %) | day 16.0 (-18.6 %) | day 43.0 (-16 %) | day 116.0 (-16.8 %) | day 312.4 (-8.8 %) |
| A+B | Island only | day 0.2 (0 %) | day 6.0 (-48.9 %) | day 22.0 (-44.3 %) | day 73.0 (-34.2 %) | day 211.0 (-31.8 %) | not reached (–) |
| A+D | Dedicated (10) | day 0.1 (0 %) | day 3.1 (-12.6 %) | day 11.5 (-22.6 %) | day 37.0 (-10.8 %) | day 129.6 (+12.7 %) | day 378.4 (+15 %) |
| A+D | Regular (6) | day 0.2 (0 %) | day 3.1 (-13.7 %) | day 12.0 (-18.7 %) | day 39.6 (-8.4 %) | day 128.5 (+11.7 %) | day 371.4 (+16.1 %) |
| A+D | Casual (3) | day 0.6 (0 %) | day 4.1 (-26.2 %) | day 16.0 (-18.6 %) | day 45.0 (-12.1 %) | day 129.4 (-7.2 %) | day 378.0 (+10.3 %) |
| A+D | Island only | day 0.2 (0 %) | day 6.0 (-48.9 %) | day 22.7 (-42.4 %) | day 75.1 (-32.3 %) | day 236.4 (-23.6 %) | not reached (–) |
| B+C | Dedicated (10) | day 0.1 (0 %) | day 3.5 (0 %) | day 12.5 (-15.8 %) | day 38.0 (-8.4 %) | day 101.0 (-12.2 %) | day 257.0 (-21.9 %) |
| B+C | Regular (6) | day 0.2 (0 %) | day 4.0 (+10.3 %) | day 15.5 (+5.1 %) | day 41.0 (-5.2 %) | day 108.4 (-5.8 %) | day 284.4 (-11.1 %) |
| B+C | Casual (3) | day 0.6 (0 %) | day 6.6 (+18 %) | day 21.5 (+9.1 %) | day 56.0 (+9.4 %) | day 141.7 (+1.6 %) | day 353.0 (+3 %) |
| B+C | Island only | day 0.2 (0 %) | day 11.8 (0 %) | day 39.5 (0 %) | day 111.0 (0 %) | day 309.4 (0 %) | not reached (–) |
| C+D | Dedicated (10) | day 0.1 (0 %) | day 3.5 (0 %) | day 12.5 (-15.4 %) | day 38.0 (-8.4 %) | day 115.8 (+0.7 %) | day 311.6 (-5.3 %) |
| C+D | Regular (6) | day 0.2 (0 %) | day 4.0 (+10.3 %) | day 15.5 (+5.1 %) | day 42.5 (-1.7 %) | day 129.9 (+12.9 %) | day 338.4 (+5.8 %) |
| C+D | Casual (3) | day 0.6 (0 %) | day 6.6 (+18 %) | day 21.5 (+9.1 %) | day 56.6 (+10.4 %) | day 158.4 (+13.6 %) | day 417.0 (+21.7 %) |
| C+D | Island only | day 0.2 (0 %) | day 11.8 (0 %) | day 39.6 (+0.3 %) | day 117.0 (+5.4 %) | day 324.5 (+4.9 %) | not reached (–) |
| A+B+C | Dedicated (10) | day 0.1 (0 %) | day 2.8 (-20.5 %) | day 11.5 (-22.6 %) | day 37.0 (-10.8 %) | day 100.0 (-13.1 %) | day 256.0 (-22.2 %) |
| A+B+C | Regular (6) | day 0.2 (0 %) | day 3.5 (-3.4 %) | day 12.5 (-15.3 %) | day 38.0 (-12.1 %) | day 101.4 (-11.8 %) | day 257.6 (-19.4 %) |
| A+B+C | Casual (3) | day 0.6 (0 %) | day 4.6 (-18 %) | day 16.0 (-18.6 %) | day 43.0 (-16 %) | day 117.4 (-15.8 %) | day 299.0 (-12.7 %) |
| A+B+C | Island only | day 0.2 (0 %) | day 6.0 (-48.9 %) | day 22.0 (-44.3 %) | day 73.0 (-34.2 %) | day 211.0 (-31.8 %) | not reached (–) |
| A+B+C+D | Dedicated (10) | day 0.1 (0 %) | day 2.8 (-20.5 %) | day 11.5 (-22.6 %) | day 37.0 (-10.8 %) | day 105.4 (-8.4 %) | day 289.4 (-12 %) |
| A+B+C+D | Regular (6) | day 0.2 (0 %) | day 3.5 (-3.4 %) | day 12.5 (-15.3 %) | day 38.0 (-12.1 %) | day 115.5 (+0.4 %) | day 319.4 (-0.1 %) |
| A+B+C+D | Casual (3) | day 0.6 (0 %) | day 4.6 (-18 %) | day 16.0 (-18.6 %) | day 44.6 (-13 %) | day 133.4 (-4.3 %) | day 360.4 (+5.2 %) |
| A+B+C+D | Island only | day 0.2 (0 %) | day 6.0 (-48.9 %) | day 22.7 (-42.4 %) | day 75.1 (-32.3 %) | day 236.4 (-23.6 %) | not reached (–) |
| E (A + C) | Dedicated (10) | day 0.1 (0 %) | day 2.8 (-20.5 %) | day 11.5 (-22.6 %) | day 37.0 (-10.8 %) | day 100.0 (-13.1 %) | day 256.0 (-22.2 %) |
| E (A + C) | Regular (6) | day 0.2 (0 %) | day 3.5 (-3.4 %) | day 12.5 (-15.3 %) | day 38.0 (-12.1 %) | day 101.4 (-11.8 %) | day 257.6 (-19.4 %) |
| E (A + C) | Casual (3) | day 0.6 (0 %) | day 4.6 (-18 %) | day 16.0 (-18.6 %) | day 43.0 (-16 %) | day 117.4 (-15.8 %) | day 299.0 (-12.7 %) |
| E (A + C) | Island only | day 0.2 (0 %) | day 6.0 (-48.9 %) | day 22.0 (-44.3 %) | day 73.0 (-34.2 %) | day 211.0 (-31.8 %) | not reached (–) |
| E, A without the Fishery | Dedicated (10) | day 0.1 (0 %) | day 2.7 (-22.5 %) | day 11.5 (-22.6 %) | day 37.0 (-10.8 %) | day 100.0 (-13.1 %) | day 256.0 (-22.2 %) |
| E, A without the Fishery | Regular (6) | day 0.2 (0 %) | day 3.6 (0 %) | day 12.5 (-15.3 %) | day 38.0 (-12.1 %) | day 101.4 (-11.8 %) | day 264.6 (-17.2 %) |
| E, A without the Fishery | Casual (3) | day 0.6 (0 %) | day 4.6 (-18 %) | day 16.0 (-18.6 %) | day 43.2 (-15.6 %) | day 117.4 (-15.8 %) | day 302.0 (-11.9 %) |
| E, A without the Fishery | Island only | day 0.2 (0 %) | day 6.5 (-44.6 %) | day 24.1 (-39 %) | day 76.3 (-31.2 %) | day 220.0 (-28.9 %) | not reached (–) |

### Goal 4: the sea's share from Lighthouse 10 (target: 30 to 50 % of the wood and the fish)

| Variant | Dedicated (10) | Regular (6) | Casual (3) |
| --- | --- | --- | --- |
| A + C (the rules) | 8 % wood, 0 % fish | 5 % wood, 0 % fish | 3 % wood, 0 % fish |
| A | 7 % wood, 0 % fish | 4 % wood, 0 % fish | 3 % wood, 0 % fish |
| B | 8 % wood, 0 % fish | 5 % wood, 0 % fish | 3 % wood, 0 % fish |
| C | 46 % wood, 55 % fish | 45 % wood, 54 % fish | 14 % wood, 26 % fish |
| D | 7 % wood, 0 % fish | 4 % wood, 0 % fish | 3 % wood, 0 % fish |
| A+B | 7 % wood, 0 % fish | 4 % wood, 0 % fish | 3 % wood, 0 % fish |
| A+D | 6 % wood, 0 % fish | 3 % wood, 0 % fish | 2 % wood, 0 % fish |
| B+C | 46 % wood, 55 % fish | 45 % wood, 54 % fish | 14 % wood, 26 % fish |
| C+D | 44 % wood, 66 % fish | 44 % wood, 64 % fish | 18 % wood, 37 % fish |
| A+B+C | 35 % wood, 46 % fish | 34 % wood, 44 % fish | 13 % wood, 24 % fish |
| A+B+C+D | 38 % wood, 59 % fish | 38 % wood, 56 % fish | 15 % wood, 31 % fish |
| E (A + C) | 35 % wood, 46 % fish | 34 % wood, 44 % fish | 13 % wood, 24 % fish |
| E, A without the Fishery | 35 % wood, 55 % fish | 34 % wood, 54 % fish | 12 % wood, 40 % fish |

### Goal 5: the Mists missed (the oil always lasts)

| Variant | Follows the quests | Dedicated (10) | Regular (6) | Casual (3) | Island only |
| --- | --- | --- | --- | --- | --- |
| A + C (the rules) | 0 | 0 | 0 | 0 | 2 |
| A | 0 | 0 | 0 | 0 | 0 |
| B | 0 | 0 | 0 | 0 | 2 |
| C | 0 | 0 | 0 | 0 | 2 |
| D | 0 | 0 | 0 | 0 | 2 |
| A+B | 0 | 0 | 0 | 0 | 0 |
| A+D | 0 | 0 | 0 | 0 | 0 |
| B+C | 0 | 0 | 0 | 0 | 2 |
| C+D | 0 | 0 | 0 | 0 | 2 |
| A+B+C | 0 | 0 | 0 | 0 | 0 |
| A+B+C+D | 0 | 0 | 0 | 0 | 0 |
| E (A + C) | 0 | 0 | 0 | 0 | 0 |
| E, A without the Fishery | 0 | 0 | 0 | 0 | 0 |

### The storage full, and what it cut off

Share of the run with the wood / the fish full, and what the storage cut off a day (production and cargo left at sea).

| Variant | Dedicated (10) | Regular (6) | Casual (3) | Island only |
| --- | --- | --- | --- | --- |
| A + C (the rules) | 0 % / 0 % (6,888 a day) | 0 % / 0 % (81 a day) | 0 % / 0 % (0 a day) | 15 % / 0 % (2,012 a day) |
| A | 2 % / 0 % (9,911 a day) | 0 % / 0 % (2,300 a day) | 0 % / 0 % (2,590 a day) | 12 % / 0 % (2,669 a day) |
| B | 0 % / 0 % (6,888 a day) | 0 % / 0 % (81 a day) | 0 % / 0 % (0 a day) | 15 % / 0 % (2,012 a day) |
| C | 11 % / 34 % (16,516 a day) | 7 % / 34 % (10,209 a day) | 0 % / 0 % (0 a day) | 15 % / 0 % (2,012 a day) |
| D | 0 % / 0 % (7,177 a day) | 0 % / 0 % (1,477 a day) | 0 % / 0 % (1,317 a day) | 22 % / 0 % (3,546 a day) |
| A+B | 2 % / 0 % (9,911 a day) | 0 % / 0 % (2,300 a day) | 0 % / 0 % (2,590 a day) | 12 % / 0 % (2,669 a day) |
| A+D | 0 % / 0 % (7,219 a day) | 0 % / 0 % (493 a day) | 0 % / 0 % (372 a day) | 25 % / 0 % (6,303 a day) |
| B+C | 11 % / 34 % (16,516 a day) | 7 % / 34 % (10,209 a day) | 0 % / 0 % (0 a day) | 15 % / 0 % (2,012 a day) |
| C+D | 0 % / 3 % (761 a day) | 0 % / 8 % (1,784 a day) | 0 % / 0 % (0 a day) | 22 % / 0 % (3,546 a day) |
| A+B+C | 25 % / 43 % (27,072 a day) | 23 % / 42 % (21,520 a day) | 1 % / 0 % (452 a day) | 12 % / 0 % (2,669 a day) |
| A+B+C+D | 2 % / 10 % (3,939 a day) | 1 % / 16 % (4,571 a day) | 0 % / 0 % (0 a day) | 25 % / 0 % (6,303 a day) |
| E (A + C) | 25 % / 43 % (27,072 a day) | 23 % / 42 % (21,520 a day) | 1 % / 0 % (452 a day) | 12 % / 0 % (2,669 a day) |
| E, A without the Fishery | 24 % / 36 % (24,385 a day) | 21 % / 36 % (18,767 a day) | 0 % / 0 % (76 a day) | 23 % / 0 % (4,694 a day) |

<!-- resources:generated:end -->
