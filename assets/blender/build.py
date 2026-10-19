"""
Builds the city's models into assets/blender/out/ (not committed), then serve.py serves them to the game.

    .venv-blender/bin/python assets/blender/build.py [island] [ground] [lighthouse] [refinery] [site] [--fast] [--stage 5]
    python3 assets/blender/serve.py

--fast bakes small textures with few samples, to look at shapes in the game quickly; never served for good.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import stages  # noqa: E402

OUT = Path(__file__).resolve().parent / "out"


def main(args):
    fast = "--fast" in args
    only = [int(args[args.index("--stage") + 1])] if "--stage" in args else None
    names = [a for a in args if not a.startswith("--") and not a.isdigit()]
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
        stages.build(name, module.base, module.DETAILS, OUT, fast=fast, only=only, meta=getattr(module, "meta", None))
        for extra, make in getattr(module, "EXTRAS", {}).items():
            stages.build_one(extra, make, OUT, fast=fast)


if __name__ == "__main__":
    main(sys.argv[1:])
