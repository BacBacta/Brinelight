# Test fixtures

## `city-week4.json`

A city as the week 4 server stored it (shape 4), made with the week 4 rules themselves (commit `7774e6d`, the last commit of week 4 on `main`) and checked by the week 4 `parseState`. It has:

- a fleet at sea, on its way to camp-2;
- two combat reports: a victory at camp-1 (read) and a defeat at camp-6 (unread), with wounded in the Infirmary;
- a moored raft, the shipyard at work on a second one, a research and an upgrade in progress.

It has none of the fields of week 5 (`training`, `healing`, `veterans`, `shards`). The migration tests (`shared/test/migrate.test.ts`, `server/test/migration.test.ts`) read it as it is: never edit it by hand.

To make it again (the output is the same: the rules use no clock and no randomness):

```bash
git worktree add --detach /tmp/w4 7774e6d
W4=/tmp/w4 npx tsx make-week4.mts > shared/test/fixtures/city-week4.json
git worktree remove /tmp/w4
```

with `make-week4.mts`:

```ts
// Builds a city with the week 4 rules (commit 7774e6d), checked by the week 4 parseState, printed as JSON.
const w4 = await import(process.env.W4 + "/shared/src/index.ts");
const { newPlayerState, advance, sail, dockRaft, research, upgrade, readReport, parseState, HOUR, RAFT_SLOTS } = w4;
const ok = (r: any) => { if (!r.ok) throw new Error(r.reason); return r.state; };
let s: any = newPlayerState();
s = { ...s, buildings: { ...s.buildings, lighthouse: 4, observatory: 1, infirmary: 1, harbor: 1 }, stock: { oil: 4000, fish: 4000, wood: 4000, rope: 10 } };
// A victory at camp-1, then a defeat at camp-6 with a small army: two reports, the first one read.
s = advance(ok(sail({ ...s, troops: { boarders: 60, harpooners: 60, crossbowmen: 60 } }, "camp-1")), 8 * HOUR);
s = advance(ok(sail({ ...s, troops: { boarders: 20, harpooners: 20, crossbowmen: 20 } }, "camp-6")), 10 * HOUR);
s = readReport(s, s.reports[0].id);
// A raft moored, then the shipyard at work on a second one; a research in progress; an upgrade in the queue.
const inner = RAFT_SLOTS.filter((x: any) => x.ring === 3).map((x: any) => x.key);
s = advance(ok(dockRaft(s, inner[0])), 3 * HOUR);
s = ok(dockRaft(s, inner[1]));
s = ok(research(s, "refining"));
s = ok(upgrade(s, "refinery"));
// A fleet at sea, on its way to camp-2.
s = advance(ok(sail({ ...s, troops: { boarders: 40, harpooners: 40, crossbowmen: 40 } }, "camp-2")), 600);
const read = parseState(JSON.parse(JSON.stringify(s)));
if (!read) throw new Error("The week 4 parseState refuses the city");
if (read.fleets.length !== 1 || read.reports.length !== 2) throw new Error("Expected one fleet and two reports");
console.log(JSON.stringify(s, null, 2));
```
