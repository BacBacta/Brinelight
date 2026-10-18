# Balance

What the rules of `shared/` give over 90 days of play, measured by `npm run balance` (`tools/balance/`, week 6, task 5). The tables are written by the script; `npm test` fails when they no longer match the rules. The CSV of every day is `docs/balance/days.csv`. The script changes no value: the rules it plays are those of `shared/`, rebalanced on 18 October by the owner's decision (options I and J below, `docs/decisions.md`). The curve after Lighthouse 15 was measured on temporary copies of the rules and waits for the owner's decision.

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
5. **Sea:** the lowest pirate camp with all the troops if the odds are "easy"; every other fleet salvages the nearest wreck.
6. **Captains:** unlock and add stars as soon as there are shards; the rarest, then highest level, leads; a Logbook while 100 Pearls are left after it.
7. **Rafts:** a building on an empty raft (Greenhouse, Smokehouse, Watchtower, two of each), else the lowest raft building upgraded, else a new raft.

**The reserve:** while the Lighthouse waits, every other spending leaves untouched the cost of its next level, up to what the storage holds (no one can save more); while the Lighthouse is being built, nothing is kept. A first try without this reserve for the other buildings gave a player who never researched nor trained in 60 days: they spent all the wood on buildings first.

**Not modeled:** the Mist (always calm, the Lighthouse never stoked), the Leviathan, objectives and daily tasks (week 7), other players, the daily recruitment, Fish Shoals and Wooded Isles (fleets cannot go there yet).

## Results

![Lighthouse level by day for the three profiles](balance/lighthouse.svg)

<!-- balance:generated:start (npm run balance) -->

### Milestones (days after the city is founded)

| Profile | Lighthouse 5 | Lighthouse 10 | Lighthouse 15 | Lighthouse 20 | Refinery 2 | Barracks 1 | First camp beaten |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Casual (3 sessions) | day 1.1 | day 7.6 | day 26.0 | day 72.2 | day 4.0 | day 0.0 | day 1.3 |
| Regular (6 sessions) | day 1.1 | day 5.8 | day 19.7 | day 62.2 | day 2.4 | day 0.0 | day 2.0 |
| Dedicated (10 sessions) | day 1.1 | day 5.7 | day 17.5 | day 56.2 | day 1.5 | day 0.0 | day 1.1 |

### Day 30

| Profile | Lighthouse | Power | Oil | Fish | Wood | Storage | Troops + veterans | Captains (lead, level, stars) | Techs | Rafts | Camps beaten |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Casual (3 sessions) | 15 | 65,739 | 28,242 | 35,101 | 7,101 | 56,550 | 495 | 6 (mira, 8, 22★) | 28 | 7 | 40 |
| Regular (6 sessions) | 16 | 88,955 | 71,650 | 30,833 | 25,181 | 71,050 | 301 | 6 (mira, 14, 30★) | 28 | 7 | 66 |
| Dedicated (10 sessions) | 17 | 99,848 | 99,470 | 13,730 | 29,014 | 99,470 | 383 | 6 (mira, 20, 30★) | 28 | 7 | 106 |

### Day 60

| Profile | Lighthouse | Power | Oil | Fish | Wood | Storage | Troops + veterans | Captains (lead, level, stars) | Techs | Rafts | Camps beaten |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Casual (3 sessions) | 19 | 113,905 | 130,303 | 109,648 | 91,554 | 194,971 | 299 | 6 (mira, 15, 30★) | 28 | 7 | 68 |
| Regular (6 sessions) | 19 | 124,700 | 194,971 | 85,179 | 90,793 | 194,971 | 430 | 6 (mira, 20, 30★) | 28 | 7 | 99 |
| Dedicated (10 sessions) | 20 | 133,858 | 202,878 | 53,721 | 31,913 | 272,963 | 686 | 6 (mira, 20, 30★) | 28 | 7 | 154 |

### Day 90

| Profile | Lighthouse | Power | Oil | Fish | Wood | Storage | Troops + veterans | Captains (lead, level, stars) | Techs | Rafts | Camps beaten |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Casual (3 sessions) | 20 | 134,991 | 215,003 | 191,879 | 129,925 | 272,963 | 403 | 6 (mira, 19, 30★) | 28 | 7 | 88 |
| Regular (6 sessions) | 21 | 146,720 | 320,471 | 146,440 | 112,861 | 382,148 | 402 | 6 (mira, 20, 30★) | 28 | 7 | 127 |
| Dedicated (10 sessions) | 21 | 152,122 | 393,488 | 93,912 | 214,934 | 382,148 | 741 | 6 (mira, 20, 30★) | 28 | 7 | 195 |

### Waiting and blocks

