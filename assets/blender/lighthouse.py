"""
The Lighthouse (art direction: a white tower with red bands, a verdigris copper lantern) in its six eras
(docs/tasks/week-8.md, "The eras"), each a different tower, from an oil lamp to a great lens, an electric lamp, then a
modern beacon with a radar:

- Salvage (1–4): a tower of driftwood poles on its rock, an oil lamp in a glazed box, a rope ladder, rag bands;
- Colony (5–9): an octagonal plank tower in white and red bands, its timber frame showing, an oil lantern room;
- Workshop (10–14): a bare brick tower with white bands, a great lens in a larger lantern room, the keeper's house;
- Industry (15–19): a skeletal tower of riveted iron around a slim banded column, a riveted iron lantern and gallery,
  the lens turned by clockwork, a steam fog horn;
- Electricity (20–24): a square concrete tower in three setbacks, an electric lamp in a steel lantern, cables to a
  generator hut, a small wind turbine;
- Modern (25–30): a slim white concrete tower, a bright warm beacon, a radar, solar panels, an antenna; still mended by
  hand (a riveted plate, a rope); at 30, a gold cap, rail and crown.

It is the tallest building at every level (a test checks it against every level of the others). Its lantern's height
goes in the manifest: the game's beams and light go there. Everything stays within its plot (hex reach 0.93).
"""
import math

from kit import band, barrel, box, cone, crate, cylinder, drum, flag, ladder, lamp_post, prism_roof, rail_ring, ring, rod, rope_coil, sack, sphere, wheel
from stages import era_of

BASE = 0.3


def banded(r0, r1, height, foot, bands, colors, sides=14):
    """A tapered tower from radius `r0` at `foot` to `r1` at its top, in `bands` bands of `colors` in turn."""
    p = []
    h = height / bands
    for i in range(bands):
        a, b = r0 + (r1 - r0) * i / bands, r0 + (r1 - r0) * (i + 1) / bands
        p.append(cylinder(a, h, (0, foot + h * (i + 0.5), 0), colors[i % len(colors)], sides=sides, bevel=0, top=b))
    return p


def rock():
    """The rock of the first eras: a low mound and a few boulders."""
    p = [cylinder(0.72, BASE, (0, BASE / 2, 0), "rock", sides=8, bevel=0.06, top=0.66)]
    for a, r, h in ((30, 0.2, 0.22), (150, 0.17, 0.18), (250, 0.22, 0.26), (320, 0.15, 0.16)):
        x, z = math.cos(math.radians(a)) * 0.64, math.sin(math.radians(a)) * 0.64
        p.append(cylinder(r, h, (x, h / 2, z), "rock_dark", sides=6, bevel=0.04, top=r * 0.6))
    return p


def plinth(color="stone", steps=True):
    """The plinth of the later eras, its steps at the front."""
    p = [cylinder(0.76, BASE, (0, BASE / 2, 0), color, sides=8, bevel=0.04), cylinder(0.8, 0.05, (0, BASE - 0.02, 0), "stone_dark", sides=8, bevel=0.01)]
    if steps:
        for i in range(2):
            p.append(box((0.34, 0.1, 0.12), (0, BASE - 0.1 - i * 0.1, 0.76 + i * 0.1), color, bevel=0.01))
    return p


def lantern_room(top, radius, height, frame, cap, glass="gold", posts=6, sides=10):
    """A lantern room on a tower's top: its floor ring, glass, posts, and its cap (a cone)."""
    p = [cylinder(radius + 0.04, 0.06, (0, top + 0.03, 0), frame, sides=sides, bevel=0.008)]
    p.append(cylinder(radius, height, (0, top + 0.06 + height / 2, 0), glass, sides=sides, bevel=0))
    for i in range(posts):
        a = math.radians(i * 360 / posts + 30)
        p.append(rod((math.cos(a) * radius, top + 0.06, math.sin(a) * radius), (math.cos(a) * radius, top + 0.06 + height, math.sin(a) * radius), 0.016, frame, 4))
    p.append(cone(radius + 0.07, 0.26, (0, top + 0.06 + height, 0), cap, sides=sides))
    return p


def gallery(y, radius, color, rail):
    return [cylinder(radius, 0.05, (0, y + 0.025, 0), color, sides=12, bevel=0.01), *rail_ring(radius - 0.02, (0, y + 0.05, 0), color=rail, posts=8, height=0.12)]


