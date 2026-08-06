"""OHAM — OrthoHolonic Accessible Memory, the Python face.

A thin wrapper over the bundled `oham` binary; the CLI's `--json` output
is the API. Example:

    import oham
    info = oham.info("clip.tsb")          # dict
    oham.unseal("clip.tsb", tick=300, level=1, png="frame.png")

Paul Phillips — solo developer · involvedinvolutions.com
License: Apache-2.0 + Commons Clause (commercial use requires a paid
license — see COMMERCIAL_LICENSE.md in the distribution).
"""
import json
import os
import subprocess
import sys

__version__ = "0.2.0"


def _bin():
    here = os.path.dirname(os.path.abspath(__file__))
    cand = os.path.join(here, "bin", "oham")
    return cand if os.path.exists(cand) else "oham"


def _run(*args, parse=False):
    r = subprocess.run([_bin(), *args], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip() or r.stdout.strip())
    return json.loads(r.stdout) if parse else r.stdout


def info(path):
    return _run("info", str(path), "--json", parse=True)


def unseal(path, tick, level=0, raw=None, png=None, ppm=None, window=None):
    args = ["unseal", str(path), "--tick", str(tick), "--level", str(level), "--json"]
    if raw:
        args += ["--raw", str(raw)]
    if png:
        args += ["--png", str(png)]
    if ppm:
        args += ["--ppm", str(ppm)]
    if window:
        args += ["--window", ",".join(map(str, window))]
    return _run(*args, parse=True)


def excerpt(src, dst, ticks):
    spec = ticks if isinstance(ticks, str) else ",".join(map(str, ticks))
    return _run("excerpt", str(src), str(dst), "--tick", spec)


def repack(src, dst, form):
    if form not in ("v1", "v2"):
        raise ValueError("form is 'v1' or 'v2'")
    return _run("repack", str(src), str(dst), f"--{form}")


def main():
    os.execvp(_bin(), [_bin(), *sys.argv[1:]])
