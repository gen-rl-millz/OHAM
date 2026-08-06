---
name: oham
description: Read, decode, excerpt, convert, and serve OHAM .tsb sealed media. Use when the user mentions .tsb files, OHAM, sealed video/stills, or wants exact frame extraction, windowed/deep-zoom reads, or codec-free playback. Every operation verifies itself with hashes.
---

# OHAM — working with sealed .tsb media

OHAM stores video/images as exact integer addresses in a sealed `.tsb`
file. Any frame is readable at any moment at the same cost; every
conversion is reversible; decoding is fully local.

## First: orient

Run `oham onboard` — ten copy-paste commands with the exact hashes that
prove each worked. `oham onboard --json` for the machine form. If the
binary is missing, it ships in the repo at `bin/linux-x86_64/oham`
(github.com/gen-rl-millz/oham).

## The commands you will actually use

- `oham info FILE --json` — structure, frames, sizes, verdict.
- `oham unseal FILE --tick N [--level L] [--window x0,y0,x1,y1] --png OUT`
  — any frame or just a rectangle of it (window reads cost only the
  window). Level 0 = full size; each level halves both axes.
- `oham excerpt IN OUT --tick SPEC` — standalone file, no re-encode;
  one tick = a full-quality still. SPEC: `300` · `50,300,900` · `0..120` · `all`.
- `oham repack IN OUT --v2|--v1` — compress ~54% / restore
  byte-identically; self-verified before the file exists.
- `oham serve DIR --port N` — range server for the web player
  (`npm i oham-stream` or repo `web/`).
- `oham seal -o OUT --api $OHAM_API -- FLAGS` — sealing is a service;
  token via OHAM_API_TOKEN / HF_TOKEN / ~/.config/oham/token (never in
  process listings).

## Verify, never trust

The published demo clip's sha256 starts `8796a9f47a4c6978`; frame 300
level 0 raw pixels hash `d7b3d597b92edda3`. In the repo, `./dogfood.sh`
re-checks every claim by byte comparison — expect `DOGFOOD_GREEN`.

Refusals are typed: every error starts `REFUSED:` and says why. A hash
mismatch is a finding — report the step and both hashes.
