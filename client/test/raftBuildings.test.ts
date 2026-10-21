import * as THREE from "three";
import {
  RAFT_INSTALL_TIME,
  RAFT_MAX_HP,
  RAFT_SLOTS,
  advance,
  applyAction,
  emptyTroops,
  newPlayerState,
  type PlayerState,
  type RaftBuildingId,
} from "@brinelight/shared";
import { describe, expect, it } from "vitest";
import { RAFT_TEXT, raftEffectText, raftSheetHtml, yardName } from "../src/city/raftSheet.js";

/** These sheets read the rafts' words (before the Lighthouse 5, or with ?legacy); the land's are read in words.test.ts. */
const RAFTS = false;
import { QUEUE_ROWS, queueFold } from "../src/city/queue.js";
import { RAFT_BUILDING_FIT, createCityRafts, raftBuildingGeometry, raftBuildingTurn, raftBuildingsShown } from "../src/city/rafts.js";
import { attackInput } from "../src/sea/odds.js";
import { SAVE_KEY, openSave, saveGame, type KeyValueStore } from "../src/state/save.js";

const memoryStore = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};
const INNER = RAFT_SLOTS.filter((s) => s.ring === 3).map((s) => s.key);
const [A, B, C] = INNER as [string, string, string];
const free = { hp: RAFT_MAX_HP, building: null, level: 0 };
const moored = (): PlayerState => {
  const s = newPlayerState();
  return { ...s, buildings: { ...s.buildings, lighthouse: 6 }, rafts: { [A]: { ...free }, [B]: { ...free }, [C]: { ...free } }, stock: { oil: 5000, fish: 5000, wood: 5000, rope: 3 } };
};
const carrying = (s: PlayerState, slot: string, building: RaftBuildingId, level: number): PlayerState => ({ ...s, rafts: { ...s.rafts, [slot]: { hp: RAFT_MAX_HP, building, level } } });
/** As main.ts does without an account: the shared rules, and no id, since nothing is sent. */
type RaftAction = { type: "installOnRaft"; slot: string; building: RaftBuildingId } | { type: "upgradeRaft"; slot: string };
const locally = (s: PlayerState, a: RaftAction) => {
  const r = applyAction(s, { id: "", ...a });
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};
/** A stand-in for a building model: a tall box off center, as a loaded model may be. */
const tower = () => {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 6, 1), new THREE.MeshStandardMaterial());
  m.position.set(3, 5, -1);
  g.add(m);
  return g;
};

describe("what a raft building does, in your units", () => {
  it("Kelp Greenhouse in fish per hour, Smokehouse in fish eaten, Watchtower in fleet attack", () => {
    expect(raftEffectText("greenhouse", 1)).toBe("+4.5 fish/h");
    expect(raftEffectText("greenhouse", 3)).toBe("+13.5 fish/h");
    expect(raftEffectText("smokehouse", 2)).toBe("−20% fish eaten");
    expect(raftEffectText("watchtower", 3)).toBe("+15% fleet attack");
  });
});

