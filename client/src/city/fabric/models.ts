/**
 * The city fabric's models (assets/blender/fabric_models.py: client/public/city/fabric-<era>.bin) and their merging:
 * every still piece of the fabric in one mesh, its windows in a second (they light in the Mist), the turbines' rotors
 * apart (they turn). Pure: arrays in, arrays out, no three.js, so the tests read it as the game does.
 */
import type { FabricPlan, Piece } from "./plan.js";

/** A part of a model: positions, normals, colors (linear) and indices. */
export type Part = { position: Float32Array; normal: Float32Array; color: Float32Array; index: Uint16Array };
export type FabricModel = { body?: Part; windows?: Part };
export type FabricModels = Record<string, FabricModel>;

const linear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

/** Reads a fabric file. */
export function readFabric(buffer: ArrayBuffer): FabricModels {
  const view = new DataView(buffer);
  if (String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)) !== "BLFB") throw new Error("Not a fabric file");
  const headLength = view.getUint32(4, true);
  const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 8, headLength))) as { scale: number; vertices: number; indices: number; models: Record<string, Record<"body" | "windows", [number, number, number, number]>> };
  const n = head.vertices;
  const pad = (k: number) => Math.ceil(k / 4) * 4;
  let at = 8 + headLength;
  const pos = new Int16Array(buffer.slice(at, at + n * 6));
  at += pad(n * 6);
  const nor = new Int8Array(buffer.slice(at, at + n * 3));
  at += pad(n * 3);
  const col = new Uint8Array(buffer.slice(at, at + n * 3));
  at += pad(n * 3);
  const idx = new Uint16Array(buffer.slice(at, at + head.indices * 2));
  const out: FabricModels = {};
  for (const [name, parts] of Object.entries(head.models)) {
    const model: FabricModel = {};
    for (const kind of ["body", "windows"] as const) {
      const p = parts[kind];
      if (!p) continue;
      const [v0, vn, i0, iN] = p;
      const part: Part = { position: new Float32Array(vn * 3), normal: new Float32Array(vn * 3), color: new Float32Array(vn * 3), index: idx.slice(i0, i0 + iN) };
      for (let i = 0; i < vn * 3; i++) {
        part.position[i] = pos[v0 * 3 + i]! / head.scale;
        part.normal[i] = nor[v0 * 3 + i]! / 127;
        part.color[i] = linear(col[v0 * 3 + i]!);
      }
      model[kind] = part;
    }
    out[name] = model;
  }
  return out;
}

/** A merged mesh's arrays; `lit`, for the windows: when each vertex's window lights (0 first, 1 last). */
export type Merged = { position: Float32Array; normal: Float32Array; color: Float32Array; lit: Float32Array; index: Uint32Array };

class Builder {
  position: number[] = [];
  normal: number[] = [];
  color: number[] = [];
  lit: number[] = [];
  index: number[] = [];
  add(part: Part, x: number, y: number, z: number, turn: number, scale: number, lit: number) {
    const base = this.position.length / 3;
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    for (let i = 0; i < part.position.length; i += 3) {
      const [px, py, pz] = [part.position[i]! * scale, part.position[i + 1]! * scale, part.position[i + 2]! * scale];
      // A turn around the vertical axis, as three.js's (and Blender's) positive turn.
      this.position.push(x + px * c + pz * s, y + py, z - px * s + pz * c);
      const [nx, ny, nz] = [part.normal[i]!, part.normal[i + 1]!, part.normal[i + 2]!];
      this.normal.push(nx * c + nz * s, ny, -nx * s + nz * c);
      this.color.push(part.color[i]!, part.color[i + 1]!, part.color[i + 2]!);
      this.lit.push(lit);
    }
    for (let i = 0; i < part.index.length; i++) this.index.push(base + part.index[i]!);
  }
  /** A box from (ax, ay, az) to (bx, by, bz), `w` thick, one color: a power line. */
  line(a: readonly [number, number, number], b: readonly [number, number, number], w: number, rgb: readonly [number, number, number]) {
    const [dx, dy, dz] = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const len = Math.hypot(dx, dz) || 1;
    // Its side, flat across the line, and up.
    const [sx, sz] = [(-dz / len) * w, (dx / len) * w];
    const corners = [
      [a[0] + sx, a[1], a[2] + sz],
      [b[0] + sx, b[1] + dy * 0, b[2] + sz],
      [b[0] - sx, b[1], b[2] - sz],
      [a[0] - sx, a[1], a[2] - sz],
    ];
    const base = this.position.length / 3;
    for (const [x, y, z] of corners) {
      this.position.push(x!, y!, z!);
      this.normal.push(0, 1, 0);
      this.color.push(...rgb);
      this.lit.push(1);
    }
    this.index.push(base, base + 1, base + 2, base, base + 2, base + 3, base, base + 2, base + 1, base, base + 3, base + 2);
  }
  /**
   * A raised row of a field along `points` (x, y, z: its foot): a low ridge `w` wide on either side, `h` high at each
   * point, darker at its foot than on its top (linear colors).
   */
  ridge(points: readonly (readonly [number, number, number])[], w: number, h: readonly number[], top: readonly [number, number, number], foot: readonly [number, number, number]) {
    const base = this.position.length / 3;
    points.forEach(([x, y, z], i) => {
      const [ax, az] = i + 1 < points.length ? [points[i + 1]![0] - x, points[i + 1]![2] - z] : [x - points[i - 1]![0], z - points[i - 1]![2]];
      const len = Math.hypot(ax, az) || 1;
      // Across the row, and each slope's normal (up and out).
      const [sx, sz] = [-az / len, ax / len];
      const k = Math.hypot(w, h[i]!) || 1;
      for (const side of [1, -1]) {
        const [ox, oz] = [sx * side, sz * side];
        const normal = [(ox * h[i]!) / k, w / k, (oz * h[i]!) / k];
        this.position.push(x + ox * w, y, z + oz * w, x, y + h[i]!, z);
        this.normal.push(...normal, ...normal);
        this.color.push(...foot, ...top);
        this.lit.push(1, 1);
      }
    });
    // Four vertices a point: the left foot and top, the right foot and top.
    for (let i = 0; i + 1 < points.length; i++) {
      const [a, b] = [base + i * 4, base + (i + 1) * 4];
      this.index.push(a, b, b + 1, a, b + 1, a + 1, a + 2, a + 3, b + 3, a + 2, b + 3, b + 2);
    }
    // Its two ends.
    const last = base + (points.length - 1) * 4;
    this.index.push(base, base + 1, base + 2, last, last + 2, last + 1);
  }
  done(): Merged {
    return { position: new Float32Array(this.position), normal: new Float32Array(this.normal), color: new Float32Array(this.color), lit: new Float32Array(this.lit), index: new Uint32Array(this.index) };
  }
}

