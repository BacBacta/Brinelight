import { describe, expect, it } from "vitest";
import { GAP, MAX_SHIFT, layoutLabels, type LabelBox } from "../src/city/overlap.js";

const box = (id: string, x: number, y: number, depth: number, extra: Partial<LabelBox> = {}): LabelBox => ({ id, x, y, w: 80, h: 20, depth, ...extra });

describe("city labels layout", () => {
  it("labels apart stay where they are", () => {
    const r = layoutLabels([box("a", 100, 100, 0.5), box("b", 300, 100, 0.6)]);
    expect(r).toEqual({ a: { dy: 0, compact: false }, b: { dy: 0, compact: false } });
  });

  it("the farther of two overlapping labels moves up, above the nearer one", () => {
    const r = layoutLabels([box("far", 110, 105, 0.9), box("near", 100, 110, 0.5)]);
    expect(r.near).toEqual({ dy: 0, compact: false });
    // The near label's top is at 110 - 20 = 90: the far one ends GAP above it.
    expect(r.far!.dy).toBe(90 - GAP - 105);
    expect(r.far!.compact).toBe(false);
  });

  it("the order is by distance, not by the order given", () => {
    const a = layoutLabels([box("x", 100, 100, 0.2), box("y", 100, 100, 0.8)]);
    const b = layoutLabels([box("y", 100, 100, 0.8), box("x", 100, 100, 0.2)]);
    expect(a).toEqual(b);
    expect(a.x!.dy).toBe(0);
    expect(a.y!.dy).toBeLessThan(0);
  });

  it("moves past several labels in a row when there is room", () => {
    const r = layoutLabels([box("n1", 100, 100, 0.1), box("n2", 100, 80 - GAP, 0.2), box("far", 100, 100, 0.9)]);
    expect(r.n2!.dy).toBe(0);
    expect(r.far!.dy).toBeLessThan(0);
    expect(-r.far!.dy).toBeLessThanOrEqual(MAX_SHIFT);
  });

  it("a building not built yet is reduced to its + icon when moving up is not enough", () => {
    // A wall of near labels above: no room within MAX_SHIFT. The reduced "+" fits beside them.
    const near = [box("n1", 100, 100, 0.1), box("n2", 100, 78, 0.2), box("n3", 100, 56, 0.3)];
    const r = layoutLabels([...near, box("new", 160, 100, 0.9, { w: 120, compactW: 24 })]);
    expect(r.new).toEqual({ dy: 0, compact: true });
  });

  it("a built building is never reduced; it moves up at most MAX_SHIFT", () => {
    const near = [box("n1", 100, 100, 0.1), box("n2", 100, 78, 0.2), box("n3", 100, 56, 0.3)];
    const r = layoutLabels([...near, box("built", 100, 100, 0.9)]);
    expect(r.built).toEqual({ dy: -MAX_SHIFT, compact: false });
  });

  it("a reduced label still moves up if its icon touches a nearer label", () => {
    const near = [box("n1", 100, 100, 0.1), box("n2", 100, 78, 0.2), box("n3", 100, 56, 0.3)];
    const r = layoutLabels([...near, box("wide", 300, 100, 0.4, { w: 200 }), box("new", 150, 100, 0.9, { w: 200, compactW: 24 })]);
    expect(r.new!.compact).toBe(true);
  });

  it("no labels, no layout", () => {
    expect(layoutLabels([])).toEqual({});
  });
});
