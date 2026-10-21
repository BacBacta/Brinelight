"""
The Observatory (art direction: a round turret, a verdigris dome, a telescope) in its six eras (docs/tasks/week-8.md,
"The eras"), each a different place to watch the sky, and a detail at every other level within its era. It stands in
the middle row on the left (client/src/city/plots.ts), its turret at the back of its plot, so the Harbor behind it
stays in sight (client/test/visible.test.ts).

- Salvage (1–4): a platform on driftwood stilts, a spyglass on a tripod, a tarp against the wind;
- Colony (5–9): a round plank tower, its wooden roof turned by hand with a crank;
- Workshop (10–14): a brick turret, a verdigris copper dome, a brass telescope out of its slit;
- Industry (15–19): a riveted steel dome on a rail and its wheels, a large refractor, clockwork;
- Electricity (20–24): an electric verdigris dome, its motor and cables, a weather station with its anemometer;
- Modern (25–30): a white dome, a radio dish, solar panels, an antenna; at 30, a gold ring at the dome's foot.
"""
import math

from kit import band, barrel, box, cone, crate, cylinder, flag, ladder, rod, sphere, wheel
from parts import FLOOR, door, era_details, floor, house, window
from stages import era_of

# The turret's center: at the back of the plot, a little to the left.
CX, CZ = -0.12, -0.2
# A 10-sided drum has a flat face toward the camera, at this share of its radius.
FLAT = math.cos(math.pi / 10)


def drum(radius, height, foot, color):
    return cylinder(radius, height, (CX, foot + height / 2, CZ), color, sides=10, bevel=0)


def dome(radius, at_y, color):
    """A dome on a drum: a ball whose lower half stays inside the drum."""
    return sphere(radius, (CX, at_y, CZ), color, subdivisions=2)


# Where the telescopes look: toward the front right and up, so the camera sees their length.
AIM, RISE = math.radians(55), math.radians(34)


def slit(radius, at_y, lean=40):
    """The dome's opening toward the sky, turned to where its telescope looks."""
    a = math.radians(lean)
    out = math.cos(a) * radius * 0.9
    return box((0.09, radius * 0.95, 0.03), (CX + math.sin(AIM) * out, at_y + math.sin(a) * radius * 0.55, CZ + math.cos(AIM) * out), "dark", bevel=0, tilt=(-a, 0), turn=AIM)


def aimed(y, length, start=0.0):
    """The two ends of a telescope from the turret's axis at height `y`, pointing where the slit opens."""
    def at(d):
        return (CX + math.sin(AIM) * math.cos(RISE) * d, y + math.sin(RISE) * d, CZ + math.cos(AIM) * math.cos(RISE) * d)

    return at(start), at(length)


def telescope(a, b, radius, color, rings="brass"):
    """A tube from `a` (inside) to `b` (its lens), with a ring at its lens and one along it."""
    out = [rod(a, b, radius, color, 10)]
    for t, r in ((0.98, radius * 1.25), (0.6, radius * 1.12)):
        p = tuple(a[i] + (b[i] - a[i]) * t for i in range(3))
        out.append(rod(tuple(p[i] - (b[i] - a[i]) * 0.03 for i in range(3)), p, r, rings, 10))
    return out


def lens(x, z, foot):
    """A brass lens on a stand."""
    return [cylinder(0.012, 0.22, (x, foot + 0.11, z), "wood", sides=4, bevel=0), cylinder(0.06, 0.02, (x, foot + 0.27, z), "brass", sides=10, bevel=0, tilt=(math.radians(80), 0)), cylinder(0.045, 0.024, (x, foot + 0.27, z + 0.002), "glass", sides=10, bevel=0, tilt=(math.radians(80), 0))]


def chart_table(x, z, foot):
    """A table with a sky chart pinned on it."""
    out = [box((0.24, 0.02, 0.14), (x, foot + 0.16, z), "plank", bevel=0.004), box((0.18, 0.006, 0.1), (x, foot + 0.173, z), "cream", bevel=0)]
    out += [box((0.02, 0.15, 0.02), (x + dx, foot + 0.075, z + dz), "wood", bevel=0) for dx in (-0.1, 0.1) for dz in (-0.05, 0.05)]
    out.append(box((0.02, 0.008, 0.02), (x + 0.03, foot + 0.178, z - 0.01), "gold", bevel=0))
    return out