const linearHex = (hex: string): [number, number, number] => [1, 3, 5].map((i) => linear(parseInt(hex.slice(i, i + 2), 16))) as [number, number, number];
const scaled = (c: readonly number[], k: number) => c.map((v) => Math.min(1, v * k)) as [number, number, number];
/** A row's height and half width: the vegetables stand higher than the kelp laid on the sand. */
const ROW_SHAPE = { garden: { h: 0.04, w: 0.045 }, kelp: { h: 0.018, w: 0.032 } } as const;

/** The pieces that move: drawn apart. */
export const MOVING = new Set(["turbine-rotor"]);
/** Where a turbine's rotor turns, from its mast's foot (its hub, in front of the mast's top). */
export const ROTOR_AT = [0, 1.3, 0.08] as const;
/** The power lines' height at their poles, and their color (dark, linear). */
const WIRE_Y = 0.46;
const WIRE = [0.024, 0.016, 0.009] as const;

/**
 * The fabric of a plan as meshes: its still pieces in `body`, their windows in `windows` (each vertex with its piece's
 * `lit`), and the turbines' rotors (their hubs and turns). `height`: the ground's height at (x, z) for a piece.
 */
export function mergeFabric(plan: FabricPlan, models: FabricModels, height: (p: Piece) => number): { body: Merged; windows: Merged; rotors: { x: number; y: number; z: number; turn: number }[]; triangles: number } {
  const body = new Builder();
  const windows = new Builder();
  const rotors: { x: number; y: number; z: number; turn: number }[] = [];
  for (const p of plan.pieces) {
    const m = models[p.model];
    if (!m) continue;
    const y = height(p);
    if (m.body) body.add(m.body, p.x, y, p.z, p.turn, p.scale, p.lit);
    if (m.windows) windows.add(m.windows, p.x, y, p.z, p.turn, p.scale, p.lit);
    if (p.model === "turbine-mast") {
      const [c, s] = [Math.cos(p.turn), Math.sin(p.turn)];
      rotors.push({ x: p.x + ROTOR_AT[2] * s, y: y + ROTOR_AT[1], z: p.z + ROTOR_AT[2] * c, turn: p.turn });
    }
  }
  for (const row of plan.rows) {
    const shape = ROW_SHAPE[row.kind];
    const c = linearHex(row.color);
    const points = row.points.map(([x, z]) => [x, height({ model: "row", x, z, turn: 0, scale: 1, lit: 1 }) - 0.004, z] as const);
    // Each plant a little higher or lower than the next; the row's ends lower.
    const h = row.points.map(([x, z], i) => shape.h * (0.75 + 0.5 * (Math.sin(x * 41.3 + z * 17.9) * 0.5 + 0.5)) * (i === 0 || i === row.points.length - 1 ? 0.6 : 1));
    body.ridge(points, shape.w, h, scaled(c, 1.25), scaled(c, 0.7));
  }
  for (const [ax, az, bx, bz] of plan.wires) {
    const ya = height({ model: "pole", x: ax, z: az, turn: 0, scale: 1, lit: 1 }) + WIRE_Y;
    const yb = height({ model: "pole", x: bx, z: bz, turn: 0, scale: 1, lit: 1 }) + WIRE_Y;
    body.line([ax, ya, az], [bx, yb, bz], 0.004, WIRE);
  }
  const b = body.done();
  const w = windows.done();
  const rotor = models["turbine-rotor"]?.body;
  const triangles = (b.index.length + w.index.length) / 3 + (rotor ? (rotor.index.length / 3) * rotors.length : 0);
  return { body: b, windows: w, rotors, triangles };
}
