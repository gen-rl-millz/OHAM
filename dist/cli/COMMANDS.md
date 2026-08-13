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

### `oham transfer`
```
Verified, bounded network transfer of exact bytes

Usage: oham transfer <COMMAND>

Commands:
  pull  Pull exact bytes with strict HTTP ranges, resume, and final SHA-256
  help  Print this message or the help of the given subcommand(s)

Options:
  -h, --help  Print help
```

### `oham bundle`
```
Typed multistream TSB/2 bundles with a dedicated integrity ledger

Usage: oham bundle <COMMAND>

Commands:
  create   Create a typed bundle; each value is DOMAIN=PATH
  append   Atomically append streams by rebuilding the directory and integrity ledger
  list     List typed stream metadata without materializing payloads
  extract  Extract one stream; defaults to stream 0, or select by unique domain
  range    Read an exact byte range from one stream payload
  stream   Read one bounded stream chunk and return the resume cursor
  verify   Verify the final integrity LEDGER against every payload and aux section
  help     Print this message or the help of the given subcommand(s)

Options:
  -h, --help  Print help
```

### `oham object`
```
Exact typed objects: store, inspect, range, stream, transfer, verify, and restore

Usage: oham object <COMMAND>

Commands:
  store           Store one file as an exact typed TSB/2 object
  inspect         Inspect the typed directory without materializing its payload
  read            Read the complete exact payload without applying a semantic adapter
  restore         Restore the complete exact payload to a filesystem file
  range           Read an exact byte range into a file
  stream          Read the next bounded chunk; `next_offset` is the resume cursor
  transfer        Copy an object without interpreting its domain
  verify          Verify structure and the stored SHA-256 payload digest
  clean-partials  Find or explicitly remove stale staged outputs for one destination
  help            Print this message or the help of the given subcommand(s)

Options:
  -h, --help  Print help
```

### `oham info`
```
Structure, census, and digests of a .tsb container

STRUCTURE_OK means the container's shape is sound: magic, version, sections tiling exactly to EOF, the index consistent with the header, and the two copies of the inner header agreeing. It does NOT mean the pixels are intact — the file carries no checksum over its picture data, so damaged picture data can still report STRUCTURE_OK here, and nothing in this tool can tell you otherwise. `oham verify --clip <file>` re-checks the format's rules, not the pixels; `unseal` is what actually rejects a record it cannot read.

Usage: oham info [OPTIONS] <FILE>

Arguments:
  <FILE>
          

Options:
      --json
          machine-readable output (one JSON object)

  -h, --help
          Print help (see a summary with '-h')
```

### `oham unseal`
```
Exact RGBA of one or many frames — reads only the bytes each frame needs

Usage: oham unseal [OPTIONS] <FILE>

Arguments:
  <FILE>
          

Options:
      --tick <TICK>
          which frames: `50` · `50,300,900` · `0..120` (end-exclusive) · `all`
          
          [default: 0]

      --level <LEVEL>
          resolution rung: 0 = native. Each level up halves the BLOCK EDGE and keeps the block grid, so the pixel size follows the grid, not a plain halving: 4096x2160 at block 64 is 2048x1088 at level 1, not 1080
          
          [default: 0]

      --raw <RAW>
          write raw RGBA bytes (file for one tick, directory for many)

      --ppm <PPM>
          write PPM (P6) images

      --png <PNG>
          write PNG images

      --window <WINDOW>
          resolve ONLY a pixel window `x0,y0,x1,y1` (coords at the chosen level) — the cost is set by the window, not the frame.
          
          The rectangle SNAPS OUTWARD to whole blocks, because the block is the unit the receiver addresses: asking for `100,100,200,200` on a block-64 stream returns 192x192 at 64,64. The output line always states the rectangle actually returned, and those pixels are byte-identical to that rectangle of the full decode.

      --force
          overwrite an existing output file (never permits input == output)

      --json
          machine-readable output (one JSON array)

  -h, --help
          Print help (see a summary with '-h')
```

### `oham excerpt`
```
Cut frames into a standalone .tsb — records carried verbatim, no re-encode; a one-tick excerpt IS the still form

Usage: oham excerpt [OPTIONS] <INPUT> <OUTPUT>

Arguments:
  <INPUT>   
  <OUTPUT>  

Options:
      --tick <TICK>  which frames: `300` · `50,300,900` · `0..120` · `all` [default: 0]
      --force        overwrite an existing output file (never permits input == output)
  -h, --help         Print help
```

