"""
Serves the models the Blender scripts made (assets/blender/out/, not committed) to the game (client/public/city/), the
same way make-models.py serves the Meshy ones: the texture as a WebP (512 px, 1,024 for the island), quality 82, the
geometry quantized. Writes their measures in client/src/scene/city-models.json, which the game and its tests read.

    python3 assets/blender/serve.py [name ...]

A building's details carry the level they appear at (`_LEVEL`, kit.tag). Its triangles are ordered by that level, so
the game draws a level as one range of the mesh: `levels` lists, for each level where something appears, how many
indices to draw, and the model's height and reach on its plot (hex distance) up to that level.
"""
import importlib.util
import io
import json
import sys
from pathlib import Path

from PIL import Image

here = Path(__file__).resolve().parent
root = here.parent.parent
spec = importlib.util.spec_from_file_location("make_models", here.parent / "make-models.py")
mm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mm)

RAW = here / "out"
SERVED = root / "client" / "public" / "city"
MANIFEST = root / "client" / "src" / "scene" / "city-models.json"
TEXTURE = {"island": 1024, **{f"ground-{e}": 1024 for e in (1, 5, 10, 15, 20, 25)}}


def hex_reach(x, z):
    return max(abs(x), abs(x / 2 + z * 0.866), abs(-x / 2 + z * 0.866))


def serve(name):
    doc, binary = mm.read_glb(RAW / f"{name}.glb")
    assert len(doc["meshes"]) == 1 and len(doc["meshes"][0]["primitives"]) == 1 and len(doc["images"]) == 1, f"{name}: one mesh, one texture expected"
    prim = doc["meshes"][0]["primitives"][0]
    attrs = prim["attributes"]
    positions = mm.accessor(doc, binary, attrs["POSITION"])
    normals = mm.accessor(doc, binary, attrs["NORMAL"])
    uvs = mm.accessor(doc, binary, attrs["TEXCOORD_0"])
    levels = [round(v[0]) for v in mm.accessor(doc, binary, attrs["_LEVEL"])] if "_LEVEL" in attrs else [0] * len(positions)
    indices = [i[0] for i in mm.accessor(doc, binary, prim["indices"])]
    # The node's own transform, if the exporter left one: the scripts apply theirs, so none is expected.
    assert all(k not in doc["nodes"][0] for k in ("matrix", "rotation", "scale", "translation")), f"{name}: transforms must be applied"

    # Triangles in the order of the level they appear at; within a level, as they came.
    tris = [indices[t : t + 3] for t in range(0, len(indices), 3)]
    tris.sort(key=lambda t: max(levels[i] for i in t))
    order_levels = [max(levels[i] for i in t) for t in tris]

    lo = [min(p[k] for p in positions) for k in range(3)]
    hi = [max(p[k] for p in positions) for k in range(3)]
    center = [(lo[k] + hi[k]) / 2 for k in range(3)]
    half = max((hi[k] - lo[k]) / 2 for k in range(3))
    qpos = [tuple(round((p[k] - center[k]) / half * 32767) for k in range(3)) for p in positions]
    qnor = []
    for n in normals:
        length = sum(c * c for c in n) ** 0.5 or 1
        qnor.append(tuple(mm.clamp(round(c / length * 127), -127, 127) for c in n))
    assert all(-1e-6 <= c <= 1 + 1e-6 for uv in uvs for c in uv), f"{name}: texture coordinates outside 0..1"
    quv = [tuple(mm.clamp(round(c * 65535), 0, 65535) for c in uv) for uv in uvs]
    seen, order, remap = {}, [], []
    for v in zip(qpos, qnor, quv):
        if v not in seen:
            seen[v] = len(order)
            order.append(v)
        remap.append(seen[v])
    assert len(order) < 65536, f"{name}: too many vertices for 16-bit indices"
    flat = [remap[i] for t in tris for i in t]

    image = doc["images"][0]
    view = doc["bufferViews"][image["bufferView"]]
    src = binary[view.get("byteOffset", 0) : view.get("byteOffset", 0) + view["byteLength"]]
    webp = io.BytesIO()
    size = TEXTURE.get(name, 512)
    Image.open(io.BytesIO(src)).convert("RGB").resize((size, size), Image.LANCZOS).save(webp, "WEBP", quality=mm.QUALITY, method=6)
    glb = mm.quantized_glb(name, order, flat, center, half, webp.getvalue(), doc["materials"][0], doc.get("samplers", [{}]))
    SERVED.mkdir(parents=True, exist_ok=True)
    (SERVED / f"{name}.glb").write_bytes(glb)

    # Each level where something appears: the indices to draw, and the height and reach of what is drawn.
    steps = []
    for level in sorted(set(order_levels)):
        shown = [i for t, l in zip(tris, order_levels) if l <= level for i in t]
        steps.append(
            {
                "level": level,
                "indices": len(shown),
                "height": round(max(positions[i][1] for i in shown), 3),
                "reach": round(max(hex_reach(positions[i][0], positions[i][2]) for i in shown), 3),
            }
        )
    entry = {"kB": round(len(glb) / 1024, 1), "triangles": len(flat) // 3, "levels": steps}
    meta = RAW / f"{name}.json"
    if meta.exists():
        entry.update(json.loads(meta.read_text()))
    return entry


def main(names):
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    names = names or sorted(p.stem for p in RAW.glob("*.glb"))
    for name in names:
        manifest[name] = serve(name)
        e = manifest[name]
        print(f"{name:<16} {e['kB']:6.1f} kB  {e['triangles']:5d} triangles  height {e['levels'][-1]['height']:.2f}  reach {e['levels'][-1]['reach']:.2f}  levels {[s['level'] for s in e['levels']]}")
    MANIFEST.write_text(json.dumps(dict(sorted(manifest.items())), indent=1) + "\n")


if __name__ == "__main__":
    main(sys.argv[1:])