# Per era: the tower's foot radius, top radius and height, the lantern room's radius and height.
TOWER = {
    "salvage": (0.3, 0.2, 1.65, 0.15, 0.24),
    "colony": (0.44, 0.28, 1.95, 0.2, 0.3),
    "workshop": (0.5, 0.3, 2.25, 0.27, 0.4),
    "industry": (0.5, 0.3, 2.45, 0.27, 0.42),
    "electricity": (0.39, 0.25, 2.8, 0.22, 0.4),
    "modern": (0.36, 0.26, 3.2, 0.22, 0.34),
}


def tower(s):
    return TOWER[era_of(s)]


def top_of(s):
    return BASE + tower(s)[2]


def radius_at(s, t):
    r0, r1 = tower(s)[:2]
    return r0 + (r1 - r0) * t


# ---------------------------------------------------------------------------------------------------------------- Salvage
def salvage(s):
    r0, r1, th, lr, lh = tower(s)
    top = BASE + th
    p = rock()
    # Four driftwood poles leaning in, braced at three heights, a platform of boards at the top.
    corners = [(1, 1), (-1, 1), (-1, -1), (1, -1)]
    for cx, cz in corners:
        p.append(rod((cx * r0, BASE - 0.02, cz * r0), (cx * r1, top, cz * r1), 0.04, "wood", 6))
    for t, c in ((0.25, "plank"), (0.55, "wood"), (0.82, "plank")):
        r = r0 + (r1 - r0) * t
        for k in range(4):
            (ax, az), (bx, bz) = corners[k], corners[(k + 1) % 4]
            p.append(rod((ax * r, BASE + th * t, az * r), (bx * r, BASE + th * t + 0.05, bz * r), 0.018, c, 4))
    # Rag bands, white and red, wrapped round the poles: the Lighthouse's colors from the first day.
    for t, c in ((0.33, "white"), (0.45, "lighthouse_red"), (0.64, "white")):
        r = r0 + (r1 - r0) * t
        p.append(box((r * 2 + 0.06, 0.1, r * 2 + 0.06), (0, BASE + th * t, 0), c, bevel=0.01, turn=0.05))
    p.append(box((r1 * 2 + 0.16, 0.05, r1 * 2 + 0.16), (0, top + 0.025, 0), "plank", bevel=0.01, turn=0.1))
    # The oil lamp in its glazed box, a tin roof, its smoke pipe.
    p.append(box((lr * 2, lh, lr * 2), (0, top + 0.05 + lh / 2, 0), "gold", bevel=0.01))
    for x, z in corners:
        p.append(rod((x * lr, top + 0.05, z * lr), (x * lr, top + 0.05 + lh, z * lr), 0.014, "wood", 4))
    p.append(cone(lr * 1.6, 0.18, (0, top + 0.05 + lh, 0), "tin", sides=4, turn=math.radians(45)))
    p.append(cylinder(0.025, 0.12, (0.06, top + 0.05 + lh + 0.16, 0), "dark", sides=5, bevel=0))
    # The rope ladder up the front.
    p.extend(ladder((0, BASE, r0 + 0.05), (0, top, r1 + 0.06), color="plank", width=0.16))
    return p


# ----------------------------------------------------------------------------------------------------------------- Colony
def colony(s):
    r0, r1, th, lr, lh = tower(s)
    top = BASE + th
    p = [cylinder(0.72, BASE, (0, BASE / 2, 0), "stone", sides=8, bevel=0.04, top=0.66)]
    # An octagonal plank tower painted in bands, small windows at the front, a door.
    p.extend(banded(r0, r1, th, BASE, 5, ("white", "lighthouse_red"), sides=8))
    # Its timber frame shows: a post on each edge, a beam under each band.
    for i in range(8):
        a = math.radians(i * 45 + 22.5)
        k0, k1 = r0 / math.cos(math.radians(22.5)), r1 / math.cos(math.radians(22.5))
        p.append(rod((math.cos(a) * k0, BASE, math.sin(a) * k0), (math.cos(a) * k1, BASE + th, math.sin(a) * k1), 0.025, "wood", 4))
    for k in range(1, 5):
        p.append(band(radius_at(s, k / 5) / math.cos(math.radians(22.5)) + 0.01, 0.035, (0, BASE + th * k / 5, 0), "wood", sides=8))
    p.append(box((0.16, 0.26, 0.03), (0, BASE + 0.13, r0 - 0.01), "dark", bevel=0.006))
    for t in (0.45, 0.75):
        p.append(box((0.08, 0.12, 0.03), (0, BASE + th * t, radius_at(s, t) - 0.01), "glass", bevel=0.004))
    # A wooden gallery and its rail, the oil lantern room with its verdigris cap.
    p.extend(gallery(top, r1 + 0.12, "plank", "wood"))
    p.extend(lantern_room(top, lr, lh, "wood", "copper", posts=8, sides=8))
    p.append(cylinder(0.03, 0.1, (0, top + 0.06 + lh + 0.29, 0), "brass", sides=6, bevel=0))
    return p


