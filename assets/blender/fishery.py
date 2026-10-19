"""
The Fishery (art direction: an open hut on stilts, drying nets, an upturned boat) in its six eras (docs/tasks/week-8.md,
"The eras"), and a detail at every other level within its era. It stands on the east coast (client/src/city/plots.ts):
its open side and its jetty face the sea (+x). Its plot's edge there lies right by the rafts' rooms, so its boats stay
on land and its jetty on its plot.

- Salvage (1–4): a tarp on driftwood stilts, nets on poles, an upturned rowboat, a jetty of boards;
- Colony (5–9): a plank hut on stilts, racks of drying fish, a small jetty;
- Workshop (10–14): a brick smokehouse and its smoking chimney, barrels of salted fish;
- Industry (15–19): a steel cannery shed, a conveyor to the jetty, a winch, steam;
- Electricity (20–24): a fish hall under a glass roof, cold rooms with their fans, lamps over the jetty;
- Modern (25–30): a steel-and-glass fish market under a white canopy, a refrigerated container, solar panels; at 30,
  a gold rim to the canopy.
"""
import math

from kit import barrel, box, cylinder, flag, prism_roof, rod, sphere
from parts import FLOOR, door, era_details, floor, half_barrel, house, window
from stages import era_of


def jetty(foot, color="plank", posts="wood"):
    """A jetty of boards along the plot's sea edge (+x), on posts."""
    out = [box((0.34, 0.04, 0.32), (0.74, foot + 0.06, 0.0), color, bevel=0.006)]
    for x in (0.6, 0.88):
        for z in (-0.13, 0.13):
            out.append(cylinder(0.02, 0.06, (x, foot + 0.03, z), posts, sides=5, bevel=0))
    return out


def fish_rack(x, z, foot, w=0.3):
    """A rack of drying fish: two posts, a bar, fish hanging from it."""
    out = [cylinder(0.014, 0.34, (x + dx, foot + 0.17, z), "wood", sides=4, bevel=0) for dx in (-w / 2, w / 2)]
    out.append(rod((x - w / 2, foot + 0.32, z), (x + w / 2, foot + 0.32, z), 0.008, "wood", 4))
    for k in range(4):
        out.append(box((0.02, 0.08, 0.008), (x - w / 2 + w * (k + 0.5) / 4, foot + 0.26, z), "gold" if k % 2 else "stone_dark", bevel=0))
    return out


def salvage(s):
    # The tarp on driftwood stilts, sloping to the sea; nets on poles; the upturned rowboat.
    p = []
    for x in (-0.25, 0.3):
        for z in (-0.35, 0.05):
            h = 0.5 if x < 0 else 0.4
            p.append(cylinder(0.025, h, (x, h / 2, z), "wood", sides=5, bevel=0))
    p.append(box((0.66, 0.02, 0.5), (0.03, 0.46, -0.15), "cream", bevel=0.004, tilt=(0, math.radians(-9))))
    p.append(box((0.4, 0.05, 0.3), (0.0, 0.025, -0.15), "plank", bevel=0.008))
    for x in (-0.6, -0.3):
        p.append(cylinder(0.015, 0.4, (x, 0.2, -0.55), "wood", sides=4, bevel=0))
    p.append(box((0.3, 0.26, 0.01), (-0.45, 0.24, -0.55), "navy", bevel=0))
    p.append(half_barrel(0.12, 0.46, (-0.32, 0.0, 0.28), "wood", sides=8))
    p += jetty(0)
    p.extend(flag((0.3, 0.0, -0.45), "cream", height=0.48))
    return p


def colony(s):
    p, f = floor("colony")
    # The plank hut on stilts, its door toward the sea.
    for x in (-0.38, 0.12):
        for z in (-0.4, -0.02):
            p.append(cylinder(0.025, 0.2, (x, f + 0.1, z), "wood", sides=5, bevel=0))
    p += house(-0.13, -0.21, 0.56, 0.44, 0.34, "plank", "wood", foot=f + 0.2, windows=((-0.14, 0.18),))
    p += door(0.16, f + 0.2, -0.21, w=0.12, h=0.22)
    p += fish_rack(-0.3, 0.32, f)
    p += jetty(f)
    p.extend(flag((-0.5, f, -0.45), "cream", height=0.5))
    return p


