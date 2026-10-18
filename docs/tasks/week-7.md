# Week 7 · The Mist, the rafts, the Leviathan, the objectives

Goal of the week: the Mist becomes a rule, not just a look. It comes at fixed hours, hides the far sea, slows the city unless the Lighthouse is stoked, and damages the rafts of a city that did not hold. Repairing the rafts gives oil a use: it overflows today (open questions in `docs/decisions.md`). A Leviathan rises at sea, to hunt alone for now. A list of objectives guides the first hours, and daily tasks bring the player back. A last task checks, with the balance simulation, that the Lighthouse's pace set in week 6 does not move by more than 10 %.

Do the tasks in order, one per session. For each one: read CLAUDE.md, say what you will do and what you will not do, wait for approval, write the code, run `npm run check` (and `npm run e2e` when the client changes), commit, push. One pull request for the whole week.

## For every task this week

- Every rule lives in `shared/src/rules/` with its tests in `shared/test/`, test first when possible. The server decides; the client sends intentions only ("stoke the Lighthouse", "repair the rafts", "send a fleet to the Leviathan", "claim this objective"), never a result, a time or an amount.
- Every balance value is new and announced: the owner approves the values before the task starts (the open questions below), and each one is written down in `docs/decisions.md`.
- **Nothing for sale is ever a reward.** The Leviathan, the objectives and the daily tasks give resources, Pearls and captain shards only. They never give convenience time (the "speedups" of the prototype are paid convenience: `COMFORT_CAP`), never a recruitment, never anything bought.
- **No randomness.** The prototype draws the Mist's next hour, the Leviathan's next rise and the captain who gets the Leviathan's shards at random; here all three are fixed and published. The daily recruitment (week 15) stays the only random draw.
- No multiplayer: no alliance help, no treasury, no Sea Pact, no notarization on Solana (week 8 at the earliest). The Leviathan is hunted alone this week.
- The city gets new fields: each task that adds some raises `CITY_SHAPE` by one, with its step in `shared/src/state/migrate.ts` (it adds what is missing, never changes a value) and its test with the week 6 city.
- Player text in English, short, second person. Every new sheet or banner is checked at 412 × 915 and 360 × 800; the look references that change are made again by the CI (`e2e/look/README.md`), and the owner is told which ones before they are committed.
- What the player sees never decides anything: the countdowns, banners and celebrations follow the city the rules made.

## Task 1 · The Mist

What it does:

- **A clock in the city.** The city gets `clock`: its game time, in seconds since 1 January 1970 (UTC), that `advance` moves forward. The server sets it when the city is made, and the migration of the stored cities sets it from their last save. The client never sends it. With `DEV_SPEED`, the clock runs faster, like the rest of the game.
- **A fixed calendar, the same for every city** (`shared/src/rules/mist.ts`): `mistAt(clock)` says whether the Mist is on, when it starts and when it ends. Every Mist is announced one hour before it starts. A fixed calendar lets the alliances of weeks 9 to 13 face the same Mist without changing the rule.
- **Stoking is an order that stays.** The action `stoke { on }` ("Keep the Lighthouse stoked") can be given at any time; it applies during every Mist, offline too, as long as there is oil. During the Mist:
  - stoked: the Lighthouse burns 2.2 times its oil (`STOKE_MULTIPLIER`, already in the rules), production stays normal;
  - not stoked, or out of oil: production of oil, fish and wood is cut by 30 % (`MIST_PENALTY`, already in the rules).
- **What it hides.** During the Mist, the sea beyond the Lighthouse's light is hidden: you cannot send a new fleet to a site farther from your city than `lightRadius(lighthouse, stoked)`. Fleets already at sea carry on. Refusal: "The Mist hides this place. Stoke the Lighthouse or wait for it to lift."
- **What pushes it back.** The light's reach grows with the Lighthouse's level, and stoking adds to it.
- **Held or not.** A Mist is held when the Lighthouse stayed stoked from its start to its end without running out of oil.
  - Held: +30 Pearls, as in the prototype.
  - Not held: each raft loses 35 sturdiness (`MIST_RAFT_DAMAGE` and `applyMistDamage`, already in the rules, never used until now).
  - Either way, the end of a Mist is an event of `advance` (one celebration: "You held the Mist · +30 Pearls" or "The Mist damaged 4 rafts. Repair them.").
- `advance` cuts at each Mist's start and end, as it does for the other events: advancing 10 hours at once gives the same city as ten times one hour.
- **Client:**
  - `seaMood()` reads the rule; `?mist` stays as a preview.
  - The banner says "Mist in 52 min · enough oil" or "Mist · 1 h 10 left · Lighthouse stoked".
  - The Lighthouse's sheet gets the stoke switch.
  - At sea, hidden sites are drawn in the fog and refuse a fleet with the reason.

