"""
The portal's enemies (Hold the Light, docs/design/hold-the-light.md, task 6.1): the three families and the three bosses,
made with the kit in the palette, each one mesh and one texture, served to client/public/night/ (one instanced draw
call a family in the game). Their bow is +z: the game turns each toward the Lighthouse.

    .venv-blender/bin/python assets/blender/night_enemies.py [--fast]
    python3 assets/blender/serve_night.py
"""
import sys
from pathlib import Path

here = Path(__file__).resolve().parent
sys.path.insert(0, str(here))
import kit  # noqa: E402
from kit import box, cone, cylinder, rod, sphere  # noqa: E402

OUT = here / "out"


def raider():
    """A pirate skiff: a tarred hull, a bow, a mast and a red sail."""
    p = [box((0.42, 0.16, 0.8), (0, 0.08, 0), "tar_light", bevel=0.05, segments=2)]
    p.append(cone(0.21, 0.28, (0, 0.08, 0.46), "tar_light", sides=8, turn=0))
    p.append(box((0.36, 0.03, 0.7), (0, 0.17, -0.02), "wood", bevel=0.01))
    p.append(rod((0, 0.17, 0.05), (0, 0.78, 0.05), 0.02, "wood", 6))
    p.append(box((0.03, 0.42, 0.36), (0, 0.5, 0.0), "lighthouse_red", bevel=0.01))
    p.append(box((0.12, 0.08, 0.02), (0.06, 0.78, 0.05), "dark", bevel=0.005))
    return p


def beast():
    """A beast of the Mist: a humped back out of the water, two gold eyes, fins."""
    p = [sphere(0.55, (0, 0.12, -0.1), "rock_dark", subdivisions=2, squash=0.5)]
    p.append(sphere(0.32, (0, 0.18, 0.42), "stone_dark", subdivisions=2, squash=0.8))
    for x in (-0.12, 0.12):
        p.append(sphere(0.06, (x, 0.28, 0.66), "gold", subdivisions=1))
    for x in (-0.5, 0.5):
        p.append(box((0.32, 0.05, 0.2), (x, 0.1, 0.0), "rock", bevel=0.02, turn=0.4 if x > 0 else -0.4))
    p.append(cone(0.12, 0.3, (0, 0.38, -0.2), "rock", sides=6))
    return p


def wraith():
    """A wraith: a pale shroud rising from the water, a hood, two gold eyes."""
    p = [cone(0.32, 0.9, (0, 0.0, 0), "steam", sides=10)]
    p.append(sphere(0.17, (0, 0.78, 0.04), "white", subdivisions=2))
    for x in (-0.06, 0.06):
        p.append(sphere(0.035, (x, 0.8, 0.18), "gold", subdivisions=1))
    for x in (-0.22, 0.22):
        p.append(rod((x * 0.5, 0.55, 0.05), (x, 0.3, 0.22), 0.04, "steam", 6))
    return p


def galleon():
    """The Mist Galleon: a dark hull, two masts with navy sails, red lanterns at the stern."""
    p = [box((1.1, 0.5, 2.8), (0, 0.25, 0), "dark", bevel=0.12, segments=2)]
    p.append(cone(0.55, 0.6, (0, 0.25, 1.6), "dark", sides=8))
    p.append(box((1.0, 0.06, 2.6), (0, 0.52, 0), "wood", bevel=0.02))
    p.append(box((1.0, 0.35, 0.5), (0, 0.72, -1.1), "dark", bevel=0.04))
    for z, h in ((0.55, 2.0), (-0.45, 1.7)):
        p.append(rod((0, 0.55, z), (0, 0.55 + h, z), 0.05, "wood", 8))
        p.append(box((0.05, h * 0.55, 0.9), (0, 0.55 + h * 0.55, z), "navy_dark", bevel=0.02))
    for x in (-0.35, 0.35):
        p.append(sphere(0.08, (x, 0.95, -1.32), "lighthouse_red", subdivisions=1))
    return p


def kraken():
    """The Kraken: a red dome, gold eyes, tentacles reaching out of the water."""
    p = [sphere(1.0, (0, 0.2, 0), "brick", subdivisions=3, squash=0.6)]
    for x in (-0.3, 0.3):
        p.append(sphere(0.13, (x, 0.55, 0.78), "gold", subdivisions=1))
    import math

    for k in range(8):
        a = k * math.pi / 4
        bx, bz = math.cos(a) * 0.9, math.sin(a) * 0.9
        tx, tz = math.cos(a) * 1.7, math.sin(a) * 1.7
        p.append(rod((bx, 0.05, bz), (tx, 0.55 + 0.25 * (k % 2), tz), 0.12, "copper", 8))
        p.append(sphere(0.12, (tx, 0.55 + 0.25 * (k % 2), tz), "copper", subdivisions=1))
    return p


def leviathan():
    """The Leviathan: a long dark back of rising humps, fins, a great head with gold eyes."""
    p = []
    for k, z in enumerate((-2.2, -1.3, -0.4, 0.5, 1.4)):
        r = 0.55 + 0.12 * k
        p.append(sphere(r, (0, 0.15, z), "navy_dark", subdivisions=2, squash=0.6))
        p.append(cone(0.14, 0.45, (0, 0.15 + r * 0.55, z), "steel", sides=6))
    p.append(sphere(0.9, (0, 0.3, 2.3), "navy", subdivisions=2, squash=0.7))
    for x in (-0.38, 0.38):
        p.append(sphere(0.12, (x, 0.62, 2.95), "gold", subdivisions=1))
        p.append(box((0.9, 0.06, 0.45), (x * 2.4, 0.1, 1.2), "steel", bevel=0.03, turn=0.5 if x > 0 else -0.5))
    return p


MODELS = (("night-raider", raider), ("night-beast", beast), ("night-wraith", wraith), ("night-galleon", galleon), ("night-kraken", kraken), ("night-leviathan", leviathan))


def build(out, fast=False):
    for name, make in MODELS:
        kit.reset(style=True)
        obj = kit.join(make(), name)
        tris = kit.bake_and_export(obj, Path(out) / f"{name}.glb", size=128 if fast else 512, samples=4 if fast else 48)
        print(f"{name:<16} {tris:5d} triangles", flush=True)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    build(OUT, fast="--fast" in sys.argv)