### `oham repack`
```
Convert between wire forms: v1 (raw records) and v2 (z-wire, deflated records)

Usage: oham repack [OPTIONS] <INPUT> <OUTPUT>

Arguments:
  <INPUT>   
  <OUTPUT>  

Options:
      --v1     produce the v1 raw-record form (inflate)
      --v2     produce the v2 z-wire form (deflate; verified reversible before writing)
      --evd    add the per-record integrity lane (evd): an 8-byte corruption checksum per record, verified on every read. Detection, not cryptography — no keys, no authentication claim. With no wire-form flag the input's form is kept; a container already carrying the lane keeps it (and repack re-verifies every record in passing)
      --force  overwrite an existing output file (never permits input == output)
  -h, --help   Print help
```

### `oham serve`
```
HTTP range server (206 partial content, keep-alive, CORS *) — what the wire pages need

Usage: oham serve [OPTIONS] [ROOT]

Arguments:
  [ROOT]  a .tsb file or a directory to serve [default: .]

Options:
      --port <PORT>  [default: 8207]
      --bind <BIND>  [default: 127.0.0.1]
  -h, --help         Print help
```

### `oham seal`
```
Seal a source into a .tsb (development tree, or the OHAM sealing API)

THREE MODES, and the first needs nothing set up:

oham seal --image photo.png a picture, through the public converter. No token, no --api. The service picks block/tiles/mode from the image's own size and prints what it chose.

oham seal -o out.tsb --api <url> -- --w 1920 --h 1088 --frames 60 video, through a token-gated endpoint.

oham seal -o out.tsb -- <encoder flags> inside the development tree only: drives the gated pipeline exactly as a hand run would, so gate C1 can demand byte-identical containers.

Reading is local in every case — the sealed format never needs a service to open.

Usage: oham seal [OPTIONS] [-- <ENCODER>...]

Arguments:
  [ENCODER]...
          flags passed verbatim to the encoder (after `--`), e.g. `-- --w 256 --h 128 --frames 120`

Options:
  -o, --out <OUT>
          output .tsb path; image sealing defaults to IMAGE.tsb

      --api <API>
          seal through the OHAM API instead of a local tree, e.g. https://<private-backend>/ — auth via HF_TOKEN when the backend is a private Space. The response is verified against its own transport hash and the container law before it is kept

      --y4m <Y4M>
          y4m source file (API mode; empty = the deterministic synthetic source)

      --image <IMAGE>
          seal a PICTURE (png/jpg/...) through the public converter — the no-token path. Uses <api>/api/seal, which chooses block, tiles and mode for you from the image's own size, and needs no encoder flags. Defaults --api to the public converter

      --workdir <WORKDIR>
          working directory for segments/sidecars (default: <out>.seal/)

      --v2
          repack the sealed output to the v2 z-wire form (verified reversible)

      --fps <FPS>
          override the prelude fps rational, e.g. 24:1 (structural patch, verified)

      --force
          overwrite an existing output file (never permits input == output)

      --probe
          PROBE ONLY: read the y4m source's own geometry/rate/content and print the recipe the documented laws select (grid-law block, the tiles rule, the smooth-content dial) as one JSON document — nothing is sealed and no output is written. Guided selection, so the flags need never be known

      --mode <MODE>
          the named form for --probe: auto (=standard) | performance | standard | quality — the vocabulary law: a mode is selected by name, never redefined at the point of use
          
          [default: auto]

  -h, --help
          Print help (see a summary with '-h')
```

### `oham about`
```
What OHAM is, and whose it is

Usage: oham about

Options:
  -h, --help  Print help
```

### `oham onboard`
```
Quick start for people using OHAM: common tasks, automatic defaults, and plain-language product limits

Usage: oham onboard [OPTIONS]

Options:
      --json  machine-readable public quick start (one JSON object)
  -h, --help  Print help
```

### `oham doctor`
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

### `oham errors`
```
The stable refusal-code registry (`oham.error.v1`) — every refusal leads with one of these codes; the envelope contract is printed too

Usage: oham errors [OPTIONS]

Options:
      --json  machine-readable (one JSON object)
  -h, --help  Print help
```

### `oham verify`
```
Re-run the format's own laws against a container, offline

This is a CONFORMANCE check, not an integrity check. It asks "does this file obey the laws the format declares, and does this build reproduce the reference decode?" — every leg a byte comparison this run made, nothing downloaded, nothing taken on trust.

It CANNOT tell you a picture matches the source it was sealed from. The container stores no payload checksum, so there is nothing to compare a record against, and the source is not present. What a stream promises about its own reconstruction is a contract that stream declares; this checks the laws, and measures the blind spot.

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