def workshop(s):
    p, f = floor("workshop")
    p += house(-0.14, -0.22, 0.62, 0.46, 0.5, "brick", "stone_dark", foot=f, roof_h=0.22, windows=((-0.16, 0.32),), door_at=0.1)
    # The smokehouse's tall chimney, its smoke; barrels of salted fish at the front.
    p.append(box((0.12, 0.62, 0.12), (-0.36, f + 0.6, -0.34), "brick", bevel=0))
    for i, (dy, r) in enumerate(((0.98, 0.06), (1.1, 0.08), (1.24, 0.07))):
        p.append(sphere(r, (-0.36 + 0.04 * i, f + dy, -0.34), "steam", subdivisions=1))
    for x in (-0.3, -0.14):
        p.append(barrel((x, f + 0.1, 0.3), radius=0.07, height=0.2))
    p += jetty(f, color="stone", posts="stone")
    p.extend(flag((0.3, f, -0.42), "navy", height=0.52))
    return p


def industry(s):
    p, f = floor("industry")
    # The cannery shed in steel, a sawtooth roof; the conveyor to the jetty; the winch; steam.
    p.append(box((0.74, 0.46, 0.5), (-0.16, f + 0.23, -0.2), "steel", bevel=0.01))
    for k in range(3):
        p.append(box((0.26, 0.02, 0.52), (-0.42 + 0.25 * k, f + 0.52, -0.2), "tin", bevel=0.004, tilt=(0, math.radians(-22))))
    for x in (-0.36, -0.06):
        p += window(x, f + 0.28, 0.05, w=0.14, h=0.12, frame="steel")
    p += door(0.12, f, 0.05, w=0.14, h=0.24, color="navy")
    p.append(box((0.5, 0.03, 0.1), (0.48, f + 0.26, -0.16), "dark", bevel=0, tilt=(0, math.radians(18))))
    for x in (0.34, 0.6):
        p.append(cylinder(0.012, 0.3 - (x - 0.34) * 0.6, (x, f + 0.15 - (x - 0.34) * 0.3, -0.16), "steel", sides=4, bevel=0))
    p.append(cylinder(0.025, 0.6, (0.82, f + 0.3, -0.3), "steel", sides=6, bevel=0))
    p.append(rod((0.82, f + 0.58, -0.3), (0.82, f + 0.6, 0.05), 0.016, "steel", 4))
    p.append(cylinder(0.04, 0.4, (-0.4, f + 0.66, -0.36), "dark", sides=6, bevel=0))
    for i, (dy, r) in enumerate(((0.92, 0.06), (1.04, 0.08))):
        p.append(sphere(r, (-0.4 + 0.03 * i, f + dy, -0.36), "steam", subdivisions=1))
    p += jetty(f, color="steel", posts="steel")
    p.extend(flag((0.12, f + 0.5, -0.4), "navy", height=0.36))
    return p


def electricity(s):
    p, f = floor("electricity")
    hx, hz, w, d = -0.14, -0.2, 0.72, 0.48
    p.append(box((w, 0.16, d), (hx, f + 0.08, hz), "brick", bevel=0.008))
    p.append(box((w - 0.04, 0.26, d - 0.04), (hx, f + 0.29, hz), "glass", bevel=0.004))
    for x in (-w / 2, 0, w / 2):
        p.append(box((0.035, 0.42, 0.035), (hx + x, f + 0.21, hz + d / 2), "steel", bevel=0))
    p.append(prism_roof(w + 0.06, d + 0.06, 0.24, (hx, f + 0.42, hz), "glass"))
    for x in (-w / 2, 0, w / 2):
        p.append(prism_roof(0.03, d + 0.08, 0.25, (hx + x, f + 0.42, hz), "steel"))
    p += door(hx + 0.2, f + 0.16, hz + d / 2, w=0.14, h=0.22)
    # The cold rooms at the back right, their fans; lamps over the jetty.
    for z in (-0.42, -0.2):
        p.append(box((0.26, 0.26, 0.2), (0.5, f + 0.13, z), "white", bevel=0.01))
        p.append(cylinder(0.06, 0.02, (0.64, f + 0.15, z), "dark", sides=10, bevel=0, tilt=(0, math.radians(90))))
    p += jetty(f, color="concrete", posts="steel")
    for z in (-0.14, 0.14):
        p.append(cylinder(0.012, 0.36, (0.9, f + 0.18, z), "navy", sides=4, bevel=0))
        p.append(sphere(0.03, (0.9, f + 0.38, z), "gold", subdivisions=1))
    p.extend(flag((-0.48, f + 0.42, -0.36), "copper", height=0.32))
    return p


