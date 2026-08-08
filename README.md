# OHAM — OrthoHolonic Accessible Memory

*A Paul Phillips / Involved Involutions manifestation.*

**A sealed-media substrate that stores addresses, not pixels.** Content
lives in a `.tsb` sealed container and is reconstructed bit-exactly on
any device by a small CPU-only receiver — no GPU, no codecs, integer
arithmetic end to end. Any frame is readable at any moment at the same
cost (no keyframes), any output size is an exact masked read of the same
sealed content (no transcodes), and streams survive arbitrary delivery
reordering.

**Sole developer: [Paul Phillips](https://involvedinvolutions.com).**

Live demo (frozen, verified at 60 fps on-device):
<https://storage.googleapis.com/framecore-etch-video/edge.html>

## What this repository is

The **usable tool**: the reader/player half of OHAM, complete and
verified — the `oham` CLI, the browser receiver (WebAssembly + pages),
and a one-tag web component. Everything here reads, serves, converts,
and plays sealed containers locally, with no service dependency.

**Sealing (encoding) is offered as a service** through the OHAM API —
contact via [involvedinvolutions.com](https://involvedinvolutions.com).
The sealed format stays fully readable locally: nothing you decode ever
depends on the service.

## The CLI

```sh
npm i -g oham-cli
oham doctor            # is this install right? decodes a built-in fixture
oham onboard           # the whole tool, copy-paste, each step with its hash
```

`doctor` decodes a container carried *inside* the binary and compares the
pixels to a digest fixed at build time — a checksum proves the file
arrived, this proves the receiver computes the right pixels here.

```sh
# inspect a sealed container (structure, census, digests; --json for agents)
oham info clip.tsb

# exact RGBA/PNG of any frame at any moment — reads only that frame's bytes
oham unseal clip.tsb --tick 300 --level 1 --png frame.png

# serve clips to the web receiver (HTTP ranges, CORS)
oham serve ./clips --port 8207

# convert wire forms losslessly (verified before the output file exists)
oham repack clip.tsb clipz.tsb --v2

oham about
```

*From a clone of this repository* the same binary is prebuilt at
`bin/linux-x86_64/oham` (checksum in `SHA256SUMS`) — put it on your PATH,
or prefix each command with that path. Full flag surface:
[`dist/cli/COMMANDS.md`](dist/cli/COMMANDS.md), generated from the
binary's own `--help` and gated against drift.

Sealing through the OHAM API (the write side lives behind the private
backend and is called, never shipped — the response is verified against
its transport hash and the container law before it is kept):

```sh
oham seal -o out.tsb --api https://<oham-api> [--y4m src.y4m] -- --w 1920 --h 1088 --frames 60
```

Every conversion is **reversible and verified**: the compressed z-wire
form converts back to the original container byte-identically, and the
CLI produces the same pixel bytes as the browser receiver for the same
input — these are gated claims, checked on every release, not promises.

## Stills and ultra-high-MP images

A one-frame excerpt is a **still** — fully standalone, records carried
verbatim, no re-encode:

```sh
oham excerpt clip.tsb still.tsb --tick 300     # 8.8 MP native, ~117 KB
oham unseal still.tsb --tick 0 --png photo.png
# read ONLY a window — the cost is the window's, not the image's:
oham unseal still.tsb --tick 0 --window 1024,512,1536,1024 --png crop.png
```

`web/still.html` is the pan/zoom viewer built on the same law: every
view is an exact windowed read at the right resolution rung — **you
never download the image**. The demo still ships at `web/still300.tsb`;
try `oham serve . --port 8207` then open
`http://127.0.0.1:8207/web/still.html?src=/web/still300.tsb`.

## Try it yourself, objectively

`DOGFOOD.md` is a cold-start exercise where every step prints the hash
it must produce — run `./dogfood.sh` and the verdict is a byte
comparison, not an impression.

## Add the stream to any page — one tag

```html
<script src="web/oham-element.js"></script>
<oham-stream></oham-stream>                          <!-- the flagship demo -->
<oham-stream clip="https://your.host/your.tsb"></oham-stream>
<oham-stream mode="locked"></oham-stream>            <!-- fill once, locked 60 -->
<oham-stream mode="probe"></oham-stream>             <!-- measure your wire -->
```

The element embeds the proven receiver page — it cannot drift from the
demo because it *is* the demo.

## The web receiver

`web/` is a byte-exact copy of the frozen, verified deployment (each
file's hash is pinned in `EXPORT_MANIFEST.txt`): the streaming player
(`edge.html`), banked locked-60 playback (`edge-next.html`), the wire
probe (`wire-probe.html`), the decode worker, and `oham.wasm` — the
CPU-only receiver that runs identically in every browser.

Host it anywhere that serves static files with HTTP Range support;
`oham serve` is such a host.

## License

**Apache-2.0 + Commons Clause** (see `LICENSE`) — free and open to play
with, study, and verify. Selling a product or service whose value
derives substantially from OHAM requires a **commercial license**: see
`COMMERCIAL_LICENSE.md`. Attribution lives in `NOTICE`.

---

**Paul Phillips — solo developer.**
OHAM / OrthoHolonic Accessible Memory · [involvedinvolutions.com](https://involvedinvolutions.com)
