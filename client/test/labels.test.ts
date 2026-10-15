import { describe, expect, it } from "vitest";
import { GAP, layoutLabels, type LabelBox } from "../src/city/overlap.js";

/** A label 80 × 20, whose badge is 24 × 20. */
const box = (id: string, x: number, y: number, depth: number, extra: Partial<LabelBox> = {}): LabelBox => ({
  id,
  x,
  y,
  w: 80,
  h: 20,
  depth,
  compactW: 24,
  compactH: 20,
  ...extra,
});

describe("city labels layout", () => {
  it("labels apart stay where they are", () => {
    const r = layoutLabels([box("a", 100, 100, 0.5), box("b", 300, 100, 0.6)]);
    expect(r).toEqual({ a: { dy: 0, compact: false }, b: { dy: 0, compact: false } });
  });

  it("the farther of two overlapping labels moves up just above the nearer one", () => {
    const r = layoutLabels([box("far", 110, 105, 0.9), box("near", 100, 110, 0.5)]);
    expect(r.near).toEqual({ dy: 0, compact: false });
    // The near label's top is at 110 - 20 = 90: the far one ends GAP above it, 17 px up.
    expect(r.far).toEqual({ dy: 90 - GAP - 105, compact: false });
  });

  it("the order is by distance, not by the order given", () => {
    const a = layoutLabels([box("x", 100, 100, 0.2), box("y", 100, 100, 0.8)]);
    const b = layoutLabels([box("y", 100, 100, 0.8), box("x", 100, 100, 0.2)]);
    expect(a).toEqual(b);
    expect(a.x!.dy).toBe(0);
  });

  it("when moving up by one label height is not enough, the farther label becomes a badge", () => {
    // Two near labels stacked above the anchor: going past both would take more than 20 px.
    const r = layoutLabels([box("n1", 100, 100, 0.1), box("n2", 100, 78, 0.2), box("far", 140, 100, 0.9)]);
    expect(r.far!.compact).toBe(true);
  });

  it("a badge beside the crowd stays on its anchor", () => {
    const r = layoutLabels([box("n1", 100, 100, 0.1), box("n2", 100, 78, 0.2), box("far", 160, 100, 0.9)]);
    expect(r.far).toEqual({ dy: 0, compact: true });
  });

  it("a badge that still cannot fit stays on its anchor rather than floating away", () => {
    const wall = [box("n1", 100, 100, 0.1), box("n2", 100, 78, 0.2), box("n3", 100, 56, 0.3)];
    const r = layoutLabels([...wall, box("far", 100, 100, 0.9)]);
    expect(r.far).toEqual({ dy: 0, compact: true });
  });

  it("the building you tapped keeps its full label, laid out first", () => {
    const r = layoutLabels([box("near", 100, 100, 0.1), box("tapped", 100, 100, 0.9)], "tapped");
    expect(r.tapped).toEqual({ dy: 0, compact: false });
    // The nearer label gives way: it would have to move 22 px up, more than its 20 px height.
    expect(r.near!.compact).toBe(true);
  });

  it("no label ever ends more than one label height from its anchor", () => {
    // A crowded island seen from far away: 40 labels piled in a small area, in a fixed pattern.
    const boxes: LabelBox[] = [];
    for (let i = 0; i < 40; i++) {
      const h = 18 + (i % 3) * 6;
      boxes.push(box(`l${i}`, 150 + ((i * 37) % 90), 300 + ((i * 53) % 70), (i * 7) % 40, { h, w: 60 + (i % 4) * 15, compactH: 18 }));
    }
    for (const pinned of [null, "l7"]) {
      const r = layoutLabels(boxes, pinned);
      for (const b of boxes) {
        const p = r[b.id]!;
        expect(p.dy).toBeLessThanOrEqual(0);
        expect(-p.dy).toBeLessThanOrEqual(p.compact ? b.compactH : b.h);
      }
    }
  });

  it("no labels, no layout", () => {
    expect(layoutLabels([])).toEqual({});
  });
});
