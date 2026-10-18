# Balance

What the rules of `shared/` give over 60 days of play, measured by `npm run balance` (`tools/balance/`, week 6, task 5). The tables are written by the script; `npm test` fails when they no longer match the rules. The CSV of every day is `docs/balance/days.csv`. Nothing here changes a value: the options at the end were measured on temporary copies of the rules and are waiting for the owner's decision.

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

| Profile | Lighthouse 5 | Lighthouse 10 | Lighthouse 12 | Lighthouse 15 | Refinery 2 | Barracks 1 | First camp beaten |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Casual (3 sessions) | day 2.8 | day 31.5 | not reached | not reached | day 16.0 | day 2.6 | day 9.0 |
| Regular (6 sessions) | day 2.8 | day 22.1 | day 44.6 | not reached | day 6.5 | day 1.4 | day 4.4 |
| Dedicated (10 sessions) | day 2.7 | day 21.2 | day 42.8 | not reached | day 6.6 | day 4.2 | day 6.4 |

### Day 30

| Profile | Lighthouse | Power | Oil | Fish | Wood | Storage | Troops + veterans | Captains (lead, level, stars) | Techs | Rafts | Camps beaten |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Casual (3 sessions) | 9 | 19,271 | 17,724 | 13,540 | 190 | 24,000 | 228 | 1 (tom, 3, 1★) | 5 | 1 | 4 |
| Regular (6 sessions) | 10 | 35,608 | 97,890 | 12,584 | 540 | 34,450 | 344 | 4 (bran, 4, 7★) | 20 | 1 | 19 |
| Dedicated (10 sessions) | 10 | 46,359 | 208,494 | 6,629 | 930 | 38,425 | 351 | 6 (mira, 8, 21★) | 26 | 4 | 39 |

### Day 60

| Profile | Lighthouse | Power | Oil | Fish | Wood | Storage | Troops + veterans | Captains (lead, level, stars) | Techs | Rafts | Camps beaten |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Casual (3 sessions) | 11 | 32,427 | 92,255 | 37,700 | 25,116 | 37,700 | 252 | 2 (tom, 4, 2★) | 15 | 1 | 10 |
| Regular (6 sessions) | 12 | 68,018 | 352,610 | 45,675 | 46,945 | 45,675 | 259 | 6 (mira, 12, 30★) | 28 | 7 | 53 |
| Dedicated (10 sessions) | 12 | 76,162 | 688,064 | 45,675 | 46,145 | 45,675 | 518 | 6 (mira, 20, 30★) | 28 | 7 | 96 |

### Waiting and blocks

| Profile | Builder hours free a day (days 1–30) | (days 31–60) | Sessions with a builder free and nothing to start | Sessions with nothing at all | Blocked by (sessions) | Hours full: oil, fish, wood |
| --- | --- | --- | --- | --- | --- | --- |
| Casual (3 sessions) | 44.2 | 43.1 | 151 of 180 (84 %) | 0 | oil 37, wood 114 | 616, 291, 0 |
| Regular (6 sessions) | 39.1 | 37.0 | 273 of 360 (76 %) | 0 | wood 273 | 1167, 115, 162 |
| Dedicated (10 sessions) | 36.9 | 36.7 | 461 of 600 (77 %) | 1 | wood 461 | 1237, 74, 300 |

### The storage wall

| Profile | Lighthouse level | Next level costs | Storage holds | Days at the wall | Got past it |
| --- | --- | --- | --- | --- | --- |
| Casual (3 sessions) | not reached | | | | |
| Regular (6 sessions) | 12 | 58,810 wood | 45,675 | 15.0 (to the end) | no |
| Dedicated (10 sessions) | 12 | 58,810 wood | 45,675 | 16.8 (to the end) | no |

<!-- balance:generated:end -->

## What it shows

### 1. The pace: far behind the genre