# --------------------------------------------------------------------------------------------------------------- Workshop
def workshop(s):
    r0, r1, th, lr, lh = tower(s)
    top = BASE + th
    p = plinth()
    # A brick tower with white-painted bands, its door and windows.
    # Bare brick, two white bands; a corbelled stone ring under the gallery.
    p.extend(banded(r0, r1, th, BASE, 7, ("brick", "brick", "white", "brick", "brick", "white", "brick")))
    p.append(cylinder(r1 + 0.04, 0.1, (0, BASE + th - 0.05, 0), "stone", sides=14, bevel=0.01, top=r1 + 0.12))
    p.append(box((0.16, 0.28, 0.03), (0, BASE + 0.14, r0 - 0.005), "dark", bevel=0.006))
    for t in (0.36, 0.62, 0.86):
        p.append(box((0.09, 0.13, 0.03), (0, BASE + th * t, radius_at(s, t) - 0.01), "dark", bevel=0.004))
    # The keeper's brick house beside it, a slate roof and its chimney.
    p.append(box((0.4, 0.36, 0.34), (0.46, BASE + 0.18, 0.28), "brick", bevel=0.012))
    p.append(prism_roof(0.46, 0.4, 0.2, (0.46, BASE + 0.36, 0.28), "stone_dark"))
    p.append(box((0.1, 0.16, 0.02), (0.4, BASE + 0.08, 0.455), "dark", bevel=0.003))
    p.append(box((0.1, 0.1, 0.02), (0.56, BASE + 0.2, 0.455), "glass", bevel=0.003))
    p.append(box((0.07, 0.2, 0.07), (0.56, BASE + 0.5, 0.2), "brick", bevel=0))
    # The gallery, then the great lens: a tall lantern room, its glass ringed with brass prisms.
    p.extend(gallery(top, r1 + 0.13, "navy", "navy"))
    p.extend(lantern_room(top, lr, lh, "navy", "copper", posts=6))
    for k in range(1, 4):
        p.append(band(lr + 0.008, 0.025, (0, top + 0.06 + lh * k / 4, 0), "brass", sides=10))
    p.append(cylinder(0.035, 0.1, (0, top + 0.06 + lh + 0.31, 0), "brass", sides=6, bevel=0))
    return p


