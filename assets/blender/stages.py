"""
A building's models (owner, 19 October): one for each of the six eras (Salvage 1–4, Colony 5–9, Workshop 10–14,
Industry 15–19, Electricity 20–24, Modern 25–30), each with its own architecture, and the Modern era complete at 30.
The model of a stage carries the details of its own levels tagged with their level (kit.tag): the game shows them one
by one, with one draw call (serve.py orders the triangles). A new era is a new building: the details of the era before
do not carry over; within the Modern era, the model of level 30 keeps those of 26 to 29.
"""
from pathlib import Path

import kit

STAGES = [1, 5, 10, 15, 20, 25, 30]
# The first level of each era.
ERAS = {1: "salvage", 5: "colony", 10: "workshop", 15: "industry", 20: "electricity", 25: "modern"}


def era_of(level):
    return ERAS[max(e for e in ERAS if e <= max(1, level))]


def stage_of(level):
    """The stage a level shows: the highest stage at or under it."""
    return max(s for s in STAGES if s <= max(1, level))


def next_stage(stage):
    later = [s for s in STAGES if s > stage]
    return later[0] if later else 31


# The flag of each era, in the palette (brick red belongs to the pirates).
FLAG = {1: "cream", 10: "navy", 20: "copper", 30: "gold"}


def flag_color(stage):
    return FLAG[max(t for t in FLAG if t <= stage)]


def build(name, base, details, out, fast=False, only=None, meta=None):
    """
    Makes `name`-<stage>.glb for each stage: `base(stage)` returns the parts of the stage; `details` maps each level
    (not a stage) to a function of the stage returning the parts that level adds. `meta(stage)`, if given, goes in the
    model's sidecar (the Lighthouse's lantern height).
    """
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    assert not set(details) & set(STAGES), "a stage's level is a transformation, not a detail"
    for stage in only or STAGES:
        kit.reset(style=True)
        parts = list(base(stage))
        for level in sorted(details):
            if level < stage and era_of(level) == era_of(stage):
                parts += details[level](stage)
            elif stage < level < next_stage(stage):
                parts += kit.tag(details[level](stage), level)
        obj = kit.join(parts, f"{name}-{stage}")
        path = out / f"{name}-{stage}.glb"
        tris = kit.bake_and_export(obj, path, size=128 if fast else 1024, samples=4 if fast else 48, meta=meta(stage) if meta else None)
        print(f"{name}-{stage:<3} {tris:5d} triangles  {path.stat().st_size / 1024:6.0f} kB", flush=True)