What it does not do:

- No morale or survivors moved by the Mist (morale does not move at all today; see question 1.6).
- No Nera skill ("−50 % losses in the Great Mist" stays text only, as in the prototype).
- No Mist per alliance, no notarization.
- The Mist's look of week 6 does not change.

How it is tested:

- `shared/test/mist.test.ts`:
  - the calendar at its edges (a second before, at, a second after), the warning;
  - the light's reach by level, stoked or not;
  - a hidden site refused, a visible one accepted, a fleet already at sea untouched.
- State tests:
  - production and oil during a Mist, stoked or not;
  - running out of oil in the middle (the Mist is then not held, and production drops at that moment);
  - held → +30 Pearls; not held → every raft −35, never below 0;
  - one long `advance` equals many short ones, across several Mists.
- Migration 5 → 6 with the week 6 city; `parseState` refuses a city without a clock.
- Server cheat cases: a client sending a clock, Pearls or raft sturdiness gets the server's city; `stoke` with anything but a boolean is refused.
- e2e: the banner counts down to a Mist (server with `DEV_SPEED`); the stoke switch is applied by the server and found again after a reload.

Open questions for the owner:

1. **When does the Mist come?** The prototype: every 9.7 to 11.7 h, at random, for 2 h 12.
   - **Recommendation:** three times a day, every 8 hours, each lasting 2 hours, at fixed UTC hours: 04:00, 12:00 and 20:00 UTC (6:00, 14:00, 22:00 in Paris in summer). A player with three sessions a day meets most of them, and the one at night only matters if stoking was left off.
2. **Stoking: an order that stays, or a tap during each Mist?** The prototype asks for a tap once the Mist is there, which an offline player can never give.
   - **Recommendation:** an order that stays, on until you turn it off. The cost is the oil, not your presence.
3. **The light's reach.** Today your city is 15 map units from the nearest wreck and 59 from the farthest camp.
   - **Recommendation:** 15 + 2 × the Lighthouse's level, +10 when stoked. This gives 19 at Lighthouse 2 (the nearest wreck), 35 at 10, 45 at 15, and everything from 23 (from 18 when stoked).
4. **The reward for a Mist held:** **Recommendation:** +30 Pearls, as in the prototype (Pearls are never for sale).
5. **The damage when not held:** **Recommendation:** −35 sturdiness per raft, as in the prototype and the rules: two missed Mists put a raft below 60, at half efficiency.
6. **Morale and survivors in the Mist** (the prototype lowers morale, and survivors leave below 30).
   - **Recommendation:** not this week. Morale does not move at all in the rules today, and making it move is a task of its own.

## Task 2 · Repairing the rafts

What it does:

- **A new shipyard work, "Repair the rafts"** (`yard.kind: "repair"`): all the damaged rafts at once, one action, the shipyard busy while it lasts.
- **Its cost is mostly oil** (tar to caulk the hulls), so a city that does not hold the Mist spends its extra oil on it. A little wood too. The cost grows with the Lighthouse's level, so that oil still has a use when the storage holds hundreds of thousands. Today's `repairCost` (3 wood per missing point, instant, never used) is replaced.
- **What it unlocks:**
  - a raft back at 100 runs at full efficiency again (below 60 it runs at half, as today);
  - a raft below 60 cannot be upgraded until it is repaired ("Repair this raft first");
  - **new:** a raft at 0 stops its building altogether.
- **Client:**
  - the raft's sheet shows the sturdiness, the cost and the button;
  - the shipyard's queue row says "Repairing 4 rafts";
  - the city already shows damaged rafts (week 5).

What it does not do:

- No raft is ever destroyed.
- No other damage than the Mist's: no storms, no attacks on rafts.
- No repair one raft at a time (see question 2.3).

How it is tested:

- Rule tests:
  - the cost and duration for one and several rafts and at several Lighthouse levels;
  - nothing to repair → "Your rafts are in good shape";
  - shipyard busy, not enough resources;
  - efficiency at 100, 59 and 0;
  - upgrade refused below 60.
