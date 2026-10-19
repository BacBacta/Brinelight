"""
The Refinery (art direction: a round hooped vat, a short copper chimney) in its six eras (docs/tasks/week-8.md, "The
eras"), each a different building, and a detail at every other level within its era:

- Salvage (1–4): a lean-to of driftwood and tin on drums, two oil drums over a fire, a stovepipe, a tarp;
- Colony (5–9): a plank workshop on a stone foundation, a hooped wooden vat, a glazed window, shingles;
- Workshop (10–14): a brick still-house with a tall brick chimney, timber beams, a copper boiler and its flywheel;
- Industry (15–19): two tall riveted steel tanks, a catwalk between them, pipes, steam, a small gantry crane;
- Electricity (20–24): a steel-framed hall with a glass roof, a wind turbine, cables on poles, electric lamps;
- Modern (25–30): a glass-and-steel tower, slim white tanks, solar panels, an antenna with a warm light.

Its plot is 2 wide: everything stays within 0.93 of its center (hex distance), under the Lighthouse's top. The camera
looks from the front (+z): each era's details stand at the front and on the walls it sees.
"""
import math

from kit import band, barrel, box, cone, crate, cylinder, drum, flag, gauge, ladder, lamp_post, lantern, prism_roof, rail_ring, ring, rod, rope_coil, sack, sphere, wheel
from stages import era_of


def roof_slope(size, at, color, tilt_deg):
    """A single-slope roof: a thin box tilted toward the camera."""
    return box(size, at, color, bevel=0.01, tilt=(math.radians(tilt_deg), 0))


# ---------------------------------------------------------------------------------------------------------------- Salvage
SALVAGE_FLOOR = 0.24


def salvage(s):
    f = SALVAGE_FLOOR
    p = []
    # Oil drums for stilts, a platform of mismatched driftwood boards.
    for x, z in ((-0.55, -0.42), (0.05, -0.45), (0.58, -0.38), (-0.55, 0.4), (0.05, 0.44), (0.58, 0.4)):
        p.append(cylinder(0.11, f - 0.04, (x, (f - 0.04) / 2, z), "navy" if (x + z) > 0 else "steel", sides=8, bevel=0))
    for i, (w, dz, turn) in enumerate(((0.42, -0.38, 0.03), (0.36, -0.02, -0.04), (0.4, 0.34, 0.02))):
        p.append(box((1.36, 0.06, w), (0, f - 0.03, dz), "wood" if i % 2 else "plank", bevel=0.012, turn=turn))
    # The lean-to at the back left: driftwood posts, patched tin walls, a tin roof sloping to the front, a cream tarp.
    for x, z, h in ((-0.62, -0.5, 0.78), (0.1, -0.5, 0.78), (-0.62, 0.0, 0.56), (0.1, 0.0, 0.56)):
        p.append(cylinder(0.035, h, (x, f + h / 2, z), "wood", sides=6, bevel=0))
    p.append(box((0.72, 0.62, 0.03), (-0.26, f + 0.31, -0.5), "tin", bevel=0.004))
    p.append(box((0.03, 0.5, 0.5), (-0.62, f + 0.25, -0.25), "tin", bevel=0.004))
    for x, y, w, h, c in ((-0.45, 0.42, 0.22, 0.16, "steel"), (-0.1, 0.2, 0.18, 0.2, "stone_dark"), (-0.3, 0.12, 0.16, 0.12, "copper")):
        p.append(box((w, h, 0.012), (x, f + y, -0.48), c, bevel=0.002))
    p.append(roof_slope((0.86, 0.035, 0.66), (-0.26, f + 0.68, -0.24), "tin", -18))
    p.append(roof_slope((0.5, 0.02, 0.44), (-0.38, f + 0.71, -0.22), "cream", -18))
    # The still: two drums lying over a fire of stones, a stovepipe from the lean-to.
    for dx in (0.0, 0.2):
        p.append(cylinder(0.1, 0.3, (0.32 + dx, f + 0.2, -0.05), "steel" if dx else "navy", sides=10, bevel=0, tilt=(math.radians(90), 0)))
    for a in range(6):
        ang = math.radians(a * 60)
        p.append(sphere(0.045, (0.42 + math.cos(ang) * 0.18, f + 0.03, -0.05 + math.sin(ang) * 0.12), "rock_dark", subdivisions=1, squash=0.7))
    p.append(cone(0.07, 0.1, (0.42, f, -0.05), "gold", sides=6))
    p.append(cylinder(0.035, 0.75, (-0.05, f + 0.6, -0.35), "steel", sides=6, bevel=0))
    p.append(rod((-0.05, f + 0.97, -0.35), (0.1, f + 1.05, -0.35), 0.035, "steel", 6))
    p.append(rod((0.32, f + 0.25, -0.05), (0.1, f + 0.5, -0.32), 0.02, "copper", 5))
    # Ropes between the posts, a rag flag on a stick.
    p.append(rod((0.1, f + 0.5, 0.0), (0.42, f + 0.3, 0.36), 0.008, "plank", 3))
    p.extend(flag((0.42, f, 0.36), "cream", height=0.55))
    return p