def star_pennant(x, z, foot):
    """A pole with a navy pennant and its gold star."""
    return [cylinder(0.014, 0.5, (x, foot + 0.25, z), "wood", sides=5, bevel=0), box((0.2, 0.12, 0.01), (x + 0.1, foot + 0.43, z), "navy", bevel=0), box((0.04, 0.04, 0.014), (x + 0.1, foot + 0.43, z), "gold", bevel=0, turn=math.radians(45))]


def crystal(x, z, foot):
    """A clear crystal on a stone, as found on the shore."""
    return [box((0.12, 0.06, 0.1), (x, foot + 0.03, z), "stone", bevel=0.01), cone(0.04, 0.14, (x, foot + 0.06, z), "glass", sides=5), cone(0.025, 0.09, (x + 0.04, foot + 0.06, z + 0.01), "glass", sides=5)]


def salvage(s):
    # The platform on driftwood stilts, its deck of boards, the ladder up to it.
    p = []
    deck = 0.6
    for x in (-0.36, 0.2):
        for z in (-0.4, 0.02):
            p.append(cylinder(0.026, deck, (x + 0.02 * (z > 0), deck / 2, z), "wood", sides=5, bevel=0))
    p.append(rod((-0.36, 0.1, -0.4), (0.2, 0.5, -0.4), 0.012, "wood", 4))
    for i, c in enumerate(("plank", "wood", "plank")):
        p.append(box((0.68, 0.05, 0.17), (-0.08 + 0.02 * (i % 2), deck + 0.025, -0.36 + 0.17 * i), c, bevel=0.008, turn=0.03 * (1 if i % 2 else -1)))
    p += ladder((0.12, 0.0, 0.34), (0.12, deck + 0.04, 0.06), width=0.14)
    # The spyglass on its tripod, the tarp against the wind at the back.
    apex = (-0.12, deck + 0.34, -0.16)
    for dx, dz in ((-0.14, -0.08), (0.12, -0.1), (0.0, 0.12)):
        p.append(rod((apex[0] + dx, deck + 0.05, apex[2] + dz), apex, 0.01, "wood", 4))
    p += telescope((-0.3, deck + 0.28, -0.2), (0.12, deck + 0.46, -0.08), 0.022, "brass", rings="dark")
    for x in (-0.38, 0.22):
        p.append(cylinder(0.014, 0.42, (x, deck + 0.21, -0.43), "wood", sides=4, bevel=0))
    p.append(box((0.56, 0.2, 0.01), (-0.08, deck + 0.3, -0.43), "navy", bevel=0, tilt=(math.radians(-6), 0)))
    # What it keeps under its deck.
    p += crate((-0.26, 0.0, -0.18), size=0.14)
    p += barrel((0.0, 0.1, -0.22), radius=0.07, height=0.2)
    p.extend(flag((0.24, deck + 0.05, -0.36), "cream", height=0.42))
    return p


def colony(s):
    p, f = floor("colony")
    r, h = 0.3, 0.78
    p.append(drum(r, h, f, "plank"))
    for y in (0.2, 0.52):
        p.append(band(r + 0.006, 0.03, (CX, f + y, CZ), "wood", sides=10))
    # The roof turned by hand: a wooden cone, its opening, the crank at its side.
    p.append(cone(r + 0.06, 0.34, (CX, f + h, CZ), "wood", sides=10))
    p.append(box((0.08, 0.26, 0.02), (CX + math.sin(AIM) * r * 0.62, f + h + 0.12, CZ + math.cos(AIM) * r * 0.62), "dark", bevel=0, tilt=(math.radians(-44), 0), turn=AIM))
    p += telescope(*aimed(f + h + 0.02, 0.5, 0.06), 0.024, "brass", rings="wood")
    p += wheel((CX + r + 0.02, f + h - 0.08, CZ + 0.04), radius=0.07, color="wood", facing="x")
    p += door(CX, f, CZ + r * FLAT, w=0.13, h=0.26, color="wood")
    p += window(CX, f + 0.56, CZ + r * FLAT, w=0.08, h=0.1)
    # A plank shed for the charts at the right.
    p += house(0.42, -0.24, 0.3, 0.3, 0.26, "plank", "wood", foot=f, roof_h=0.14, door_at=0.0)
    p.extend(flag((-0.52, f, -0.42), "cream", height=0.54))
    return p


