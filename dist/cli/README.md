# oham — the command line for sealed `.tsb` containers

**OHAM — OrthoHolonic Accessible Memory.** Content is stored as exact
integer addresses on Hadamard carriers and reconstructed **bit-exactly** on
any machine: no floats, no codecs, integer arithmetic end to end.

Three properties follow, and they are the whole tool:

- **Any frame, any moment, the same cost.** No keyframes, no prediction
  chain — one 12-byte index read plus one record read.
- **Any size is an exact masked read of the same content.** Level 0 is
  native; each level up halves both axes. No transcode, no second file, no
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
key, no GPU, no codec. **Writing** (sealing new content) runs behind the
OHAM API, so the substrate itself is never distributed; `oham seal --api`
is the client half and says so when you call it without one. Nothing you
decode ever depends on the service.

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

## Prove it yourself

`dogfood.sh` re-checks every claim above by byte comparison and prints
`DOGFOOD_GREEN n/n`. It downloads the two published demo clips (~211 MB), so
it is the thorough path, not the quick one; `oham doctor` is the quick one.

## Licence

**Apache-2.0 with the Commons Clause** — free to use, study, verify, modify
and build on. You may not *sell* the software, or sell a service whose value
derives substantially from it; commercial use requires a paid licence. That
combination is deliberately **not** OSI-approved open source, and this says
so rather than borrowing the Apache badge.

---

**Paul Phillips — solo developer.**
OHAM / OrthoHolonic Accessible Memory · <https://involvedinvolutions.com>
