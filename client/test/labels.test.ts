import { describe, expect, it } from "vitest";
import { GAP, layoutLabels, type LabelBox, type LabelPlace } from "../src/city/overlap.js";

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
    expect(r).toEqual({ a: { dy: 0, compact: false, hidden: false }, b: { dy: 0, compact: false, hidden: false } });
  });

  it("the farther of two overlapping labels moves up just above the nearer one", () => {
    const r = layoutLabels([box("far", 110, 105, 0.9), box("near", 100, 110, 0.5)]);
    expect(r.near).toEqual({ dy: 0, compact: false, hidden: false });
    // The near label's top is at 110 - 20 = 90: the far one ends GAP above it, 17 px up.
    expect(r.far).toEqual({ dy: 90 - GAP - 105, compact: false, hidden: false });
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
    expect(r.far).toEqual({ dy: 0, compact: true, hidden: false });
  });

  it("a badge that still cannot fit is hidden, rather than covering a label or floating away", () => {
    const wall = [box("n1", 100, 100, 0.1), box("n2", 100, 78, 0.2), box("n3", 100, 56, 0.3)];
    const r = layoutLabels([...wall, box("far", 100, 100, 0.9)]);
    expect(r.far).toEqual({ dy: 0, compact: true, hidden: true });
    for (const id of ["n1", "n2", "n3"]) expect(r[id]!.hidden).toBe(false);
  });

  it("seen on the phone: a badge beside the Lighthouse's label, with no room above, is hidden instead of covering its end", () => {
    // "Lighthouse 4" (98 × 22), and the badge "1" of a farther building anchored on its right end, under a third label.
    const lighthouse = box("lighthouse", 200, 365, 0.2, { w: 98, h: 22, compactW: 26, compactH: 22 });
    const above = box("infirmary", 225, 322, 0.3, { w: 80, h: 22, compactW: 26, compactH: 22 });
    const badge = box("barracks", 240, 366, 0.6, { w: 82, h: 22, compactW: 26, compactH: 22 });
    const r = layoutLabels([lighthouse, above, badge]);
    expect(r.lighthouse).toEqual({ dy: 0, compact: false, hidden: false });
    expect(r.barracks!.hidden).toBe(true);
  });

  it("the building you tapped keeps its full label, laid out first", () => {
    const r = layoutLabels([box("near", 100, 100, 0.1), box("tapped", 100, 100, 0.9)], "tapped");
    expect(r.tapped).toEqual({ dy: 0, compact: false, hidden: false });
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

  it("a label never covers another one, and the building you tapped always keeps its label", () => {
    const rect = (b: LabelBox, p: LabelPlace) => {
      const [w, h] = p.compact ? [b.compactW, b.compactH] : [b.w, b.h];
      return { left: b.x - w / 2, right: b.x + w / 2, top: b.y + p.dy - h, bottom: b.y + p.dy };
    };
    // Crowded islands seen from many angles: 9 labels in a small area, in fixed patterns.
    for (let seed = 1; seed <= 200; seed++) {
      const boxes: LabelBox[] = [];
      for (let i = 0; i < 9; i++) {
        const k = seed * 31 + i * 17;
        boxes.push(box(`l${i}`, 120 + ((k * 37) % 170), 300 + ((k * 53) % 120), (k * 7) % 40, { w: 50 + (k % 5) * 12, h: 20 + (k % 2) * 24, compactW: 26, compactH: 20 + (k % 2) * 24 }));
      }
      for (const pinned of [null, "l4"]) {
        const r = layoutLabels(boxes, pinned);
        if (pinned) expect(r[pinned]).toMatchObject({ compact: false, hidden: false });
        const shown = boxes.filter((b) => !r[b.id]!.hidden).map((b) => ({ id: b.id, ...rect(b, r[b.id]!) }));
        for (const a of shown)
          for (const c of shown) {
            if (a.id >= c.id) continue;
            const apart = a.right + GAP <= c.left || c.right + GAP <= a.left || a.bottom + GAP <= c.top || c.bottom + GAP <= a.top;
            expect(apart, `seed ${seed}, pinned ${pinned}: ${a.id} and ${c.id}`).toBe(true);
          }
      }
    }
  });

  it("no labels, no layout", () => {
    expect(layoutLabels([])).toEqual({});
  });

  describe("week 8: level badges by default, never under a panel", () => {
    const panel = { left: 0, right: 400, top: 0, bottom: 80 };

    it("a label shows in full only when it may (touched, at work, suggested, just upgraded); the others are badges", () => {
      const r = layoutLabels([box("a", 100, 200, 0.5), box("b", 300, 200, 0.6)], null, { full: new Set(["b"]) });
      expect(r.a).toEqual({ dy: 0, compact: true, hidden: false });
      expect(r.b).toEqual({ dy: 0, compact: false, hidden: false });
    });

    it("a label under a panel is moved up past it if it can, else hidden; one above the panel's bottom edge is hidden", () => {
      // Its bottom at 90: its badge (20 high) would reach up to 70, under the panel, and cannot move down.
      const r = layoutLabels([box("a", 100, 90, 0.5)], null, { full: new Set(), panels: [panel] });
      expect(r.a!.hidden).toBe(true);
      const clear = layoutLabels([box("a", 100, 120, 0.5)], null, { full: new Set(), panels: [panel] });
      expect(clear.a).toEqual({ dy: 0, compact: true, hidden: false });
    });

    it("the label of the building touched keeps its full size, unless that would put it under a panel", () => {
      const r = layoutLabels([box("a", 100, 200, 0.5)], "a", { full: new Set(), panels: [panel] });
      expect(r.a).toEqual({ dy: 0, compact: false, hidden: false });
      const under = layoutLabels([box("a", 100, 95, 0.5)], "a", { full: new Set(), panels: [panel] });
      expect(under.a!.compact || under.a!.hidden).toBe(true);
    });

    it("a label at the bottom moves up above a panel by one label at most", () => {
      const quest = { left: 0, right: 400, top: 700, bottom: 800 };
      // Its bottom at 710, inside the quest card: it moves up so its bottom is GAP above the card's top.
      const r = layoutLabels([box("a", 100, 710, 0.5)], null, { full: new Set(), panels: [quest] });
      expect(r.a).toEqual({ dy: 700 - GAP - 710, compact: true, hidden: false });
    });
  });
});

