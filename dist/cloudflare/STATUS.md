# Cloudflare Workers — STATUS

**READY (template, untested live — no CF account in the build session).**
worker.js is a complete R2-backed range server (206/416/suffix ranges,
CORS, wasm/html types) — upload the repo's web/ tree + clips to the
bucket and the player streams from the edge. Deploy needs the owner's
Cloudflare account: `wrangler r2 bucket create oham-clips && wrangler
deploy`, then upload objects. Pairs with the involvedinvolutions.com
site (the cloudflare-infrastructure tooling the owner already uses).
