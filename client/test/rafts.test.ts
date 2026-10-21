import * as THREE from "three";
import { RAFT_BUILD_TIME, RAFT_MAX, RAFT_MAX_HP, RAFT_SLOTS, applyAction, newPlayerState, raftCap, type PlayerState } from "@brinelight/shared";
import { describe, expect, it } from "vitest";
import { RAFT_TEXT, raftSheetHtml } from "../src/city/raftSheet.js";
import { DECK_VARIANTS, RAFT_FILL, WALKWAY_GRIP, cornerMarks, createCityRafts, markedSlots, raftSlots, raftVariant, raftWalkways } from "../src/city/rafts.js";
import type { Placed, Village } from "../src/city/village.js";
import { hexX, hexZ } from "../src/scene/island.js";
import { hexReach } from "../src/scene/buildings.js";
import { SAVE_KEY, openSave, saveGame, type KeyValueStore } from "../src/state/save.js";

const memoryStore = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};
const INNER = RAFT_SLOTS.filter((s) => s.ring === 3).map((s) => s.key);
const lit = (lighthouse = 4): PlayerState => {
  const s = newPlayerState();
  return { ...s, buildings: { ...s.buildings, lighthouse }, stock: { oil: 9000, fish: 9000, wood: 9000, rope: 50 } };
};
/** A stand-in for the village (village.ts): it keeps what it is asked to lay. */
const fakeVillage = () => {
  const laid: { items: Placed[] } = { items: [] };
  const village = { meshes: [], show: (items: Placed[]) => void (laid.items = items), animate() {}, prefetch() {}, setDimness() {}, setCloseness() {} } as unknown as Village;
  return { village, laid };
};
const raft = (hp = RAFT_MAX_HP) => ({ hp, building: null, level: 0 });
/** As main.ts does without an account: the shared rules, and no id, since nothing is sent. */
const dockLocally = (s: PlayerState, slot: string) => applyAction(s, { id: "", type: "dockRaft", slot });

describe("raft slots around the island", () => {
  it("free slots appear once the Lighthouse lights them, the first ring before the second", () => {
    expect(raftSlots(lit(2))).toEqual([]);
    const four = raftSlots(lit(4));
    expect(four.map((s) => s.key)).toEqual(INNER);
    expect(four.every((s) => s.view === "free")).toBe(true);
    expect(raftSlots(lit(8))).toHaveLength(RAFT_SLOTS.length);
  });

  it("while the shipyard works, only its slot and the moored rafts show; a damaged raft looks damaged", () => {
    const r = dockLocally({ ...lit(), rafts: { [INNER[1]!]: raft(40) } }, INNER[0]!);
    if (!r.ok) throw new Error(r.reason);
    expect(raftSlots(r.state)).toEqual([
      { key: INNER[0], view: "building" },
      { key: INNER[1], view: "damaged" },
    ]);
  });

  it(`up to ${RAFT_MAX} rafts: the village lays them, here two meshes in all (the free slots' marks, the tap shapes)`, () => {
    const added: THREE.Object3D[] = [];
    const { village, laid } = fakeVillage();
    const rafts = createCityRafts((o) => added.push(o), () => 4.6, village);
    const full = { ...lit(4), rafts: Object.fromEntries(RAFT_SLOTS.slice(0, RAFT_MAX).map((s) => [s.key, raft()])) };
    rafts.refresh(full);
    rafts.animate(1.5);
    const [ring, hit] = rafts.meshes as THREE.InstancedMesh[];
    expect(added).toHaveLength(2);
    expect(hit!.count).toBe(RAFT_MAX);
    // A deck per raft, the walkways from ring 4 and the moorings of ring 3.
    expect(laid.items.filter((it) => it.name.startsWith("raft-") && it.bob !== undefined)).toHaveLength(RAFT_MAX);
    rafts.refresh(lit(4));
    expect(ring!.count).toBe(markedSlots(lit(4), false).size);
    expect(ring!.count).toBeGreaterThan(0);
    expect(added).toHaveLength(2);
  });
});

