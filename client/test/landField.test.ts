import { describe, expect, it } from "vitest";
import { ground, landDepth, type LandSlots } from "../src/city/land/field.js";
import CASES from "./fixtures/land.json";

type Case = LandSlots & { points: [number, number][]; depth: number[]; mine: number[]; y: number[] };

describe("the land won on the sea: the game's field is the one Blender drew (assets/blender/reclaim.py)", () => {
  it("the same depth, dike and height at 1,200 points of three cities (Lighthouse 5, 15 and 30)", () => {
    let worst = 0;
    for (const c of CASES as unknown as Case[]) {
      c.points.forEach(([x, z], i) => {
        const d = landDepth(x, z, c);
        const g = ground(x, z, c);
        worst = Math.max(worst, Math.abs(d.depth - c.depth[i]!), Math.abs(d.mine - c.mine[i]!), Math.abs(g.y - c.y[i]!));
      });
    }
    expect(worst).toBeLessThan(1e-6);
  });
});
