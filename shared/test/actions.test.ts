import { describe, expect, it } from "vitest";
import {
  BUILDING_IDS,
  HOUR,
  SEA_SITES,
  advance,
  applyAction,
  newPlayerState,
  parseAction,
  readReport,
  sail,
  upgrade,
  type GameAction,
  type PlayerState,
} from "../src/index.js";

const ID = "3f2b8c1e-9d4a-4f6b-8e2c-1a7d5b9c0e4f";
const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** Freezes a city and everything inside it: any change would throw. */
function deepFreeze<T>(v: T): T {
  if (v && typeof v === "object") {
    for (const k of Object.keys(v)) deepFreeze((v as Record<string, unknown>)[k]);
    Object.freeze(v);
  }
  return v;
}

/** A city with a fleet back home and its report unread. */
const withReport = (): PlayerState => {
  const r = sail(newPlayerState(), "camp-1");
  if (!r.ok) throw new Error(r.reason);
  return advance(r.state, 8 * HOUR);
};

describe("applyAction", () => {
  it("an upgrade gives the same city as the rule itself", () => {
    const s = newPlayerState();
    expect(applyAction(s, { id: ID, type: "upgrade", building: "refinery" })).toEqual(upgrade(s, "refinery"));
  });

  it("sending a fleet gives the same city as the rule itself", () => {
    const s = newPlayerState();
    expect(applyAction(s, { id: ID, type: "sail", site: "camp-1" })).toEqual(sail(s, "camp-1"));
  });

  it("reading a report gives the same city as the rule itself", () => {
    const s = withReport();
    expect(applyAction(s, { id: ID, type: "readReport", reportId: "r1" })).toEqual({ ok: true, state: readReport(s, "r1") });
  });

  it("an upgrade is refused with the rule's reason, word for word", () => {
    const s = newPlayerState();
    const act = (building: Extract<GameAction, { type: "upgrade" }>["building"], city: PlayerState = s) => applyAction(city, { id: ID, type: "upgrade", building });
    expect(act("refinery", { ...s, stock: { oil: 0, fish: 0, wood: 0, rope: 0 } })).toEqual({ ok: false, reason: "Not enough resources" });
    expect(act("refinery", { ...s, buildings: { ...s.buildings, refinery: s.buildings.lighthouse } })).toEqual({ ok: false, reason: "Upgrade the Lighthouse first" });
    const busy = [
      { id: "refinery" as const, left: 100, duration: 100 },
      { id: "fishery" as const, left: 100, duration: 100 },
    ];
    expect(act("lumberyard", { ...s, queue: busy })).toEqual({ ok: false, reason: "Your 2 builders are busy" });
    expect(act("refinery", { ...s, queue: busy.slice(0, 1) })).toEqual({ ok: false, reason: "This building is already being upgraded" });
  });

  it("sending a fleet is refused with the rule's reason, word for word", () => {
    const s = newPlayerState();
    const act = (city: PlayerState) => applyAction(city, { id: ID, type: "sail", site: "camp-1" });
    expect(act({ ...s, troops: { boarders: 0, harpooners: 0, crossbowmen: 0 } })).toEqual({ ok: false, reason: "You do not have enough troops" });
    const r = sail(s, "camp-1");
    if (!r.ok) throw new Error(r.reason);
    expect(act({ ...r.state, troops: { boarders: 25, harpooners: 25, crossbowmen: 25 } })).toEqual({ ok: false, reason: "Build the Harbor to send more fleets" });
  });

  it("reading a report marks the one named, even when a newer one arrived in between", () => {
    let s = withReport();
    const again = sail({ ...s, troops: { boarders: 25, harpooners: 25, crossbowmen: 25 } }, "camp-1");
    if (!again.ok) throw new Error(again.reason);
    s = advance(again.state, 8 * HOUR);
    expect(s.reports.map((r) => [r.id, r.read])).toEqual([
      ["r1", false],
      ["r2", false],
    ]);
    const r = applyAction(s, { id: ID, type: "readReport", reportId: "r1" });
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.reports.map((x) => [x.id, x.read])).toEqual([
      ["r1", true],
      ["r2", false],
    ]);
  });

  it("reading a report that is gone or already read changes nothing, without a refusal", () => {
    const s = withReport();
    expect(applyAction(s, { id: ID, type: "readReport", reportId: "r9" })).toEqual({ ok: true, state: s });
    const read = readReport(s, "r1");
    expect(applyAction(read, { id: ID, type: "readReport", reportId: "r1" })).toEqual({ ok: true, state: read });
  });

  it("never changes the city it receives, whether the action passes or is refused", () => {
    const cities: PlayerState[] = [newPlayerState(), withReport(), { ...newPlayerState(), stock: { oil: 0, fish: 0, wood: 0, rope: 0 } }];
    const actions: GameAction[] = [
      { id: ID, type: "upgrade", building: "refinery" },
      { id: ID, type: "upgrade", building: "lighthouse" },
      { id: ID, type: "upgrade", building: "harbor" },
      { id: ID, type: "sail", site: "camp-1" },
      { id: ID, type: "sail", site: "wreck-1" },
      { id: ID, type: "readReport", reportId: "r1" },
      { id: ID, type: "readReport", reportId: "r5" },
    ];
    for (const city of cities) {
      const before = json(city);
      deepFreeze(city);
      for (const a of actions) {
        expect(() => applyAction(city, a), `${a.type}`).not.toThrow();
        expect(json(city)).toEqual(before);
      }
    }
  });
});