# --------------------------------------------------------------------------------------------------------------- Industry
def industry(s):
    r0, r1, th, lr, lh = tower(s)
    top = BASE + th
    p = plinth()
    # A skeletal tower of riveted iron: six legs leaning in, braced in crosses at three heights, around a slim column
    # in white and red bands (its stair inside).
    legs = [math.radians(k * 60 + 30) for k in range(6)]
    for a in legs:
        p.append(rod((math.cos(a) * r0, BASE, math.sin(a) * r0), (math.cos(a) * r1, top, math.sin(a) * r1), 0.03, "steel", 6))
    for t0, t1 in ((0.0, 0.33), (0.33, 0.66), (0.66, 0.95)):
        ra, rb = r0 + (r1 - r0) * t0, r0 + (r1 - r0) * t1
        for k in range(6):
            if math.sin(legs[k] + math.radians(30)) < -0.5:
                continue
            a, b = legs[k], legs[(k + 1) % 6]
            p.append(rod((math.cos(a) * ra, BASE + th * t0, math.sin(a) * ra), (math.cos(b) * rb, BASE + th * t1, math.sin(b) * rb), 0.012, "steel", 4))
            p.append(rod((math.cos(b) * ra, BASE + th * t0, math.sin(b) * ra), (math.cos(a) * rb, BASE + th * t1, math.sin(a) * rb), 0.012, "steel", 4))
        p.append(band(rb + 0.02, 0.03, (0, BASE + th * t1, 0), "steel", sides=6))
    p.extend(banded(0.17, 0.15, th, BASE, 6, ("white", "lighthouse_red"), sides=10))
    p.append(box((0.12, 0.24, 0.03), (0, BASE + 0.12, 0.17), "dark", bevel=0.005))
    # Riveted iron galleries, one halfway: steel, a row of rivets under each.
    for y, r in ((top, r1 + 0.13),):
        p.extend(gallery(y, r, "steel", "steel"))
        for i in range(10):
            a = math.radians(i * 36 + 18)
            if math.sin(a) < -0.2:
                continue
            p.append(box((0.022, 0.022, 0.022), (math.cos(a) * (r - 0.01), y - 0.005, math.sin(a) * (r - 0.01)), "dark", bevel=0))
    # The riveted iron lantern, the lens turned by clockwork (its brass case and its wheel on the gallery).
    p.extend(lantern_room(top, lr, lh, "steel", "copper", posts=8))
    for k in (1, 3):
        p.append(band(lr + 0.008, 0.025, (0, top + 0.06 + lh * k / 4, 0), "brass", sides=10))
    p.append(box((0.14, 0.12, 0.1), (0.2, top + 0.11, 0.24), "brass", bevel=0.01))
    p.extend(wheel((0.2, top + 0.2, 0.3), radius=0.06, color="gold"))
    p.append(cylinder(0.035, 0.1, (0, top + 0.06 + lh + 0.31, 0), "brass", sides=6, bevel=0))
    # The steam fog horn: its iron house at the front left, the horn toward the sea, steam from its pipe.
    p.append(box((0.3, 0.26, 0.24), (-0.46, BASE + 0.13, 0.32), "steel", bevel=0.01))
    p.append(box((0.34, 0.03, 0.28), (-0.46, BASE + 0.28, 0.32), "tin", bevel=0.004, tilt=(math.radians(8), 0)))
    p.append(cone(0.08, 0.2, (-0.46, BASE + 0.16, 0.44), "brass", sides=8))
    p[-1].rotation_euler = (math.radians(90), 0, 0)
    p.append(cylinder(0.025, 0.24, (-0.54, BASE + 0.4, 0.26), "dark", sides=6, bevel=0))
    for i, (dx, y, r) in enumerate(((0.0, 0.56, 0.06), (0.04, 0.66, 0.075))):
        p.append(sphere(r, (-0.54 + dx, BASE + y, 0.26 + i * 0.02), "steam", subdivisions=1))
    return p


