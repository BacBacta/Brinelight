"""
The Refinery (art direction: a round hooped vat, a short copper chimney), at its seven stages, and a detail at every
other level. From afar: its height, its tiers' materials (wood, a stone plinth at 10, brass at 20, verdigris roofs at
30) and its transformations (a still at 5, a second floor and a hoist at 15, a column at 25). Up close: each level.

Its plot is 2 wide: everything stays within 0.93 of its center (hex distance), under the Lighthouse's top.
The camera looks from the front (+z): the details stand at the front and on the walls it sees.
"""
import math

import kit
from kit import band, barrel, box, cone, crate, cylinder, drum, flag, gauge, ladder, lantern, prism_roof, rail_ring, ring, rod, rope_coil, sack, wheel
from stages import flag_color

# The floor everything stands on: a plank deck on stilts, then a stone plinth, at the same height.
FLOOR = 0.28
VAT = (-0.2, -0.1)
SHED = (0.42, 0.16)


def vat_radius(s):
    return 0.4 if s < 10 else 0.42 if s < 20 else 0.44


def vat_height(s):
    return {1: 0.5, 5: 0.56, 10: 0.68, 15: 0.76, 20: 0.86, 25: 0.94, 30: 1.0}[s]


def shed_height(s):
    return 0.4 if s < 15 else 0.66


def metal(s):
    return "navy" if s < 20 else "brass"


def roof(s):
    return "plank" if s < 10 else "stone_dark" if s < 30 else "copper"


def base(s):
    p = []
    # The floor: stilts and a plank deck, then a stone plinth.
    if s < 10:
        for x in (-0.6, 0.0, 0.6):
            for z in (-0.48, 0.48):
                p.append(cylinder(0.05, FLOOR - 0.04, (x, (FLOOR - 0.04) / 2, z), "wood", sides=6, bevel=0))
        p.append(box((1.42, 0.08, 1.16), (0, FLOOR - 0.04, 0), "plank", bevel=0.02))
    else:
        p.append(box((1.44, FLOOR - 0.04, 1.24), (0, (FLOOR - 0.04) / 2, 0), "stone", bevel=0.04, segments=1))
        p.append(box((1.48, 0.04, 1.28), (0, FLOOR - 0.02, 0), "stone_dark", bevel=0.012))
    # The vat: taller at each stage, its hoops navy, then brass; its roof plank, slate, then verdigris.
    vx, vz = VAT
    r, h = vat_radius(s), vat_height(s)
    p.append(cylinder(r, h, (vx, FLOOR + h / 2, vz), "wood", sides=12, bevel=0.02))
    hoops = 2 if s < 10 else 3 if s < 20 else 4
    for i in range(hoops):
        p.append(band(r + 0.012, 0.045, (vx, FLOOR + h * (i + 1) / (hoops + 1), vz), metal(s), sides=12))
    top = FLOOR + h
    p.append(cone(r + 0.05, 0.26, (vx, top, vz), roof(s), sides=12))
    # The chimney: copper, taller with each stage, a band at its top.
    ch = {1: 0.35, 5: 0.55, 10: 0.7, 15: 0.8, 20: 0.9, 25: 1.0, 30: 1.05}[s]
    cx, cz = vx + 0.14, vz - 0.14
    p.append(cylinder(0.065, ch, (cx, top + 0.06 + ch / 2, cz), "copper", sides=8, bevel=0))
    p.append(cylinder(0.085, 0.06, (cx, top + 0.06 + ch, cz), metal(s), sides=8, bevel=0.008))
    # The shed beside it: a second floor from 15, a lit window from 20.
    sx, sz = SHED
    sh = shed_height(s)
    p.append(box((0.48, sh, 0.44), (sx, FLOOR + sh / 2, sz), "plank" if s < 10 else "stone", bevel=0.02))
    p.append(box((0.13, 0.22, 0.02), (sx - 0.08, FLOOR + 0.11, sz + 0.225), "dark", bevel=0.004))
    if s >= 15:
        p.append(box((0.52, 0.04, 0.48), (sx, FLOOR + 0.41, sz), "wood", bevel=0.01))
        p.append(box((0.12, 0.11, 0.02), (sx + 0.08, FLOOR + 0.53, sz + 0.225), "gold" if s >= 20 else "dark", bevel=0.004))
    p.append(prism_roof(0.58, 0.54, 0.22, (sx, FLOOR + sh, sz), roof(s)))
    # Barrels at the front.
    p.append(barrel((0.0, FLOOR + 0.13, 0.5)))
    p.append(barrel((-0.26, FLOOR + 0.13, 0.52), color="plank"))
    # 5: a copper still at the back, its pipe arching into the vat. 10: it becomes a tank.
    if 5 <= s < 10:
        p.append(cylinder(0.17, 0.26, (0.5, FLOOR + 0.13, -0.42), "copper", sides=10, bevel=0.02))
        p.append(cone(0.17, 0.16, (0.5, FLOOR + 0.26, -0.42), "copper", sides=10))
        p.append(rod((0.5, FLOOR + 0.42, -0.42), (0.22, FLOOR + 0.52, -0.3), 0.03, "copper"))
        p.append(rod((0.22, FLOOR + 0.52, -0.3), (vx + r - 0.02, FLOOR + 0.44, vz - 0.05), 0.03, "copper"))
    if s >= 10:
        th = 0.55 if s < 20 else 0.7
        p.append(cylinder(0.23, th, (0.5, FLOOR + th / 2, -0.42), "copper", sides=10, bevel=0.02))
        p.append(cone(0.25, 0.13, (0.5, FLOOR + th, -0.42), metal(s), sides=10))
        p.append(rod((0.3, FLOOR + th * 0.7, -0.36), (vx + r - 0.02, FLOOR + th * 0.7, vz - 0.06), 0.035, metal(s)))
    # 15: a hoist on the shed, a barrel hanging from it.
    if s >= 15:
        top_shed = FLOOR + sh + 0.18
        p.append(rod((sx + 0.1, top_shed, sz), (0.66, top_shed + 0.05, 0.46), 0.025, "wood", 6))
        p.append(rod((0.66, top_shed + 0.05, 0.46), (0.66, FLOOR + 0.42, 0.46), 0.008, "plank", 4))
        p.append(barrel((0.66, FLOOR + 0.32, 0.46), radius=0.08, height=0.18))
    # 20: a flare tower at the back left, its flame gold.
    if s >= 20:
        fh = 1.2 if s < 25 else 1.35
        fx, fz = -0.6, -0.45
        p.append(cylinder(0.05, fh, (fx, FLOOR + fh / 2, fz), "navy", sides=8, bevel=0))
        for y in (0.4, 0.8):
            p.append(band(0.06, 0.04, (fx, FLOOR + y, fz), "brass", sides=8))
        p.append(cone(0.1, 0.24, (fx, FLOOR + fh, fz), "gold", sides=8))
    # 25: a distillation column at the back, a ring of catwalk around it.
    if s >= 25:
        kx, kz = 0.18, -0.58
        p.append(cylinder(0.09, 1.25, (kx, FLOOR + 0.625, kz), "copper", sides=8, bevel=0))
        for y in (0.35, 0.7, 1.05):
            p.append(band(0.1, 0.035, (kx, FLOOR + y, kz), "brass", sides=8))
        p.append(cone(0.11, 0.12, (kx, FLOOR + 1.25, kz), "brass", sides=10))
        p.extend(rail_ring(0.16, (kx, FLOOR + 0.66, kz), color="navy", posts=6, height=0.09))
    # 30: a gantry over the back, with two lanterns.
    if s >= 30:
        for x in (0.06, 0.66):
            p.append(box((0.07, 1.05, 0.07), (x, FLOOR + 0.525, -0.56), "navy", bevel=0.01))
        p.append(box((0.68, 0.08, 0.1), (0.36, FLOOR + 1.05, -0.56), "brass", bevel=0.015))
        for x in (0.22, 0.52):
            p.extend(lantern((x, FLOOR + 0.94, -0.56), size=0.09))
    # The flag of its tier, on the shed's roof.
    p.extend(flag((sx + 0.04, FLOOR + sh + 0.1, sz - 0.12), flag_color(s), height=0.5 if s < 20 else 0.62))
    return p


