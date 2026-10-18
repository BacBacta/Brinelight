# Balance

What the rules of `shared/` give over a year of play (365 days), measured by `npm run balance` (`tools/balance/`, week 6, task 5). The tables are written by the script; `npm test` fails when they no longer match the rules. The CSV of every day is `docs/balance/days.csv`. The script changes no value: the rules it plays are those of `shared/`, rebalanced on 18 October by the owner's decisions (options I and J below, then the gentler curve after Lighthouse 15; `docs/decisions.md`).

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
5. **Sea:** the Leviathan first, while it is at sea and a fleet stays free for the wrecks, with all the troops; otherwise the lowest pirate camp with all the troops if the odds are "easy"; every other fleet salvages the nearest wreck it can sail to, one fleet a wreck (an emptied wreck waits 2 hours before it fills again).
6. **Captains:** unlock and add stars as soon as there are shards; the rarest, then highest level, leads; a Logbook while 100 Pearls are left after it.
7. **Rafts:** the rafts repaired as soon as one is below 60, keeping the reserve below; else a building on an empty raft (Greenhouse, Smokehouse, Watchtower, two of each), else the lowest raft building upgraded, else a new raft.
8. **Claims:** every objective done, and every chest the day's points open.

**The reserve:** while the Lighthouse waits, every other spending leaves untouched the cost of its next level, up to what the storage holds (no one can save more); while the Lighthouse is being built, or once it is at level 30, nothing is kept. A first try without this reserve for the other buildings gave a player who never researched nor trained in 60 days: they spent all the wood on buildings first.

**Week 7 is played** (task 5): the Mist, three a day on the city's clock, the order to stoke left on, as for a new city; the repairs; the Leviathan; the objectives and the daily tasks. **Two more players**, with the regular player's sessions: one who turns the order to stoke off at the start and never back on, and one away from day 20 to day 22 (no session), back on day 23. **Not modeled:** other players, the daily recruitment, Fish Shoals and Wooded Isles (fleets cannot go there yet).

## Results

![Lighthouse level by day for the three profiles](balance/lighthouse.svg)

<!-- balance:generated:start (npm run balance) -->

### Milestones (days after the city is founded)

| Profile | Lighthouse 5 | Lighthouse 10 | Lighthouse 15 | Lighthouse 20 | Lighthouse 25 | Lighthouse 30 | Refinery 2 | Barracks 1 | First camp beaten |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Casual (3 sessions) | day 1.1 | day 7.6 | day 26.5 | day 62.0 | day 147.0 | day 369.6 | day 4.0 | day 0.0 | day 2.0 |
| Regular (6 sessions) | day 1.1 | day 5.6 | day 18.1 | day 48.6 | day 119.5 | day 318.0 | day 2.4 | day 0.0 | day 2.0 |
| Dedicated (10 sessions) | day 1.1 | day 5.7 | day 17.1 | day 43.0 | day 115.0 | day 324.8 | day 1.5 | day 0.0 | day 1.1 |

### Day 30

| Profile | Lighthouse | Power | Oil | Fish | Wood | Storage | Troops + veterans | Captains (lead, level, stars) | Techs | Rafts | Camps beaten |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Casual (3 sessions) | 15 | 64,112 | 16,842 | 34,113 | 3,135 | 56,550 | 678 | 6 (mira, 9, 17★) | 28 | 7 | 34 |
| Regular (6 sessions) | 17 | 95,681 | 62,951 | 29,176 | 16,346 | 85,768 | 283 | 6 (mira, 19, 30★) | 28 | 7 | 68 |
| Dedicated (10 sessions) | 17 | 101,223 | 87,688 | 16,033 | 60,023 | 85,768 | 416 | 6 (mira, 20, 30★) | 28 | 7 | 92 |

### Day 90

| Profile | Lighthouse | Power | Oil | Fish | Wood | Storage | Troops + veterans | Captains (lead, level, stars) | Techs | Rafts | Camps beaten |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Casual (3 sessions) | 22 | 144,479 | 115,650 | 183,048 | 193,829 | 318,474 | 373 | 6 (mira, 20, 30★) | 28 | 7 | 85 |
| Regular (6 sessions) | 23 | 158,297 | 118,325 | 36,343 | 78,614 | 414,011 | 436 | 6 (mira, 20, 30★) | 28 | 7 | 129 |
| Dedicated (10 sessions) | 23 | 162,659 | 375,131 | 66,627 | 186,371 | 414,011 | 800 | 6 (mira, 20, 30★) | 28 | 7 | 213 |

### Day 365

| Profile | Lighthouse | Power | Oil | Fish | Wood | Storage | Troops + veterans | Captains (lead, level, stars) | Techs | Rafts | Camps beaten |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Casual (3 sessions) | 29 | 234,041 | 1,578,195 | 766,515 | 850,183 | 1,998,372 | 759 | 6 (mira, 20, 30★) | 28 | 7 | 182 |
| Regular (6 sessions) | 30 | 255,193 | 2,355,763 | 468,304 | 676,717 | 2,597,893 | 804 | 6 (mira, 20, 30★) | 28 | 7 | 261 |
| Dedicated (10 sessions) | 30 | 256,811 | 2,597,893 | 393,322 | 1,058,294 | 2,597,893 | 1,132 | 6 (mira, 20, 30★) | 28 | 7 | 353 |

### Waiting and blocks