def workshop(s):
    p, f = floor("workshop")
    r, h = 0.32, 0.78
    p.append(drum(r, h, f, "brick"))
    p.append(cylinder(r + 0.02, 0.05, (CX, f + h, CZ), "stone", sides=10, bevel=0))
    p.append(dome(r - 0.01, f + h + 0.02, "copper"))
    p.append(slit(r, f + h + 0.02))
    p += telescope(*aimed(f + h + 0.08, 0.6), 0.032, "brass", rings="dark")
    p += window(CX, f + 0.46, CZ + r * FLAT, w=0.08, h=0.18, frame="stone")
    # The brick annex at the right, with its door; the clock-weights' little window.
    p += house(0.44, -0.24, 0.32, 0.34, 0.34, "brick", "stone_dark", foot=f, roof_h=0.14, door_at=0.0)
    p.extend(flag((-0.54, f, -0.42), "navy", height=0.56))
    return p


def industry(s):
    p, f = floor("industry")
    r, h = 0.34, 0.5
    p.append(drum(r, h, f, "stone"))
    # The rail and its wheels, the riveted steel dome turning on them.
    p.append(band(r + 0.025, 0.04, (CX, f + h + 0.02, CZ), "brass", sides=16))
    for k in range(6):
        a = math.radians(-160 + 28 * k)
        p.append(box((0.05, 0.05, 0.03), (CX + math.cos(a) * (r + 0.03), f + h, CZ - math.sin(a) * (r + 0.03)), "dark", bevel=0, turn=a))
    rd = r + 0.01
    p.append(dome(rd, f + h + 0.04, "steel"))
    for elev in (14, 38):
        e = math.radians(elev)
        for k in range(9):
            a = math.radians(-150 + 15 * k)
            if abs(-150 + 15 * k + 90) < 10:
                continue
            p.append(box((0.018, 0.018, 0.018), (CX + math.cos(a) * math.cos(e) * rd, f + h + 0.04 + math.sin(e) * rd, CZ - math.sin(a) * math.cos(e) * rd), "dark", bevel=0))
    p.append(slit(rd, f + h + 0.04))
    p += telescope(*aimed(f + h + 0.1, 0.72), 0.044, "navy")
    # The clockwork that turns it: a great brass gear and its weight on a chain.
    gx, gy, gz = CX + 0.2, f + 0.28, CZ + r * FLAT + 0.04
    p += wheel((gx, gy, gz), radius=0.1, color="brass")
    for k in range(10):
        a = 2 * math.pi * k / 10
        p.append(box((0.03, 0.03, 0.02), (gx + math.cos(a) * 0.12, gy + math.sin(a) * 0.12, gz), "brass", bevel=0, tilt=(0, -a)))
    p.append(rod((gx + 0.12, gy, gz + 0.01), (gx + 0.12, f + 0.08, gz + 0.01), 0.006, "dark", 3))
    p.append(cylinder(0.035, 0.08, (gx + 0.12, f + 0.06, gz + 0.01), "dark", sides=6, bevel=0))
    p += door(CX - 0.1, f, CZ + r * FLAT, w=0.14, h=0.26, color="navy")
    # The steel workshop of the instruments at the right.
    p.append(box((0.28, 0.3, 0.3), (0.46, f + 0.15, -0.26), "steel", bevel=0.01))
    p.append(box((0.32, 0.02, 0.34), (0.46, f + 0.31, -0.26), "tin", bevel=0.004, tilt=(math.radians(-10), 0)))
    p += window(0.46, f + 0.17, -0.11, w=0.12, h=0.1, frame="steel")
    p.extend(flag((-0.54, f, -0.42), "navy", height=0.6))
    return p