# ----------------------------------------------------------------------------------------------------------------- Colony
COLONY_FLOOR = 0.2
COLONY_VAT = (-0.32, -0.1)


def colony(s):
    f = COLONY_FLOOR
    p = [box((1.4, f, 1.2), (0, f / 2, 0), "stone", bevel=0.03)]
    # The plank workshop at the right, a shingle roof, a glazed window and a door.
    p.append(box((0.62, 0.52, 0.56), (0.32, f + 0.26, -0.08), "plank", bevel=0.015))
    p.append(prism_roof(0.72, 0.66, 0.3, (0.32, f + 0.52, -0.08), "wood"))
    p.append(box((0.16, 0.26, 0.02), (0.2, f + 0.13, 0.205), "dark", bevel=0.004))
    p.append(box((0.16, 0.14, 0.02), (0.46, f + 0.32, 0.205), "glass", bevel=0.004))
    p.append(box((0.18, 0.02, 0.025), (0.46, f + 0.4, 0.21), "wood", bevel=0))
    p.append(box((0.02, 0.16, 0.025), (0.46, f + 0.32, 0.215), "wood", bevel=0))
    # The hooped wooden vat at the left, its cone roof, a stone chimney on the workshop.
    vx, vz = COLONY_VAT
    p.append(cylinder(0.32, 0.6, (vx, f + 0.3, vz), "wood", sides=12, bevel=0.015))
    for y in (0.18, 0.42):
        p.append(band(0.33, 0.04, (vx, f + y, vz), "navy", sides=12))
    p.append(cone(0.37, 0.24, (vx, f + 0.6, vz), "plank", sides=12))
    p.append(box((0.14, 0.42, 0.14), (0.5, f + 0.62, -0.24), "stone", bevel=0.01))
    p.append(box((0.17, 0.04, 0.17), (0.5, f + 0.84, -0.24), "stone_dark", bevel=0.005))
    p.append(rod((vx + 0.3, f + 0.45, vz), (0.02, f + 0.4, -0.1), 0.025, "copper", 6))
    p.extend(flag((0.05, f + 0.6, -0.36), "cream", height=0.5))
    return p


# --------------------------------------------------------------------------------------------------------------- Workshop
WORK_FLOOR = 0.16