| Profile | Builder hours free a day (days 1–30) | (days 31–90) | (days 91–365) | Sessions with a builder free and nothing to start | Sessions with nothing at all | Blocked by (sessions) | Hours full: oil, fish, wood |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Casual (3 sessions) | 36.5 | 15.6 | 13.0 | 341 of 1095 (31 %) | 0 | oil 29, wood 312 | 0, 0, 0 |
| Regular (6 sessions) | 22.4 | 6.8 | 7.5 | 399 of 2190 (18 %) | 49 | wood 399 | 125, 0, 0 |
| Dedicated (10 sessions) | 15.8 | 4.9 | 9.1 | 741 of 3650 (20 %) | 68 | wood 741 | 2151, 0, 0 |

### Oil, the Mist, the Leviathan and the claims (whole run)

| Profile | Hours of full oil (days 1–90) | Oil spent stoking | Repairs (oil) | Mists held | Mists missed | Hunts joined | Leviathans killed | Objectives claimed | Chests opened |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Casual (3 sessions) | 0 | 65,561 | 0 (0 oil) | 1093 | 1 | 362 | 0 | 18 | 755 |
| Regular (6 sessions) | 125 | 68,441 | 0 (0 oil) | 1094 | 0 | 726 | 0 | 18 | 791 |
| Dedicated (10 sessions) | 314 | 69,005 | 0 (0 oil) | 1094 | 0 | 704 | 0 | 18 | 826 |
| Never stokes (6 sessions) | 0 | 0 | 131 (2,996,170 oil) | 0 | 1094 | 726 | 0 | 10 | 418 |
| Away 3 days (6 sessions, none on days 20 to 22) | 26 | 68,675 | 0 (0 oil) | 1094 | 0 | 720 | 1 | 18 | 791 |

### Pearls a day, by source (average over the whole run)

| Profile | Mist | Leviathan | Camps | Objectives | Chests | Earned | Spent on Logbooks | Pearls at the end |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Casual (3 sessions) | 89.8 | 51.5 | 59.2 | 2.1 | 4.4 | 207.0 | 37.7 | 27,007 |
| Regular (6 sessions) | 89.9 | 130.1 | 113.2 | 2.1 | 15.1 | 350.3 | 36.7 | 79,673 |
| Dedicated (10 sessions) | 89.9 | 81.3 | 197.6 | 2.1 | 24.1 | 395.0 | 33.3 | 97,225 |
| Never stokes (6 sessions) | 0.0 | 109.8 | 75.7 | 0.7 | 4.4 | 190.6 | 26.2 | 34,225 |
| Away 3 days (6 sessions, none on days 20 to 22) | 89.9 | 118.3 | 111.6 | 2.1 | 16.7 | 338.6 | 37.0 | 75,302 |

### Two more players: milestones

| Profile | Lighthouse 5 | Lighthouse 10 | Lighthouse 15 | Lighthouse 20 | Lighthouse 25 | Lighthouse 30 |
| --- | --- | --- | --- | --- | --- | --- |
| Never stokes (6 sessions) | day 1.1 | day 6.0 | day 21.6 | day 60.1 | day 169.0 | not reached |
| Away 3 days (6 sessions, none on days 20 to 22) | day 1.1 | day 5.6 | day 18.1 | day 47.3 | day 116.9 | day 314.6 |

### What a player away finds on return (before the first session)

| Profile | Day | Rafts | Damaged | Lowest sturdiness | Mists missed so far | Oil (storage) | Repairing everything: oil, wood, time |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Away 3 days (6 sessions, none on days 20 to 22) | 23 | 7 | 0 | 100 | 0 | 45,538 (65,975) | 0, 0, 0.0 h |

### The storage wall

| Profile | Lighthouse level | Next level costs | Storage holds | Days at the wall | Got past it |
| --- | --- | --- | --- | --- | --- |
| Casual (3 sessions) | not reached | | | | |
| Regular (6 sessions) | not reached | | | | |
| Dedicated (10 sessions) | not reached | | | | |

### The storage and the Lighthouse, level by level (the rules alone)

| Lighthouse level | Storage | With Sealed Warehouses 3 | Next level: wood | Next level: build time |
| --- | --- | --- | --- | --- |
| 5 | 14,000 | 20,300 | 970 | 0.2 days |
| 10 | 26,500 | 38,425 | 5,210 | 0.8 days |
| 15 | 39,000 | 56,550 | 28,000 | 3.4 days |
| 20 | 129,963 | 188,446 | 103,970 | 8.4 days |
| 25 | 482,538 | 699,679 | 386,030 | 20.9 days |
| 29 | 1,378,188 | 1,998,372 | 1,102,550 | 43.4 days |
| 30 | 1,791,650 | 2,597,893 | – | max level |

<!-- balance:generated:end -->

## What it shows

Written on 18 October, with all of week 7 played and the owner's decisions of that day. A test keeps every milestone of the three profiles within 10 % of week 6 (`tools/balance/balance.test.ts`).

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

- **Never stokes:** every Mist missed, its rafts are damaged three times a day. Repaired as soon as one is below 60, at 2 × the Lighthouse's level in oil per missing point, 131 repairs cost 3.0 million oil and block it in 892 sessions: Lighthouse 20 on day 60.1, 25 on day 169.0, 30 not reached in a year. Never repairing, it reaches Lighthouse 30 on day 362.5. What a repair should cost is an open decision (`docs/decisions.md`).
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
