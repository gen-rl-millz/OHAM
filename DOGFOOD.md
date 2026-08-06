# Dogfood OHAM — a cold-start exercise for any agent or human

Everything below is objective: expected hashes are printed next to every
step, so "it works" is a byte comparison, never an impression. The whole
run needs: this repository, `curl`, and ~250 MB of disk. No build step —
the CLI is prebuilt at `bin/linux-x86_64/oham` (checksum in `SHA256SUMS`).

**The fast path:** `./dogfood.sh` runs every step below mechanically and
prints `DOGFOOD_GREEN n/n`. The manual path follows, for understanding.

## 0 · Verify the tool you were handed

```sh
( cd bin/linux-x86_64 && sha256sum -c SHA256SUMS )   # oham: OK
bin/linux-x86_64/oham about                          # who made this
```

## 1 · Fetch the published clips (the demo's own sealed data)

```sh
curl -O https://storage.googleapis.com/framecore-etch-video/driving60q2.tsb
curl -O https://storage.googleapis.com/framecore-etch-video/driving60q2z.tsb
sha256sum driving60q2*.tsb | cut -c1-16
# driving60q2.tsb  MUST start 8796a9f47a4c6978  (v1, 136,612,657 B)
# driving60q2z.tsb (v2 z-wire, 74,967,324 B)
```

## 2 · Inspect — structure is verified, never assumed

```sh
oham info driving60q2.tsb     # TSB1 v1 · EVS6 4096x2160 · 1200 frames · STRUCTURE_OK
oham info driving60q2z.tsb    # TSB1 v2 · records raw-deflate (z-wire)
```

## 3 · Exact decode — the same bytes the browser receiver produces

```sh
oham unseal driving60q2.tsb  --tick 50 --level 1
# t50 L1 2048x1088 · sha256/16 9fdf230726bf4bc6   ← the published golden
oham unseal driving60q2z.tsb --tick 50 --level 1
# the SAME hash from the compressed wire form — nothing was lost
oham unseal driving60q2.tsb --tick 300 --level 0 --png frame300.png
# a 4K PNG of frame 300, from a 117 KB record
```

All nine goldens, if you want the full sweep (tick · level · sha256/16):
`t50 L0 6c04bb8dd2bff253 · t50 L1 9fdf230726bf4bc6 · t50 L2 1377ace75d0f8c7d ·
t300 L0 d7b3d597b92edda3 · t300 L1 5a8bde6333481685 · t300 L2 f3814653d1c95773 ·
t900 L0 2965276276479762 · t900 L1 2018ef3ddc8ee3a4 · t900 L2 65eeb3d655579935`

## 4 · Reversibility — the conversion that proves itself

```sh
oham repack driving60q2z.tsb rt.tsb --v1
sha256sum rt.tsb | cut -c1-16      # MUST be 8796a9f47a4c6978 — the v2 wire
                                   # form reconstructs the v1 container
                                   # BYTE-IDENTICALLY
oham repack driving60q2.tsb rtz.tsb --v2
# prints: roundtrip 1200/1200 records inflate back byte-exact
# (verified before the output file existed)
```

## 5 · The still form — excerpt and windowed reads

```sh
oham excerpt driving60q2.tsb still.tsb --tick 300
# 1 of 1200 frames · records verbatim — an 8.8-megapixel native still,
# ~117 KB, fully standalone
oham unseal still.tsb --tick 0 --level 0
# sha256/16 d7b3d597b92edda3 — identical to the source's frame 300
oham unseal still.tsb --tick 0 --level 0 --window 1024,512,1536,1024 --png crop.png
# a 512x512 native-detail window; note the printed address count — the
# cost is the window's, not the frame's
```

## 6 · Serve and watch — the whole receiver stack, locally

```sh
oham serve . --port 8207 &
# then open http://127.0.0.1:8207/web/still.html?src=/still.tsb
#   (pan/zoom = windowed reads; the bar shows each view's address cost)
# and the streaming demo runs frozen at:
#   https://storage.googleapis.com/framecore-etch-video/edge.html
```

Embed it in any page with one tag:

```html
<script src="web/oham-element.js"></script>
<oham-stream></oham-stream>
```

## What to report

For an agent: run `./dogfood.sh` and report its final line plus any step
whose hash differed. A hash mismatch on ANY step is a finding — file it
with the step number and both hashes. That is the whole protocol: the
system's claims are byte-precise, so its bug reports are too.

---
*OHAM — OrthoHolonic Accessible Memory · Paul Phillips — solo developer ·
involvedinvolutions.com · Apache-2.0 + Commons Clause.*
