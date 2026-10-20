"""
Builds the city's models into assets/blender/out/ (not committed), then serve.py serves them to the game.

    .venv-blender/bin/python assets/blender/build.py [island] [ground] [lighthouse] [refinery] [site] [--fast] [--stage 5] [--only raft-a]
    python3 assets/blender/serve.py

--fast bakes small textures with few samples, to look at shapes in the game quickly; never served for good. --only builds
just the models of their own whose names start with it (the floating village has many).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import stages  # noqa: E402

OUT = Path(__file__).resolve().parent / "out"


def main(args):
    fast = "--fast" in args
    only = [int(args[args.index("--stage") + 1])] if "--stage" in args else None
    prefix = args[args.index("--only") + 1] if "--only" in args else ""
    names = [a for a in args if not a.startswith("--") and not a.isdigit() and a != prefix]
    for name in names:
        if name == "island":
            import island

            island.main(OUT, fast=fast)
            continue
        if name == "ground":
            import ground

            ground.build(OUT, fast=fast, only=only)
            continue
        if name == "site":
            import site_models

            site_models.build(OUT, fast=fast)
            continue
        module = __import__(name)
        # The floating village (raft.py, raft_buildings.py) has only models of its own, no stages.
        if hasattr(module, "base"):
            stages.build(name, module.base, module.DETAILS, OUT, fast=fast, only=only, meta=getattr(module, "meta", None))
        for extra, make in getattr(module, "EXTRAS", {}).items():
            if extra.startswith(prefix):
                stages.build_one(extra, make, OUT, fast=fast)
        # Models of their own for each stage (the Harbor's pier and boat), laid by the game with the stage's.
        for extra, make in getattr(module, "STAGE_EXTRAS", {}).items():
            for stage in only or stages.STAGES:
                stages.build_one(f"{extra}-{stage}", (lambda st: lambda: make(st))(stage), OUT, fast=fast)


if __name__ == "__main__":
    main(sys.argv[1:])