describe("the sheet of a raft", () => {
  it("a free raft: the three buildings, their effect, cost, time and copies, an Install button each", () => {
    const html = raftSheetHtml(carrying(moored(), B, "smokehouse", 1), A, 1, RAFTS)!;
    expect(html.title).toBe("Raft");
    expect(html.body).toContain("A free raft. Put a building on it. Each type is limited to 2 rafts.");
    expect(html.body).toContain("Sturdiness");
    expect(html.body).toContain("<b>Kelp Greenhouse</b><small>+4.5 fish/h per level</small><small>200 wood · 80 oil · 48 min · 0/2</small>");
    expect(html.body).toContain("<b>Smokehouse</b><small>−10% fish eaten per level</small><small>220 wood · 100 fish · 48 min · 1/2</small>");
    expect(html.body).toContain("<b>Watchtower</b><small>+5% fleet attack per level</small><small>260 wood · 120 oil · 48 min · 0/2</small>");
    expect(html.body).toContain('data-act="install" data-building="watchtower" aria-disabled="false">Install</button>');
    expect(html.body).not.toContain('class="why"');
  });

  it("a third copy, or the shipyard busy: the button is still there, refused; the busy shipyard is said", () => {
    const two = carrying(carrying(moored(), B, "greenhouse", 1), C, "greenhouse", 1);
    expect(raftSheetHtml(two, A, 1, RAFTS)!.body).toContain('data-act="install" data-building="greenhouse" aria-disabled="true"');
    const busy = locally(moored(), { type: "installOnRaft", slot: B, building: "watchtower" });
    const html = raftSheetHtml(busy, A, 1, RAFTS)!.body;
    expect(html).toContain("1/2</small>");
    expect(html).toContain('<p class="why">The shipyard is busy</p>');
  });

  it("a raft with a building: its effect at this level, the next level's cost, time and Power, or Max level", () => {
    const html = raftSheetHtml(carrying(moored(), A, "greenhouse", 2), A, 1, RAFTS)!;
    expect(html.title).toBe("Kelp Greenhouse");
    expect(html.body).toContain("Kelp Greenhouse level 2: +9 fish/h.");
    expect(html.body).toContain("<h4>Upgrade to level 3</h4>");
    expect(html.body).toContain("Time: 1 h 48 min · Power +90");
    expect(html.body).toContain('data-act="upgrade-raft" aria-disabled="false">Upgrade</button>');
    const max = raftSheetHtml(carrying(moored(), A, "watchtower", 3), A, 1, RAFTS)!;
    expect(max.body).toContain("Watchtower level 3: +15% fleet attack.");
    expect(max.body).toContain(RAFT_TEXT.max);
    expect(max.body).not.toContain('data-act="upgrade-raft"');
  });

  it("while the shipyard works on it: what and how long", () => {
    const s = locally(moored(), { type: "installOnRaft", slot: A, building: "smokehouse" });
    const html = raftSheetHtml(s, A, 1, RAFTS)!;
    expect(html.title).toBe("Smokehouse");
    expect(html.body).toContain(RAFT_TEXT.working);
    expect(html.body).toContain("Done in 48:00");
  });
});

describe("repairing the rafts, on a raft's sheet", () => {
  const damaged = (): PlayerState => {
    const s = carrying(moored(), A, "greenhouse", 1);
    return { ...s, rafts: { ...s.rafts, [A]: { ...s.rafts[A]!, hp: 65 }, [B]: { ...s.rafts[B]!, hp: 25 } } };
  };

  it("while rafts are damaged, every raft's sheet offers to repair them all: the cost in oil, the time", () => {
    const html = raftSheetHtml(damaged(), C, 1, RAFTS)!.body;
    // 35 + 75 = 110 points: 220 oil and no wood, whatever the Lighthouse's level; 110 / 35 × 6 minutes.
    expect(html).toContain("Repair the 2 damaged rafts");
    expect(html).toContain('data-act="repair"');
    expect(html).toContain('title="oil">');
    expect(html).toMatch(/title="oil"><span class="ic oil">.*?<\/span>220<\/span>/);
    expect(html).not.toContain('title="wood"');
    expect(html).toContain("Time: 19 min");
    expect(raftSheetHtml(damaged(), A, 1, RAFTS)!.body).toContain("Repair the 2 damaged rafts");
    expect(raftSheetHtml(moored(), A, 1, RAFTS)!.body).not.toContain('data-act="repair"');
  });

  it("while they are repaired: their sheets show the work, the queue names it", () => {
    const r = applyAction(damaged(), { id: "", type: "repairRafts" });
    if (!r.ok) throw new Error(r.reason);
    expect(raftSheetHtml(r.state, B, 1, RAFTS)!.body).toContain("Repairing 2 rafts.");
    expect(raftSheetHtml(r.state, C, 1, RAFTS)!.body).not.toContain('data-act="repair"');
    expect(yardName(r.state, RAFTS)).toBe("Shipyard · repairing 2 rafts");
  });
});

describe("the queue", () => {
  it("names the shipyard's work: a raft, a building put on a raft, a building one level up", () => {
    const docked = applyAction(moored(), { id: "", type: "dockRaft", slot: INNER[4]! });
    if (!docked.ok) throw new Error(docked.reason);
    expect(yardName(docked.state, RAFTS)).toBe("Shipyard · raft");
    expect(yardName(locally(moored(), { type: "installOnRaft", slot: A, building: "greenhouse" }), RAFTS)).toBe("Shipyard · Kelp Greenhouse");
    expect(yardName(locally(carrying(moored(), A, "watchtower", 1), { type: "upgradeRaft", slot: A }), RAFTS)).toBe("Shipyard · Watchtower Lv 2");
    expect(yardName(moored(), RAFTS)).toBeNull();
  });

  it(`shows at most ${QUEUE_ROWS} rows, then "+N more", which unfolds the rest and folds it back`, () => {
    expect(QUEUE_ROWS).toBe(3);
    expect(queueFold(2, false)).toEqual({ shown: 2, button: null });
    expect(queueFold(3, false)).toEqual({ shown: 3, button: null });
    expect(queueFold(6, false)).toEqual({ shown: 3, button: "+3 more" });
    expect(queueFold(6, true)).toEqual({ shown: 6, button: "Show less" });
    expect(queueFold(4, false)).toEqual({ shown: 3, button: "+1 more" });
  });
});