# ------------------------------------------------------------------------------------------------------------ Electricity
def electricity(s):
    r0, r1, th, lr, lh = tower(s)
    top = BASE + th
    p = plinth("concrete")
    # A square concrete tower in three setbacks, white with a red top, tall slit windows: the age of electric light.
    y = BASE
    for w, h, c in ((0.78, 1.2, "white"), (0.64, 1.0, "white"), (0.5, th - 2.2, "lighthouse_red")):
        p.append(box((w, h, w), (0, y + h / 2, 0), c, bevel=0.015))
        p.append(box((w + 0.06, 0.05, w + 0.06), (0, y + h, 0), "concrete", bevel=0.01))
        if c == "white":
            p.append(box((0.08, h * 0.5, 0.02), (0, y + h * 0.55, w / 2 + 0.005), "glass", bevel=0.004))
        y += h
    p.append(box((0.18, 0.3, 0.02), (0, BASE + 0.15, 0.4), "dark", bevel=0.005))
    # The steel gallery, the electric lamp in its steel lantern, a steel dome.
    p.extend(gallery(top, r1 + 0.12, "steel", "steel"))
    p.append(cylinder(lr + 0.04, 0.06, (0, top + 0.03, 0), "steel", sides=10, bevel=0.008))
    p.append(cylinder(lr, lh, (0, top + 0.06 + lh / 2, 0), "gold", sides=10, bevel=0))
    for i in range(8):
        a = math.radians(i * 45 + 22)
        p.append(rod((math.cos(a) * lr, top + 0.06, math.sin(a) * lr), (math.cos(a) * lr, top + 0.06 + lh, math.sin(a) * lr), 0.014, "steel", 4))
    p.append(band(lr + 0.008, 0.03, (0, top + 0.06 + lh / 2, 0), "steel", sides=10))
    p.append(sphere(lr + 0.05, (0, top + 0.06 + lh, 0), "steel", subdivisions=2, squash=0.55))
    p.append(cylinder(0.02, 0.18, (0, top + 0.06 + lh + 0.2, 0), "steel", sides=5, bevel=0))
    # The generator hut at the back left, cables up the tower; a small wind turbine at the back right.
    p.append(box((0.32, 0.26, 0.26), (-0.46, BASE + 0.13, -0.32), "brick", bevel=0.01))
    p.append(box((0.36, 0.03, 0.3), (-0.46, BASE + 0.27, -0.32), "steel", bevel=0.004))
    p.append(rod((-0.32, BASE + 0.24, -0.24), (-0.16, top - 0.2, -0.2), 0.008, "dark", 3))
    p.append(rod((-0.32, BASE + 0.2, -0.22), (-0.2, BASE + th * 0.45, -0.3), 0.008, "dark", 3))
    tx, tz, h = 0.46, -0.42, 1.45
    p.append(cylinder(0.035, h, (tx, BASE + h / 2, tz), "white", sides=6, bevel=0, top=0.022))
    p.append(box((0.06, 0.06, 0.14), (tx, BASE + h, tz), "white", bevel=0.015))
    for k in range(3):
        a = math.radians(90 + k * 120)
        blade = box((0.04, 0.3, 0.012), (tx + math.cos(a) * 0.16, BASE + h + math.sin(a) * 0.16, tz + 0.08), "white", bevel=0.003)
        blade.rotation_euler = (0, math.radians(90) - a, 0)
        p.append(blade)
    p.append(rod((tx, BASE + 0.3, tz), (-0.1, BASE + 0.4, -0.38), 0.008, "dark", 3))
    return p


# ----------------------------------------------------------------------------------------------------------------- Modern
def modern(s):
    r0, r1, th, lr, lh = tower(s)
    top = BASE + th
    p = plinth("concrete")
    # The slim white tower, clean lines, two red bands at the top; a door; a riveted plate and its rivets where it was
    # mended by hand.
    p.append(cylinder(r0, th * 0.78, (0, BASE + th * 0.39, 0), "white", sides=16, bevel=0, top=radius_at(s, 0.78)))
    p.extend(banded(radius_at(s, 0.78), r1, th * 0.22, BASE + th * 0.78, 3, ("lighthouse_red", "white"), sides=16))
    p.append(box((0.16, 0.3, 0.03), (0, BASE + 0.15, r0 - 0.005), "dark", bevel=0.006))
    y, r = BASE + th * 0.42, radius_at(s, 0.42)
    p.append(box((0.13, 0.18, 0.02), (0, y, r - 0.002), "steel", bevel=0.002))
    for dx in (-0.045, 0.045):
        for dy in (-0.07, 0.07):
            p.append(box((0.018, 0.018, 0.012), (dx, y + dy, r + 0.012), "dark", bevel=0))
    # The gallery (concrete, a steel rail), the beacon: a compact lantern of warm glass under a white cap.
    crown = s >= 30
    p.extend(gallery(top, r1 + 0.14, "concrete", "gold" if crown else "steel"))
    p.extend(lantern_room(top, lr, lh, "white", "gold" if crown else "white", posts=8, sides=12))
    # The radar's mast beside the lantern (its turning bar is its own model, RADAR, turned by the game), an antenna
    # with its warm light.
    rx, rz = RADAR_AT
    p.append(cylinder(0.025, 0.5, (rx, top + 0.25, rz), "steel", sides=6, bevel=0))
    p.append(box((0.08, 0.06, 0.08), (rx, top + 0.48, rz), "steel", bevel=0.01))
    p.append(cylinder(0.014, 0.5, (-0.16, top + 0.25, -0.14), "steel", sides=5, bevel=0))
    p.append(sphere(0.035, (-0.16, top + 0.52, -0.14), "gold", subdivisions=1))
    # Solar panels at the back of the plinth, one held down with a rope.
    for x, w in ((-0.36, 0.3), (0.34, 0.26)):
        p.append(box((w, 0.02, 0.2), (x, BASE + 0.1, -0.5), "solar", bevel=0, tilt=(math.radians(-25), 0)))
        p.append(rod((x, BASE, -0.5), (x, BASE + 0.08, -0.5), 0.012, "steel", 4))
    p.append(rod((-0.5, BASE + 0.12, -0.46), (-0.22, BASE + 0.12, -0.46), 0.008, "plank", 3))
    if s >= 30:
        # The era complete: a gold cap and rail, a gold crown under the lantern, a gold finial, a second antenna.
        p.append(band(r1 + 0.03, 0.06, (0, top - 0.06, 0), "gold", sides=16))
        p.append(cylinder(0.05, 0.1, (0, top + 0.06 + lh + 0.3, 0), "gold", sides=8, bevel=0.02, top=0.015))
        p.append(cylinder(0.012, 0.36, (-0.08, top + 0.62, 0.14), "steel", sides=5, bevel=0))
        p.append(sphere(0.03, (-0.08, top + 0.82, 0.14), "gold", subdivisions=1))
    else:
        p.append(cylinder(0.03, 0.08, (0, top + 0.06 + lh + 0.28, 0), "steel", sides=6, bevel=0))
    return p