describe("parseAction", () => {
  it("reads a valid action of each type", () => {
    for (const a of [
      { id: ID, type: "upgrade", building: "refinery" },
      { id: ID, type: "sail", site: "wreck-1" },
      { id: ID, type: "readReport", reportId: "r12" },
    ]) {
      expect(parseAction(json(a))).toEqual(a);
    }
  });

  it("knows every building and every site", () => {
    for (const building of BUILDING_IDS) expect(parseAction({ id: ID, type: "upgrade", building })).not.toBeNull();
    for (const s of SEA_SITES) expect(parseAction({ id: ID, type: "sail", site: s.id })).not.toBeNull();
  });

  const bad: [string, unknown][] = [
    ["null", null],
    ["a number", 42],
    ["a string", "upgrade"],
    ["an array", [ID, "upgrade", "refinery"]],
    ["no id", { type: "upgrade", building: "refinery" }],
    ["an id in capitals", { id: ID.toUpperCase(), type: "upgrade", building: "refinery" }],
    ["an id of another UUID version", { id: "3f2b8c1e-9d4a-1f6b-8e2c-1a7d5b9c0e4f", type: "upgrade", building: "refinery" }],
    ["an id that is not a UUID", { id: "action-1", type: "upgrade", building: "refinery" }],
    ["an id too long", { id: ID + "0", type: "upgrade", building: "refinery" }],
    ["an id that is a number", { id: 1, type: "upgrade", building: "refinery" }],
    ["an unknown type", { id: ID, type: "buyPearls", building: "refinery" }],
    ["a type from the prototype chain", { id: ID, type: "toString" }],
    ["a missing field", { id: ID, type: "upgrade" }],
    ["an extra field", { id: ID, type: "upgrade", building: "refinery", level: 30 }],
    ["the field of another type", { id: ID, type: "upgrade", site: "camp-1" }],
    ["a field of the wrong type", { id: ID, type: "upgrade", building: 3 }],
    ["an unknown building", { id: ID, type: "upgrade", building: "castle" }],
    ["an unknown site", { id: ID, type: "sail", site: "camp-99" }],
    ["a bad report id", { id: ID, type: "readReport", reportId: "1" }],
    ["a report id too long", { id: ID, type: "readReport", reportId: "r1234567890" }],
    ["a string of 10 000 characters", { id: ID, type: "sail", site: "c".repeat(10_000) }],
    ["a type of 10 000 characters", { id: ID, type: "u".repeat(10_000), building: "refinery" }],
  ];
  for (const [name, raw] of bad) {
    it(`refuses ${name}`, () => {
      expect(parseAction(raw)).toBeNull();
    });
  }

  it("refuses a __proto__ field sent as JSON", () => {
    expect(parseAction(JSON.parse(`{"id":"${ID}","type":"upgrade","building":"refinery","__proto__":{"x":1}}`))).toBeNull();
  });

  it("never throws, even on an object whose fields throw when read", () => {
    const trap = new Proxy(
      {},
      {
        get() {
          throw new Error("trap");
        },
        ownKeys() {
          throw new Error("trap");
        },
      },
    );
    const getter = Object.defineProperty({ id: ID, type: "upgrade" }, "building", {
      enumerable: true,
      get() {
        throw new Error("trap");
      },
    });
    expect(() => parseAction(trap)).not.toThrow();
    expect(parseAction(trap)).toBeNull();
    expect(parseAction(getter)).toBeNull();
  });
});
