"""
Where the island's small living details go on the models (week 8, meeting 4): the chimneys that smoke (the puffs of
steam each model already carries) and the lanterns that light up when the light falls. Read from the scripts that make
the models, without baking anything, into client/src/city/life/spots.json:

    .venv-blender/bin/python assets/blender/spots.py

For each model, "smoke" and "lamps" list [x, y, z, level]: where on the model (its own axes), and the building's level
from which it shows (0: from the stage's first).
"""
import json
import sys
from pathlib import Path

here = Path(__file__).resolve().parent
sys.path.insert(0, str(here))
import kit  # noqa: E402
import stages  # noqa: E402

OUT = here.parent.parent / "client" / "src" / "city" / "life" / "spots.json"
_found = {"smoke": [], "lamps": [], "chimneys": []}
_level = [0]
_sphere, _lantern, _box, _cylinder = kit.sphere, kit.lantern, kit.box, kit.cylinder
# A chimney: a slim upright column of brick, stone or copper, taller than wide, its top over the roofs.
CHIMNEY = {"brick", "stone", "stone_dark", "copper", "dark"}


def column(at, width, height, color):
    if color in CHIMNEY and width <= 0.17 and height >= 2.2 * width and height >= 0.2 and at[1] + height / 2 > 0.55:
        _found["chimneys"].append([at[0], at[1] + height / 2 + 0.03, at[2], _level[0]])


def box(size, at, color, *args, **kwargs):
    if not kwargs.get("tilt") and (len(args) < 4 or not args[3]):
        column(at, max(size[0], size[2]), size[1], color)
    return _box(size, at, color, *args, **kwargs)


def cylinder(radius, height, at, color, *args, **kwargs):
    if not kwargs.get("tilt"):
        column(at, 2 * radius, height, color)
    return _cylinder(radius, height, at, color, *args, **kwargs)


def sphere(radius, at, color, *args, **kwargs):
    if color == "steam":
        _found["smoke"].append([*at, _level[0]])
    return _sphere(radius, at, color, *args, **kwargs)


def lantern(at, size=0.1):
    _found["lamps"].append([*at, _level[0]])
    return _lantern(at, size)


# Before the scripts import them by name.
kit.sphere, kit.lantern, kit.box, kit.cylinder = sphere, lantern, box, cylinder

BUILDINGS = ["refinery", "fishery", "lumberyard", "harbor", "lighthouse", "shelters", "barracks", "infirmary", "observatory"]


def chimneys(points):
    """One smoke for each chimney: the lowest puff of each group of puffs."""
    out = []
    for p in sorted(points, key=lambda p: p[1]):
        if not any(abs(p[0] - q[0]) < 0.1 and abs(p[2] - q[2]) < 0.1 for q in out):
            out.append(p)
    return out


def record(name, make):
    for found in _found.values():
        found.clear()
    kit.reset(style=False)
    make()
    entry = {}
    # A chimney's own puffs of steam say where its smoke starts; a chimney without them smokes from its top.
    smoke = chimneys(_found["smoke"])
    # Three columns or more at the same height are a front's pilasters, not chimneys.
    tops = [c for c in _found["chimneys"] if sum(abs(c[1] - d[1]) < 0.01 for d in _found["chimneys"]) < 3]
    smoke += [c for c in tops if not any(abs(c[0] - p[0]) < 0.12 and abs(c[2] - p[2]) < 0.12 for p in smoke)]
    if smoke:
        entry["smoke"] = [[round(c, 3) for c in p] for p in smoke]
    if _found["lamps"]:
        entry["lamps"] = [[round(c, 3) for c in p] for p in _found["lamps"]]
    return entry


def stage_parts(module, stage):
    """The parts of a stage, as stages.build gathers them, each detail's level noted."""
    _level[0] = 0
    module.base(stage)
    for level in sorted(module.DETAILS):
        if level < stage and stages.era_of(level) == stages.era_of(stage):
            _level[0] = 0
            module.DETAILS[level](stage)
        elif stage < level < stages.next_stage(stage):
            _level[0] = level
            module.DETAILS[level](stage)
    _level[0] = 0


def main():
    spots = {}
    for name in BUILDINGS:
        module = __import__(name)
        for stage in stages.STAGES:
            entry = record(f"{name}-{stage}", lambda: stage_parts(module, stage))
            if entry:
                spots[f"{name}-{stage}"] = entry
    import raft_buildings

    for extra, make in raft_buildings.EXTRAS.items():
        entry = record(extra, make)
        if entry:
            spots[extra] = entry
    OUT.write_text(json.dumps(dict(sorted(spots.items())), indent=1) + "\n")
    print(f"{len(spots)} models with smoke or lamps -> {OUT}")


if __name__ == "__main__":
    main()