describe("a free slot's golden marks (the village, style pass)", () => {
  it("only at its six corners, inside its room: no line around it that would read as a grid", () => {
    const room = RAFT_FILL / Math.cos(Math.PI / 6);
    const pos = cornerMarks(room, 0.16, 0.035).getAttribute("position");
    expect(pos.count).toBe(6 * 2 * 6);
    const corners = [0, 1, 2, 3, 4, 5].map((k) => ({ x: Math.cos(Math.PI / 2 + (k * Math.PI) / 3) * room, z: Math.sin(Math.PI / 2 + (k * Math.PI) / 3) * room }));
    for (let i = 0; i < pos.count; i++) {
      const [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
      expect(y).toBe(0);
      expect(hexReach(x, z)).toBeLessThanOrEqual(RAFT_FILL + 1e-6);
      // Each point lies near a corner: a stroke covers less than a fifth of a side.
      expect(Math.min(...corners.map((c) => Math.hypot(x - c.x, z - c.z)))).toBeLessThan(0.2 * room + 0.04);
    }
  });
});

describe("the sheet of a raft slot", () => {
  it("a free slot: cost, time, and the button, or the rule's reason", () => {
    const html = raftSheetHtml(lit(), INNER[0]!, 1)!;
    expect(html.title).toBe("Raft slot");
    expect(html.body).toContain(RAFT_TEXT.free);
    expect(html.body).toContain(`<span>Rafts</span><span>0 / ${raftCap(4)}</span>`);
    expect(html.body).toContain('data-act="dock" aria-disabled="false"');
    const full = { ...lit(), rafts: Object.fromEntries(INNER.slice(1, raftCap(4) + 1).map((k) => [k, raft()])) };
    expect(raftSheetHtml(full, INNER[0]!, 1)!.body).toContain('<p class="why">Upgrade the Lighthouse to grow your city further</p>');
  });

  it("the slot the shipyard works on, then the moored raft and its sturdiness", () => {
    const r = dockLocally(lit(), INNER[0]!);
    if (!r.ok) throw new Error(r.reason);
    expect(raftSheetHtml(r.state, INNER[0]!, 1)!.body).toContain(RAFT_TEXT.working);
    const moored = raftSheetHtml({ ...lit(), rafts: { [INNER[0]!]: raft(40) } }, INNER[0]!, 1)!;
    expect(moored.body).toContain("40% · half efficiency");
    expect(moored.body).toContain(RAFT_TEXT.raft);
  });
});

describe("rafts without an account", () => {
  it("a raft started in the local game is saved on this device and moored during time away", () => {
    const t0 = Date.UTC(2026, 9, 16, 12);
    const store = memoryStore();
    const r = dockLocally(lit(), INNER[0]!);
    if (!r.ok) throw new Error(r.reason);
    saveGame(store, r.state, t0);
    const back = openSave(store, t0 + RAFT_BUILD_TIME * 1000);
    expect(back.rejected).toBe(false);
    expect(back.state.rafts).toEqual({ [INNER[0]!]: raft() });
    expect(back.state.yard).toBeNull();
  });

  it("a local save from before the shipyard loads with no work in progress, never set aside", () => {
    const store = memoryStore();
    const { yard: _y, research: _r, ...old } = newPlayerState();
    store.data.set(SAVE_KEY, JSON.stringify({ v: 1, savedAt: 0, state: old }));
    const opened = openSave(store, 0);
    expect(opened.rejected).toBe(false);
    expect(opened.state).toEqual(newPlayerState());
  });
});

describe("the floating village", () => {
  const all = RAFT_SLOTS.map((s) => s.key);
  const at = (key: string) => {
    const s = RAFT_SLOTS.find((x) => x.key === key)!;
    return { x: hexX(s.q, s.r), z: hexZ(s.r), ring: s.ring };
  };

  it("two rafts side by side never show the same deck, the four decks mixed around the ring (no stripes)", () => {
    for (const a of RAFT_SLOTS)
      for (const b of RAFT_SLOTS) {
        if (Math.hypot(hexX(a.q, a.r) - hexX(b.q, b.r), hexZ(a.r) - hexZ(b.r)) > 2.01 || a.key === b.key) continue;
        expect(raftVariant(a.key), `${a.key} ${b.key}`).not.toBe(raftVariant(b.key));
      }
    // Each deck on at least six of the 39 slots, on both rings.
    for (let v = 0; v < DECK_VARIANTS; v++) {
      expect(all.filter((k) => raftVariant(k) === v).length, `deck ${v}`).toBeGreaterThanOrEqual(6);
      for (const ring of [3, 4]) expect(RAFT_SLOTS.some((s) => s.ring === ring && raftVariant(s.key) === v), `deck ${v} ring ${ring}`).toBe(true);
    }
    // Not the old rule's diagonal stripes: (q − r) mod 3 no longer tells a slot's deck.
    const stripes = RAFT_SLOTS.filter((s) => raftVariant(s.key) === ((((s.q - s.r) % 3) + 3) % 3)).length;
    expect(stripes).toBeLessThan(RAFT_SLOTS.length * 0.6);
  });

  it("with the village, the free slots show their marks only when a raft can be moored now, all of them while placing one", () => {
    const start = newPlayerState() as PlayerState;
    const base = { ...start, buildings: { ...start.buildings, lighthouse: 5 } } as PlayerState;
    const rich = { ...base, stock: { ...base.stock, oil: 1e6, fish: 1e6, wood: 1e6 } } as PlayerState;
    const poor = { ...base, stock: { ...base.stock, oil: 0, fish: 0, wood: 0 } } as PlayerState;
    const free = raftSlots(rich).filter((s) => s.view === "free").map((s) => s.key);
    expect(free.length).toBeGreaterThan(0);
    expect([...markedSlots(rich, false)].sort()).toEqual([...free].sort());
    expect(markedSlots(poor, false).size).toBe(0);
    expect([...markedSlots(poor, true)].sort()).toEqual([...raftSlots(poor).filter((s) => s.view === "free").map((s) => s.key)].sort());
    // The shipyard at work: no slot to fill, none shown.
    const busy = { ...rich, yard: { slot: free[0]!, kind: "raft", left: 10, duration: 20 } } as unknown as PlayerState;
    expect(markedSlots(busy, false).size).toBe(0);
  });

  it("one walkway per raft toward the island: ring 3 to the shore, ring 4 to a raft of ring 3 beside it", () => {
    const coast = () => 4.6;
    const ways = raftWalkways(all, coast);
    expect(ways).toHaveLength(all.length);
    // A raft of ring 4 alone, with no raft of ring 3 beside it, has none.
    const outer = all.find((k) => at(k).ring === 4)!;
    expect(raftWalkways([outer], coast)).toEqual([]);
    for (const w of ways) {
      expect(w.length, JSON.stringify(w)).toBeGreaterThan(0);
      // It lies on the water between rooms: its middle is in no raft's room.
      for (const k of all) {
        const r = at(k);
        expect(hexReach(w.x - r.x, w.z - r.z), `${JSON.stringify(w)} ${k}`).toBeGreaterThan(RAFT_FILL - WALKWAY_GRIP);
      }
    }
    // The same rafts always get the same walkways.
    expect(raftWalkways(all, coast)).toEqual(ways);
  });
});
