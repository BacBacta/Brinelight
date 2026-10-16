/** Keeps the city labels readable and close to their building: a pure layout, from the nearest label to the farthest. */

/** A label before layout: anchored at its bottom center (x, y), in screen pixels. */
export type LabelBox = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Larger is farther from the camera. */
  depth: number;
  /** Size once reduced to a badge: just the level, or "+" for a building not built yet. */
  compactW: number;
  compactH: number;
};

/**
 * Where a label ends up: moved up by `dy` pixels (zero or negative), maybe reduced to its badge,
 * or hidden when even its badge would cover another label.
 */
export type LabelPlace = { dy: number; compact: boolean; hidden: boolean };

/** Space kept between two labels. */
export const GAP = 2;

type Rect = { left: number; right: number; top: number; bottom: number };

const size = (b: LabelBox, compact: boolean) => (compact ? { w: b.compactW, h: b.compactH } : { w: b.w, h: b.h });

const rectOf = (b: LabelBox, dy: number, compact: boolean): Rect => {
  const { w, h } = size(b, compact);
  return { left: b.x - w / 2, right: b.x + w / 2, top: b.y + dy - h, bottom: b.y + dy };
};

const overlaps = (a: Rect, b: Rect): boolean =>
  a.left < b.right + GAP && b.left < a.right + GAP && a.top < b.bottom + GAP && b.top < a.bottom + GAP;

/**
 * Moves a label up past the placed labels it touches, but never by more than its own height,
 * so it always stays next to its building. Null if it still touches one.
 */
function lift(b: LabelBox, compact: boolean, placed: Rect[]): { dy: number; rect: Rect } | null {
  const limit = size(b, compact).h;
  let dy = 0;
  for (let i = 0; i <= placed.length; i++) {
    const rect = rectOf(b, dy, compact);
    const hit = placed.find((p) => overlaps(rect, p));
    if (!hit) return { dy, rect };
    dy = hit.top - GAP - b.y;
    if (-dy > limit) return null;
  }
  return null;
}

/**
 * Lays out the labels from the nearest to the farthest. A label that touches a nearer one moves up, by one label
 * height at most; if that is not enough, it becomes a badge (its level, or "+"), moved up the same way if needed.
 * A badge that still cannot fit is hidden: a label never covers another one. It comes back as soon as the camera
 * makes room, and its building can still be tapped. The `pinned` label (the building you tapped) is laid out
 * first and keeps its full size.
 */
export function layoutLabels(boxes: readonly LabelBox[], pinned: string | null = null): Record<string, LabelPlace> {
  const out: Record<string, LabelPlace> = {};
  const placed: Rect[] = [];
  const order = [...boxes].sort((a, c) => (a.id === pinned ? -1 : c.id === pinned ? 1 : a.depth - c.depth));
  for (const b of order) {
    const full = lift(b, false, placed);
    if (full || b.id === pinned) {
      const place = full ?? { dy: 0, rect: rectOf(b, 0, false) };
      placed.push(place.rect);
      out[b.id] = { dy: place.dy, compact: false, hidden: false };
      continue;
    }
    const small = lift(b, true, placed);
    if (!small) {
      out[b.id] = { dy: 0, compact: true, hidden: true };
      continue;
    }
    placed.push(small.rect);
    out[b.id] = { dy: small.dy, compact: true, hidden: false };
  }
  return out;
}
