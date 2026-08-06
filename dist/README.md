# dist/ — every distribution surface, with its status

| surface | dir | status |
|---|---|---|
| MCP server (agents) | `mcp/` | **LIVE — npm `oham-mcp@0.2.0`**; 6 tools, protocol-tested, zero deps |
| npm web package | (repo root) | **LIVE — npm `oham-stream@0.2.0`** (receiver + element + still viewer) |
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

Every agent-facing surface starts at the same place: `oham onboard`
(also `--json`) — the tool in ten commands with the hashes that prove
each one worked.
