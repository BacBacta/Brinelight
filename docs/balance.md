# Balance

What the rules of `shared/` give over a year of play (365 days), measured by `npm run balance` (`tools/balance/`, week 6, task 5). The tables are written by the script; `npm test` fails when they no longer match the rules. The CSV of every day is `docs/balance/days.csv`. The script changes no value: the rules it plays are those of `shared/`, rebalanced on 18 October by the owner's decisions (options I and J below, then the gentler curve after Lighthouse 15; `docs/decisions.md`), then on 23 October by the early start (A + C, `docs/tasks/early-start.md`).

## How the players play

Three players, with the same choices; only the number of sessions a day differs:

| Profile | Sessions | Times |
| --- | --- | --- |
| Casual | 3 | 8:00, 13:00, 21:00 |
| Regular | 6 | 7:00, 10:00, 13:00, 16:00, 19:00, 22:00 |
| Dedicated | 10 | every 1 h 40 from 7:00 to 22:00 |

The city is founded on day 1 at 8:00, in a first session. A session is instant: the player starts everything the rules allow, then leaves; between sessions, the rules run alone (`advance`). In each session, in this order:

1. **Builders:** the Lighthouse first; otherwise the lowest building (Refinery, Lumberyard, Fishery, Shelters, Barracks, Observatory, Harbor, Infirmary).
2. **Observatory:** the next research of a fixed list (Refining, Saws, Nets, Warehouses, then the sea, then war).
3. **Barracks:** promotions once the Veteran Doctrine is researched, else a batch of soldiers, the three types in turn.
4. **Infirmary:** heals the wounded.
5. **Sea:** the Leviathan first, while it is at sea and a fleet stays free for the wrecks, with all the troops; otherwise the lowest pirate camp with all the troops if the odds are "easy"; every other fleet gathers where the storage holds the least: a wreck (oil and rope), a Wooded Isle (wood) or a Fish Shoal (fish), the nearest it can sail to, one fleet a site (an emptied wreck waits 2 hours before it fills again, an isle or a shoal 8 hours).
6. **Captains:** unlock and add stars as soon as there are shards; the rarest, then highest level, leads; a Logbook while 100 Pearls are left after it.
7. **Rafts:** the rafts repaired as soon as one is below 60, keeping the reserve below; else a building on an empty raft (Greenhouse, Smokehouse, Watchtower, two of each), else the lowest raft building upgraded, else a new raft.
8. **Claims:** every objective done, and every chest the day's points open.

