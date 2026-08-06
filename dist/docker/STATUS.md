# Docker / GHCR — STATUS

**READY (builds in CI).** The Dockerfile packages the prebuilt CLI + the
web receiver; default command serves the bundled web tree, typical use
mounts a clips volume. No docker daemon exists in the build session, so
the image builds/pushes via the release workflow (a `docker/build-push-
action` job pushing ghcr.io/gen-rl-millz/oham on tag — added alongside
the release job; the Action's GITHUB_TOKEN has packages:write once the
workflow permission block includes it). First image appears with the
first tag push.
