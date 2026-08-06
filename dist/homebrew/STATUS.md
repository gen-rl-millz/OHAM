# Homebrew — STATUS

**BLOCKED on two owner inputs, formula ready.**
1. The tap repo `gen-rl-millz/homebrew-oham` must exist (public — brew
   taps cannot be private) with this file at `Formula/oham.rb`.
2. The first GitHub release must exist (push tag v0.2.0; the workflow
   builds the tarball whose sha fills RELEASE_SHA256_LINUX).
macOS: darwin/arm64 binaries cannot be built from this repo (no source
here by design — the lock); they build in the private tree and land in
bin/darwin-arm64/ the same way linux-x86_64 does. Until then the formula
is linux-only.
