# Week 4 · The server decides

Goal of the week (roadmap, phase 2): an action the rules refuse is refused by the server, even if the client is modified.
The client stops sending its city (`PUT /city` disappears). It sends **actions** ("upgrade the Refinery", "send a fleet to this wreck"); the server applies them with the rules of `shared` and sends back the city.

Do the tasks in order, one per session. For each one: read CLAUDE.md, say what you will do and what you will not do, wait for approval, write the code, run `npm run check` (and `npm run e2e` when the client changes), commit, push. One pull request for the whole week.

## Task 1 · Time away: timers and production

Problem found while preparing the week: `catchUp` caps the whole time away at `OFFLINE_CAP` (8 h), timers included. As long as the client counted time, it went unnoticed. Once the server is the judge, a player away for 2 days would find a 20 h upgrade stuck at 8 h, and a fleet stuck at sea.

- Timers (build queue, fleets) always advance by the full real time away. No cap, ever.
- Production: **decision for the owner before coding** (balance value, CLAUDE.md rule 3). **Decision: A (owner, 16 October).**
  - **A (recommended):** remove `OFFLINE_CAP`. Storage (`storeCap`) already limits what piles up; this is how most games of the genre work, and the open question of week 2 is closed.
  - **B:** keep a cap on production only. Then `advance` must split time: timers on the full time, production on the capped part, with the levels reached along the way. More code, more tests.
- Update the tests, `docs/decisions.md` (close the open question) and the Week 3 test "20 h away is capped at 8 h".
- Done when: a test shows that a 20 h upgrade started before 3 days away is finished, and a fleet sent before 3 days away is back with its loot.

## Task 2 · Actions in shared

- `shared/src/state/actions.ts`: a `GameAction` type, each with an `id` made by the client (a UUID) and a `type`:
  - `upgrade` (building), `sail` (site), `readReport`.
- `applyAction(state, action)` returns `{ ok: true, state }` or `{ ok: false, reason }`, using only the existing rules (`upgrade`, `sail`, `readReport`). No clock and no randomness: the server advances the city to now **before** applying the action.
- `parseAction(raw)`: strict reading of an action sent by the client (unknown type, missing or extra field, bad id: refused). Never throws.
- Tests: each action, each refusal with its reason, and `parseAction` on bad input.

## Task 3 · The server applies actions

- `POST /city/actions` (signed in), body `{ action }`. In **one database transaction**:
  1. lock the player's city row (`SELECT … FOR UPDATE`);
  2. if this action id was already applied, return the stored answer (nothing applied twice);
  3. advance the city to now (`catchUp` with the server clock);
  4. apply the action; on refusal, return `{ code: "rule_refused", error: <reason from shared> }` and change nothing;
  5. save the city (version + 1) and the answer under the action id.
- New table `applied_actions` (player_id, action_id, applied_at, answer), primary key (player_id, action_id). `purgeExpired` deletes rows older than 7 days.
- Rate limit: 60 actions per minute per player (`too_many_actions`).
- **A new account gets a new city made by the server** (`newPlayerState`) at its first `GET /city`. A city played without an account stays on the device and is never imported: it was made by the client, so importing it would let anyone edit their save and then sign in. Write this in `docs/decisions.md`. (Guest accounts on the server can come with the embedded wallet, week 13.)
- Remove `PUT /city`, `readSentCity` and their tests. `GET /city` stays.
- Development speed (CLAUDE.md rule 4): `DEV_SPEED` read by the server only, refused when `NODE_ENV=production`, applied to the time it measures. `GET /city` and every action answer include `speed`, so the client shows the same pace as the server. This removes the week 3 limit "fewer resources after a reload in development".
- Tests: every step above, two actions sent at the same moment (both applied once, in order), the same action sent twice (applied once, same answer), a refused action changes nothing, a new account gets a new city.

**Done (16 October), with these changes approved by the owner:**
- `applied_actions` keeps the outcome (applied, or refused with code and reason) and a SHA-256 of the action, not the answer with its city. A replay answers the same outcome with the current city and `"replayed": true`; the same id with other content is refused (409 `action_id_reused`).
- A rule refusal is HTTP 422. Every answer that reads the database carries the city (`state`, `version`, `asOf`, `speed`); 413 `action_too_large` (body over 2 KB) and 429 `too_many_actions` never touch the database and carry none.
- `PUT /city`, `readSentCity` and their tests stay until task 4, so that every commit stays green, end-to-end tests included. "A new account gets a new city at its first `GET /city`" moves to task 4: `ensureCity` is ready, and the first action already creates the city.
- `DEV_SPEED` applies to the game time of the city only, never to sessions, nonces, rate limits or purges.
- Two actions at the same moment are tested on a real PostgreSQL in the CI (job `postgres`), with a check that removing `FOR UPDATE` makes the test fail.

## Task 4 · The client sends actions

- Signed in: each action is applied locally at once with `applyAction` (the screen reacts immediately), then sent. The server's answer **replaces** the local city.
- A refusal (`rule_refused` or other): the city goes back to the server's, and a toast shows `error`.
- No network: actions wait in a queue (with their ids, in order) and are sent when the network is back. At most 20 waiting actions; beyond that, new actions are refused with "You are offline. Reconnect to keep playing." The queue is saved locally, so a reload does not lose it.
- Between two answers, the client advances the display with `tick` at the server's `speed`.
- After sign-in: the account's city is shown. If a city was played on this device without an account, one message: "Your account has its own city. The city on this device stays here when you sign out."
- Not signed in: nothing changes, the game is played locally as today.
- Remove the week 3 sync code (`PUT /city`, `readSentCity` and their tests, the "one version ahead" guess, the keep/replace question).
- `GET /city` creates the city of a new account with `ensureCity` (moved from task 3).
- e2e: upgrade signed in → reload → the upgrade is there; upgrade refused by the server (resources edited in localStorage) → back to the server city with the toast; offline actions sent when back online.

## Task 5 · The cheat test

The checkpoint of the phase: "a modified client can neither create resources nor speed up time". Make it a test that runs in CI (`server/test/cheat.test.ts`, plus one e2e scenario):

- an upgrade without enough resources, above the Lighthouse level, or with both builders busy;
- a fleet without troops, to an unknown site, or with all fleets at sea;
- the same action id replayed ten times;
- an unknown action type, extra fields, a huge body;
- a client whose localStorage was edited (stock ×100, levels 30) then sends an action: the server answers with its own city, unchanged by the edit;
- a client with a faster clock (`DEV_SPEED` changed in the page): the server city does not move faster.
- Done when: every case is refused or ignored, and the server city is exactly what the rules give.

## Task 6 · Research and rafts (can slip to week 5)

The rules exist in `shared` (`canResearch`, `canAddRaft`…) but nothing in the game uses them yet.

- Actions `research` (tech) and `dockRaft` (slot), with the research queue in the city state, applied by the server like the others.
- Observatory sheet: the list of research, cost, time, and the refusal reason.
- Raft slots appear around the island from Lighthouse level 4, as in the prototype; tapping a free slot shows its cost and docks a raft.
- Tests in shared and server, one e2e scenario for research.

## Not this week

Training troops (no rule in `shared` yet: to add from the prototype, week 5), the Mist and the Leviathan on the server (week 7), multiplayer (weeks 8 to 12), renting the server (week 7 at the latest).
