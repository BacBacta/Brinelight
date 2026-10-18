/**
 * Reads the shapes of a .glb file into three.js objects, for the tests: nodes (matrix or translation, rotation, scale)
 * and the positions and indices of their meshes, quantized (KHR_mesh_quantization) or not. No texture, no material.
 */
import { readFileSync } from "node:fs";
import * as THREE from "three";

type Accessor = { bufferView: number; byteOffset?: number; componentType: number; count: number; type: string; normalized?: boolean };
type Node = { mesh?: number; children?: number[]; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] };
type Gltf = {
  scenes: { name?: string; nodes: number[] }[];
  nodes: Node[];
  meshes: { primitives: { attributes: { POSITION: number }; indices?: number }[] }[];
  accessors: Accessor[];
  bufferViews: { byteOffset?: number; byteStride?: number }[];
};

/** Bytes per component, and how to read one, by glTF component type. */
const COMPONENTS: Record<number, { bytes: number; read: (dv: DataView, at: number) => number }> = {
  5120: { bytes: 1, read: (dv, at) => dv.getInt8(at) },
  5121: { bytes: 1, read: (dv, at) => dv.getUint8(at) },
  5122: { bytes: 2, read: (dv, at) => dv.getInt16(at, true) },
  5123: { bytes: 2, read: (dv, at) => dv.getUint16(at, true) },
  5125: { bytes: 4, read: (dv, at) => dv.getUint32(at, true) },
  5126: { bytes: 4, read: (dv, at) => dv.getFloat32(at, true) },
};
const SIZES: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

export function readGlb(file: string): { gltf: Gltf; scenes: Record<string, THREE.Object3D> } {
  const bytes = readFileSync(file);
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength)) as Gltf;
  const binStart = 20 + jsonLength + 8;
  const bin = bytes.buffer.slice(bytes.byteOffset + binStart, bytes.byteOffset + bytes.length);

  const read = (index: number, attribute: boolean): THREE.BufferAttribute => {
    const a = gltf.accessors[index]!;
    const view = gltf.bufferViews[a.bufferView]!;
    const c = COMPONENTS[a.componentType]!;
    const size = SIZES[a.type]!;
    const stride = view.byteStride ?? c.bytes * size;
    const start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const dv = new DataView(bin);
    // Integers stay integers (normalized ones are read as such by three.js); indices too.
    const out = a.componentType === 5126 ? new Float32Array(a.count * size) : a.componentType === 5122 ? new Int16Array(a.count * size) : new Uint32Array(a.count * size);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < size; k++) out[i * size + k] = c.read(dv, start + i * stride + k * c.bytes);
    return new THREE.BufferAttribute(out, size, attribute && !!a.normalized);
  };

  const build = (index: number): THREE.Object3D => {
    const n = gltf.nodes[index]!;
    const o = new THREE.Group();
    if (n.matrix) new THREE.Matrix4().fromArray(n.matrix).decompose(o.position, o.quaternion, o.scale);
    if (n.translation) o.position.fromArray(n.translation);
    if (n.rotation) o.quaternion.fromArray(n.rotation);
    if (n.scale) o.scale.fromArray(n.scale);
    if (n.mesh !== undefined)
      for (const p of gltf.meshes[n.mesh]!.primitives) {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", read(p.attributes.POSITION, true));
        if (p.indices !== undefined) g.setIndex(read(p.indices, false));
        o.add(new THREE.Mesh(g));
      }
    for (const c of n.children ?? []) o.add(build(c));
    return o;
  };

  const scenes: Record<string, THREE.Object3D> = {};
  gltf.scenes.forEach((s, i) => {
    const g = new THREE.Group();
    for (const n of s.nodes) g.add(build(n));
    scenes[s.name ?? String(i)] = g;
  });
  return { gltf, scenes };
}
