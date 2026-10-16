"""
Makes the 3D models the game serves, from the Meshy originals (one mesh, one 2048 px JPEG texture each):
the nine buildings (assets/buildings/src/ to client/public/buildings/) and the other models (assets/models/src/ to
client/public/models/).

    python3 assets/make-models.py

Each model gets:
- its texture as a WebP (512 px, 1 024 for the island), quality 82 (EXT_texture_webp);
- its geometry quantized (KHR_mesh_quantization): positions on 16 bits, normals on 8 bits, texture coordinates on
  16 bits, then identical vertices welded and 16-bit indices. The decoding scale and offset go in the node's matrix.
The island is flattened first: every vertex above FLATTEN is brought down to it, with its normal pointing up, so the
plateau the buildings stand on is flat. three.js reads both extensions. The originals stay out of the client build.
Needs Pillow only.
"""
import io
import json
import math
import struct
from pathlib import Path

from PIL import Image

QUALITY = 82
here = Path(__file__).resolve().parent
public = here.parent / "client" / "public"

BUILDINGS = ["lighthouse", "refinery", "fishery", "lumberyard", "shelters", "barracks", "harbor", "observatory", "infirmary"]
# The buildings on rafts (greenhouse, smokehouse, watchtower) are made now; the shipyard's task shows them later.
OTHERS = ["island", "raft", "wreck", "camp", "boat", "greenhouse", "smokehouse", "watchtower"]
# Texture size, 512 px unless set here: the island is the largest thing on screen.
TEXTURE = {"island": 1024}
# Height (in the original's units) above which the island's vertices are flattened: the sand is at about 0.14, the
# rocks of its rim rise to 0.23.
FLATTEN = {"island": 0.12}

FLOAT, BYTE, SHORT, USHORT, UINT = 5126, 5120, 5122, 5123, 5125
COUNTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3}
FORMATS = {FLOAT: "f", UINT: "I", USHORT: "H"}


def read_glb(path):
    data = path.read_bytes()
    magic, _version, _length = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67, f"{path.name} is not a GLB file"
    json_len, _ = struct.unpack_from("<II", data, 12)
    doc = json.loads(data[20 : 20 + json_len])
    bin_len, _ = struct.unpack_from("<II", data, 20 + json_len)
    start = 28 + json_len
    return doc, data[start : start + bin_len]


