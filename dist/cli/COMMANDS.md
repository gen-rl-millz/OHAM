# `oham` — command reference

**Generated from the binary's own `--help`.** Do not edit by hand: a release
gate regenerates this file from the binary and fails on any diff, so a hand
edit is reported as drift rather than shipped.

Reading a container is entirely local — `info`, `unseal`, `excerpt`, `repack`
and `serve` need no network, no service, no GPU and no codec. **Sealing runs
as a service** (`seal --api`); the sealed format stays fully readable locally
either way.

Start with `oham doctor` (is this install right?) then `oham onboard` (the
whole tool with the hashes that prove each step).

*oham 0.12.0*

## The commands

### `oham info`
```sh
oham info driving60q2.tsb --json
```
structure, frame count, sizes, digests; refuses corrupt files with the reason
```
Structure, census, and digests of a .tsb container

Usage: oham info [OPTIONS] <FILE>

Arguments:
  <FILE>  

Options:
      --json  machine-readable output (one JSON object)
  -h, --help  Print help
```

### `oham unseal`
```sh
oham unseal driving60q2.tsb --tick 300 --level 1 --png frame.png
```
any frame, any size rung (level 0 = full size, each level halves it); t300 level 0 raw pixels hash to d7b3d597b92edda3 — check yourself
```
Exact RGBA of one or many frames — reads only the bytes each frame needs

Usage: oham unseal [OPTIONS] --tick <TICK> <FILE>

Arguments:
  <FILE>  

Options:
      --tick <TICK>      which frames: `50` · `50,300,900` · `0..120` (end-exclusive) · `all`
      --level <LEVEL>    resolution rung: 0 = native, each level up halves both axes [default: 0]
      --raw <RAW>        write raw RGBA bytes (file for one tick, directory for many)
      --ppm <PPM>        write PPM (P6) images
      --png <PNG>        write PNG images
      --window <WINDOW>  resolve ONLY a pixel window `x0,y0,x1,y1` (coords at the chosen level) — the cost is set by the window, not the frame
      --json             machine-readable output (one JSON array)
  -h, --help             Print help
```

### `oham excerpt`
```sh
oham excerpt driving60q2.tsb still.tsb --tick 300
```
a standalone sealed file, no re-encode; one tick = a full-quality still
```
Cut frames into a standalone .tsb — records carried verbatim, no re-encode; a one-tick excerpt IS the still form

Usage: oham excerpt --tick <TICK> <INPUT> <OUTPUT>

Arguments:
  <INPUT>   
  <OUTPUT>  

Options:
      --tick <TICK>  which frames: `300` · `50,300,900` · `0..120` · `all`
  -h, --help         Print help
```

### `oham repack`
```sh
oham repack driving60q2.tsb smaller.tsb --v2
```
~54% the size, verified reversible BEFORE the file is written; --v1 converts back byte-identically
```
Convert between wire forms: v1 (raw records) and v2 (z-wire, deflated records)

Usage: oham repack [OPTIONS] <INPUT> <OUTPUT>

Arguments:
  <INPUT>   
  <OUTPUT>  

Options:
      --v1    produce the v1 raw-record form (inflate)
      --v2    produce the v2 z-wire form (deflate; verified reversible before writing)
  -h, --help  Print help
```

### `oham serve`
```sh
oham serve . --port 8207
```
a range-request file server; the web receiver (web/ in the repo, or `npm i oham-stream`) plays from it
```
HTTP range server (206 partial content, keep-alive, CORS *) — what the wire pages need

Usage: oham serve [OPTIONS] <ROOT>

Arguments:
  <ROOT>  a .tsb file or a directory to serve

Options:
      --port <PORT>  [default: 8207]
      --bind <BIND>  [default: 127.0.0.1]
  -h, --help         Print help
```

### `oham seal`
```sh
oham seal -o out.tsb --api $OHAM_API -- --w 1920 --h 1088 --frames 60
```
sealing runs as a service; set OHAM_API_TOKEN (or HF_TOKEN, or ~/.config/oham/token) — the token never appears in process listings. The response is kept only if its transport hash and structure verify
```
Seal a source into a .tsb (development tree, or the OHAM sealing API)

In the development tree this drives the gated encoder pipeline exactly as a hand run would, so gate C1 can demand byte-identical containers. Outside it, sealing is offered through the OHAM API — the sealed format stays fully readable locally either way.

Usage: oham seal [OPTIONS] --out <OUT> [-- <ENCODER>...]

Arguments:
  [ENCODER]...
          flags passed verbatim to the encoder (after `--`), e.g. `-- --w 256 --h 128 --frames 120`

Options:
  -o, --out <OUT>
          output .tsb path

      --api <API>
          seal through the OHAM API instead of a local tree, e.g. https://<private-backend>/ — auth via HF_TOKEN when the backend is a private Space. The response is verified against its own transport hash and the container law before it is kept

      --y4m <Y4M>
          y4m source file (API mode; empty = the deterministic synthetic source)

      --workdir <WORKDIR>
          working directory for segments/sidecars (default: <out>.seal/)

      --v2
          repack the sealed output to the v2 z-wire form (verified reversible)

      --fps <FPS>
          override the prelude fps rational, e.g. 24:1 (structural patch, verified)

  -h, --help
          Print help (see a summary with '-h')
```

### `oham about`
```sh
oham about
```
OHAM stores video/images as exact integer addresses in a sealed .tsb file. Any frame is readable at any moment at the same cost; every conversion is reversible; decoding never needs a network or a service.
```
What OHAM is, and whose it is

Usage: oham about

Options:
  -h, --help  Print help
```

### `oham onboard`
```
Everything an agent or new user needs, in one read — plain words, copy-paste commands, and the hashes that prove your setup works

Usage: oham onboard [OPTIONS]

Options:
      --json  machine-readable (one JSON object: commands, examples, goldens)
  -h, --help  Print help
```

### `oham doctor`
```sh
oham doctor
```
decodes a container carried inside the binary and compares the pixels to a digest fixed at build time; expect OHAM_DOCTOR_OK. Do this before reporting any hash below as wrong — it separates a broken install from a real finding
```
Is this install working? Decodes a container carried inside the binary and checks the pixels against a digest fixed at build time

A checksum of the executable proves the file arrived; it says nothing about whether the receiver in it computes the right pixels on this machine. This answers the second question, and also reports where the binary is, whether a sealing API is configured, and whether a development tree is in reach.

Usage: oham doctor [OPTIONS]

Options:
      --json
          machine-readable (one JSON object)

  -h, --help
          Print help (see a summary with '-h')
```

### `oham verify`
```sh
oham verify
```
re-checks the laws above by BYTE COMPARISON against a container carried inside this binary — window == crop, the rung grid, excerpt verbatim, the wire round trip, and a corrupt container refused. Nothing is downloaded. `oham verify --clip yours.tsb` runs the same laws against your own file; expect OHAM_VERIFY_GREEN
```
Re-check the laws this tool claims, by byte comparison, offline

Every check is a comparison of bytes this run produced — nothing is taken on trust and nothing is downloaded. Runs against a container carried inside the binary, or against `--clip <your file>`.

Usage: oham verify [OPTIONS]

Options:
      --clip <CLIP>
          verify these laws against your own container instead of the built-in one (the laws are the container's, not the fixture's)

      --json
          machine-readable (one JSON object)

  -h, --help
          Print help (see a summary with '-h')
```

---

*OHAM — OrthoHolonic Accessible Memory · Paul Phillips — solo developer · involvedinvolutions.com · Apache-2.0 + Commons Clause.*