def anemometer(x, y, z):
    """Three arms turning on a hub, a cup at each end."""
    out = [cylinder(0.02, 0.03, (x, y, z), "steel", sides=6, bevel=0)]
    for k in range(3):
        a = 2 * math.pi * k / 3 + 0.4
        tip = (x + math.cos(a) * 0.12, y + 0.01, z + math.sin(a) * 0.12)
        out.append(rod((x, y + 0.01, z), tip, 0.006, "steel", 3))
        out.append(sphere(0.024, tip, "white", subdivisions=1, squash=0.8))
    return out


def electricity(s):
    p, f = floor("electricity")
    r, h = 0.34, 0.56
    p.append(cylinder(r + 0.01, 0.16, (CX, f + 0.08, CZ), "brick", sides=10, bevel=0))
    p.append(cylinder(r, h - 0.16, (CX, f + 0.16 + (h - 0.16) / 2, CZ), "concrete", sides=10, bevel=0))
    p.append(band(r + 0.02, 0.035, (CX, f + h + 0.01, CZ), "steel", sides=16))
    p.append(dome(r - 0.005, f + h + 0.02, "copper"))
    p.append(slit(r, f + h + 0.02))
    p += telescope(*aimed(f + h + 0.1, 0.64), 0.036, "navy")
    # Its electric motor at the rail, the cable from the pole, lamps at the door.
    p.append(box((0.1, 0.08, 0.08), (CX - 0.28, f + h - 0.02, CZ + 0.16), "navy", bevel=0.006))
    p.append(cylinder(0.016, 0.7, (-0.6, f + 0.35, 0.1), "wood", sides=5, bevel=0))
    p.append(box((0.12, 0.02, 0.02), (-0.6, f + 0.66, 0.1), "wood", bevel=0))
    p.append(rod((-0.6, f + 0.66, 0.1), (CX - 0.28, f + h, CZ + 0.18), 0.005, "dark", 3))
    p += door(CX, f + 0.0, CZ + r * FLAT, w=0.14, h=0.26)
    for x in (CX - 0.12, CX + 0.12):
        p.append(sphere(0.026, (x, f + 0.34, CZ + r * FLAT + 0.03), "gold", subdivisions=1))
    # The weather station at the right: the mast, its anemometer and its vane; the instrument box on legs.
    mx, mz = 0.48, -0.32
    p.append(cylinder(0.016, 0.86, (mx, f + 0.43, mz), "steel", sides=5, bevel=0))
    p += anemometer(mx, f + 0.87, mz)
    p.append(rod((mx - 0.1, f + 0.74, mz), (mx + 0.12, f + 0.74, mz), 0.006, "steel", 3))
    p.append(box((0.06, 0.05, 0.008), (mx + 0.12, f + 0.74, mz), "copper", bevel=0))
    p.append(box((0.2, 0.16, 0.14), (0.5, f + 0.32, -0.02), "white", bevel=0.006))
    for k in range(3):
        p.append(box((0.19, 0.008, 0.01), (0.5, f + 0.28 + 0.04 * k, 0.052), "concrete", bevel=0))
    p += [box((0.016, 0.24, 0.016), (0.5 + dx, f + 0.12, -0.02 + dz), "wood", bevel=0) for dx in (-0.08, 0.08) for dz in (-0.05, 0.05)]
    p.extend(flag((-0.56, f, -0.42), "copper", height=0.6))
    return p