def modern(s):
    p, f = floor("modern")
    # The fish market: glass and steel under a white canopy with solar panels; the refrigerated container.
    mx, mz, w, d = -0.18, -0.2, 0.7, 0.46
    p.append(box((w, 0.4, d), (mx, f + 0.2, mz), "glass", bevel=0.004))
    for x in (-w / 2, -w / 6, w / 6, w / 2):
        p.append(box((0.03, 0.4, 0.03), (mx + x, f + 0.2, mz + d / 2), "steel", bevel=0))
    p.append(box((w + 0.2, 0.04, d + 0.16), (mx, f + 0.43, mz + 0.04), "white", bevel=0.008))
    if s >= 30:
        p.append(box((w + 0.22, 0.05, 0.03), (mx, f + 0.43, mz + 0.04 + (d + 0.16) / 2), "gold", bevel=0.005))
    for x in (-0.16, 0.16):
        p.append(box((0.28, 0.02, 0.3), (mx + x, f + 0.48, mz), "solar", bevel=0, tilt=(math.radians(-12), 0)))
    p += door(mx + 0.1, f, mz + d / 2, w=0.14, h=0.24, color="navy")
    p.append(box((0.22, 0.24, 0.5), (0.5, f + 0.12, -0.18), "white", bevel=0.01))
    for z in (-0.36, -0.24, -0.12, 0.0):
        p.append(box((0.23, 0.22, 0.012), (0.5, f + 0.12, z), "steel", bevel=0))
    p.append(box((0.012, 0.04, 0.48), (0.615, f + 0.18, -0.18), "navy", bevel=0))
    p += jetty(f, color="concrete", posts="concrete")
    p.extend(flag((-0.5, f + 0.45, -0.36), "gold", height=0.3))
    return p


BUILD = {"salvage": salvage, "colony": colony, "workshop": workshop, "industry": industry, "electricity": electricity, "modern": modern}


def base(s):
    return BUILD[era_of(s)](s)


F = {era: h for era, (h, _) in FLOOR.items()}

DETAILS = era_details(
    {
        "salvage": [(0.05, 0.4), (-0.6, 0.0), (0.45, 0.38)],
        "colony": [(0.12, 0.42), (0.35, 0.32), (-0.58, 0.05), (0.0, 0.2)],
        "workshop": [(0.12, 0.42), (-0.55, 0.42), (0.35, 0.32), (0.05, 0.25)],
        "industry": [(-0.3, 0.38), (0.05, 0.42), (0.38, 0.38), (-0.6, 0.2)],
        "electricity": [(-0.3, 0.38), (0.05, 0.42), (0.38, 0.36), (-0.6, 0.2)],
        "modern": [(-0.3, 0.38), (0.05, 0.44), (0.38, 0.38), (-0.6, 0.22)],
    },
    # Its own: a crate of fish, a coil of net, a lobster pot.
    own={
        2: lambda s: [box((0.16, 0.08, 0.12), (0.05, 0.04, 0.4), "plank", bevel=0.008), *[box((0.03, 0.02, 0.06), (0.0 + 0.04 * k, 0.09, 0.4), "stone_dark" if k % 2 else "gold", bevel=0) for k in range(3)]],
        7: lambda s: [half_barrel(0.06, 0.14, (0.35, F["colony"], 0.32), "navy", sides=8)],
        12: lambda s: [cylinder(0.08, 0.12, (-0.55, F["workshop"] + 0.06, 0.42), "wood", sides=8, bevel=0), cylinder(0.083, 0.012, (-0.55, F["workshop"] + 0.1, 0.42), "navy", sides=8, bevel=0)],
    },
)

_ = window
