import { describe, expect, it } from "vitest";
import { COAST_GAP, PLOT_LAND, RAFT_FILL, coastAt, plotsEdge, raftsEdge } from "../src/scene/coast.js";

describe("the island's coast follows the grid", () => {
  it("lies short of the rooms of the rafts of ring 3, unless a plot needs the land", () => {
    // Toward a corner of the grid (+x), the first raft room begins at 6 − RAFT_FILL.
    expect(raftsEdge(0)).toBeCloseTo(6 - RAFT_FILL, 2);
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      expect(coastAt(a), `${i * 5}°`).toBeGreaterThanOrEqual(plotsEdge(a) + PLOT_LAND - 1e-9);
      // Short of the rafts wherever the plots leave room for it.
      if (plotsEdge(a) + PLOT_LAND < raftsEdge(a) - COAST_GAP - 0.3) expect(coastAt(a), `${i * 5}°`).toBeLessThanOrEqual(raftsEdge(a) - COAST_GAP + 1e-9);
    }
  });
});