BUILD = {"salvage": salvage, "colony": colony, "workshop": workshop, "industry": industry, "electricity": electricity, "modern": modern}


def base(s):
    return BUILD[era_of(s)](s)


def meta(s):
    _, _, th, _, lh = tower(s)
    out = {"lantern": round(BASE + th + (0.05 if era_of(s) == "salvage" else 0.06) + lh / 2, 3)}
    if era_of(s) == "modern":
        out["radar"] = [RADAR_AT[0], round(BASE + th + 0.53, 3), RADAR_AT[1]]
    return out


# Where the Modern era's radar turns (game x, z): its bar is a model of its own, centered on its axis.
RADAR_AT = (0.22, -0.12)


def radar():
    """The radar's bar, centered on the axis it turns around: white, a steel hub, a gold tip at one end."""
    return [box((0.56, 0.07, 0.08), (0, 0, 0), "white", bevel=0.012), box((0.06, 0.08, 0.1), (0, 0, 0), "steel", bevel=0.01), box((0.04, 0.04, 0.09), (0.27, 0, 0), "gold", bevel=0.005)]


# Models of their own, turned or moved by the game.
EXTRAS = {"lighthouse-radar": radar}


def on_base(angle, r=0.6):
    a = math.radians(angle)
    return (math.cos(a) * r, BASE, math.sin(a) * r)


def on_tower(s, angle, t, out=0.012):
    a = math.radians(angle)
    r = radius_at(s, t) + out
    return (math.cos(a) * r, BASE + tower(s)[2] * t, math.sin(a) * r)