describe("buildings on rafts in the city", () => {
  it("stand on the rafts that carry them once the work is done, by type", () => {
    const s = locally(carrying(moored(), B, "greenhouse", 2), { type: "installOnRaft", slot: A, building: "greenhouse" });
    expect(raftBuildingsShown(s)).toEqual({ greenhouse: [B], smokehouse: [], watchtower: [] });
    expect(raftBuildingsShown(advance(s, RAFT_INSTALL_TIME)).greenhouse.sort()).toEqual([A, B].sort());
  });

  it("each model becomes one geometry, centered, standing on its bottom, within the room a raft gives", () => {
    const { geometry } = raftBuildingGeometry(tower());
    const box = geometry.boundingBox!;
    expect(box.min.y).toBeCloseTo(0, 6);
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0, 6);
    expect(box.max.y - box.min.y).toBeCloseTo(RAFT_BUILDING_FIT.height, 6);
    expect(Math.max(box.max.x - box.min.x, box.max.z - box.min.z)).toBeLessThanOrEqual(RAFT_BUILDING_FIT.width);
  });

  it("three meshes for the three types, two copies each at most, and a tap on a building opens its raft", () => {
    const added: THREE.Object3D[] = [];
    const rafts = createCityRafts({}, tower(), (o) => added.push(o));
    let s = moored();
    s = carrying(carrying(carrying(s, A, "greenhouse", 1), B, "greenhouse", 3), C, "watchtower", 2);
    rafts.refresh(s);
    rafts.useBuildings({ greenhouse: tower(), smokehouse: tower(), watchtower: tower() });
    rafts.animate(2);
    expect(added).toHaveLength(6 + 3);
    const onRafts = rafts.meshes.slice(5) as THREE.InstancedMesh[];
    expect(onRafts.map((m) => [m.userData.raftBuilding, m.count, m.visible])).toEqual([
      ["greenhouse", 2, true],
      ["smokehouse", 0, false],
      ["watchtower", 1, true],
    ]);
    expect(onRafts.every((m) => m.instanceMatrix.count === 2)).toBe(true);
    expect(rafts.hits).toContain(onRafts[2]);
    expect(rafts.slotOf({ object: onRafts[2]!, instanceId: 0 } as unknown as THREE.Intersection)).toBe(C);
    // Each building stands on its raft's slot, turned as the prototype turned it.
    const m = new THREE.Matrix4();
    onRafts[2]!.getMatrixAt(0, m);
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    m.decompose(p, q, sc);
    const turn = new THREE.Euler().setFromQuaternion(q, "YXZ").y;
    expect(Math.cos(turn)).toBeCloseTo(Math.cos(raftBuildingTurn(C)), 6);
    // The city changes: the meshes stay, their counts follow.
    rafts.refresh(moored());
    expect(onRafts.map((m) => m.count)).toEqual([0, 0, 0]);
    expect(added).toHaveLength(9);
  });
});

describe("the odds and the local game", () => {
  it("the odds shown before you sail count the Watchtowers", () => {
    expect(attackInput(carrying(moored(), A, "watchtower", 2), emptyTroops()).watchtowers).toBe(2);
  });

  it("a building put on a raft in the local game is saved on this device and stands there after time away", () => {
    const t0 = Date.UTC(2026, 9, 17, 12);
    const store = memoryStore();
    saveGame(store, locally(moored(), { type: "installOnRaft", slot: A, building: "watchtower" }), t0);
    const back = openSave(store, t0 + RAFT_INSTALL_TIME * 1000);
    expect(back.rejected).toBe(false);
    expect(back.state.rafts[A]).toEqual({ hp: RAFT_MAX_HP, building: "watchtower", level: 1 });
    expect(back.state.yard).toBeNull();
    expect(store.data.has(SAVE_KEY)).toBe(true);
  });
});
