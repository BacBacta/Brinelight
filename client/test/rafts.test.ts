import * as THREE from "three";
import { RAFT_BUILD_TIME, RAFT_MAX, RAFT_MAX_HP, RAFT_SLOTS, applyAction, newPlayerState, raftCap, type PlayerState } from "@brinelight/shared";
import { describe, expect, it } from "vitest";
import { RAFT_TEXT, raftSheetHtml } from "../src/city/raftSheet.js";
import { RAFT_WIDTH, createCityRafts, raftGeometry, raftSlots } from "../src/city/rafts.js";
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
/** A stand-in for the raft model: a flat box off center, as a loaded model may be. */
const raftModel = () => {
  const g = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 3), new THREE.MeshStandardMaterial());
  deck.position.set(2, -1, 0);
  g.add(deck);
  return g;
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

  it(`up to ${RAFT_MAX} rafts are drawn with the same few meshes`, () => {
    const added: THREE.Object3D[] = [];
    const rafts = createCityRafts({}, raftModel(), (o) => added.push(o));
    const full = { ...lit(10), rafts: Object.fromEntries(RAFT_SLOTS.slice(0, RAFT_MAX).map((s) => [s.key, raft()])) };
    rafts.refresh(full);
    rafts.animate(1.5);
    const meshes = rafts.meshes as THREE.InstancedMesh[];
    expect(meshes).toHaveLength(4);
    expect(meshes.every((m) => m instanceof THREE.InstancedMesh)).toBe(true);
    expect(meshes[0]!.count).toBe(RAFT_MAX);
    // One scaffolding model aside; nothing else is added, whatever the number of rafts.
    expect(added).toHaveLength(5);
    rafts.refresh(lit(4));
    expect(meshes[0]!.count).toBe(0);
    expect(meshes[1]!.count).toBe(raftSlots(lit(4)).length);
  });
});

describe("the raft model", () => {
  it("one geometry with the model's texture, centered on its slot, standing on its bottom, RAFT_WIDTH wide", () => {
    const { geometry, material } = raftGeometry(raftModel());
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect(box.min.y).toBeCloseTo(0, 6);
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0, 6);
    expect(Math.max(box.max.x - box.min.x, box.max.z - box.min.z)).toBeCloseTo(RAFT_WIDTH, 6);
    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
  });

  it("a model in several parts becomes a single geometry, its parts where they were", () => {
    const two = raftModel();
    const top = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    top.position.set(0, 3, 0);
    two.add(top);
    const { geometry } = raftGeometry(two);
    expect(geometry.getAttribute("position").count).toBe(48);
    expect(geometry.boundingBox!.max.y).toBeGreaterThan(geometry.boundingBox!.max.x);
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
    expect(raftSheetHtml(full, INNER[0]!, 1)!.body).toContain('<p class="why">Upgrade the Lighthouse to moor more rafts</p>');
  });

  it("the slot the shipyard works on, then the moored raft and its sturdiness", () => {
    const r = dockLocally(lit(), INNER[0]!);
    if (!r.ok) throw new Error(r.reason);
    expect(raftSheetHtml(r.state, INNER[0]!, 1)!.body).toContain(RAFT_TEXT.working);
    const moored = raftSheetHtml({ ...lit(), rafts: { [INNER[0]!]: raft(40) } }, INNER[0]!, 1)!;
    expect(moored.body).toContain("40% · half efficiency");
    expect(moored.body).toContain("Buildings on rafts are coming soon.");
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
