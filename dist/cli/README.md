# oham — the command line for sealed `.tsb` containers

**OHAM — OrthoHolonic Accessible Memory.** Content is stored as exact
integer addresses on Hadamard carriers and reconstructed **bit-exactly** on
any machine: no floats, no codecs, integer arithmetic end to end.

Three properties follow, and they are the whole tool:

- **Any frame, any moment, the same cost.** No keyframes, no prediction
  chain — one 12-byte index read plus one record read.
- **Any size is an exact masked read of the same content.** Level 0 is
  native; each level up halves the block edge while keeping the block grid
  identical — so a 4096×2160 frame at block 64 is a 64×34 grid at every
  rung, and L1 is 2048×**1088**, not 1080. No transcode, no second file, no
  pyramid.
- **A window costs the window.** Reading a 512×512 rectangle of an
  8.8-megapixel image touches 1,537 addresses, and the pixels are identical
  to cropping the full decode.

```sh
npm i -g oham-cli
oham doctor
```

`doctor` decodes a container carried **inside the binary** and checks the
pixels against a digest fixed when it was built. A checksum of the
executable proves the file arrived; this proves the receiver computes the
right pixels on your machine. Expect `OHAM_DOCTOR_OK`.

## Reading is local; sealing is a service

Everything below runs entirely on your machine — no network, no service, no
key, no GPU, no codec. **Writing** runs behind the OHAM API, so the
substrate itself is never distributed. Nothing you decode ever depends on
the service.

## Five minutes, with the hashes that prove each step

Everything here uses one 117 KB file — a single-frame container holding an
8.8-megapixel image.

```sh
curl -O https://storage.googleapis.com/framecore-etch-video/lab/still300.tsb
sha256sum still300.tsb | cut -c1-16      # 3756b663647cd78f
```

**Look inside.** Structure is verified, never assumed; a structural
violation is refused with the reason.

```sh
oham info still300.tsb --json
# TSB1 v1 · EVS6 4096x2160 · 1 record · 6x4 tiles · STRUCTURE_OK
```

**Decode it, exactly.**

```sh
oham unseal still300.tsb --tick 0 --level 0
# t0 L0 4096x2160 · sha256/16 d7b3d597b92edda3
oham unseal still300.tsb --tick 0 --level 2
# t0 L2 1024x544 · sha256/16 f3814653d1c95773
```

Those two hashes are the published goldens the browser receiver produces for
the same content — the native and WebAssembly faces are the same compiled
receiver, and gates compare them byte for byte.

**Read only a window.** The cost is the window's, not the image's.

```sh
oham unseal still300.tsb --tick 0 --window 1024,512,1536,1024 --png crop.png
# t0 L0 512x512 · window @1024,512 · 1537 addresses · sha256/16 8871b5d7810adb8c
```

1,537 addresses out of the frame's ~37,000. You never download the image;
you read a rectangle of the inscription.

### Seal a picture of your own — no token, no setup

Any PNG or JPEG works — the step just above wrote `crop.png`, so this runs
straight after it:

```sh
oham seal -o mine.tsb --image crop.png
```

That is the whole write side for a picture. It posts to the public
converter, which chooses the block size, tile count and mode from your
image's own dimensions and **prints what it chose**:

```
sealed -> mine.tsb · 22916 B · sha256/16 5957a6ad5cba0022
  chosen: width 512 · height 512 · block 8 · tiles 2 · grid 64x64 · mode standard · q 2 · magbits 7
```

The response is kept **only** if it passes the container law — a JSON error
body saved under a `.tsb` name would otherwise look like a success. Then
read it back with the commands below; that round trip is the whole system in
two lines.

Sealing **video** goes through a token-gated endpoint:
`oham seal -o out.tsb --api <url> -- --w 1920 --h 1088 --frames 60`, with
the token in `$OHAM_API_TOKEN`, `$HF_TOKEN` or `~/.config/oham/token` (it
never rides argv). Ask via <https://involvedinvolutions.com>.

**Convert wire forms, reversibly.** v2 deflates each record; v1 restores it.
The round trip is verified *before* the output file exists.

```sh
oham repack still300.tsb small.tsb --v2   # 117,405 -> 65,061 B (55.1%)
oham repack small.tsb back.tsb --v1
sha256sum back.tsb | cut -c1-16           # 3756b663647cd78f — byte-identical
```

**Serve it** to the browser receiver (HTTP ranges + CORS):

```sh
oham serve . --port 8207
```

**The whole tool**, in copy-paste commands each carrying its proving hash:

```sh
oham onboard          # or: oham onboard --json, for agents and scripts
```

Full flag surface: [`COMMANDS.md`](./COMMANDS.md), generated from the
binary's own `--help` so it cannot drift.

## Other ways to use it

| | |
|---|---|
| **In a page, one tag** | `npm i oham-stream` → `<oham-stream clip="…/clip.tsb">` |
| **From an assistant** | `npm i -g oham-mcp` → OHAM as a native tool for any MCP agent |
| **In the browser, nothing installed** | <https://storage.googleapis.com/framecore-etch-video/edge.html> — 4K, 60 fps, CPU-only |

## Install notes

The binary ships as a platform package (`oham-cli-linux-x64` today) pulled
in as an optional dependency, so you download one binary and not five. If
your platform has no build yet, `oham` says which platform it is and what
is built, rather than failing as "not found". `OHAM_BIN=/path/to/oham`
overrides the lookup entirely.

`npm i --no-optional` skips the binary — `oham doctor` will tell you so.

## Prove it yourself — offline, in one command

```sh
oham verify
```

Six checks, each a byte comparison this run made, against a container
carried inside the binary. Nothing is downloaded and nothing is asserted
from a table:

| | |
|---|---|
| `V1` | the receiver reproduces a digest fixed at build time |
| `V2` | a windowed read equals that rectangle of the full decode |
| `V3` | the block grid is identical at every rung |
| `V4` | an excerpt's frame is byte-identical to the source's |
| `V5` | v1 → v2 → v1 reproduces the input container exactly |
| `V6` | **every structural corruption is refused** — swept, not a single flip |

`V6` is the one that makes the rest mean something: a verifier that only
ever sees good input hasn't shown it can tell the difference.

It also prints what this build **cannot** check. The container carries no
payload checksum, so a damaged *record* can decode to wrong pixels with
nothing to compare against. Rather than hide that, every run measures it:

```
NOTE payload corruption, 24 single-byte flips through the records:
     4 detected · 2 inert · 3 crashed the decoder ·
     15 DECODED TO WRONG PIXELS UNDETECTED.
```

Structure is checked; pixels are not. That is a limit of the format as it
stands, disclosed on every run rather than discovered later.

Run the same laws against **your own** file:

```sh
oham verify --clip still300.tsb
```

If a hash differs from one printed here, run `oham doctor` first — it
separates a broken install from a real finding, and a real finding is worth
reporting.

## Licence

**Apache-2.0 with the Commons Clause** — free to use, study, verify, modify
and build on. You may not *sell* the software, or sell a service whose value
derives substantially from it; commercial use requires a paid licence. That
combination is deliberately **not** OSI-approved open source, and this says
so rather than borrowing the Apache badge.

---

**Paul Phillips — solo developer.**
OHAM / OrthoHolonic Accessible Memory · <https://involvedinvolutions.com>