# A detail at every level that is not a stage, within its era: on the rock or plinth's front half (which the camera
# sees), on the tower's wall, on the gallery.
DETAILS = {
    # Salvage: a crate, a coil of rope, a barrel of lamp oil.
    2: lambda s: crate(on_base(150), size=0.14),
    3: lambda s: rope_coil(on_base(120, 0.62), radius=0.07),
    4: lambda s: barrel((*on_base(40, 0.62)[:1], BASE + 0.1, on_base(40, 0.62)[2]), radius=0.075, height=0.2),
    # Colony: a lamp post, a water barrel, a bench, a flag.
    6: lambda s: lamp_post(on_base(60, 0.6), height=0.4, color="wood"),
    7: lambda s: barrel((*on_base(140, 0.6)[:1], BASE + 0.1, on_base(140, 0.6)[2]), radius=0.07, height=0.2),
    8: lambda s: [box((0.26, 0.03, 0.08), (-0.32, BASE + 0.1, 0.5), "plank", bevel=0.004), box((0.03, 0.1, 0.06), (-0.43, BASE + 0.05, 0.5), "wood", bevel=0), box((0.03, 0.1, 0.06), (-0.21, BASE + 0.05, 0.5), "wood", bevel=0)],
    9: lambda s: flag((0.42, BASE, -0.42), "cream", height=0.55),
    # Workshop: sacks, a brass plaque on the tower, a bench, oil drums.
    11: lambda s: [sack(on_base(135, 0.62), size=0.13), sack(on_base(150, 0.66), size=0.12)],
    12: lambda s: [box((0.14, 0.1, 0.02), on_tower(s, 90, 0.12, out=0.02), "brass", bevel=0.004)],
    13: lambda s: [box((0.24, 0.05, 0.08), (-0.45, BASE + 0.12, 0.55), "wood", bevel=0.006), box((0.04, 0.12, 0.08), (-0.55, BASE + 0.06, 0.55), "wood", bevel=0), box((0.04, 0.12, 0.08), (-0.35, BASE + 0.06, 0.55), "wood", bevel=0)],
    14: lambda s: [drum(on_base(25, 0.68), color="copper", radius=0.06, height=0.15), drum(on_base(10, 0.68), color="copper", radius=0.06, height=0.15)],
    # Industry: a coal heap, signal flags on a line, a lifebuoy on the tower, a bell on the gallery.
    16: lambda s: [sphere(0.12, (0.42, BASE, 0.5), "dark", subdivisions=1, squash=0.5)],
    17: lambda s: [rod(on_tower(s, 60, 0.75, out=0.0), (0.5, BASE + tower(s)[2] * 0.5, 0.35), 0.006, "dark", 3), *[box((0.06, 0.07, 0.006), (0.2 + 0.08 * i, BASE + tower(s)[2] * (0.7 - 0.05 * i), 0.18 + 0.04 * i), c, bevel=0) for i, c in enumerate(("gold", "navy", "cream"))]],
    18: lambda s: [ring(0.08, 0.025, 0.035, on_tower(s, 115, 0.22, out=0.03), "lighthouse_red", sides=8)],
    19: lambda s: [cone(0.05, 0.08, (-0.22, top_of(s) + 0.06, 0.32), "brass", sides=8), cylinder(0.01, 0.06, (-0.22, top_of(s) + 0.17, 0.32), "dark", sides=4, bevel=0)],
    # Electricity: an electric lamp post, a cable reel, a fuse box, a floodlight on the gallery.
    21: lambda s: lamp_post(on_base(60, 0.62), height=0.45, color="navy"),
    22: lambda s: [cylinder(0.1, 0.06, (*on_base(150, 0.6)[:1], BASE + 0.1, on_base(150, 0.6)[2]), "wood", sides=10, bevel=0, tilt=(math.radians(90), 0)), cylinder(0.065, 0.065, (*on_base(150, 0.6)[:1], BASE + 0.1, on_base(150, 0.6)[2]), "dark", sides=8, bevel=0, tilt=(math.radians(90), 0))],
    23: lambda s: [box((0.14, 0.2, 0.07), (0.38, BASE + 0.1, 0.45), "navy", bevel=0.006), *[cylinder(0.012, 0.05, (0.34 + 0.04 * k, BASE + 0.23, 0.45), "cream", sides=5, bevel=0) for k in range(3)]],
    24: lambda s: [box((0.1, 0.07, 0.06), (0.22, top_of(s) + 0.12, 0.3), "navy", bevel=0.005), box((0.08, 0.05, 0.01), (0.22, top_of(s) + 0.12, 0.335), "gold", bevel=0)],
    # Modern: a planter, a bench, an information panel, a gold band at the tower's foot.
    26: lambda s: [box((0.26, 0.1, 0.1), (-0.4, BASE + 0.05, 0.48), "concrete", bevel=0.01), *[sphere(0.045, (-0.48 + 0.08 * k, BASE + 0.12, 0.48), "meadow", subdivisions=1) for k in range(3)]],
    27: lambda s: [box((0.24, 0.03, 0.08), (0.4, BASE + 0.1, 0.46), "plank", bevel=0.004), box((0.03, 0.1, 0.06), (0.3, BASE + 0.05, 0.46), "steel", bevel=0), box((0.03, 0.1, 0.06), (0.5, BASE + 0.05, 0.46), "steel", bevel=0)],
    28: lambda s: [box((0.16, 0.2, 0.03), (-0.56, BASE + 0.22, 0.2), "navy", bevel=0.006), cylinder(0.012, 0.14, (-0.56, BASE + 0.07, 0.2), "steel", sides=4, bevel=0)],
    29: lambda s: [band(radius_at(s, 0.05) + 0.015, 0.04, (0, BASE + tower(s)[2] * 0.05, 0), "gold", sides=16)],
}