| Profile | Builder hours free a day (days 1–30) | (days 31–60) | (days 61–90) | Sessions with a builder free and nothing to start | Sessions with nothing at all | Blocked by (sessions) | Hours full: oil, fish, wood |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Casual (3 sessions) | 36.2 | 16.6 | 8.7 | 85 of 270 (31 %) | 0 | oil 6, wood 79 | 0, 0, 0 |
| Regular (6 sessions) | 25.2 | 9.8 | 6.0 | 132 of 540 (24 %) | 0 | wood 132 | 686, 0, 0 |
| Dedicated (10 sessions) | 18.8 | 7.3 | 2.1 | 150 of 900 (17 %) | 1 | fish 1, wood 149 | 1263, 0, 0 |

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
| 20 | 188,250 | 272,963 | 150,600 | 15.2 days |
| 25 | 1,012,475 | 1,468,089 | 809,980 | 68.0 days |
| 29 | 3,889,513 | 5,639,793 | 3,111,610 | 225.8 days |
| 30 | 5,445,325 | 7,895,721 | – | max level |

<!-- balance:generated:end -->

## What it shows

### 1. The pace: in line with the genre up to Lighthouse 15

- **Lighthouse 10** comes on day 5.7 (dedicated), 5.8 (regular) and 7.6 (casual); **Lighthouse 15** on day 17.5, 19.7 and 26.0; **Lighthouse 20** on day 56.2, 62.2 and 72.2. In Whiteout Survival, an active player reaches the equivalent of level 15 in one to two weeks: the dedicated player is a few days behind it, the casual one about two weeks.
- From Lighthouse 15, build time leads: the Lighthouse's level 15 to 16 takes 3.4 days, 20 to 21 takes 15.2 days. The three players end within one level of each other (20, 21, 21 on day 90): more sessions bring the next level a few days sooner, not more levels.

### 2. No storage wall

- The storage always holds 1.25 times the wood of the Lighthouse's next level (39,000 at Lighthouse 15, 188,250 at 20; Sealed Warehouses add 15 % a level). No one meets a wall in 90 days, and the Lighthouse never needs a camp's loot.
- The other buildings keep their ×1.6 a level: at Lighthouse 30 (7,895,721 with Sealed Warehouses 3), their cost passes the storage from level 24 to 26. No player of the simulation gets near it (they are at level 11 to 14 on day 90).

### 3. What blocks now

- **Wood, still, but far less often:** a builder is left free with nothing to start in 17 % (dedicated), 24 % (regular) and 31 % (casual) of the sessions, instead of 76 to 84 %, and nearly always for wood (oil 6 times for the casual player, early on; fish once). Oil and fish do not take wood's place.
- Builders free: 19 to 36 hours a day out of 48 in the first month, 2 to 9 in the third, when the Lighthouse's long builds keep one builder busy.
- Oil is plentiful: the regular and dedicated players' oil is full 686 and 1,263 hours in 90 days. A wreck no longer brings oil past the storage (option J).

### 4. Early game

- Lighthouse 5 comes on day 1.1 for everyone; Refinery 2 on day 1.5 (dedicated) to 4.0 (casual); the first camp beaten on day 1.1 to 2.0.

## After Lighthouse 15 (measured, not applied)

The Lighthouse's curves of option I run to level 30 today. Measured over 1,500 days on temporary copies of the rules, the Lighthouse's cost and time changing from its level 15 to 16 on (the levels up to 15 unchanged); "–" is not reached in 1,500 days. "Build time 15 → 30" adds up the Lighthouse's own build times alone.

| After 15: cost / time a level | Build time 15 → 30 | Lighthouse 20 (casual / regular / dedicated) | Lighthouse 25 | Lighthouse 30 | Level on day 365 | Storage at Lighthouse 30 (without Warehouses) |
| --- | --- | --- | --- | --- | --- | --- |
| ×1.4 / ×1.35 (today) | 861 days | 72 / 62 / 56 | 250 / 227 / 215 | 971 / 937 / 917 | 26 / 26 / 26 | 5,445,325 |
| ×1.5 / ×1.45 (steeper) | 1,971 days | 83 / 72 / 63 | 405 / 373 / 356 | – / – / – | 24 / 24 / 25 | 15,327,525 |
| ×1.6 / ×1.55 (about the prototype's) | 4,396 days | 95 / 84 / 75 | 619 / 600 / 579 | – / – / – | 23 / 23 / 23 | 40,355,500 |
| ×1.4 / ×1.2 | 244 days | 67 / 56 / 50 | 198 / 165 / 155 | 687 / 561 / 548 | 27 / 28 / 28 | 5,445,325 |
| ×1.35 / ×1.25 | 371 days | 66 / 56 / 50 | 176 / 154 / 152 | 549 / 488 / 488 | 28 / 28 / 28 | 3,155,800 |
| ×1.3 / ×1.2 | 244 days | 63 / 53 / 45 | 152 / 123 / 119 | 371 / 321 / 326 | 29 / 30 / 30 | 1,791,650 |
| ×1.3 / ×1.15 | 161 days | 62 / 50 / 44 | 139 / 111 / 108 | 353 / 286 / 285 | 30 / 30 / 30 | 1,791,650 |

Today's curve already makes Lighthouse 30 a goal of about two and a half years, set by build time (the level 29 to 30 alone takes 226 days). A steeper curve pushes it past four years and the storage into the tens of millions. To make Lighthouse 30 a goal of months (about a year), the curve after 15 has to be gentler, not steeper.

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
