# Week 2 · Port the prototype into the client

Goal of the week (roadmap, phase 1): the single-player game runs from `client/` like the prototype, with no visible change, split into small modules.
Reference: `client/public/prototype/index.html` (do not modify it).

Do the tasks in order, one per session. For each one: read CLAUDE.md, say what you will do and what you will not do, write the code, run `npm run check`, then commit.

## Task 1 · Scene and camera

- Create `client/src/scene/`: renderer, camera, OrbitControls, lights, water, sky, as in the prototype.
- Load `phare.glb` from `client/public/prototype/assets/` (no copy for now).
- Automatic quality tuning as in the prototype (pixel ratio and shadows reduced when the frame rate drops).
- Not included: buildings, interface, game state.
- Done when: `npm run dev:client` shows the empty island, the sea and the Lighthouse; the camera moves like in the prototype.

## Task 2 · Game state from the shared rules

- Create `client/src/state/`: the player's state (`buildings`, `stock`, `troops`, `techs`, `rafts`, `captains`) typed with `@brinelight/shared`.
- Production uses `netRates` and `advanceStock` from `shared`; no rule is rewritten in the client.
- Save in localStorage under `brinelight-client-v1` (temporary, the server takes over in week 4).
- Speedup factor `DEV_SPEED` in the client config only, never in the rules.
- Done when: unit tests in `client/test/` show that 1 hour advances the stock as `netRates` says. Add `client/test` to the Vitest config.

## Task 3 · Buildings in the city

- Create `client/src/city/`: place the 9 buildings on their plots as in the prototype, with their level labels.
- Tapping a building opens its sheet: level, upgrade cost and duration (`upgradeCost`, `upgradeTime`), the refusal reason from `canUpgrade` when the button is disabled.
- Upgrade queue with the 2 builders (`BUILDERS`).
- Done when: you can upgrade the Refinery, the timer runs, and the level rises at the end.

## Task 4 · Top bar and menus

- Create `client/src/ui/`: resource bar, Power, Mist banner, bottom menu, toasts. Same look as the prototype (copy its CSS into `client/src/ui/style.css`).
- English text, plain, second person.
- Done when: the resource bar follows the stock in real time, on a 412 px-wide phone screen with no horizontal scroll.

## Task 5 · Sea view and combat

- Create `client/src/sea/`: sea map, pirate camps, wrecks, sending a fleet, travel time, combat with `resolveCombat`, report.
- Done when: attacking a level 1 camp with 25/25/25 gives the same result as the test "known prototype scenario" (victory, 12 losses per type).

## Task 6 · Measure on a phone

- Add a small FPS counter visible with `?fps` in the URL.
- Write `docs/perf.md`: phone model, FPS in the city and at sea, what you changed.
- Done when: 30 FPS or more on the low-end Android test phone.

## Not this week

Server, sign-in, Solana, multiplayer, rafts, research, captains (they come in weeks 3 to 6, on the server side first).