def modern(s):
    p, f = floor("modern")
    r, h = 0.34, 0.5
    p.append(drum(r, h, f, "white"))
    p.append(cylinder(r + 0.004, 0.1, (CX, f + 0.34, CZ), "glass", sides=10, bevel=0))
    p.append(band(r + 0.022, 0.06 if s >= 30 else 0.04, (CX, f + h + 0.01, CZ), "gold" if s >= 30 else "concrete", sides=16))
    p.append(dome(r - 0.005, f + h + 0.02, "white"))
    p.append(slit(r, f + h + 0.02))
    # A steel plate bolted over the dome, its antenna and its light: still mended by hand.
    p.append(box((0.12, 0.1, 0.02), (CX - 0.22, f + h + 0.2, CZ + 0.14), "steel", bevel=0.002, turn=math.radians(50), tilt=(math.radians(-30), 0)))
    p.append(cylinder(0.01, 0.36, (CX + 0.1, f + h + 0.44, CZ - 0.08), "steel", sides=4, bevel=0))
    p.append(sphere(0.024, (CX + 0.1, f + h + 0.63, CZ - 0.08), "gold", subdivisions=1))
    p += door(CX, f, CZ + r * FLAT, w=0.16, h=0.24, color="navy")
    # The radio dish at the right on its pedestal, braced with a plank; solar panels of two sizes at the left.
    dx, dz = 0.48, -0.3
    p.append(cylinder(0.06, 0.34, (dx, f + 0.17, dz), "concrete", sides=8, bevel=0))
    p.append(box((0.12, 0.08, 0.04), (dx, f + 0.38, dz), "steel", bevel=0.004))
    p.append(cylinder(0.04, 0.06, (dx, f + 0.48, dz + 0.02), "white", sides=14, bevel=0, top=0.2, tilt=(math.radians(28), 0), turn=math.radians(-40)))
    p.append(rod((dx, f + 0.48, dz + 0.02), (dx - 0.05, f + 0.66, dz + 0.08), 0.006, "steel", 3))
    p.append(sphere(0.02, (dx - 0.05, f + 0.66, dz + 0.08), "steel", subdivisions=1))
    p.append(rod((dx - 0.06, f + 0.02, dz + 0.12), (dx, f + 0.36, dz), 0.012, "plank", 4))
    for (px, pz), (w, d) in (((-0.62, -0.2), (0.22, 0.26)), ((-0.6, 0.12), (0.18, 0.2))):
        p.append(box((w, 0.02, d), (px, f + 0.16, pz), "solar", bevel=0, tilt=(math.radians(-20), 0)))
        p.append(box((0.02, 0.14, 0.02), (px, f + 0.07, pz - 0.04), "steel", bevel=0))
    p.extend(flag((0.24, f, -0.5), "gold", height=0.56))
    return p


BUILD = {"salvage": salvage, "colony": colony, "workshop": workshop, "industry": industry, "electricity": electricity, "modern": modern}


def base(s):
    return BUILD[era_of(s)](s)


F = {era: h for era, (h, _) in FLOOR.items()}

DETAILS = era_details(
    {
        "salvage": [(0.45, 0.3), (-0.45, 0.3), (0.0, 0.45)],
        "colony": [(0.35, 0.35), (-0.45, 0.35), (0.05, 0.44), (-0.62, 0.05)],
        "workshop": [(-0.4, 0.38), (0.5, 0.25), (0.12, 0.44), (-0.62, 0.05)],
        "industry": [(0.5, 0.35), (-0.5, 0.35), (0.05, 0.46), (-0.22, 0.44)],
        "electricity": [(-0.4, 0.38), (0.05, 0.46), (0.38, 0.38), (-0.62, -0.12)],
        "modern": [(0.5, 0.3), (0.05, 0.46), (-0.32, 0.42), (0.28, 0.46)],
    },
    # Its own: a brass lens on a stand, a chart table, a star pennant, a crystal.
    own={
        2: lambda s: lens(0.45, 0.3, 0.0),
        3: lambda s: chart_table(-0.45, 0.3, 0.0),
        4: lambda s: star_pennant(0.0, 0.45, 0.0),
        6: lambda s: lens(0.35, 0.35, F["colony"]),
        7: lambda s: crystal(-0.45, 0.35, F["colony"]),
        11: lambda s: chart_table(-0.4, 0.38, F["workshop"]),
        12: lambda s: star_pennant(0.5, 0.25, F["workshop"]),
        16: lambda s: lens(0.5, 0.35, F["industry"]),
        17: lambda s: crystal(-0.5, 0.35, F["industry"]),
        21: lambda s: chart_table(-0.4, 0.38, F["electricity"]),
        26: lambda s: star_pennant(0.5, 0.3, F["modern"]),
    },
)