def workshop(s):
    f = WORK_FLOOR
    p = [box((1.44, f, 1.22), (0, f / 2, 0), "stone_dark", bevel=0.02)]
    # The brick still-house: two floors, timber beams, a slate roof, tall windows.
    hx, hz = -0.18, -0.2
    p.append(box((0.86, 0.8, 0.6), (hx, f + 0.4, hz), "brick", bevel=0.01))
    for y in (0.0, 0.4, 0.8):
        p.append(box((0.9, 0.04, 0.03), (hx, f + y, hz + 0.31), "wood", bevel=0))
    for x in (-0.42, 0.06):
        p.append(box((0.04, 0.8, 0.03), (hx + x + 0.18, f + 0.4, hz + 0.31), "wood", bevel=0))
    p.append(prism_roof(0.96, 0.7, 0.3, (hx, f + 0.8, hz), "stone_dark"))
    for x in (-0.3, -0.06, 0.18):
        p.append(box((0.12, 0.2, 0.02), (hx + x, f + 0.56, hz + 0.31), "glass", bevel=0.004))
    p.append(box((0.18, 0.3, 0.02), (hx - 0.06, f + 0.15, hz + 0.31), "dark", bevel=0.004))
    # The tall brick chimney at the back right: the era's silhouette.
    p.append(cylinder(0.13, 1.7, (0.42, f + 0.85, -0.42), "brick", sides=8, bevel=0, top=0.1))
    p.append(band(0.12, 0.06, (0.42, f + 1.62, -0.42), "stone_dark", sides=8))
    # The copper boiler lying at the front right, its flywheel pump.
    p.append(cylinder(0.16, 0.5, (0.42, f + 0.2, 0.18), "copper", sides=10, bevel=0.02, tilt=(math.radians(90), 0)))
    p.append(sphere(0.16, (0.42, f + 0.2, -0.07), "copper", subdivisions=1))
    p.append(cylinder(0.2, 0.03, (0.67, f + 0.25, 0.18), "navy", sides=12, bevel=0, tilt=(0, math.radians(90))))
    p.append(rod((0.42, f + 0.36, 0.18), (0.42, f + 0.62, -0.1), 0.025, "copper", 6))
    p.extend(flag((hx - 0.38, f + 1.0, hz), "navy", height=0.5))
    return p


# --------------------------------------------------------------------------------------------------------------- Industry
IND_FLOOR = 0.12
TANKS = ((-0.32, -0.28, 0.3, 1.45), (0.38, -0.3, 0.26, 1.15))


def industry(s):
    f = IND_FLOOR
    p = [box((1.46, f, 1.26), (0, f / 2, 0), "concrete", bevel=0.015)]
    # Two tall riveted steel tanks, domed, rivet bands, a catwalk between their tops.
    for x, z, r, h in TANKS:
        p.append(cylinder(r, h, (x, f + h / 2, z), "steel", sides=12, bevel=0))
        for k in range(1, 4):
            p.append(band(r + 0.008, 0.025, (x, f + h * k / 4, z), "stone_dark", sides=12))
        p.append(sphere(r, (x, f + h, z), "steel", subdivisions=2, squash=0.35))
    p.append(box((0.5, 0.03, 0.12), (0.03, f + 1.12, -0.3), "steel", bevel=0))
    p.append(rod((-0.2, f + 1.2, -0.25), (0.26, f + 1.2, -0.25), 0.01, "navy", 4))
    # A pump house at the front left, corrugated roof; pipes from the tanks to it.
    p.append(box((0.46, 0.34, 0.32), (-0.36, f + 0.17, 0.32), "steel", bevel=0.01))
    p.append(roof_slope((0.52, 0.03, 0.4), (-0.36, f + 0.36, 0.32), "tin", 10))
    p.append(box((0.14, 0.22, 0.02), (-0.36, f + 0.11, 0.485), "dark", bevel=0.003))
    p.append(rod((-0.32, f + 0.3, 0.02), (-0.32, f + 0.3, 0.17), 0.04, "stone_dark", 8))
    p.append(rod((0.38, f + 0.25, -0.04), (0.38, f + 0.25, 0.3), 0.04, "stone_dark", 8))
    p.append(rod((0.38, f + 0.25, 0.3), (-0.13, f + 0.25, 0.3), 0.04, "stone_dark", 8))
    # A vent stack with its steam, and a small gantry crane over the front right.
    p.append(cylinder(0.05, 1.05, (0.05, f + 0.52, -0.05), "stone_dark", sides=8, bevel=0))
    for i, (dx, y, r) in enumerate(((0.02, 1.15, 0.1), (0.08, 1.3, 0.13), (0.0, 1.47, 0.11))):
        p.append(sphere(r, (0.05 + dx, f + y, -0.05 + i * 0.02), "steam", subdivisions=1))
    for x in (0.2, 0.66):
        p.append(box((0.05, 0.62, 0.05), (x, f + 0.31, 0.46), "navy", bevel=0))
    p.append(box((0.52, 0.06, 0.07), (0.43, f + 0.62, 0.46), "navy", bevel=0))
    p.append(rod((0.5, f + 0.6, 0.46), (0.5, f + 0.32, 0.46), 0.006, "dark", 3))
    p.append(crate((0.5, f + 0.2, 0.46), size=0.12))
    p.extend(flag((-0.32, f + 1.45 + 0.08, -0.28), "navy", height=0.42))
    return p


