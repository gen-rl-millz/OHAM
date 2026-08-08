# dist/ — every distribution surface, with its status

| surface | dir | status |
|---|---|---|
| **the `oham` command** | `cli/` | **LIVE — npm `oham-cli@0.2.2`**; `npm i -g oham-cli` puts `oham` on PATH. Per-platform binaries as `os`/`cpu`-gated optional dependencies (`oham-cli-linux-x64` today), so one platform's bytes download and not five |
| MCP server (agents) | `mcp/` | **LIVE — npm `oham-mcp@0.2.2`**; 7 tools, protocol-tested; takes the binary from `oham-cli` instead of carrying its own |
| npm web package | (repo root) | **LIVE — npm `oham-stream@0.2.2`** (receiver + element + still viewer) |
| PyPI | `../packages/pypi/` | wheel built; publish blocked only on the account's email verification |
| Claude skill | `claude-skill/` | READY — drop-in `.claude/skills/oham/`; marketplace listing = owner PR |
| GitHub Releases | `../.github/workflows/` | armed — push tag v0.2.0 to cut the first release |
| Homebrew | `homebrew/` | formula ready; needs public tap repo + first release (+darwin builds later) |
| Docker/GHCR | `docker/` | Dockerfile ready; builds/pushes in CI on first tag |
| VS Code | `vscode/` | working extension (inspect + frame preview); marketplace needs owner PAT |
| Cloudflare | `cloudflare/` | complete R2 range-server template; needs owner's CF account |
| OBS | `obs/` | blocked on E6 TSB-LIVE (status inside) |
| ffmpeg | `ffmpeg/` | pipe adapter works today via seal --api; muxer = owner call (status inside) |
| Unity/Unreal | `unity-unreal/` | blocked on E10; megatexture wedge documented (status inside) |

Every agent-facing surface starts at the same two commands: **`oham doctor`**
(does this install decode correctly? — it checks a container carried inside
the binary against a digest fixed at build time) and **`oham onboard`** (also
`--json`) — the whole tool in copy-paste commands, each with the hash that
proves it worked.

Reach is gated, not assumed: `labs/oham_cli_reach_v1` packs the tarballs,
installs them into a clean prefix, and requires that `oham` resolve on PATH,
that every command in the shipped README run from outside the repo, and that
the command reference still match the binary (`CLI_REACH_GREEN 5/5`).