- **Lighthouse 10** comes on day 21.2 (dedicated), 22.1 (regular) and 31.5 (casual). **Lighthouse 15 is reached by no one in 60 days.** In Whiteout Survival, an active player reaches the equivalent of level 15 in one to two weeks.
- Time alone is not the reason: the Lighthouse's own build times add up to 5.3 days for level 10 and 48.7 days for level 15. **Wood is**: a builder stays free with nothing to start at the end of 76 to 84 % of the sessions, for want of wood in all of them but 37 (oil, casual player, early on), and the two builders stay free 37 to 44 hours a day out of 48.
- More sessions barely help: the regular and the dedicated player are within a day of each other up to level 12. The game waits for wood, not for the player.
- Oil never blocks a regular or dedicated player: salvaging the nearest wreck brings oil past the storage (cargo is not capped, and a wreck refills at once), up to 352 610 (regular) and 688 064 (dedicated) on day 60.

### 2. The storage wall

- From Lighthouse 12, the next level costs 58 810 wood while the storage holds 45 675, Sealed Warehouses 3 included (31 500 without). Only loot can carry the stock past the storage, and a pirate camp gives 60 + 50 × its level in wood.
- **The regular player reaches it on day 44.6 and the dedicated on day 42.8; both are still there on day 60** (15.0 and 16.8 days). The casual player does not reach it in 60 days.
- A variant where the player keeps every wood of loot for the Lighthouse instead of spending it does not get past it either: training needs wood too, so the army stops growing while the camps grow stronger after each win.
- With today's formulas, the wall starts at Lighthouse 11 without the Warehouses research, 12 with it, and never closes again: the storage grows by 2 500 a level, the Lighthouse's cost by 62 %.

### 3. Early game

- Lighthouse 5 comes on day 2.7 to 2.8 for everyone; Refinery 2 on day 6.5 (regular) to 16.0 (casual), because the reserve for the Lighthouse comes first; the first camp beaten on day 4.4 (regular) to 9.0 (casual).

## Measured options (not applied)

Each option was applied to a temporary copy of the rules, played for 60 days by the three profiles, then removed (measured on `7f6cf68`). Days are after the city is founded; "–" is not reached in 60 days.

| Option | Lighthouse 10 (casual / regular / dedicated) | Lighthouse 15 | Days at the storage wall (regular / dedicated) | Regular player's sessions blocked by wood |
| --- | --- | --- | --- | --- |
| Today | 31.5 / 22.1 / 21.2 | – / – / – | 15.0 / 16.8, never past | 76 % of sessions |
| A. Storage at least 1.25 × the Lighthouse's next wood cost | 31.5 / 22.1 / 21.2 | – / – / – | 0 / 0 (Lighthouse 13 on day 57.2, dedicated) | 70 % |
| B. Lighthouse cost ×1.5 a level instead of ×1.62 | 25.5 / 17.1 / 15.4 | – / – / 75.3 | 0 / 0 in 60 days; the wall comes back at Lighthouse 13 to 15 (without or with Sealed Warehouses) | 46 % |
| C. Lighthouse build time ×1.4 a level instead of ×1.55 | 28.8 / 21.7 / 20.7 | – / – / – | 27.2 / 31.1, from Lighthouse 11, never past | 92 % |
| D. Twice the wood (Lumberyard 28 instead of 14 an hour a level) | 25.9 / 20.1 / 13.5 | – / – / – | 23.8 / 32.9, never past | 77 % |
| A + B | 25.5 / 17.1 / 15.4 | – / – / 75.3 | 0 / 0 | 46 % |
| A + B + C | 21.0 / 14.4 / 13.3 | – / 62.1 / 57.1 | 0 / 0 | 78 % |
| A + B + C + D | 12.8 / 9.7 / 8.7 | 57.7 / 40.5 / 34.1 | 0 / 0 | 63 % |
| Strong: cost ×1.4, time ×1.3, four times the wood, storage tied to the cost | 7.4 / 6.4 / 4.7 | 21.5 / 15.4 / 14.0 | 0 / 0 | 45 % |
| Salvage capped by the storage | no change | no change | no change | no change (oil on day 60: 50 075 instead of 352 610) |