# ------------------------------------------------------------------------------------------------------------ Electricity
ELEC_FLOOR = 0.12
HALL = (0.18, -0.12, 0.94, 0.62)  # x, z, width, depth


def electricity(s):
    f = ELEC_FLOOR
    hx, hz, hw, hd = HALL
    p = [box((1.46, f, 1.26), (0, f / 2, 0), "concrete", bevel=0.015)]
    # The hall: a low brick base, steel columns, glass walls and a glass roof on steel ribs.
    p.append(box((hw, 0.2, hd), (hx, f + 0.1, hz), "brick", bevel=0.008))
    p.append(box((hw - 0.04, 0.42, hd - 0.04), (hx, f + 0.41, hz), "glass", bevel=0.004))
    for x in (-hw / 2, -hw / 6, hw / 6, hw / 2):
        for z in (-hd / 2, hd / 2):
            p.append(box((0.04, 0.64, 0.04), (hx + x, f + 0.32, hz + z), "steel", bevel=0))
    p.append(prism_roof(hw + 0.06, hd + 0.06, 0.32, (hx, f + 0.62, hz), "glass"))
    for x in (-hw / 2, -hw / 6, hw / 6, hw / 2):
        p.append(prism_roof(0.035, hd + 0.08, 0.33, (hx + x, f + 0.62, hz), "steel"))
    p.append(box((0.2, 0.3, 0.02), (hx - 0.2, f + 0.15, hz + hd / 2 + 0.012), "dark", bevel=0.003))
    # The wind turbine at the back left: the era's silhouette.
    tx, tz, th = -0.4, -0.52, 2.45
    p.append(cylinder(0.05, th, (tx, f + th / 2, tz), "white", sides=8, bevel=0, top=0.03))
    p.append(box((0.08, 0.08, 0.2), (tx, f + th, tz - 0.02), "white", bevel=0.02))
    p.append(cone(0.045, 0.08, (tx, f + th, tz + 0.08), "white", sides=6))
    for k in range(3):
        a = math.radians(90 + k * 120)
        p.append(box((0.05, 0.46, 0.015), (tx + math.cos(a) * 0.26, f + th + math.sin(a) * 0.26, tz + 0.1), "white", bevel=0.004, turn=0))
        # Each blade along its own radius, in the plane the camera faces.
        p[-1].rotation_euler = (0, math.radians(90) - a, 0)
    # Cables on poles to the hall, electric lamps.
    for x, z in ((0.66, 0.38), (-0.3, 0.42)):
        p.append(cylinder(0.025, 0.85, (x, f + 0.42, z), "wood", sides=6, bevel=0))
        p.append(box((0.22, 0.03, 0.03), (x, f + 0.8, z), "wood", bevel=0))
    p.append(rod((0.66, f + 0.8, 0.38), (-0.3, f + 0.8, 0.42), 0.006, "dark", 3))
    p.append(rod((0.66, f + 0.8, 0.38), (hx + hw / 2, f + 0.6, hz), 0.006, "dark", 3))
    p.append(rod((tx, f + 0.6, tz), (hx - hw / 2, f + 0.5, hz), 0.006, "dark", 3))
    for x in (0.66, -0.3):
        p.append(sphere(0.045, (x, f + 0.74, 0.42 if x < 0 else 0.38), "gold", subdivisions=1))
    p.extend(flag((hx + hw / 2 - 0.22, f + 0.94, hz - 0.1), "copper", height=0.45))
    return p


