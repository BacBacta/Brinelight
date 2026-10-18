"""
Makes the 3D models the game serves, from the Meshy originals (one mesh, one 2048 px JPEG texture each):
the nine buildings (assets/buildings/src/ to client/public/buildings/) and the other models (assets/models/src/ to
client/public/models/).

    python3 assets/make-models.py

Each model gets:
- its texture as a WebP (512 px, 1 024 for the island), quality 82 (EXT_texture_webp);
- its geometry quantized (KHR_mesh_quantization): positions on 16 bits, normals on 8 bits, texture coordinates on
  16 bits, then identical vertices welded and 16-bit indices. The decoding scale and offset go in the node's matrix.
The island is flattened first (FLATTEN): the bumps of its meadow are brought down to the meadow, with their normals
pointing up, the faces this turns upside down are turned face up just under it, and the meadow is moved to y = 0, where
the buildings stand. three.js reads both extensions. The originals stay out of the client build.
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
# The island's two windswept pines, found by their box (x, z in the original's units) and their height: the vertices
# above `above`. Where the model put them, one stood in an empty plot of ring 2 and the other where rafts moor. The
# only place clear of every plot and raft slot is the rim at the pier's gap (no raft slot there), and it holds one
# pine: the smaller one moves there, turned by `turn` degrees around its trunk so it still leans out to sea, its
# trunk at `to` and its foot down at `base`; the other one goes. The triangles that joined a pine to the ground go
# with it. Under each pine, what lay flat (its lowest branches and flowers, flattened later) takes the meadow's texture.
PINES = {
    "island": [
        {"x": (-0.62, -0.24), "z": (-0.9, -0.45), "above": 0.08},
        {"x": (0.56, 0.86), "z": (0.34, 0.74), "above": 0.08, "to": (-0.395, -0.827), "turn": -152.4, "base": -0.098},
    ]
}
# The island's meadow, and the height up to which its bumps (grass tufts, the edge of the meadow) are flattened onto
# it, in the original's units. The meadow is flat at -0.07; above 0.08 stand its windswept pines (up to 0.30). The faces
# that flattening turns upside down are turned face up, `sink` under the meadow (about 1 cm in the city): far more than
# the depth buffer can tell apart, far less than the eye can see.
FLATTEN = {"island": {"ground": -0.07, "top": 0.08, "sink": 0.002}}

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
    removed = moved = 0
    # The vertices a moved pine brings: never flattened.
    keep_shape = [False] * len(positions)
    if cid in PINES:
        ground = FLATTEN[cid]["ground"]
        # A texel of the meadow: the meadow's vertex nearest the island's center.
        meadow = min((i for i, p in enumerate(positions) if abs(p[1] - ground) < 0.002), key=lambda i: math.hypot(positions[i][0], positions[i][2]))
        gone = set()
        cut = set()
        for pine in PINES[cid]:
            (x0, x1), (z0, z1) = pine["x"], pine["z"]
            inside = [i for i, p in enumerate(positions) if x0 <= p[0] <= x1 and z0 <= p[2] <= z1]
            tall = {i for i in inside if positions[i][1] > pine["above"]}
            for i in inside:
                if ground + 0.001 < positions[i][1] <= pine["above"]:
                    uvs[i] = uvs[meadow]
            # The triangles between the pine and the ground: the pine leaves them.
            cut.update(t for t in range(0, len(indices), 3) if 0 < len(tall.intersection(indices[t : t + 3])) < 3)
            if "to" not in pine:
                gone |= tall
                continue
            mx = sum(positions[i][0] for i in tall) / len(tall)
            mz = sum(positions[i][2] for i in tall) / len(tall)
            a = math.radians(pine["turn"])
            ca, sa = math.cos(a), math.sin(a)
            drop = pine["base"] - min(positions[i][1] for i in tall)
            for i in tall:
                x, y, z = positions[i][0] - mx, positions[i][1], positions[i][2] - mz
                positions[i] = (pine["to"][0] + x * ca - z * sa, y + drop, pine["to"][1] + x * sa + z * ca)
                nx, ny, nz = normals[i]
                normals[i] = (nx * ca - nz * sa, ny, nx * sa + nz * ca)
                keep_shape[i] = True
            moved += len(tall)
        removed = len(gone)
        kept = [t for t in range(0, len(indices), 3) if t not in cut and not gone.intersection(indices[t : t + 3])]
        used = sorted({indices[t + k] for t in kept for k in range(3)})
        renumber = {old: new for new, old in enumerate(used)}
        indices = [renumber[indices[t + k]] for t in kept for k in range(3)]
        positions, normals, uvs, keep_shape = ([v[i] for i in used] for v in (positions, normals, uvs, keep_shape))
    flattened = turned = 0
    if cid in FLATTEN:
        ground, top = FLATTEN[cid]["ground"], FLATTEN[cid]["top"]
        for i, p in enumerate(positions):
            if ground < p[1] <= top and not keep_shape[i]:
                positions[i] = (p[0], ground, p[2])
                normals[i] = (0.0, 1.0, 0.0)
                flattened += 1
        # Where a bump hung over the meadow (a tuft, the lip of its edge), flattening lays its underside on the meadow,
        # upside down and exactly in its plane: the two faces fight for each pixel (z-fighting), and the upside-down one
        # shows dark through the double-sided material. Each face so folded is turned face up, on vertices of its own
        # laid `sink` under the meadow: where the meadow covers it, the meadow shows; where it does not, it fills the gap.
        sink = ground - FLATTEN[cid]["sink"]
        for t in range(0, len(indices), 3):
            a, b, c = (positions[i] for i in indices[t : t + 3])
            if any(abs(q[1] - ground) > 0.002 for q in (a, b, c)):
                continue
            if (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]) >= 0:
                continue
            turned_face = []
            for i in reversed(indices[t : t + 3]):
                turned_face.append(len(positions))
                positions.append((positions[i][0], sink, positions[i][2]))
                normals.append((0.0, 1.0, 0.0))
                uvs.append(uvs[i])
                keep_shape.append(False)
            indices[t : t + 3] = turned_face
            turned += 1
        positions = [(p[0], p[1] - ground, p[2]) for p in positions]

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
    return {"removed": removed, "moved": moved, "id": cid, "before kB": before, "kB": len(glb) / 1024, "triangles": len(tris) // 3, "vertices": count, "was": len(positions), "error": error, "flattened": flattened, "turned": turned}


for ids, src_dir, out_dir in [(BUILDINGS, here / "buildings" / "src", public / "buildings"), (OTHERS, here / "models" / "src", public / "models")]:
    out_dir.mkdir(parents=True, exist_ok=True)
    total = 0
    for cid in ids:
        r = convert(cid, src_dir, out_dir)
        total += r["kB"]
        flat = "".join(f"  {r[k]} vertices {k}" for k in ("removed", "moved", "flattened") if r[k]) + (f"  {r['turned']} faces turned" if r["turned"] else "")
        print(f"{r['id']:<12} {r['before kB']:6.0f} kB -> {r['kB']:4.0f} kB  {r['triangles']} triangles  {r['vertices']} vertices (was {r['was']})  largest position error {r['error']:.6f}{flat}")
    print(f"{'total':<12} {total:23.0f} kB  ({out_dir.relative_to(here.parent)})")