- State tests: the repair ends as an event of `advance`, every repaired raft at 100.
- Migration (a yard of kind `repair` is new: shape 7), parse, server cheat cases, e2e (a city damaged by a Mist under `DEV_SPEED`, repaired from a raft's sheet).

Open questions for the owner:

1. **The cost.**
   - **Recommendation:** per missing sturdiness point, 2 × the Lighthouse's level in oil and 1 wood.
   - One missed Mist on one raft (35 points) costs 700 oil and 35 wood at Lighthouse 10, and 1,400 oil at Lighthouse 20.
   - 17 rafts after one missed Mist at Lighthouse 20 cost 23,800 oil.
   - Task 5 measures whether it is enough for the oil to stop overflowing.
2. **The duration.**
   - **Recommendation:** 6 minutes of shipyard per 35 points per raft: 10 rafts after one missed Mist take an hour.
3. **All at once or one raft at a time?**
   - **Recommendation:** all at once, one tap.
4. **A raft at 0 stops its building:** **Recommendation:** yes. Without it, missing every Mist only halves the rafts, and the repair is optional for good.

## Task 3 · The Leviathan

What it does:

- **A Leviathan rises at sea at fixed hours**, the same for every city (on the city's clock). It stays for its hunt and then dives.
- **The hunt:**
  - you send a fleet to it (a new fleet kind, `hunt`), with all your troops and veterans, as for a camp;
  - the fleet stays until the hunt ends, then comes home;
  - it deals damage while it is there: its attack, as computed for a camp (troops, veterans, lead captain, Watchtowers, research), per hour on site.
- **The Leviathan's health depends on its level.** Its level is per city, as the pirate camps' are, and rises by one each time you kill it. It is hunted alone this week; the alliance's hunt comes with multiplayer.
- **Rewards, fixed and published, at the hunt's end:**
  - Pearls by the share of its health you took;
  - shards when you kill it;
  - experience for the captain who led the fleet.
- **No troop is lost:** the Leviathan dives, it does not sink fleets (as in the prototype).
- **Client:**
  - the Leviathan on the sea map, with its countdown (the week 5 model);
  - its sheet: health, level, time left, the rewards, and the button "Send my fleet";
  - a report at the end of each hunt.

What it does not do:

- No alliance, no treasury, no share between players, no notarization.
- No random captain for the shards.
- No troop losses or wounded.
- The Mist does not hide the Leviathan (it rises near the Great Lighthouse, 18 units from your city).

How it is tested:

- Rule tests:
  - the calendar;
  - health by level;
  - damage for a known fleet (the same attack as against a camp);
  - killed or not, the rewards for a known share;
  - the level rising after a kill;
  - the refusals: no hunt now, fewer than 5 troops, all fleets at sea.
- State tests:
  - a fleet sent mid-hunt deals damage only for the time it is there;
  - the report;
  - one long `advance` equals many short ones.
- Migration (`leviathan` in the city, the fleet kind `hunt`: shape 8), parse, server cheat cases (a client sending damage or Pearls), e2e (the hunt under `DEV_SPEED`: send, report).

Open questions for the owner:

1. **How many times a day, and for how long?** The prototype: every 14 to 17 h at random, a 30 s hunt (3 h at our scale).
   - **Recommendation:** twice a day, at 13:00 and 19:00 UTC (15:00 and 21:00 in Paris in summer), each hunt lasting 2 hours. This leaves room for the Mist of 12:00 UTC to be over first.
2. **Its health.** **Recommendation:**
   - 4,000 at level 1, ×1.5 each level;
   - set so that a regular player's army kills the first one in about an hour on site, and later ones get harder like the camps.
   - Task 5 checks it with the three profiles.
3. **The rewards.** **Recommendation:**
   - **Pearls:** 20 + 180 × your share, up to 200 for a kill.
   - **Shards:** 3 shards of the captain who led the hunt when you kill it; none otherwise. It is fixed and chosen by the player. The alternative is shards of Nera only, the Mist's admiral.
   - **Experience:** +30 for the lead captain, as in the prototype.
   - **Never anything for sale.**
4. **Troops lost:** **Recommendation:** none, as in the prototype. The cost is the army's time away from the camps.

## Task 4 · Objectives and daily tasks

What it does:

- **Objectives** (`shared/src/rules/objectives.ts`): a fixed list, one at a time, in order. Each one has a condition read from the city and a reward you claim (action `claimObjective`). The list is the prototype's, without what needs other players or a payment:
  - the alliance's help, the free recruitment and the Sea Pact are left out;
  - the speedups in its rewards are replaced by resources.

  **Recommendation** (the prototype's order and rewards, the speedups replaced):

  | # | Objective | Reward |
  | --- | --- | --- |
  | 1 | Upgrade the Refinery to level 2 | 150 wood, 100 fish |
  | 2 | Build the Barracks | 200 fish |
  | 3 | Build the Harbor | 150 oil |
  | 4 | Build the Observatory | 200 oil, 150 wood |
  | 5 | Start your first research | 200 wood (2 speedups in the prototype) |
  | 6 | Send a fleet to gather at sea | 100 Pearls |
  | 7 | Upgrade the Lighthouse to level 3 | 300 oil, 300 wood |
  | 8 | Train troops at the Barracks | 200 fish (2 speedups) |
  | 9 | Beat a pirate camp | 150 Pearls |
  | 10 | Build the Infirmary | 250 fish |
  | 11 | Keep the Lighthouse stoked through a Mist | 250 oil |
  | 12 | Join the Leviathan hunt | 300 wood (3 speedups) |
  | 13 | Upgrade the Shelters to level 3 | 300 fish |
  | 14 | Upgrade the Lighthouse to level 4 | 400 oil, 400 wood, 400 fish |
  | 15 | Moor your first raft | 2 rope, 300 wood |
  | 16 | Put a Kelp Greenhouse on a raft | 400 fish |
  | 17 | Upgrade the Harbor to level 3 | 200 Pearls |
  | 18 | Bring the Lighthouse to level 5 | 300 Pearls (and 5 speedups) |

- **Daily tasks** (`shared/src/rules/daily.ts`):
  - a fixed list of tasks with points, counted by the rules as you play;
  - chests at 20, 40, 60, 80 and 100 points, claimed by an action (`claimChest`);
  - everything resets at 00:00 UTC on the city's clock;
  - the counters the tasks need (gathers, camps beaten, troops trained, Mists held, hunts joined) are kept by the rules.
- **Client:**
  - the current objective under the top bar, with "Claim" when it is done;
  - a Daily Tasks sheet: the tasks, the points, the five chests.

What it does not do:

- No season pass, no badges (a cNFT badge is a Solana task).
- No alliance tasks, no free recruitment task.
- No claim on the client's word: the server checks the condition.

How it is tested:

- Rule tests:
  - every objective's condition on a city that meets it and one that does not;
  - claim in order only ("Finish your current objective first"), once only;
  - the rewards;
  - daily points counted from the city's actions;
  - chests at their thresholds, once a day;
  - the reset at midnight UTC, including across an `advance` that spans midnight.
- Migration (`objective`, `daily`, counters: shape 9), parse, server cheat cases (claiming an unmet objective, a chest twice, a chest from yesterday), e2e (claim the first objective, open a chest), look captures of the new sheets.

Open questions for the owner:

1. **The objectives list and rewards.** **Recommendation:** the table above. The rewards are the prototype's small amounts: they matter in the first hours and fade later, which is the point.
2. **The daily tasks and chests.** **Recommendation:**
   - Tasks:
     - "Start 2 upgrades" (20);
     - "Gather at sea 3 times" (20);
     - "Beat 2 pirate camps" (20);
     - "Train troops" (10);
     - "Keep the Lighthouse stoked through a Mist" (20);
     - "Join the Leviathan hunt" (20).
     That makes 110 points, so a player can skip one.
   - Chests, all scaled by the Lighthouse's level so they stay worth it:
     - at 20: 300 wood and 300 fish × the Lighthouse's level / 5;
     - at 40: 400 oil × the level / 5 (5 speedups in the prototype);
     - at 60: 100 Pearls;
     - at 80: 400 oil and 2 rope;
     - at 100: 200 Pearls.
3. **The reset hour:** **Recommendation:** 00:00 UTC (2:00 in Paris in summer), as in the prototype.
4. **Points: counted alone, or claimed task by task?** **Recommendation:** counted alone (one action less per task). Only the chests are claimed, which gives the moment of the reward.

## Task 5 · The balance, with the new rules

What it does:

- `tools/balance/` plays the new rules. Its player:
  - keeps the Lighthouse stoked when the oil lasts;
  - repairs the rafts when they are below 60;
  - joins each Leviathan hunt it is present for;
  - claims every objective and chest at its sessions.
- `npm run balance` writes the CSV, the chart and the tables again (one year). `docs/balance.md` gets three new tables:
  - oil spent (stoking, repairs) against oil full;
  - Mists held and missed per profile;
  - hunts joined and killed.
- **The check:** each Lighthouse milestone (5, 10, 15, 20, 25, 30) of each profile stays within 10 % of week 6's (`c307f9f`). A test keeps that true until the owner changes it.
- If a milestone moves by more than 10 %, or oil still overflows, the task stops there. It gives the measured options to the owner (as in week 6); no value changes without their approval.

What it does not do:

- No balance value changed without approval.
- Still not modeled: other players, the daily recruitment.

How it is tested:

- The simulation's tests (determinism, every city readable by `parseState`, the committed files up to date) and the new ±10 % test.

Open questions for the owner:

1. **The 10 % against what?** **Recommendation:** against the days of week 6 (`c307f9f`), milestone by milestone, per profile: for example, Lighthouse 15 for the regular player between day 17.7 and 21.7.
2. **The target for oil.** **Recommendation:** the regular player's hours with full oil in the first 90 days fall by at least half (651 today).
3. **Which profile skips the Mist?** **Recommendation:** none. All three keep the order to stoke on, and the casual player shows what a city with little oil goes through. A fourth profile that never stokes would show the cost of the repairs; it can be added if you want it.
