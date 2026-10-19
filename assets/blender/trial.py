"""
A trial of Blender for Brinelight's models (owner's request, 19 October): the Refinery at levels 1, 10, 20 and 30, and
a raft of the floating village, sound, damaged and being built. Nothing here goes into the game by itself.

    .venv-blender/bin/python assets/blender/trial.py <out dir>

Each model is built in the game's units from the kit (kit.py), its colors and soft shadows baked into one texture,
and exported as <out dir>/<name>.glb. The Refinery grows with its level: wood (1 to 9), a stone plinth (10), brass
(20), a verdigris roof (30); its vat and chimney rise, a tank, a flare tower and a gantry come with the tiers.
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kit  # noqa: E402
from kit import barrel, box, cone, cylinder, flag, hexagon, lantern, prism_roof, ring  # noqa: E402

FLAG = {1: "cream", 10: "navy", 20: "brick", 30: "gold"}


def refinery(level):
    """The Refinery at `level` (1, 10, 20 or 30): a round hooped vat with a copper chimney, on stilts or a plinth."""
    p = []
    stone = level >= 10
    metal = "brass" if level >= 20 else "navy"
    # The ground it stands on: wooden stilts and a deck, or a stone plinth.
    if stone:
        p.append(box((1.44, 0.22, 1.24), (0, 0.11, 0), "stone", bevel=0.05, segments=2))
        p.append(box((1.5, 0.05, 1.3), (0, 0.235, 0), "stone_dark", bevel=0.02))
        base = 0.26
    else:
        for x in (-0.6, 0.0, 0.6):
            for z in (-0.48, 0.48):
                p.append(cylinder(0.05, 0.22, (x, 0.11, z), "wood", sides=8, bevel=0))
        p.append(box((1.42, 0.08, 1.16), (0, 0.26, 0), "plank", bevel=0.025, segments=2))
        base = 0.3
    # The vat: taller at each tier, its hoops in navy, then brass.
    vat_h = {1: 0.55, 10: 0.72, 20: 0.88, 30: 0.98}[level]
    vx, vz, vr = -0.18, -0.05, 0.42
    p.append(cylinder(vr, vat_h, (vx, base + vat_h / 2, vz), "wood", sides=16, bevel=0.03, segments=1))
    hoops = 2 if level < 10 else 3
    for i in range(hoops):
        p.append(ring(vr, 0.02, 0.05, (vx, base + vat_h * (i + 1) / (hoops + 1), vz), metal, sides=16))
    top = base + vat_h
    roof = "copper" if level >= 30 else ("stone_dark" if stone else "plank")
    p.append(cone(vr + 0.05, 0.28, (vx, top, vz), roof, sides=16))
    # The chimney: short and copper, taller with its tier, a band at its top.
    ch = {1: 0.45, 10: 0.7, 20: 0.85, 30: 0.95}[level]
    p.append(cylinder(0.07, ch, (vx + 0.15, top + 0.05 + ch / 2, vz - 0.12), "copper", sides=10, bevel=0.01))
    p.append(cylinder(0.09, 0.07, (vx + 0.15, top + 0.05 + ch, vz - 0.12), metal, sides=10, bevel=0.01))
    # The shed beside it, on the camera's right: its roof wood, stone-grey, then verdigris.
    sx, sz = 0.45, 0.22
    sh = 0.42 if level < 20 else 0.62
    p.append(box((0.5, sh, 0.46), (sx, base + sh / 2, sz), "plank" if not stone else "stone", bevel=0.02))
    p.append(box((0.14, 0.24, 0.02), (sx, base + 0.12, sz + 0.235), "dark", bevel=0.005))
    p.append(prism_roof(0.6, 0.56, 0.24, (sx, base + sh, sz), roof))
    if level >= 20:
        # A lit window on the shed's second floor.
        p.append(box((0.14, 0.12, 0.02), (sx, base + sh - 0.14, sz + 0.235), "gold", bevel=0.004))
    # Barrels in front, large enough to read.
    p.append(barrel((0.05, base + 0.13, 0.48)))
    p.append(barrel((-0.22, base + 0.13, 0.5), color="plank"))
    if level >= 10:
        # A copper tank at the back right, joined by a pipe.
        p.append(cylinder(0.24, 0.62, (0.48, base + 0.31, -0.38), "copper", sides=12, bevel=0.03, segments=1))
        p.append(cone(0.26, 0.14, (0.48, base + 0.62, -0.38), metal, sides=12))
        p.append(cylinder(0.04, 0.42, (0.2, base + 0.45, -0.3), metal, sides=8, bevel=0, tilt=(0, math.radians(90))))
    if level >= 20:
        # The flare tower, at the back left, with a gold flame.
        p.append(cylinder(0.06, 1.3, (-0.55, base + 0.65, -0.45), "navy", sides=8, bevel=0))
        for y in (0.45, 0.9):
            p.append(ring(0.08, 0.02, 0.05, (-0.55, base + y, -0.45), "brass", sides=10))
        p.append(cone(0.1, 0.22, (-0.55, base + 1.3, -0.45), "gold", sides=10))
        p.append(lantern((0.12, base + 0.32, 0.36)))
    if level >= 30:
        # A gantry over the tanks, with lanterns along it.
        for x in (0.05, 0.75):
            p.append(box((0.07, 1.0, 0.07), (x, base + 0.5, -0.55), "navy", bevel=0.01))
        p.append(box((0.82, 0.08, 0.1), (0.4, base + 1.0, -0.55), "brass", bevel=0.015))
        for x in (0.2, 0.6):
            p.append(lantern((x, base + 0.88, -0.55), size=0.09))
    # The flag of its tier, on the shed.
    p.append(flag((sx + 0.22, base + sh + 0.1, sz - 0.1), FLAG[level], height=0.55 if level < 20 else 0.7))
    return kit.join(p, f"refinery-{level}")


def raft(kind):
    """A raft of the floating village: 'sound', 'damaged' or 'building' (the shipyard at work). W = 1.64."""
    p = []
    apothem = 0.82
    deck_y = 0.42
    tilt = (math.radians(4), math.radians(-3)) if kind == "damaged" else (0.0, 0.0)
    # Floats: six barrels under the corners, half under the water (at 0.2 from the bottom); one gone when damaged.
    for i in range(6):
        a = math.radians(90 + 60 * i)
        if kind == "damaged" and i == 0:
            continue
        x, z = math.cos(a) * 0.62, math.sin(a) * 0.62
        p.append(cylinder(0.16, 0.36, (x, 0.18, z), "navy" if i % 2 else "wood", sides=8, bevel=0))
    if kind == "building":
        # The frame of the deck, half laid: beams along the six sides, a few planks, a pile of planks, a lantern.
        r = apothem / math.cos(math.pi / 6)
        for i in range(6):
            a0 = math.radians(30 + 60 * i)
            a1 = math.radians(90 + 60 * i)
            x0, z0, x1, z1 = math.cos(a0) * r * 0.95, math.sin(a0) * r * 0.95, math.cos(a1) * r * 0.95, math.sin(a1) * r * 0.95
            length = math.hypot(x1 - x0, z1 - z0)
            p.append(box((length, 0.07, 0.08), ((x0 + x1) / 2, deck_y - 0.04, (z0 + z1) / 2), "wood", bevel=0.01, turn=-math.atan2(z1 - z0, x1 - x0)))
        for k in range(4):
            p.append(box((1.1 - abs(k - 1.5) * 0.25, 0.04, 0.15), (0, deck_y, -0.4 + k * 0.17), "plank", bevel=0.01))
        for k in range(3):
            p.append(box((0.6, 0.04, 0.12), (0.15, deck_y + 0.04 + k * 0.045, 0.42), "plank", bevel=0.008, turn=0.15 * k))
        p.append(cylinder(0.025, 0.6, (-0.45, deck_y + 0.3, 0.25), "wood", sides=6, bevel=0))
        p.extend(lantern((-0.45, deck_y + 0.62, 0.25), size=0.09))
        return kit.join(p, "raft-building")
    # The deck: a hexagonal slab of planks, with plank lines across it.
    wood = "wood" if kind == "damaged" else "plank"
    p.append(hexagon(apothem, 0.1, (0, deck_y - 0.05, 0), wood, bevel=0.03, segments=1))
    for k in range(-3, 4):
        if kind == "damaged" and k >= 2:
            continue
        width = 2 * (apothem / math.cos(math.pi / 6)) * (1 - abs(k) / 4.5) * 0.92
        p.append(box((width, 0.012, 0.03), (0, deck_y + 0.001, k * 0.21), "wood", bevel=0))
    # The rim: short logs along the sides, near the corners; the middles of the sides stay free for the walkways.
    r = apothem / math.cos(math.pi / 6)
    for i in range(6):
        a0, a1 = math.radians(30 + 60 * i), math.radians(90 + 60 * i)
        c0 = (math.cos(a0) * r * 0.9, math.sin(a0) * r * 0.9)
        c1 = (math.cos(a1) * r * 0.9, math.sin(a1) * r * 0.9)
        for t in (0.18, 0.82):
            x, z = c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t
            if kind == "damaged" and z > 0.35:
                continue
            p.append(cylinder(0.04, 0.24, (x, deck_y + 0.05, z), "wood", sides=6, bevel=0, tilt=(0, math.radians(90)), turn=-math.atan2(c1[1] - c0[1], c1[0] - c0[0])))
    # At its back: a short mast with a furled cream sail, a crate and a coil of rope.
    p.append(cylinder(0.035, 0.72, (0.05, deck_y + 0.36, -0.5), "wood", sides=8, bevel=0))
    p.append(cylinder(0.07, 0.42, (0.05, deck_y + 0.6, -0.5), "cream", sides=8, bevel=0, tilt=(0, math.radians(90))))
    p.append(box((0.2, 0.18, 0.2), (-0.38, deck_y + 0.09, -0.4), "wood", bevel=0.015))
    p.append(cylinder(0.11, 0.05, (0.4, deck_y + 0.025, -0.38), "plank", sides=10, bevel=0))
    if kind == "damaged":
        # The damage mark at the front corner: a dark hole and two broken planks standing up.
        p.append(box((0.42, 0.02, 0.26), (0.0, deck_y + 0.005, 0.55), "dark", bevel=0.005))
        p.append(box((0.07, 0.36, 0.035), (-0.14, deck_y + 0.16, 0.58), "plank", bevel=0.005, tilt=(math.radians(28), 0), turn=0.3))
        p.append(box((0.07, 0.3, 0.035), (0.18, deck_y + 0.14, 0.6), "plank", bevel=0.005, tilt=(math.radians(-25), 0), turn=-0.4))
    obj = kit.join(p, f"raft-{kind}")
    if kind == "damaged":
        obj.rotation_euler = (tilt[0], tilt[1], 0)
        import bpy

        bpy.ops.object.transform_apply(rotation=True)
    return obj


def main(out):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    jobs = [(f"refinery-{lv}", lambda lv=lv: refinery(lv)) for lv in (1, 10, 20, 30)] + [(f"raft-{k}", lambda k=k: raft(k)) for k in ("sound", "damaged", "building")]
    for name, make in jobs:
        kit.reset()
        obj = make()
        tris = kit.bake_and_export(obj, out / f"{name}.glb")
        print(f"{name:<16} {tris:5d} triangles  {(out / f'{name}.glb').stat().st_size / 1024:6.0f} kB", flush=True)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "assets/blender/out")