# ----------------------------------------------------------------------------------------------------------------- Modern
MOD_FLOOR = 0.1
TOWER = (-0.22, -0.2, 0.56, 0.5, 2.1)  # x, z, width, depth, height


def modern(s):
    f = MOD_FLOOR
    tx, tz, tw, td, th = TOWER
    p = [box((1.46, f, 1.26), (0, f / 2, 0), "concrete", bevel=0.01)]
    # The glass-and-steel tower, in two volumes, white bands at each floor, a slim crown.
    p.append(box((tw, th, td), (tx, f + th / 2, tz), "glass", bevel=0.006))
    for k in range(1, 7):
        p.append(box((tw + 0.02, 0.025, td + 0.02), (tx, f + th * k / 7, tz), "white", bevel=0))
    for x in (-tw / 2, 0, tw / 2):
        p.append(box((0.03, th, 0.03), (tx + x, f + th / 2, tz + td / 2 + 0.005), "white", bevel=0))
    p.append(box((tw * 0.7, 0.3, td * 0.7), (tx, f + th + 0.15, tz), "white", bevel=0.01))
    # The low wing at the right, solar panels on its roof.
    p.append(box((0.62, 0.46, 0.6), (0.38, f + 0.23, -0.1), "white", bevel=0.01))
    p.append(box((0.5, 0.14, 0.02), (0.38, f + 0.3, 0.205), "glass", bevel=0.003))
    for k in range(2):
        p.append(box((0.26, 0.02, 0.44), (0.24 + k * 0.28, f + 0.52, -0.1), "solar", bevel=0, tilt=(math.radians(-14), 0)))
    # Slim white tanks at the front left, capsule tops.
    for x in (-0.58, -0.4):
        p.append(cylinder(0.075, 0.7, (x, f + 0.35, 0.3), "white", sides=10, bevel=0))
        p.append(sphere(0.075, (x, f + 0.7, 0.3), "white", subdivisions=1, squash=0.6))
        p.append(band(0.08, 0.025, (x, f + 0.5, 0.3), "gold", sides=10))
    # The antenna on the tower, its warm light at the top.
    p.append(cylinder(0.018, 0.6, (tx + 0.1, f + th + 0.6, tz), "steel", sides=5, bevel=0))
    p.append(sphere(0.04, (tx + 0.1, f + th + 0.92, tz), "gold", subdivisions=1))
    p.extend(flag((0.44, f + 0.46, -0.32), "gold", height=0.42))
    # 30: the era complete, a gold crown on the tower and a second, shorter mast.
    if s >= 30:
        # A lit gold crown room over the white one, a gold band at its foot, a second, taller mast.
        p.append(box((tw * 0.56, 0.2, td * 0.56), (tx, f + th + 0.4, tz), "gold", bevel=0.01))
        p.append(box((tw * 0.62, 0.03, td * 0.62), (tx, f + th + 0.515, tz), "white", bevel=0))
        p.append(band(tw * 0.5, 0.05, (tx, f + th + 0.04, tz), "gold", sides=4))
        p.append(cylinder(0.014, 0.5, (tx - 0.12, f + th + 0.75, tz + 0.06), "steel", sides=5, bevel=0))
        p.append(sphere(0.035, (tx - 0.12, f + th + 1.02, tz + 0.06), "gold", subdivisions=1))
    return p


