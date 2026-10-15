/** Keeps the city labels readable: a pure layout, from the nearest label to the farthest. */

/** A label before layout: anchored at its bottom center (x, y), in screen pixels. */
export type LabelBox = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Larger is farther from the camera. */
  depth: number;
  /** Width once reduced to a "+" icon; only for buildings not built yet. */
  compactW?: number;
};

/** Where a label ends up: moved up by `dy` pixels (negative), and maybe reduced to its icon. */
export type LabelPlace = { dy: number; compact: boolean };

/** A label is moved up at most this far before it gets reduced. */
export const MAX_SHIFT = 40;
/** Space kept between two labels. */
export const GAP = 2;

type Rect = { left: number; right: number; top: number; bottom: number };

const rectOf = (b: LabelBox, dy: number, compact: boolean): Rect => {
  const w = compact && b.compactW !== undefined ? b.compactW : b.w;
  return { left: b.x - w / 2, right: b.x + w / 2, top: b.y + dy - b.h, bottom: b.y + dy };
};

const overlaps = (a: Rect, b: Rect): boolean =>
  a.left < b.right + GAP && b.left < a.right + GAP && a.top < b.bottom + GAP && b.top < a.bottom + GAP;

/** Moves a label up past every placed label it touches, up to MAX_SHIFT; null if it still touches one. */
function lift(b: LabelBox, compact: boolean, placed: Rect[]): { dy: number; rect: Rect } | null {
  let dy = 0;
  for (let i = 0; i <= placed.length; i++) {
    const rect = rectOf(b, dy, compact);
    const hit = placed.find((p) => overlaps(rect, p));
    if (!hit) return { dy, rect };
    dy = hit.top - GAP - b.y;
    if (-dy > MAX_SHIFT) return null;
  }
  return null;
}

/**
 * Lays out the labels from the nearest to the farthest. A label that touches a nearer one is moved up;
 * if that is not enough, a label of a building not built yet is reduced to its "+" icon (and moved up if needed).
 * A label that still cannot fit stays at its last try, moved up by MAX_SHIFT at most.
 */
export function layoutLabels(boxes: readonly LabelBox[]): Record<string, LabelPlace> {
  const out: Record<string, LabelPlace> = {};
  const placed: Rect[] = [];
  for (const b of [...boxes].sort((a, c) => a.depth - c.depth)) {
    const full = lift(b, false, placed);
    const small = full || b.compactW === undefined ? null : lift(b, true, placed);
    const pick = full ? { ...full, compact: false } : small ? { ...small, compact: true } : null;
    const place = pick ?? { dy: -MAX_SHIFT, compact: b.compactW !== undefined, rect: rectOf(b, -MAX_SHIFT, b.compactW !== undefined) };
    placed.push(place.rect);
    out[b.id] = { dy: place.dy, compact: place.compact };
  }
  return out;
}
