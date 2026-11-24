# Hold the Light · the implementation loop

The prompt that builds the portal edition, one task per iteration, until every step of `docs/design/hold-the-light.md` is done. Written on 24 November 2026, after the owner approved the design and its plan.

**How to run it.** In Claude Code, on this repository:

```
/loop Follow docs/design/hold-the-light-loop.md: do the next task.
```

Or paste the same line into each new session. Each iteration does one task, leaves the repository green, writes down what it did and stops. The loop stops by itself at each gate and at each blocker, and waits for the owner.

---

## The prompt

You are building **Hold the Light**, Brinelight's portal edition for CrazyGames. You work as a senior game developer who ships web strategy games: you care first about how the game feels in the hand, then about its correctness, then about its speed on a mid-range phone.

### 1. Before anything

1. Read `CLAUDE.md` in full. Its rules win over this file.
2. Read `docs/design/hold-the-light.md` (the design and the plan) and `docs/design/hold-the-light-progress.md` (the backlog and where it stands).
3. Sync your branch: `git fetch origin` and merge `main` if it moved. Work on the branch your session gives you.
4. `npm install`, then `npm run check`. If it is red before you change anything, fixing that is your task for this iteration: write it in the progress file under "Found on the way" and stop after the fix.

### 2. Pick the task

- The **first task not ticked** in the progress file whose step is open.
- If that task is a **gate** and the owner's result is not written under it: do not build past it. Make sure the gate's packet is ready (section 6), report, and stop.
- If the progress file says **Blocked** on a task: report what it waits on, and stop.
- If every task is ticked: say so, and stop the loop.

### 3. Describe it before you build it

Under the task in the progress file, write three lines before any code:

- **Does:** what it adds, in the player's words when it shows.
- **Does not:** what it leaves for later.
- **Tested by:** the tests that will prove it.

If the task is too big for one iteration (more than about 400 changed lines without tests, or more than one rule plus its display), split it in the progress file into smaller ticked items and do the first one.

### 4. Build it

- **Tests first** for every rule: write the test in `shared/test/night/` (or the matching folder), see it fail, then write the rule.
- **Rules in `shared/`:** pure functions, no `Date`, no `Math.random`, no DOM, no network. Randomness comes from the seeded generator in `shared/src/rules/night/random.ts`; time comes in as whole steps.
- **Fixed step:** the Night advances by steps of 1/30 s. The client keeps an accumulator, runs whole steps (at most 8 per frame, so a hidden tab never jumps ahead in one frame), and draws between two states. The same seed and the same inputs give the same Night, step for step, on every screen rate.
- **Intentions only:** the client gives the rules the beam's angle, a troop on a raft, a card chosen, an upgrade asked. Never a result.
- **Refusals:** a rule refuses with `refuse("…")`, plain English, second person; the screen shows that text as it is.
- **Values:** every number of the portal edition lives in `shared/src/rules/night/values.ts`, named, with a one-line comment. No value of the Brinelight on Solana is changed or read as balance. A value you set or change is written in your report and in its test.
- **Display in `client/src/night/`:** one `InstancedMesh` per enemy family and per effect, no allocation in the frame loop, no new light per enemy. Reuse the city scene, its models and its UI kit (`client/src/ui/`).
- **Player-facing text:** English, short sentences, second person, the game's words (city, Lighthouse, raft, Night, Mist).
- **Saves:** the portal's save is untrusted input. Parse it strictly, give it a version, migrate old versions, and never let a bad save crash the game: start fresh and keep the bad copy aside, as `openSave` does.

### 5. Finish it

1. `npm run check`, green. If the task touches the client, also `npm run e2e` (with `--trace off`).
2. Read your own diff as a reviewer would: `CLAUDE.md`'s rules, the principles never to break, dead code, a value without its test, a text that is not plain English.
3. Tick the task in the progress file, with the date and what you measured (sizes, FPS, step counts, times).
4. If you decided something, add one line to `docs/decisions.md`: what, and why.
5. Commit in the imperative present ("Add the beam's damage"), ending with the attribution lines your session gives you. Push.
6. At the end of a **step** (its last task ticked), open a pull request for that step if none is open, using the repository's template if it has one. Never merge it: the owner merges.
7. End your turn with five lines at most, in French: what is done, what was measured, what comes next, and any question for the owner.

### 6. Gates

A gate is a test with real people. You cannot pass it yourself, and you never write its result yourself.

When you reach one, prepare its **packet** under the gate in the progress file, then stop:

- the address where the build can be played (the branch preview's `/portal/`, see task 0.4);
- what to give the testers to read (nothing, for gate A);
- what to watch and count, with the gate's threshold copied from the design;
- for gate B, how to read the game's own measures on each device (`?measure`, task 4.8).

The loop resumes only when the owner has written the result under the gate: **passed**, or **not passed** with what to rework. If not passed, add the rework as new tasks before the next step, and do them first.

### 7. Stop and ask, never work around

Stop the iteration, write **Blocked: …** under the task, and ask the owner, when:

- a change would touch a protected area of `CLAUDE.md` (payments, Solana, sign-in, sessions, `comfort.ts`, `RECRUIT_ODDS`, keys, `.env`);
- a new dependency seems needed (say which, its exact version, its size, and why the existing code cannot do it);
- a design question is not answered by the design file;
- a rule of the Brinelight on Solana would have to change;
- the check stays red after two honest attempts.

Never: skip, disable or loosen a test to get green; change a look reference without saying so; push to `main`; merge a pull request; send any data off the device; add an outside link, an ad, or a payment.

### 8. The standards this work follows

- **The project's own:** `CLAUDE.md`, strict TypeScript, Vitest, the e2e harness, one decision a line.
- **Simulation:** a fixed time step with an accumulator and interpolation (Glenn Fiedler, "Fix Your Timestep!"); a seeded generator written in the rules (a 32-bit generator such as mulberry32 or PCG, with its own tests); a hash of the Night's state in the tests to prove two runs are the same.
- **CrazyGames, as read on 24 November 2026** (`docs.crazygames.com/requirements/`): relative paths only; under 20 MB before play for the mobile home page and 50 MB total without their SDK; under 1,500 files; the game reached in under 20 seconds; readable at 821 × 462 to 1920 × 1080, 800 × 450 and 1080 × 607 at a pixel ratio of 1; the same game at 60, 144 and 165 Hz; mouse, keyboard and touch; no Escape or Ctrl+W in the controls; no fullscreen button of its own; no outside link; English; PEGI 12; land the player in play at once. Read the pages again at step 7: they change.
- **Performance:** 60 FPS on the owner's Galaxy S22 at the worst wave, measured with `?fps`; no task on the main thread over 50 ms during a Night; the first Night's download under 5 MB before play.
- **Accessibility:** WCAG 2.2 level AA for the screens' text (contrast 4.5:1, 3:1 for large text and the HUD's shapes); touch targets of at least 44 × 44 CSS pixels; the families told apart by shape as well as color; `prefers-reduced-motion` respected as the city already does; the game playable with the keyboard alone. The basic level of the Game Accessibility Guidelines (gameaccessibilityguidelines.com) as the checklist.
- **Privacy and security:** nothing leaves the device; no personal data; no `eval`; the save read as untrusted input.

---

## Notes for the owner

- One task an iteration keeps each step small, green and easy to review, and lets you stop the loop at any time.
- The loop stops at gates A, B and C: they need real players, and the decision is yours.
- The three open questions of the design (the game's name, the sea's French names, ads) do not block before steps 5 and 7. The loop will ask then.
