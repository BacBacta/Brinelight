"""
The building site of a building at work (or not built yet), in four pieces the game puts together:

- site-frame: the scaffolding, made for a building that reaches 0.95 from its plot's center and 1 high; the game
  stretches it to the building (its sides to the building's reach, its height to 70 % of the building's);
- site-mast, site-arm and site-crate: the crane at its right front corner, its arm swinging over the building and its
  crate going up and down (the game moves them).

The camera looks from +z: the poles stand at the corners of the sides it sees, the decks on the right, the ladder on
the left, the pulley and the planks at the front.
"""
import math

import kit
from kit import box, crate, cylinder, ladder, rod

R = 0.95


def corners(r=R):
    """The scaffolding's corners, a hexagon like the plot: right front, front, left front, left back, back, right back."""
    s = r / math.sqrt(3)
    return [(r, s), (0, 2 * s), (-r, s), (-r, -s), (0, -2 * s), (r, -s)]


def frame():
    c = corners()
    p = []
    poles = [c[2], c[1], c[0], c[5]]
    for x, z in poles:
        p.append(box((0.06, 1.0, 0.06), (x * 0.97, 0.5, z * 0.97), "wood", bevel=0.01))
    # Decks of planks on the two right sides, at two heights, with a rail on the upper one.
    for a, b in ((c[1], c[0]), (c[0], c[5])):
        dx, dz = b[0] - a[0], b[1] - a[1]
        length = math.hypot(dx, dz)
        turn = -math.atan2(dz, dx)
        nx, nz = -dz / length, dx / length
        inward = 1 if nx * -a[0] + nz * -a[1] > 0 else -1
        mx, mz = (a[0] + b[0]) / 2 + nx * inward * 0.08, (a[1] + b[1]) / 2 + nz * inward * 0.08
        for y in (0.45, 0.9):
            p.append(box((length, 0.035, 0.16), (mx, y, mz), "plank", bevel=0.006, turn=turn))
        p.append(box((length, 0.025, 0.025), ((a[0] + b[0]) / 2 * 1.0, 1.0, (a[1] + b[1]) / 2 * 1.0), "wood", bevel=0, turn=turn))
        # A brace across the side, from one pole's foot to the other's top.
        p.append(rod((a[0] * 0.97, 0.05, a[1] * 0.97), (b[0] * 0.97, 0.88, b[1] * 0.97), 0.015, "wood", 4))
    # The ladder up the front left side.
    a, b = c[1], c[2]
    mid = ((a[0] + b[0]) / 2 * 0.94, (a[1] + b[1]) / 2 * 0.94)
    p.extend(ladder((mid[0] + 0.02, 0, mid[1] + 0.05), (mid[0], 0.9, mid[1]), width=0.16))
    # The pulley under the top of the front pole, its rope and a bucket.
    px, pz = a[0] * 0.9, a[1] * 0.9
    p.append(cylinder(0.07, 0.04, (px, 0.88, pz), "brass", sides=8, bevel=0, tilt=(0, math.radians(90))))
    p.append(rod((px, 0.86, pz), (px, 0.3, pz), 0.008, "navy", 4))
    p.append(cylinder(0.05, 0.08, (px, 0.26, pz), "wood", sides=6, bevel=0, top=0.04))
    # The pile of planks at the ladder's foot.
    lx, lz = (a[0] + b[0]) / 2 * 0.75, (a[1] + b[1]) / 2 * 0.75
    for i in range(3):
        p.append(box((0.3, 0.035, 0.09), (lx, 0.02 + i * 0.04, lz), "plank", bevel=0.004, turn=-math.atan2(b[1] - a[1], b[0] - a[0]) + 0.2 + i * 0.12))
    return p


# The crane, at size 1 (for a building 1.7 high), standing at the origin; the arm turns around the mast's axis, and the
# crate hangs at the arm's tip, `CRATE_Y` high at rest.
MAST = 1.54
REACH = 0.55
CRATE_Y = MAST - 0.42


def mast():
    return [
        box((0.07, MAST, 0.07), (0, MAST / 2, 0), "navy", bevel=0.01),
        box((0.16, 0.06, 0.16), (0, 0.03, 0), "stone_dark", bevel=0.01),
        cylinder(0.05, 0.06, (0, MAST, 0), "brass", sides=8, bevel=0),
    ]


def arm():
    tip = (-REACH, MAST, -REACH)
    return [
        rod((0.12, MAST, 0.12), tip, 0.03, "brass", 6),
        box((0.1, 0.1, 0.1), (0.14, MAST, 0.14), "navy", bevel=0.01),
        rod(tip, (tip[0], CRATE_Y + 0.08, tip[2]), 0.008, "navy", 4),
        cylinder(0.025, 0.05, (tip[0], MAST - 0.03, tip[2]), "dark", sides=6, bevel=0),
    ]


def crate_part():
    return crate((-REACH, CRATE_Y - 0.06, -REACH), size=0.14)


def build(out, fast=False):
    from pathlib import Path

    out = Path(out)
    for name, make in (("site-frame", frame), ("site-mast", mast), ("site-arm", arm), ("site-crate", crate_part)):
        kit.reset(style=True)
        obj = kit.join(make(), name)
        tris = kit.bake_and_export(obj, out / f"{name}.glb", size=128 if fast else 512, samples=4 if fast else 48, meta={"reach": REACH, "mast": MAST, "crateY": CRATE_Y} if name == "site-arm" else None)
        print(f"{name:<12} {tris:5d} triangles", flush=True)
