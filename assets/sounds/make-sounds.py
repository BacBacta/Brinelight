"""
Makes the game's sounds (client/public/sounds/) from the ElevenLabs sources in this folder.

The sources were made with ElevenLabs Sound Effects on the owner's paid plan (commercial use), variant #1 of each
prompt, on 17 October 2026. Each sound is cut to its useful part, faded at both ends, raised so its loudest point sits
at -1 dBFS, and encoded in MP3 (mono 96 kb/s for the interface, stereo 128 kb/s for the rewards). The sea is a 28 s
loop: its last 2 s are crossfaded into its first 2 s, so it never jumps when it starts again.

Needs ffmpeg and numpy. Run from the repository root: python3 assets/sounds/make-sounds.py
"""
import re
import subprocess
from pathlib import Path

import numpy as np

SRC = Path(__file__).parent
OUT = SRC.parent.parent / "client" / "public" / "sounds"

# name: (start s, end s, fade out s, mono, extra gain dB on top of the peak normalisation)
CUTS = {
    "tap": (0.29, 0.46, 0.06, True, 0),
    "sheet-open": (0.04, 0.75, 0.25, True, None),  # None: a fixed +10 dB, the whoosh builds late
    "sheet-close": (0.08, 0.70, 0.22, True, 0),
    "refuse": (0.00, 0.60, 0.20, True, 0),
    "work-start": (0.00, 0.95, 0.25, True, 0),
    "work-done": (0.00, 0.62, 0.12, False, 0),
    "lighthouse-up": (0.00, 0.92, 0.12, False, 0),
    "captain-up": (0.00, 0.92, 0.12, False, 0),
    "troops-ready": (0.00, 1.60, 0.12, False, 0),
    "resources": (0.00, 0.95, 0.12, False, 0),
}


def ff(*args, **kw):
    return subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-y", *args], check=True, **kw)


def peak_db(path: Path) -> float:
    err = subprocess.run(
        ["ffmpeg", "-nostdin", "-hide_banner", "-i", str(path), "-af", "volumedetect", "-f", "null", "-"],
        capture_output=True,
        text=True,
    ).stderr
    return float(re.search(r"max_volume: (-?[\d.]+) dB", err).group(1))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (start, end, fade, mono, extra) in CUTS.items():
        d = end - start
        tmp = OUT / f"{name}.wav"
        af = f"atrim={start}:{end},asetpts=PTS-STARTPTS,afade=t=in:d=0.004,afade=t=out:st={d - fade:.3f}:d={fade}"
        ff("-i", str(SRC / f"{name}.mp3"), "-af", af, *(["-ac", "1"] if mono else []), str(tmp))
        gain = 10.0 if extra is None else -1.0 - peak_db(tmp) + extra
        ff("-i", str(tmp), "-af", f"volume={gain:.2f}dB", "-c:a", "libmp3lame", "-b:a", "96k" if mono else "128k",
           str(OUT / f"{name}.mp3"))
        tmp.unlink()
        print(f"{name:14s} {d:.2f} s, {gain:+.1f} dB")

    sr = 44100
    raw = subprocess.run(
        ["ffmpeg", "-nostdin", "-loglevel", "error", "-i", str(SRC / "sea-ambience.mp3"), "-ac", "1", "-ar", str(sr),
         "-f", "f32le", "-"],
        capture_output=True,
        check=True,
    ).stdout
    x = np.frombuffer(raw, dtype=np.float32).copy()
    n = 2 * sr
    head, body = x[:n], x[n:]
    t = np.linspace(0, 1, n, dtype=np.float32)
    tail = body[-n:] * np.cos(t * np.pi / 2) + head * np.sin(t * np.pi / 2)
    loop = np.concatenate([body[:-n], tail])
    loop *= 10 ** (-3 / 20) / np.abs(loop).max()
    ff("-f", "f32le", "-ar", str(sr), "-ac", "1", "-i", "-", "-c:a", "libmp3lame", "-b:a", "64k",
       str(OUT / "sea-ambience.mp3"), input=loop.astype(np.float32).tobytes())
    print(f"sea-ambience   {len(loop) / sr:.1f} s loop")


if __name__ == "__main__":
    main()
