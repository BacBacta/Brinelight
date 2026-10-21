"""
The city fabric's models for the game (owner, 21 October, step 2): the same shapes as the target images
(fabric_target.py), served in one small file per era (client/public/city/fabric-<era>.bin) that the game merges into
a few meshes. Every shape is a flat color of the palette: no texture, the color on each vertex. A model's windows (and
its lanterns, its fire) are kept apart: the game lights them in the Mist. The wind turbine's rotor is apart too: it
turns. Their measures go in client/src/scene/city-models.json (fabric-<era>: kB, triangles, models).

    .venv-blender/bin/python assets/blender/fabric_models.py

The file: "BLFB", the header's length (uint32), the header (JSON: each model's body and windows as
[first vertex, vertices, first index, indices]), then for every vertex its position (int16, 1/4096 of a unit), its
normal (int8) and its color (sRGB, uint8), each section padded to 4 bytes, then the indices (uint16).
"""
import json
import math
import struct
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import fabric_target as F  # noqa: E402
import kit  # noqa: E402

HERE = Path(__file__).resolve().parent
SERVED = HERE.parent.parent / "client" / "public" / "city"
MANIFEST = HERE.parent.parent / "client" / "src" / "scene" / "city-models.json"
SCALE = 4096
# What glows in the Mist: the windows' glass, the lanterns and the fire.
GLOWING = {"glass", "gold"}


# --- The shapes the target images did not need --------------------------------------------------------------------
def turbine_mast():
    return [kit.cylinder(0.035, 1.3, (0, 0.65, 0), "white", sides=6, bevel=0, top=0.02), kit.box((0.05, 0.05, 0.1), (0, 1.3, 0.02), "white", bevel=0)]


def turbine_rotor():
    """The three blades around the hub, at the origin, facing the camera (+z): the game turns it around z."""
    parts = [kit.box((0.04, 0.04, 0.03), (0, 0, 0), "white", bevel=0)]
    for k in range(3):
        a = k * 2 * math.pi / 3 + 0.3
        parts.append(kit.box((0.035, 0.42, 0.008), (math.sin(a) * 0.21, math.cos(a) * 0.21, 0), "white", bevel=0, tilt=(0, -a)))
    return parts


def campfire():
    parts = []
    for k in range(7):
        a = k * 2 * math.pi / 7
        parts.append(kit.box((0.045, 0.035, 0.04), (math.cos(a) * 0.09, 0.017, math.sin(a) * 0.09), "rock", bevel=0, turn=a))
    for k in range(3):
        parts.append(kit.box((0.14, 0.022, 0.022), (0, 0.03, 0), "wood", bevel=0, turn=k * 1.05))
    parts.append(kit.cone(0.045, 0.1, (0, 0.03, 0), "gold", sides=5))
    return parts


def drying_rack():
    """Fish drying on a rack: two posts, a bar, the fish hung under it."""
    parts = [kit.box((0.018, 0.22, 0.018), (x, 0.11, 0), "drift", bevel=0) for x in (-0.16, 0.16)]
    parts.append(kit.box((0.36, 0.014, 0.014), (0, 0.21, 0), "drift", bevel=0))
    for k in range(5):
        parts.append(kit.box((0.024, 0.07, 0.01), (-0.12 + k * 0.06, 0.16, 0), "plank", bevel=0))
    return parts


def laundry_line():
    parts = [kit.box((0.016, 0.26, 0.016), (x, 0.13, 0), "drift", bevel=0) for x in (-0.24, 0.24)]
    parts.append(kit.box((0.48, 0.006, 0.006), (0, 0.24, 0), "dark", bevel=0))
    for k, c in enumerate(("cream", "lighthouse_red", "navy", "white")):
        parts.append(kit.box((0.07, 0.09, 0.006), (-0.15 + k * 0.1, 0.19, 0), c, bevel=0))
    return parts


def barrels():
    return [kit.cylinder(0.055, 0.16, (dx, 0.08, dz), "wood", sides=6, bevel=0) for dx, dz in ((0, 0), (0.12, 0.03), (0.05, -0.1))]


def rowboat():
    """A rowboat pulled up on the beach, tilted on its side a little, an oar beside it."""
    hull = kit.box((0.36, 0.07, 0.14), (0, 0.04, 0), "wood", bevel=0, tilt=(0.18, 0))
    bow = kit.prism_roof(0.14, 0.12, 0.07, (0.18, 0.005, 0), "wood", turn=math.pi / 2)
    bow.modifiers.clear()
    oar = kit.box((0.32, 0.01, 0.022), (0.02, 0.012, 0.14), "plank", bevel=0, turn=0.25)
    return [hull, bow, oar]


def workshop_lit():
    return F.workshop(True)


