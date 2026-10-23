# The roadmap from week 8

Re-planned by the owner on 21 October 2026, with the design of Tides (`docs/design/tides.md`). The plan of each week, task by task, is written in its own file in this folder when the week starts (`week-8.md` is in pull request #11 until it is merged); the decisions are in `docs/decisions.md`.

## Week 8 · The end of the city's visual work, then the server

- The end of the city's visual work, and the merge of pull request #11.
- Hetzner: renting the server, putting the game online and the load test (tasks 2, 3 and 4 of `week-8.md`).
- Task 5: the Mist and the Leviathan by server, not fixed UTC hours.
- Task 6: the CI's actions on Node 24.
- Task 7 (the other buildings and the storage, the economy) moves to week 10, with everything already noted for it in `week-8.md`: the study of the island's depletion and the survivors who never grow.

## Week 9 · The first proof on Solana

The milestones of the day sealed every night in one Solana transaction, checked by each player without trusting Brinelight: the plan is `week-9.md`.

## Week 10 · The economy

- **The wood of the second day** (owner, 23 October): with A + C, the builders wait about 44 hours of 48 on day 2, short of wood. That figure is the measure to bring down (`docs/tasks/early-start.md`, "The second day"; `npx tsx tools/balance/start-run.ts`).
- The Fish Shoals and Wooded Isles of the map, harvestable by the fleets, with amounts that follow the Lighthouse.
- The late game's wall (the other buildings and the storage: task 7 of `week-8.md`).
- The survivors' growth.
- Review the curve of Lighthouse 10 to 20 after A + C (the early start, `docs/tasks/early-start.md`), with the late game.
- Simulations first: no value enters the game without the owner's agreement.
- The hour of the first Leviathan on `s1`: 13:00 (today) or 11:00 UTC, decided on its measured effects (the table A / B / C of 22 October, in `docs/decisions.md`): hunts and Pearls of each simulated player, and the Lighthouse's milestones against week 6.
- The simulated players play at varied hours: each session's hour drawn around the player's habits, with a fixed seed (the same run every time), instead of fixed hours, so that the balance never hangs on a two-hour gap between a session and a hunt.

## Week 11 · Tides 1

- The Tide's fight in `shared/`, tests first.
- A training Tide against ghost alliances.

## Week 12 · Tides 2

- Matching across servers.
- The welcome alliance.
- The rewards.
- The zones' harvest bonus.
- The replays.
- Before the Tides open, a new load test, with sudden peaks and late-game cities:
  - a whole alliance arriving at the same time;
  - the start of Tuesday's attacks;
  - the hunt of the Leviathan;
  - the simulated players' cities at the end of the game (Lighthouse 25 to 30, every raft), not new cities.

## Week 13 · Seasons, then the phone

- The seasons, the title of Guardians of the Great Lighthouse, and its seal on Solana.
- Then the phone.