BUILD = {"salvage": salvage, "colony": colony, "workshop": workshop, "industry": industry, "electricity": electricity, "modern": modern}


def base(s):
    return BUILD[era_of(s)](s)


# Each era's details, one a level, in its free places at the front and on the walls the camera sees.
DETAILS = {
    # Salvage: a crate, a coil of rope, a lantern on a post.
    2: lambda s: crate((-0.45, SALVAGE_FLOOR, 0.36), size=0.15, turn=0.3),
    3: lambda s: rope_coil((-0.18, SALVAGE_FLOOR, 0.42), radius=0.07),
    4: lambda s: lamp_post((0.3, SALVAGE_FLOOR, 0.42), height=0.4, color="wood"),
    # Colony: a woodpile, a water barrel, a flower box under the window, a bench.
    6: lambda s: [box((0.3, 0.05, 0.1), (-0.4 + 0.0, COLONY_FLOOR + 0.025 + 0.05 * k, 0.4), "wood", bevel=0.01, turn=0.05 * k) for k in range(3)],
    7: lambda s: barrel((0.62, COLONY_FLOOR + 0.13, 0.36), radius=0.09, height=0.22),
    8: lambda s: [box((0.2, 0.05, 0.06), (0.46, COLONY_FLOOR + 0.22, 0.24), "wood", bevel=0.005), *[sphere(0.03, (0.4 + 0.05 * k, COLONY_FLOOR + 0.27, 0.24), "gold" if k % 2 else "meadow", subdivisions=1) for k in range(3)]],
    9: lambda s: [box((0.32, 0.03, 0.1), (-0.1, COLONY_FLOOR + 0.12, 0.42), "plank", bevel=0.005), box((0.03, 0.1, 0.08), (-0.24, COLONY_FLOOR + 0.05, 0.42), "wood", bevel=0), box((0.03, 0.1, 0.08), (0.04, COLONY_FLOOR + 0.05, 0.42), "wood", bevel=0)],
    # Workshop: a heap of coal, a handcart, a gauge on the boiler, a stack of bricks.
    11: lambda s: [sphere(0.13, (-0.5, WORK_FLOOR, 0.36), "dark", subdivisions=1, squash=0.5), rod((-0.4, WORK_FLOOR, 0.4), (-0.36, WORK_FLOOR + 0.22, 0.38), 0.01, "wood", 4)],
    12: lambda s: [box((0.24, 0.08, 0.16), (-0.15, WORK_FLOOR + 0.12, 0.42), "wood", bevel=0.008), cylinder(0.06, 0.03, (-0.28, WORK_FLOOR + 0.06, 0.42), "dark", sides=8, bevel=0, tilt=(0, math.radians(90))), rod((-0.03, WORK_FLOOR + 0.12, 0.42), (0.08, WORK_FLOOR + 0.2, 0.42), 0.01, "wood", 4)],
    13: lambda s: gauge((0.42, WORK_FLOOR + 0.37, 0.25), radius=0.06),
    14: lambda s: [box((0.2, 0.06, 0.1), (0.05, WORK_FLOOR + 0.03 + 0.06 * k, 0.46), "brick", bevel=0.004, turn=0.1 * k) for k in range(3)],
    # Industry: a valve wheel, a stack of drums, a ladder up a tank, a warning lamp.
    16: lambda s: [rod((0.12, IND_FLOOR, 0.3), (0.12, IND_FLOOR + 0.24, 0.3), 0.02, "stone_dark", 6), *wheel((0.12, IND_FLOOR + 0.26, 0.31), radius=0.08, color="gold")],
    17: lambda s: [drum((-0.05, IND_FLOOR, 0.48), color="navy", radius=0.07, height=0.17), drum((0.1, IND_FLOOR, 0.5), color="steel", radius=0.07, height=0.17), drum((0.02, IND_FLOOR + 0.17, 0.49), color="navy", radius=0.07, height=0.17)],
    18: lambda s: ladder((-0.06, IND_FLOOR, -0.12), (-0.04, IND_FLOOR + 1.1, -0.2), width=0.14),
    19: lambda s: [cylinder(0.02, 0.06, (0.03, IND_FLOOR + 1.16, -0.24), "steel", sides=5, bevel=0), sphere(0.045, (0.03, IND_FLOOR + 1.22, -0.24), "gold", subdivisions=1)],
    # Electricity: a cable reel, a street lamp, a fuse box, a floodlight.
    21: lambda s: [cylinder(0.11, 0.06, (-0.5, ELEC_FLOOR + 0.11, 0.2), "wood", sides=10, bevel=0, tilt=(math.radians(90), 0)), cylinder(0.07, 0.065, (-0.5, ELEC_FLOOR + 0.11, 0.2), "dark", sides=8, bevel=0, tilt=(math.radians(90), 0))],
    22: lambda s: [cylinder(0.02, 0.62, (0.2, ELEC_FLOOR + 0.31, 0.5), "navy", sides=6, bevel=0), rod((0.2, ELEC_FLOOR + 0.62, 0.5), (0.3, ELEC_FLOOR + 0.66, 0.5), 0.012, "navy", 4), sphere(0.045, (0.32, ELEC_FLOOR + 0.62, 0.5), "gold", subdivisions=1)],
    23: lambda s: [box((0.16, 0.22, 0.08), (0.5, ELEC_FLOOR + 0.11, 0.3), "navy", bevel=0.006), *[cylinder(0.015, 0.05, (0.45 + 0.05 * k, ELEC_FLOOR + 0.25, 0.3), "cream", sides=5, bevel=0) for k in range(3)]],
    24: lambda s: [box((0.12, 0.08, 0.06), (HALL[0] + HALL[2] / 2 - 0.1, ELEC_FLOOR + 0.6, HALL[1] + HALL[3] / 2 + 0.06), "navy", bevel=0.005), box((0.1, 0.06, 0.01), (HALL[0] + HALL[2] / 2 - 0.1, ELEC_FLOOR + 0.6, HALL[1] + HALL[3] / 2 + 0.095), "gold", bevel=0)],
    # Modern: a row of ground solar panels, a pump terminal, a planter with a bench, a dish.
    26: lambda s: [box((0.22, 0.02, 0.16), (-0.1 + 0.24 * k, MOD_FLOOR + 0.12, 0.5), "solar", bevel=0, tilt=(math.radians(-25), 0)) for k in range(2)] + [rod((-0.1 + 0.24 * k, MOD_FLOOR, 0.5), (-0.1 + 0.24 * k, MOD_FLOOR + 0.1, 0.5), 0.012, "steel", 4) for k in range(2)],
    27: lambda s: [box((0.1, 0.3, 0.08), (0.62, MOD_FLOOR + 0.15, 0.4), "white", bevel=0.01), box((0.06, 0.08, 0.01), (0.62, MOD_FLOOR + 0.22, 0.445), "gold", bevel=0)],
    28: lambda s: [box((0.3, 0.12, 0.12), (-0.1, MOD_FLOOR + 0.06, 0.3), "concrete", bevel=0.01), *[sphere(0.05, (-0.19 + 0.09 * k, MOD_FLOOR + 0.14, 0.3), "meadow", subdivisions=1) for k in range(3)]],
    29: lambda s: [cylinder(0.11, 0.02, (TOWER[0] - 0.12, MOD_FLOOR + TOWER[4] + 0.4, TOWER[1] + 0.05), "white", sides=10, bevel=0, tilt=(math.radians(-50), 0)), cylinder(0.015, 0.1, (TOWER[0] - 0.12, MOD_FLOOR + TOWER[4] + 0.33, TOWER[1] + 0.05), "steel", sides=4, bevel=0)],
}
