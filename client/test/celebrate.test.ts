import { DAY, advance, newPlayerState, research, train, upgrade, type ActionResult, type GameEvent, type PlayerState } from "@brinelight/shared";
import { describe, expect, it } from "vitest";
import { AWAY_LINES, CELEBRATION_MS, celebrationOf, celebrationsFor, createPlayQueue, eventText } from "../src/ui/celebrate.js";
import { DEVICE, SEEN_KEY, accountOwner, awayEvents, readSeen, writeSeen } from "../src/state/seen.js";
import type { KeyValueStore } from "../src/state/save.js";

const ok = (r: ActionResult): PlayerState => {
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};
const memoryStore = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};
const rich = (): PlayerState => {
  const s = newPlayerState();
  return { ...s, buildings: { ...s.buildings, barracks: 2, observatory: 1 }, stock: { oil: 90000, fish: 90000, wood: 90000, rope: 5 } };
};

describe("what a celebration says", () => {
  it("in English, short, with the player's words", () => {
    const said = (e: GameEvent) => eventText(e);
    expect(said({ kind: "building", building: "refinery", level: 4 })).toBe("Refinery level 4");
    expect(said({ kind: "research", tech: "saws", level: 2 })).toBe("Tide Saws level 2");
    expect(said({ kind: "raft", slot: "3,0" })).toBe("A new raft is moored");
    expect(said({ kind: "raftBuilding", slot: "3,0", building: "greenhouse", level: 1 })).toBe("Kelp Greenhouse built");
    expect(said({ kind: "raftBuilding", slot: "3,0", building: "greenhouse", level: 3 })).toBe("Kelp Greenhouse level 3");
    expect(said({ kind: "troops", troop: "boarders", count: 60 })).toBe("60 boarders ready");
    expect(said({ kind: "veterans", troop: "harpooners", count: 10 })).toBe("10 veteran harpooners ready");
    expect(said({ kind: "healed", count: 8 })).toBe("8 wounded healed");
    expect(said({ kind: "captain", captain: "tom", level: 4 })).toBe("Old Tom reached level 4");
  });

  it("floating gold text for a work, the full screen for the Lighthouse, the 512 px portrait for a captain", () => {
    expect(celebrationOf({ kind: "building", building: "fishery", level: 2 }).kind).toBe("float");
    expect(celebrationOf({ kind: "building", building: "lighthouse", level: 5 })).toEqual({ kind: "lighthouse", title: "Lighthouse level 5", lines: ["Your light reaches farther."] });
    const c = celebrationOf({ kind: "captain", captain: "sel", level: 3 });
    expect(c.kind).toBe("captain");
    expect(c.portrait).toMatch(/captains\/sel-512\.webp$/);
    expect(CELEBRATION_MS.float).toBeLessThan(CELEBRATION_MS.lighthouse);
  });

  it("while you were away: one card for several, a normal celebration for one, nothing for none", () => {
    const events: GameEvent[] = [
      { kind: "building", building: "refinery", level: 4 },
      { kind: "research", tech: "saws", level: 1 },
      { kind: "troops", troop: "boarders", count: 60 },
    ];
    expect(celebrationsFor(events, true)).toEqual([{ kind: "away", title: "While you were away", lines: ["Refinery level 4", "Tide Saws level 1", "60 boarders ready"] }]);
    expect(celebrationsFor(events.slice(0, 1), true)).toEqual([celebrationOf(events[0]!)]);
    expect(celebrationsFor([], true)).toEqual([]);
    const many: GameEvent[] = Array.from({ length: AWAY_LINES + 3 }, (_, i) => ({ kind: "healed", count: i + 1 }));
    const card = celebrationsFor(many, true)[0]!;
    expect(card.lines).toHaveLength(AWAY_LINES + 1);
    expect(card.lines.at(-1)).toBe("And 3 more");
    // Live, each event has its own celebration, in order.
    expect(celebrationsFor(events).map((c) => c.kind)).toEqual(["float", "float", "float"]);
  });
});

describe("one celebration at a time", () => {
  it("the next one waits for the one shown to be over; a second 'done' changes nothing", () => {
    const shown: string[] = [];
    const dones: (() => void)[] = [];
    const q = createPlayQueue<string>((item, done) => {
      shown.push(item);
      dones.push(done);
    });
    q.add(["a", "b"]);
    q.add(["c"]);
    expect(shown).toEqual(["a"]);
    expect(q.waiting).toBe(2);
    dones[0]!();
    dones[0]!();
    expect(shown).toEqual(["a", "b"]);
    dones[1]!();
    dones[2]!();
    expect(shown).toEqual(["a", "b", "c"]);
    expect(q.playing).toBe(false);
    q.add(["d"]);
    expect(shown.at(-1)).toBe("d");
  });
});

describe("at launch, what ended while you were away", () => {
  const before = ok(research(ok(train(ok(upgrade(rich(), "refinery")), "boarders")), "saws"));
  const after = advance(before, DAY);

  it("the last city seen on this device, kept with its owner", () => {
    const store = memoryStore();
    expect(readSeen(store)).toBeNull();
    writeSeen(store, DEVICE, before);
    expect(readSeen(store)).toEqual({ owner: DEVICE, state: before });
    store.data.set(SEEN_KEY, "{broken");
    expect(readSeen(store)).toBeNull();
    expect(readSeen(null)).toBeNull();
  });

  it("the same owner's city: what ended since is told", () => {
    expect(awayEvents({ owner: DEVICE, state: before }, DEVICE, after).map((e) => e.kind)).toEqual(["building", "research", "troops"]);
    const owner = accountOwner("Wa11et");
    expect(awayEvents({ owner, state: before }, owner, after)).toHaveLength(3);
  });

  it("the very first launch: nothing seen yet, nothing told", () => {
    expect(awayEvents(null, DEVICE, after)).toEqual([]);
  });

  it("signing in, the account's city replaces the city of this device: nothing told", () => {
    expect(awayEvents({ owner: DEVICE, state: before }, accountOwner("Wa11et"), after)).toEqual([]);
    expect(awayEvents({ owner: accountOwner("Other"), state: before }, accountOwner("Wa11et"), after)).toEqual([]);
  });
});