# Every model the fabric can show, and the eras that show it (0 salvage ... 5 modern).
MODELS = {
    "tent": (lambda: F.tent(True), [0]),
    "hut": (lambda: F.hut(True), [0, 1]),
    "wooden": (lambda: F.wooden(True), [1, 2, 3]),
    "brick": (lambda: F.brick(True), [2, 3, 4]),
    "row": (lambda: F.row(True), [3, 4]),
    "workshop": (workshop_lit, [3, 4]),
    "lit-house": (lambda: F.lit_house(True), [4, 5]),
    "solar-house": (lambda: F.solar_house(True), [5]),
    "apartments": (lambda: F.apartments(True), [5]),
    "well": (F.well, [0, 1, 2, 3, 4, 5]),
    "windmill": (F.windmill, [1, 2, 3, 4, 5]),
    "chimneys": (F.chimneys, [2, 3, 4, 5]),
    "water-tower": (F.water_tower, [3, 4, 5]),
    "turbine-mast": (turbine_mast, [4, 5]),
    "turbine-rotor": (turbine_rotor, [4, 5]),
    "solar-field": (F.solar_field, [5]),
    "lamp": (F.lamp, [2, 3, 4, 5]),
    "pole": (F.pole, [4, 5]),
    "kelp-rack": (F.kelp_rack, [3, 4, 5]),
    "bench": (F.bench, [4, 5]),
    "scarecrow": (F.scarecrow, [1, 2, 3, 4, 5]),
    "barrel": (lambda: kit.cylinder(0.06, 0.18, (0, 0.09, 0), "wood", sides=6, bevel=0), [1, 2, 3, 4, 5]),
    "jetty": (F.jetty, [0, 1]),
    "quay": (F.quay, [2, 3, 4, 5]),
    "sail-boat": (lambda: F.boat(False), [0, 1, 2, 3, 4, 5]),
    "motor-boat": (lambda: F.boat(True), [3, 4, 5]),
    "campfire": (campfire, [0, 1]),
    "drying-rack": (drying_rack, [0, 1]),
    "laundry-line": (laundry_line, [0, 1]),
    "barrels": (barrels, [0, 1]),
    "rowboat": (rowboat, [0, 1]),
}


def srgb8(hex_color):
    h = hex_color.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def triangles(make):
    """The model's triangles in the game's axes: (glows, [(position, normal, color) * 3])."""
    kit.reset(style=False)
    F.MODE["night"] = False
    parts = make()
    parts = parts if isinstance(parts, list) else [parts]
    obj = kit.join(parts, "model") if len(parts) > 1 else parts[0]
    if len(parts) == 1:
        bpy.context.view_layer.objects.active = obj
        for mod in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    mesh = obj.data
    mesh.calc_loop_triangles()
    out = []
    for tri in mesh.loop_triangles:
        name = mesh.materials[tri.material_index].name.split(".")[0]
        color = srgb8(kit.PALETTE[name])
        n = tri.normal
        normal = (n.x, n.z, -n.y)
        verts = []
        for vi in tri.vertices:
            v = mesh.vertices[vi].co
            verts.append(((v.x, v.z, -v.y), normal, color))
        out.append((name in GLOWING, verts))
    return out


def pack(models):
    """The models of one era in the file's form, and their triangles."""
    header, pos, nor, col, idx = {}, [], [], [], []
    counts = {}
    for name, tris in models.items():
        entry = {}
        for part, glows in (("body", False), ("windows", True)):
            mine = [t for g, t in tris if g == glows]
            if not mine:
                continue
            first_v, first_i = len(pos), len(idx)
            seen = {}
            for t in mine:
                for p, n, c in t:
                    q = (tuple(round(x * SCALE) for x in p), tuple(max(-127, min(127, round(x * 127))) for x in n), c)
                    if q not in seen:
                        seen[q] = len(pos) - first_v
                        pos.append(q[0])
                        nor.append(q[1])
                        col.append(q[2])
                    idx.append(seen[q])
            assert len(pos) - first_v < 65536, name
            entry[part] = [first_v, len(pos) - first_v, first_i, len(idx) - first_i]
        header[name] = entry
        counts[name] = len(tris)
    assert all(abs(c) < 32767 for p in pos for c in p)
    data = bytearray()

    def pad():
        while len(data) % 4:
            data.append(0)

    for p in pos:
        data += struct.pack("<3h", *p)
    pad()
    for n in nor:
        data += struct.pack("<3b", *n)
    pad()
    for c in col:
        data += struct.pack("<3B", *c)
    pad()
    for i in idx:
        data += struct.pack("<H", i)
    pad()
    head = json.dumps({"scale": SCALE, "vertices": len(pos), "indices": len(idx), "models": header}, separators=(",", ":")).encode()
    head += b" " * ((4 - len(head) % 4) % 4)
    return b"BLFB" + struct.pack("<I", len(head)) + head + bytes(data), counts


def main():
    made = {name: triangles(make) for name, (make, _) in MODELS.items()}
    manifest = json.loads(MANIFEST.read_text())
    SERVED.mkdir(parents=True, exist_ok=True)
    for era in range(6):
        models = {name: made[name] for name, (_, eras) in MODELS.items() if era in eras}
        blob, counts = pack(models)
        (SERVED / f"fabric-{era}.bin").write_bytes(blob)
        manifest[f"fabric-{era}"] = {"kB": round(len(blob) / 1024, 1), "triangles": sum(counts.values()), "levels": [], "models": counts}
        print(f"fabric-{era}", len(models), "models", round(len(blob) / 1024, 1), "kB")
    MANIFEST.write_text(json.dumps(dict(sorted(manifest.items())), indent=1) + "\n")


if __name__ == "__main__":
    main()