**The reserve:** while the Lighthouse waits, every other spending leaves untouched the cost of its next level, up to what the storage holds (no one can save more), on the resources it spends: an upgrade paid in fish and oil goes ahead while the Lighthouse waits for wood (since 23 October, `docs/studies/resources.md`: holding the whole reserve left the Lumberyard waiting for the Lighthouse's wood). While the Lighthouse is being built, or once it is at level 30, nothing is kept. A first try without this reserve for the other buildings gave a player who never researched nor trained in 60 days: they spent all the wood on buildings first.

**Week 7 is played** (task 5): the Mist, three a day on the city's clock, the order to stoke left on, as for a new city; the repairs; the Leviathan; the objectives and the daily tasks. **Two more players**, with the regular player's sessions: one who turns the order to stoke off at the start and never back on, and one away from day 20 to day 22 (no session), back on day 23. **Not modeled:** other players, the daily recruitment.

## Results

![Lighthouse level by day for the three profiles](balance/lighthouse.svg)

<!-- balance:generated:start (npm run balance) -->

### Milestones (days after the city is founded)

| Profile | Lighthouse 5 | Lighthouse 10 | Lighthouse 15 | Lighthouse 20 | Lighthouse 25 | Lighthouse 30 | Refinery 2 | Barracks 1 | First camp beaten |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Casual (3 sessions) | day 0.6 | day 4.1 | day 15.5 | day 40.4 | day 100.7 | day 248.6 | day 2.0 | day 0.0 | day 1.0 |
| Regular (6 sessions) | day 0.2 | day 2.5 | day 9.0 | day 26.8 | day 72.8 | day 184.7 | day 1.0 | day 0.0 | day 0.4 |
| Dedicated (10 sessions) | day 0.1 | day 2.2 | day 8.4 | day 23.5 | day 65.1 | day 165.6 | day 0.5 | day 0.0 | day 0.3 |

### Day 30

| Profile | Lighthouse | Power | Oil | Fish | Wood | Storage | Troops + veterans | Captains (lead, level, stars) | Techs | Rafts | Camps beaten |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Casual (3 sessions) | 18 | 79,967 | 20,110 | 67,833 | 40,988 | 111,505 | 442 | 6 (mira, 10, 19★) | 18 | 6 | 36 |
| Regular (6 sessions) | 20 | 113,970 | 45,317 | 95,856 | 77,904 | 188,446 | 413 | 6 (mira, 18, 30★) | 28 | 7 | 63 |
| Dedicated (10 sessions) | 21 | 133,983 | 24,093 | 98,920 | 47,608 | 244,978 | 314 | 6 (mira, 19, 30★) | 28 | 7 | 71 |

### Day 90

| Profile | Lighthouse | Power | Oil | Fish | Wood | Storage | Troops + veterans | Captains (lead, level, stars) | Techs | Rafts | Camps beaten |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Casual (3 sessions) | 24 | 161,895 | 90,799 | 290,119 | 163,564 | 538,222 | 1,390 | 6 (mira, 20, 30★) | 28 | 7 | 154 |
| Regular (6 sessions) | 26 | 200,731 | 55,859 | 479,886 | 120,538 | 909,603 | 1,127 | 6 (mira, 20, 30★) | 28 | 7 | 232 |
| Dedicated (10 sessions) | 26 | 202,809 | 280,651 | 587,920 | 531,477 | 909,603 | 1,267 | 6 (mira, 20, 30★) | 28 | 7 | 229 |

### Day 365

| Profile | Lighthouse | Power | Oil | Fish | Wood | Storage | Troops + veterans | Captains (lead, level, stars) | Techs | Rafts | Camps beaten |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Casual (3 sessions) | 30 | 284,925 | 506,874 | 371,809 | 190,125 | 2,597,893 | 891 | 6 (mira, 20, 30★) | 28 | 7 | 243 |
| Regular (6 sessions) | 30 | 304,449 | 1,556,313 | 1,318,440 | 719,266 | 2,597,893 | 1,106 | 6 (mira, 20, 30★) | 28 | 7 | 394 |
| Dedicated (10 sessions) | 30 | 307,155 | 2,601,653 | 1,666,821 | 693,642 | 2,597,893 | 1,372 | 6 (mira, 20, 30★) | 28 | 7 | 426 |

### Waiting and blocks

| Profile | Builder hours free a day (days 1–30) | (days 31–90) | (days 91–365) | Sessions with a builder free and nothing to start | Sessions with nothing at all | Blocked by (sessions) | Hours full: oil, fish, wood |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Casual (3 sessions) | 43.8 | 42.6 | 43.8 | 1000 of 1095 (91 %) | 0 | oil 302, wood 698 | 0, 0, 0 |
| Regular (6 sessions) | 41.1 | 39.3 | 44.0 | 2035 of 2190 (93 %) | 0 | oil 937, wood 1098 | 0, 0, 0 |
| Dedicated (10 sessions) | 38.4 | 40.5 | 44.0 | 3408 of 3650 (93 %) | 11 | oil 813, wood 2595 | 186, 0, 0 |

### Oil, the Mist, the Leviathan and the claims (whole run)

| Profile | Hours of full oil (days 1–90) | Oil spent stoking | Repairs (oil) | Mists held | Mists missed | Hunts joined | Leviathans killed | Objectives claimed | Chests opened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Casual (3 sessions) | 0 | 71,111 | 0 (0 oil) | 1094 | 0 | 364 | 2 | 19 | 776 |
| Regular (6 sessions) | 0 | 74,200 | 0 (0 oil) | 1094 | 0 | 729 | 2 | 19 | 859 |
| Dedicated (10 sessions) | 0 | 75,069 | 0 (0 oil) | 1094 | 0 | 685 | 1 | 19 | 847 |
| Never stokes (6 sessions) | 0 | 0 | 323 (308,730 oil) | 0 | 1094 | 729 | 2 | 18 | 486 |
| Away 3 days (6 sessions, none on days 20 to 22) | 0 | 74,059 | 0 (0 oil) | 1094 | 0 | 723 | 2 | 19 | 844 |

### Pearls a day, by source (average over the whole run)

| Profile | Mist | Leviathan | Camps | Objectives | Chests | Earned | Spent on Logbooks | Pearls at the end |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Casual (3 sessions) | 89.9 | 43.4 | 99.4 | 2.1 | 7.7 | 242.4 | 36.2 | 40,485 |
| Regular (6 sessions) | 89.9 | 115.0 | 242.7 | 2.1 | 31.5 | 481.2 | 37.0 | 127,332 |
| Dedicated (10 sessions) | 89.9 | 83.5 | 281.1 | 2.1 | 31.0 | 487.5 | 35.2 | 130,299 |
| Never stokes (6 sessions) | 0.0 | 114.2 | 214.7 | 2.1 | 6.3 | 337.3 | 27.1 | 78,411 |
| Away 3 days (6 sessions, none on days 20 to 22) | 89.9 | 130.5 | 220.2 | 2.1 | 29.3 | 471.9 | 37.4 | 123,799 |

### Two more players: milestones

| Profile | Lighthouse 5 | Lighthouse 10 | Lighthouse 15 | Lighthouse 20 | Lighthouse 25 | Lighthouse 30 |
| --- | --- | --- | --- | --- | --- | --- |
| Never stokes (6 sessions) | day 0.2 | day 3.1 | day 10.0 | day 28.4 | day 77.8 | day 194.7 |
| Away 3 days (6 sessions, none on days 20 to 22) | day 0.2 | day 2.5 | day 9.0 | day 28.8 | day 73.8 | day 186.7 |

### What a player away finds on return (before the first session)

| Profile | Day | Rafts | Damaged | Lowest sturdiness | Mists missed so far | Oil (storage) | Repairing everything: oil, wood, time |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Away 3 days (6 sessions, none on days 20 to 22) | 23 | 7 | 0 | 100 | 0 | 25,724 (111,505) | 0, 0, 0.0 h |

### The storage wall

| Profile | Lighthouse level | Next level costs | Storage holds | Days at the wall | Got past it |
| --- | --- | --- | --- | --- | --- |
| Casual (3 sessions) | not reached | | | | |
| Regular (6 sessions) | not reached | | | | |
| Dedicated (10 sessions) | not reached | | | | |

### The storage and the Lighthouse, level by level (the rules alone)

| Lighthouse level | Storage | With Sealed Warehouses 3 | Next level: wood | Next level: build time |
| --- | --- | --- | --- | --- |
| 5 | 14,000 | 20,300 | 970 | 0.0 days |
| 10 | 26,500 | 38,425 | 5,210 | 0.2 days |
| 15 | 39,000 | 56,550 | 28,000 | 0.6 days |
| 20 | 129,963 | 188,446 | 103,970 | 1.4 days |
| 25 | 482,538 | 699,679 | 386,030 | 3.1 days |
| 29 | 1,378,188 | 1,998,372 | 1,102,550 | 5.6 days |
| 30 | 1,791,650 | 2,597,893 | – | max level |

<!-- balance:generated:end -->

## What it shows

### The slower build times (24 October): the new reference

The owner chose the slower curve of `docs/studies/durations.md`: levels 6 to 30 take 40 minutes to 3 d 12 h for the producers, up to 5 d 14 h for the Lighthouse's 30 (`BUILD_MINUTES`); levels 1 to 5 do not change.

- **The milestones come sooner.** Lighthouse 30 comes on day 185 for the regular player (265 before), 249 for the casual one (299) and 166 for the dedicated one (256). Lighthouse 20 comes on day 27, 40 and 24.
- **The builds no longer hold the game back; the resources do, wood above all.** From Lighthouse 11 on, a builder is free with nothing to start most of the time (`docs/studies/durations.md`, table 3).
- **The other buildings still stop at levels 21 to 23**: their next levels cost more than the storage holds (section 2 below). The costs past level 15 are the next study.
- **These days are the reference since 24 October**: a test keeps every milestone within 10 % of them (`tools/balance/balance.test.ts`).

### 0. The early start (23 October): the new reference

The quick first levels (an island building's levels 1 to 5 in at most 1, 1, 2, 5 and 15 minutes) and the richer start (2,000 wood, 1,400 oil, 800 fish), the owner's decision of 23 October (`docs/tasks/early-start.md`).

- **Lighthouse 5** comes the first day: at 22 minutes for a player who stays the first hour, and after 2 h 35 to 13 h 15 for the three players (started at their third session of the day). It came on day 1.1 before.
- **Lighthouse 10**:
  - day 6.8 for the casual player (7.6 before);
  - day 4.9 for the regular player (5.6);
  - day 5.6 for the dedicated player (5.7).
- **From Lighthouse 15 on**, the casual and the dedicated players stay within 6 % of week 6. The regular player's Lighthouse 15 and 20 come 13.2 % and 15.4 % sooner: the owner accepted them for this change only.
- **These days are the reference since 23 October**: a test keeps every milestone within 10 % of them, and Lighthouse 15 to 30 within 10 % of week 6 but for that exception (`tools/balance/balance.test.ts`).
- **The second day is short of wood.** Both builders are idle about 44 hours of the 48 for every profile.
- **To review in week 10**, with the late game: the curve of Lighthouse 10 to 20 after A + C (`docs/tasks/roadmap.md`).

Sections 1 to 5 below were written on 18 October, before the early start. Their days are those of that time; the tables above are today's rules.

Written on 18 October, with all of week 7 played and the owner's decisions of that day. A test kept every milestone of the three profiles within 10 % of week 6 (`tools/balance/balance.test.ts`).

### 1. The pace: as in week 6, Lighthouse 30 in about a year

- **Lighthouse 10** comes on day 5.6 (regular), 5.7 (dedicated) and 7.6 (casual); **Lighthouse 15** on day 18.1, 17.1 and 26.5; **Lighthouse 20** on day 48.6, 43.0 and 62.0; **Lighthouse 25** on day 119.5, 115.0 and 147.0; **Lighthouse 30** on day 318.0, 324.8 and 369.6 (the casual player is at level 29 on day 365). The farthest from week 6 is the regular player's Lighthouse 15, 8.2 % sooner.
- The longest build is the last one, 29 to 30: 43.4 days. Build time leads after 15: the regular and the dedicated player reach each level within a few days of each other.

### 2. No storage wall

- The storage always holds 1.25 times the wood of the Lighthouse's next level: 39,000 at Lighthouse 15, 129,963 at 20, 1,791,650 at 30 (2,597,893 with Sealed Warehouses 3, the most the game holds). No one meets a wall in a year.
- The other buildings keep their ×1.6 a level: even at Lighthouse 30 with Sealed Warehouses 3, upgrading them costs more than the storage from level 21 (Barracks, Harbor, Observatory) to 23 (Fishery, Lumberyard) (open question in `docs/decisions.md`).

### 3. What blocks: wood; oil only for the casual player, and less than in week 6

- **Wood:** a builder is left free with nothing to start in 18 % (regular, all for wood), 20 % (dedicated, all for wood) and 31 % (casual) of the sessions in a year.
- **Oil:** it blocks the casual player in 29 sessions in a year (101 in week 6), the regular and the dedicated player never (as in week 6). The wrecks' 2 h wait and the hunt take most of what overflowed: the oil is full 125 hours (regular) and 314 hours (dedicated) in the first 90 days, against 651 and 1,103 in week 6. Richer wrecks past Lighthouse 24 keep the last levels from running short.
- **Pearls** never block them: after the 35,000 of Lighthouse 26 to 30, they hold 27,007 (casual), 79,673 (regular) and 97,225 (dedicated) on day 365.

### 4. Week 7 in the year

- **The Mist:** held 1,093 to 1,094 times a year, the order to stoke left on; stoking burns 65,000 to 69,000 oil a year.
- **The Leviathan:** joined 362 times (casual, at 13:00) to 726 (regular), each time with a fleet left for the wrecks; killed once at most, since level 1's 4,000 health is more than one city deals alone. It gives 52 (casual) to 130 (regular) Pearls a day.
- **Claims:** the 18 objectives, and 755 to 826 chests a year. **Pearls** come in at 207 (casual) to 395 (dedicated) a day; the Mist's 90 a day is the steadiest source.

### 5. The two more players

- **Never stokes:** every Mist missed, its rafts are damaged three times a day. It repairs them as soon as one is below 60: 411 repairs at 2 oil per missing point cost 0.39 million oil a year (3.0 million at the cost before 18 October), and oil never blocks it. Lighthouse 15 on day 21.5, 20 on day 58.1, 25 on day 144.9, 30 on day 352.6: 11 to 21 % slower than the regular player, the price of the Mist's Pearls and of the camps it cannot reach in the dark. Never repairing, it would reach them on day 22.0, 56.0, 137.4 and 362.5: repairing seems to lose a little at Lighthouse 20 and 25 only because the repaired rafts are then upgraded while wood is short, a choice of the simulated player.
- **Away 3 days** (no session on days 20 to 22): back on day 23, its rafts are sound (the order to stoke works without it) and its oil at 45,538 of 65,975. It stays within 3 % of the regular player at every milestone.

### 6. Early game

- Lighthouse 5 comes on day 1.1 for everyone; Refinery 2 on day 1.5 (dedicated) to 4.0 (casual); the first camp beaten on day 1.1 to 2.0.

## Week 7: the wrecks, the chests and the hunt (applied)

Measured on temporary copies of the rules; the owner chose on 18 October. First the wrecks, measured before the simulation played the Leviathan and the claims (week 7, task 3):

| Wrecks' wait | Regular: hours of full oil (days 1–90) | Dedicated | Casual: sessions blocked by oil (1 year) | Worst milestone gap |
| --- | --- | --- | --- | --- |
| None (before) | 729 | 1,154 | 6 | – |
| 1 h | 670 | 616 | 137 | – |
| **2 h + richer wrecks past Lighthouse 24 (applied)** | 340 | 410 | 23 | regular Lighthouse 25, +9.9 % |
| 3 h + richer wrecks | 340 | 488 | 23 | dedicated Lighthouse 20, +8.3 % |

Then the chests and the hunt, on `03c56b5` with all of week 7 played and the wrecks as applied:

| Chests and hunt | Worst milestone gap with week 6 |
| --- | --- |
| Chests with wood, fish and oil, the hunt with any fleet (task 4) | casual Lighthouse 10, +39 % |
| The hunt only with a fleet left free | 24.1 % |
| Same, chest resources × 0.25 | 20.8 % |
| **Same, chests without resources (applied)** | 8.2 % (regular Lighthouse 15) |

With every decision applied, the regular player's oil is full 125 hours in the first 90 days (the hunt now leaves a fleet to the wrecks, and the chests no longer give oil).

## After Lighthouse 15 (applied: ×1.3 and ×1.2)

Measured on `90cdb9c`, before the owner chose the gentler curve (×1.3 in cost, ×1.2 in time a level from level 16 on). Measured over 1,500 days on temporary copies of the rules, the Lighthouse's cost and time changing from its level 15 to 16 on (the levels up to 15 unchanged); "–" is not reached in 1,500 days. "Build time 15 → 30" adds up the Lighthouse's own build times alone.

| After 15: cost / time a level | Build time 15 → 30 | Lighthouse 20 (casual / regular / dedicated) | Lighthouse 25 | Lighthouse 30 | Level on day 365 | Storage at Lighthouse 30 (without Warehouses) |
| --- | --- | --- | --- | --- | --- | --- |
| ×1.4 / ×1.35 (option I, before) | 861 days | 72 / 62 / 56 | 250 / 227 / 215 | 971 / 937 / 917 | 26 / 26 / 26 | 5,445,325 |
| ×1.45 / ×1.4 (steeper) | 1,306 days | 78 / 66 / 61 | 314 / 282 / 272 | 1,515 / 1,382 / 1,436 | 25 / 25 / 25 | 9,217,713 |
| ×1.5 / ×1.45 (steeper still) | 1,971 days | 83 / 72 / 63 | 405 / 373 / 356 | – / – / – | 24 / 24 / 25 | 15,327,525 |
| ×1.6 / ×1.55 (about the prototype's) | 4,396 days | 95 / 84 / 75 | 619 / 600 / 579 | – / – / – | 23 / 23 / 23 | 40,355,500 |
| ×1.4 / ×1.2 | 244 days | 67 / 56 / 50 | 198 / 165 / 155 | 687 / 561 / 548 | 27 / 28 / 28 | 5,445,325 |
| ×1.35 / ×1.25 | 371 days | 66 / 56 / 50 | 176 / 154 / 152 | 549 / 488 / 488 | 28 / 28 / 28 | 3,155,800 |
| **×1.3 / ×1.2 (applied)** | 244 days | 63 / 53 / 45 | 152 / 123 / 119 | 371 / 321 / 326 | 29 / 30 / 30 | 1,791,650 |
| ×1.3 / ×1.15 | 161 days | 62 / 50 / 44 | 139 / 111 / 108 | 353 / 286 / 285 | 30 / 30 / 30 | 1,791,650 |

Option I's curve made Lighthouse 30 a goal of about two and a half years, set by build time (the level 29 to 30 alone took 226 days); a steeper one pushed it past four years and the storage into the tens of millions. The owner chose the gentler curve: Lighthouse 30 in about a year, with levels added later rather than the pace slowed after the fact. (The measures above ran before a fix of the simulator: at level 30, it kept a reserve for a level 31; the milestones did not change.)

## Measured options (applied: I and J)

Measured on `7f6cf68`, before the rebalance, over 60 days: each option was applied to a temporary copy of the rules, played by the three profiles, then removed. Days are after the city is founded; "–" is not reached in 60 days. The owner chose I and J on 18 October; the tables above are the rules with both.

| Option | Lighthouse 10 (casual / regular / dedicated) | Lighthouse 15 | Days at the storage wall (regular / dedicated) | Regular player's sessions blocked by wood |
| --- | --- | --- | --- | --- |
| Before (the prototype's values) | 31.5 / 22.1 / 21.2 | – / – / – | 15.0 / 16.8, never past | 76 % of sessions |
| A. Storage at least 1.25 × the Lighthouse's next wood cost | 31.5 / 22.1 / 21.2 | – / – / – | 0 / 0 (Lighthouse 13 on day 57.2, dedicated) | 70 % |
| B. Lighthouse cost ×1.5 a level instead of ×1.62 | 25.5 / 17.1 / 15.4 | – / – / 75.3 | 0 / 0 in 60 days; the wall comes back at Lighthouse 13 to 15 (without or with Sealed Warehouses) | 46 % |
| C. Lighthouse build time ×1.4 a level instead of ×1.55 | 28.8 / 21.7 / 20.7 | – / – / – | 27.2 / 31.1, from Lighthouse 11, never past | 92 % |
| D. Twice the wood (Lumberyard 28 instead of 14 an hour a level) | 25.9 / 20.1 / 13.5 | – / – / – | 23.8 / 32.9, never past | 77 % |
| A + B | 25.5 / 17.1 / 15.4 | – / – / 75.3 | 0 / 0 | 46 % |
| A + B + C | 21.0 / 14.4 / 13.3 | – / 62.1 / 57.1 | 0 / 0 | 78 % |
| A + B + C + D | 12.8 / 9.7 / 8.7 | 57.7 / 40.5 / 34.1 | 0 / 0 | 63 % |
| Strong: cost ×1.4, time ×1.3, four times the wood, storage tied to the cost | 7.4 / 6.4 / 4.7 | 21.5 / 15.4 / 14.0 | 0 / 0 | 45 % |
| **I (applied).** Cost ×1.4, time ×1.35, three times the wood (Lumberyard 42 an hour a level), storage tied to the cost | 7.6 / 5.8 / 5.7 | 26.0 / 19.7 / 17.5 | 0 / 0 | 29 % |
| **J (applied).** Salvage capped by the storage | no change | no change | no change | no change (oil on day 60: 50 075 instead of 352 610) |