def on_floor(x, z):
    return (x, FLOOR, z)


def on_vat(angle, s, height, out=0.012):
    """A point on the vat's wall at `angle` (degrees, from +x toward the camera), `height` above the floor."""
    a = math.radians(angle)
    r = vat_radius(s) + out
    return (VAT[0] + math.cos(a) * r, FLOOR + height, VAT[1] + math.sin(a) * r)


def facing(angle):
    """A box's turn so that its face looks out of the vat at `angle`."""
    return -math.radians(angle - 90)


# A detail at every level that is not a stage, each where the close view sees it and in a place of its own (front of
# the floor, the vat's and the shed's walls the camera sees, the roofs); they stay at the stages after theirs. Each
# function takes the stage it is drawn at.
DETAILS = {
    # Levels 2 to 4: the yard fills.
    2: lambda s: crate(on_floor(-0.6, 0.45), size=0.16),
    3: lambda s: ladder((-0.6, FLOOR, 0.29), on_vat(135, s, 0.46, out=0.03)),
    4: lambda s: drum(on_floor(0.18, 0.48), color="navy"),
    # 6 to 9: the still's tools.
    6: lambda s: [rod((0.1, FLOOR, 0.3), (0.1, FLOOR + 0.24, 0.3), 0.02, "copper", 6), *wheel((0.1, FLOOR + 0.26, 0.31), radius=0.08, color="gold")],
    7: lambda s: rope_coil((0.0, FLOOR + 0.26, 0.5), radius=0.06),
    8: lambda s: [box((0.2, 0.12, 0.02), (SHED[0] + 0.1, FLOOR + 0.3, SHED[1] + 0.232), "plank", bevel=0.005), cone(0.035, 0.06, (SHED[0] + 0.1, FLOOR + 0.27, SHED[1] + 0.245), "gold", sides=6)],
    9: lambda s: [cylinder(0.075, 0.05, (0.59, FLOOR + 0.1, SHED[1] + 0.25), "copper", sides=8, bevel=0, tilt=(math.radians(90), 0)), cylinder(0.045, 0.055, (0.59, FLOOR + 0.1, SHED[1] + 0.25), "dark", sides=6, bevel=0, tilt=(math.radians(90), 0))],
    # 11 to 14: the stone yard's stores.
    11: lambda s: [sack(on_floor(0.36, 0.52)), sack(on_floor(0.47, 0.53), size=0.14)],
    12: lambda s: gauge(on_vat(90, s, 0.42), radius=0.075),
    13: lambda s: [cylinder(0.045, 0.11, (-0.13, FLOOR + 0.055, 0.42), "copper", sides=6, bevel=0), cylinder(0.015, 0.04, (-0.13, FLOOR + 0.13, 0.42), "brass", sides=4, bevel=0)],
    14: lambda s: [cylinder(0.1, 0.03, (VAT[0] + 0.14, FLOOR + vat_height(s) + 0.06 + {10: 0.7, 15: 0.8, 20: 0.9, 25: 1.0, 30: 1.05}[s] + 0.05, VAT[1] - 0.14), "dark", sides=8, bevel=0)],
    # 16 to 19: the second floor's work.
    16: lambda s: [rod((SHED[0] - 0.08, FLOOR + 0.36, SHED[1] + 0.22), (SHED[0] - 0.08, FLOOR + 0.36, SHED[1] + 0.3), 0.01, "navy", 4), *lantern((SHED[0] - 0.08, FLOOR + 0.31, SHED[1] + 0.3), size=0.07)],
    17: lambda s: [rod((-0.68, FLOOR + 0.2, -0.3), (-0.68, FLOOR + 0.2, 0.0), 0.03, "copper"), rod((-0.68, FLOOR, -0.15), (-0.68, FLOOR + 0.2, -0.15), 0.02, "navy", 5)],
    18: lambda s: [drum(on_floor(-0.46, 0.5), color="copper", radius=0.06, height=0.15), drum((-0.46, FLOOR + 0.15, 0.5), color="copper", radius=0.06, height=0.15)],
    19: lambda s: [box((0.17, 0.17, 0.02), on_vat(112, s, 0.3, out=0.02), "cream", bevel=0.005, turn=facing(112)), cone(0.045, 0.08, on_vat(112, s, 0.26, out=0.035), "navy", sides=6)],
    # 21 to 24: brass.
    21: lambda s: [rod((SHED[0] - 0.22, FLOOR + 0.62, SHED[1] + 0.22), (SHED[0] - 0.22, FLOOR + 0.62, SHED[1] + 0.3), 0.01, "dark", 4), cone(0.05, 0.08, (SHED[0] - 0.22, FLOOR + 0.52, SHED[1] + 0.3), "brass", sides=8)],
    22: lambda s: rail_ring(vat_radius(s) + 0.03, (VAT[0], FLOOR + vat_height(s), VAT[1]), color="brass", posts=6, height=0.1),
    23: lambda s: [cylinder(0.04, 0.09, (-0.26, FLOOR + 0.31, 0.52), "brass", sides=6, bevel=0), rod((-0.26, FLOOR + 0.355, 0.52), (-0.21, FLOOR + 0.39, 0.52), 0.008, "brass", 3)],
    24: lambda s: [box((0.1, 0.13, 0.02), (0.6, FLOOR + 0.54, SHED[1] + 0.232), "navy", bevel=0), gauge((0.6, FLOOR + 0.55, SHED[1] + 0.242), radius=0.035)],
    # 26 to 29: the last touches.
    26: lambda s: [cylinder(0.05, 0.1, (SHED[0] + 0.2, FLOOR + shed_height(s) + 0.03, SHED[1] + 0.18), "brass", sides=6, bevel=0, top=0.03)],
    27: lambda s: [rod((SHED[0] - 0.24, FLOOR + 0.62, SHED[1] + 0.22), on_vat(70, s, 0.7, out=0.0), 0.006, "dark", 3), *lantern(on_vat(80, s, 0.6, out=0.06), size=0.06)],
    28: lambda s: barrel((-0.6, FLOOR + 0.16 + 0.1, 0.45), radius=0.07, height=0.18),
    29: lambda s: [rod((VAT[0], FLOOR + vat_height(s) + 0.26, VAT[1]), (VAT[0], FLOOR + vat_height(s) + 0.42, VAT[1]), 0.012, "brass", 5), box((0.14, 0.05, 0.01), (VAT[0] + 0.05, FLOOR + vat_height(s) + 0.4, VAT[1]), "gold", bevel=0.003)],
}
