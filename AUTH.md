# Tokens and the private backend — how access is handled

The reader needs no auth, ever. The WRITE side (`oham seal --api`) talks
to the private backend and authenticates like this:

1. `OHAM_API_TOKEN` env var, else
2. `HF_TOKEN` env var (private Hugging Face Space backends), else
3. `~/.config/oham/token` — one line, `chmod 600` it.

**The token never appears in process listings**: it is passed to the
transport through a 0600 config file that exists only for the call and
is deleted immediately after — never on the command line.

The response is kept ONLY if it matches its own transport hash
(`x-oham-sha256-16`) and passes the container structural law; a
truncated or tampered wire never becomes a file.

Operators: keep the backend private (platform-level access control is
the outer wall), rotate tokens like any credential, and never commit
one — this repository's history is clean of secrets and must stay so.
