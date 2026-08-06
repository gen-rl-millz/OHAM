# oham-mcp — OHAM as a native tool for any agent

One command gives any MCP-speaking agent (Claude Code, Claude Desktop,
Cursor, …) the whole OHAM reader: inspect sealed `.tsb` files, decode any
frame — or just a window of one — straight into the conversation as an
image, cut stills, convert wire forms, and serve files to the web player.

## Install

The server needs the `oham` binary. Easiest: clone the repo (the binary
ships in it) and point at this folder — or `npm i -g oham-mcp` and set
`OHAM_BIN`.

**Claude Code:**

```sh
claude mcp add oham -- node /path/to/oham/dist/mcp/server.mjs
```

**Claude Desktop / Cursor** (`mcpServers` config):

```json
{
  "mcpServers": {
    "oham": {
      "command": "node",
      "args": ["/path/to/oham/dist/mcp/server.mjs"],
      "env": { "OHAM_BIN": "/path/to/oham/bin/linux-x86_64/oham" }
    }
  }
}
```

## The tools

| tool | what it does |
|---|---|
| `oham_onboard` | start here — the whole tool in ten commands, with the hashes that prove each worked |
| `oham_info` | inspect a container (JSON): dimensions, frames, sizes, digests, verdict |
| `oham_unseal` | any frame (or just a pixel window of one) → PNG, inline in the conversation or to a file |
| `oham_excerpt` | cut frames into a standalone file — one tick = a full-quality still |
| `oham_repack` | compress (v2, ~54%) or restore (v1, byte-identical) — verified before writing |
| `oham_serve` | start/stop a local range server the OHAM web player streams from |

Everything decodes locally; nothing needs a network or a service. Errors
come back as the CLI's own `REFUSED:` lines, which always say why.

---
*OHAM — OrthoHolonic Accessible Memory · Paul Phillips — solo developer ·
involvedinvolutions.com · Apache-2.0 + Commons Clause.*