def accessor(doc, binary, index):
    a = doc["accessors"][index]
    view = doc["bufferViews"][a["bufferView"]]
    n = COUNTS[a["type"]]
    fmt = FORMATS[a["componentType"]]
    size = struct.calcsize(fmt)
    stride = view.get("byteStride", size * n)
    base = view.get("byteOffset", 0) + a.get("byteOffset", 0)
    return [struct.unpack_from("<" + fmt * n, binary, base + i * stride) for i in range(a["count"])]


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def convert(cid, src_dir, out_dir):
    doc, binary = read_glb(src_dir / f"{cid}.glb")
    assert len(doc["meshes"]) == 1 and len(doc["meshes"][0]["primitives"]) == 1 and len(doc["images"]) == 1, f"{cid}: one mesh, one texture expected"
    prim = doc["meshes"][0]["primitives"][0]
    attrs = prim["attributes"]
    positions = accessor(doc, binary, attrs["POSITION"])
    normals = accessor(doc, binary, attrs["NORMAL"])
    uvs = accessor(doc, binary, attrs["TEXCOORD_0"])
    indices = [i[0] for i in accessor(doc, binary, prim["indices"])]
    flattened = 0
    if cid in FLATTEN:
        top = FLATTEN[cid]
        for i, p in enumerate(positions):
            if p[1] > top:
                positions[i] = (p[0], top, p[2])
                normals[i] = (0.0, 1.0, 0.0)
                flattened += 1

    # Positions: one uniform scale around the center of the box, so the model keeps its proportions.
    lo = [min(p[k] for p in positions) for k in range(3)]
    hi = [max(p[k] for p in positions) for k in range(3)]
    center = [(lo[k] + hi[k]) / 2 for k in range(3)]
    half = max((hi[k] - lo[k]) / 2 for k in range(3))
    qpos = [tuple(round((p[k] - center[k]) / half * 32767) for k in range(3)) for p in positions]
    qnor = []
    for n in normals:
        length = math.sqrt(sum(c * c for c in n)) or 1
        qnor.append(tuple(clamp(round(c / length * 127), -127, 127) for c in n))
    assert all(0 <= c <= 1 for uv in uvs for c in uv), f"{cid}: texture coordinates outside 0..1"
    quv = [tuple(round(c * 65535) for c in uv) for uv in uvs]

    # Vertices that became identical once quantized are welded.
    seen, order, remap = {}, [], []
    for v in zip(qpos, qnor, quv):
        if v not in seen:
            seen[v] = len(order)
            order.append(v)
        remap.append(seen[v])
    assert len(order) < 65536
    tris = [remap[i] for i in indices]

    # Texture: 512 px WebP.
    image = doc["images"][0]
    view = doc["bufferViews"][image["bufferView"]]
    src = binary[view.get("byteOffset", 0) : view.get("byteOffset", 0) + view["byteLength"]]
    webp = io.BytesIO()
    size = TEXTURE.get(cid, 512)
    Image.open(io.BytesIO(src)).convert("RGB").resize((size, size), Image.LANCZOS).save(webp, "WEBP", quality=QUALITY, method=6)

    chunks, views = bytearray(), []

    def add(data, target=None, stride=None):
        while len(chunks) % 4:
            chunks.append(0)
        v = {"buffer": 0, "byteOffset": len(chunks), "byteLength": len(data)}
        if target:
            v["target"] = target
        if stride:
            v["byteStride"] = stride
        chunks.extend(data)
        views.append(v)
        return len(views) - 1

    vi = add(struct.pack(f"<{len(tris)}H", *tris), 34963)
    vp = add(b"".join(struct.pack("<hhhxx", *p) for p, _, _ in order), 34962, 8)
    vn = add(b"".join(struct.pack("<bbbx", *n) for _, n, _ in order), 34962, 4)
    vt = add(b"".join(struct.pack("<HH", *t) for _, _, t in order), 34962, 4)
    vw = add(webp.getvalue())

    count = len(order)
    pmin = [min(p[k] for p, _, _ in order) for k in range(3)]
    pmax = [max(p[k] for p, _, _ in order) for k in range(3)]
    # A normalized 16-bit position reads as q / 32767, between -1 and 1: the node scales it back by `half`.
    s = half
    result = {
        "asset": {"version": "2.0", "generator": "Brinelight make-models.py"},
        "extensionsUsed": ["KHR_mesh_quantization", "EXT_texture_webp"],
        "extensionsRequired": ["KHR_mesh_quantization", "EXT_texture_webp"],
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        # Decodes the 16-bit positions: scale, then the center of the original box.
        "nodes": [{"name": cid, "mesh": 0, "matrix": [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, *center, 1]}],
        "meshes": [{"name": cid, "primitives": [{"attributes": {"POSITION": 1, "NORMAL": 2, "TEXCOORD_0": 3}, "indices": 0, "mode": 4, "material": 0}]}],
        "materials": [doc["materials"][0]],
        "textures": [{"sampler": 0, "extensions": {"EXT_texture_webp": {"source": 0}}}],
        "samplers": doc["samplers"],
        "images": [{"bufferView": vw, "mimeType": "image/webp"}],
        "accessors": [
            {"bufferView": vi, "componentType": USHORT, "count": len(tris), "type": "SCALAR"},
            {"bufferView": vp, "componentType": SHORT, "normalized": True, "count": count, "type": "VEC3", "min": pmin, "max": pmax},
            {"bufferView": vn, "componentType": BYTE, "normalized": True, "count": count, "type": "VEC3"},
            {"bufferView": vt, "componentType": USHORT, "normalized": True, "count": count, "type": "VEC2"},
        ],
        "bufferViews": views,
        "buffers": [{"byteLength": len(chunks)}],
    }
    while len(chunks) % 4:
        chunks.append(0)
    text = json.dumps(result, separators=(",", ":")).encode()
    text += b" " * (-len(text) % 4)
    glb = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(text) + 8 + len(chunks))
    glb += struct.pack("<II", len(text), 0x4E4F534A) + text + struct.pack("<II", len(chunks), 0x004E4942) + bytes(chunks)
    path = out_dir / f"{cid}.glb"
    path.write_bytes(glb)

    # The largest position error, in model units, against the original.
    error = max(abs(center[k] + q[k] / 32767 * s - p[k]) for p, q in zip(positions, qpos) for k in range(3))
    before = (src_dir / f"{cid}.glb").stat().st_size / 1024
    return {"id": cid, "before kB": before, "kB": len(glb) / 1024, "triangles": len(tris) // 3, "vertices": count, "was": len(positions), "error": error, "flattened": flattened}


for ids, src_dir, out_dir in [(BUILDINGS, here / "buildings" / "src", public / "buildings"), (OTHERS, here / "models" / "src", public / "models")]:
    out_dir.mkdir(parents=True, exist_ok=True)
    total = 0
    for cid in ids:
        r = convert(cid, src_dir, out_dir)
        total += r["kB"]
        flat = f"  {r['flattened']} vertices flattened" if r["flattened"] else ""
        print(f"{r['id']:<12} {r['before kB']:6.0f} kB -> {r['kB']:4.0f} kB  {r['triangles']} triangles  {r['vertices']} vertices (was {r['was']})  largest position error {r['error']:.6f}{flat}")
    print(f"{'total':<12} {total:23.0f} kB  ({out_dir.relative_to(here.parent)})")
