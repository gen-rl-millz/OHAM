# OHAM .tsb Tools

Inspect OHAM sealed media (`.tsb`) inside VS Code — structure panel and exact
frame preview, no codecs, no floating point.

- **OHAM: Inspect .tsb** (explorer context menu): container structure, record
  census, wire form, and whether the file carries the **evd integrity lane**
  (a per-record corruption checksum — not cryptography).
- **OHAM: Preview Frame**: decode one exact frame to PNG via the `oham` CLI
  and show it beside your editor. Any tick, any rung, no keyframes.

Requires the [`oham` CLI](https://github.com/gen-rl-millz/oham) on your PATH
(`npm i -g oham-cli`), or set `oham.binaryPath`.

Reading is free and local. Sealing is a service — the encoder never ships.

**Paul Phillips — solo developer** · OHAM / OrthoHolonic Accessible Memory ·
[involvedinvolutions.com](https://involvedinvolutions.com)

License: Apache-2.0 + Commons Clause (not OSI-approved open source; commercial
use requires a paid licence).
