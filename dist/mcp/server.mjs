#!/usr/bin/env node
/* oham-mcp — OHAM as a native tool for any MCP agent (Claude, Cursor, …).
 *
 * A newline-delimited JSON-RPC 2.0 stdio server speaking the Model Context
 * Protocol, wrapping the `oham` CLI. No SDK, no runtime libraries — the one
 * dependency is `oham-cli`, which carries the binary this drives. Every tool
 * returns plain text or an image; errors come back as the CLI's own REFUSED
 * lines, which always say why.
 *
 * Binary resolution: $OHAM_BIN, else the platform package `oham-cli` brings
 * in, else `oham` on PATH.
 *
 * Paul Phillips — solo developer · OHAM / OrthoHolonic Accessible Memory
 * involvedinvolutions.com · Apache-2.0 + Commons Clause
 */
import { execFile } from "node:child_process";
import { readFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const here = dirname(fileURLToPath(import.meta.url));
const require_ = createRequire(import.meta.url);
// The version this server REPORTS is the version it SHIPS as — read from its
// own package.json, never hardcoded. (0.2.7's initialize said "0.2.5": a
// string nobody bumps is a second source of truth, found by live-registry
// verification and closed the way the CLI closed COMMANDS.md drift.)
const PKG_VERSION = JSON.parse(
  readFileSync(join(here, "package.json"), "utf8"),
).version;

// ONE binary, in ONE package. 0.2.1 carried its own copy while `oham-cli`
// carried another, so the proof script and the executable it proves lived in
// different installs. `oham-cli` is now a dependency and owns the binary; its
// per-platform packages are `os`/`cpu` gated, so one platform's bytes are
// downloaded and not five.
//
// Resolved directly rather than through oham-cli's `bin/oham` launcher: that
// launcher is a Node shim, and paying ~40 ms of process startup on a call
// that costs ~29 µs of decode would be the tool surface's dominant cost.
const PLATFORM = `${process.platform}-${process.arch}`;
const candidates = [];
try {
  candidates.push(require_.resolve(`oham-cli-${PLATFORM}/bin/oham`));
} catch { /* platform package absent — the message below names it */ }
candidates.push(join(here, "bin/oham"));       // a vendored copy, if any

const OHAM = process.env.OHAM_BIN || candidates.find(existsSync) || "oham";

// Say so at startup, by name. A missing binary is an install problem, and an
// ENOENT on every tool call names nothing the user can act on.
if (OHAM === "oham" && !process.env.OHAM_BIN) {
  process.stderr.write(
    `oham-mcp: no oham binary found for ${PLATFORM}.\n` +
    `  looked in: $OHAM_BIN, oham-cli-${PLATFORM}/bin/oham, ./bin/oham\n` +
    "  fix: npm i -g oham-mcp again (--no-optional skips the binary),\n" +
    "       or set OHAM_BIN=/path/to/oham\n");
}

const run = (args) =>
  new Promise((resolve) => {
    execFile(OHAM, args, { maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) =>
      resolve({ ok: !err, out: stdout, err: stderr || (err ? String(err) : "") }));
  });

const MAX_INLINE = 2 * 1024 * 1024;
let serveChild = null;
let serveRoot = null, servePort = null;

const TOOLS = [
  {
    name: "oham_onboard",
    description:
      "Start here. Everything OHAM does in copy-paste commands, each with the exact hash that proves it worked. OHAM stores video/images as exact integer addresses in sealed .tsb files — any frame readable at any moment at the same cost, every conversion reversible, decoding fully local.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async () => text((await run(["onboard"])).out),
  },
  {
    name: "oham_doctor",
    description:
      "Check that this OHAM install decodes correctly: reports the binary path and version, and decodes a container carried inside the binary against a digest fixed at build time. Run this FIRST if any other tool returns an unexpected hash — it separates a broken install from a real finding. Returns JSON; verdict is OHAM_DOCTOR_OK or OHAM_DOCTOR_FAIL.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async () => {
      const r = await run(["doctor", "--json"]);
      return r.ok ? text(r.out) : fail(r);
    },
  },
  {
    name: "oham_verify",
    description:
      "Re-check OHAM's claims by BYTE COMPARISON, offline: the receiver against a digest fixed at build time, a windowed read against that rectangle of the full decode, the rung grid, excerpt-verbatim, the wire round trip, and a corrupt container refused. With no argument it checks a container carried inside the binary; pass clip to run the same laws against your file — this is the payload integrity check oham_info does NOT do. Returns JSON; verdict is OHAM_VERIFY_GREEN or OHAM_VERIFY_RED.",
    inputSchema: {
      type: "object",
      properties: { clip: { type: "string", description: "path to a .tsb to verify instead of the built-in one" } },
      additionalProperties: false,
    },
    handler: async (a) => {
      const r = await run(["verify", "--json", ...(a.clip ? ["--clip", a.clip] : [])]);
      // RED is a real answer, not a tool failure — return the JSON either way
      return text((r.out || r.err).trim());
    },
  },
  {
    name: "oham_info",
    description:
      "Inspect a .tsb sealed container: dimensions (inner.w/h), frame count (inner.frames), level count (inner.segs), record sizes, section digests, structural verdict. Returns JSON. Refuses STRUCTURALLY invalid files with the reason (bad magic, sections that do not tile, trailing bytes). It does NOT validate record payloads — a container whose pixels are corrupt still reports STRUCTURE_OK here. To check payload integrity call oham_verify, or decode with oham_unseal, which is what actually rejects a damaged record.",
    inputSchema: {
      type: "object",
      properties: { file: { type: "string", description: "path to the .tsb" } },
      required: ["file"], additionalProperties: false,
    },
    handler: async (a) => {
      const r = await run(["info", a.file, "--json"]);
      return r.ok ? text(r.out) : fail(r);
    },
  },
  {
    name: "oham_unseal",
    description:
      "Decode a frame (or just a window of it) to an image. tick = frame number; level 0 = full size, each level halves both axes; window = [x0,y0,x1,y1] pixels at that level reads ONLY that rectangle (cost is the window's, not the frame's). Returns the PNG inline (default) or writes to out_path.",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", description: "path to the .tsb" },
        tick: { type: "integer", minimum: 0, description: "frame number; see inner.frames from oham_info for the count" },
        level: { type: "integer", minimum: 0, default: 0 },
        window: {
          type: "array", items: { type: "integer", minimum: 0 },
          minItems: 4, maxItems: 4,
          description: "x0,y0,x1,y1 — omit for the whole frame",
        },
        out_path: { type: "string", description: "write the PNG here instead of returning it inline" },
      },
      required: ["file", "tick"], additionalProperties: false,
    },
    handler: async (a) => {
      const inline = !a.out_path;
      const tmp = inline ? mkdtempSync(join(tmpdir(), "oham-mcp-")) : null;
      const png = a.out_path || join(tmp, "frame.png");
      const args = ["unseal", a.file, "--tick", String(a.tick),
                    "--level", String(a.level ?? 0), "--png", png];
      if (a.window) args.push("--window", a.window.join(","));
      const r = await run(args);
      try {
        if (!r.ok) return fail(r);
        if (!inline) return text(r.out.trim() + `\nwritten: ${png}`);
        const bytes = readFileSync(png);
        // A 4096x2160 frame inlines as ~6.3 MB of base64 — enough to blow a
        // caller's context in ONE call, and it was the DEFAULT path. The cap
        // is now a size a conversation can hold, and the refusal says which
        // two knobs fix it rather than just declining.
        if (bytes.length > MAX_INLINE)
          return text(
            `${r.out.trim()}\n\nREFUSED to inline: the PNG is ${bytes.length} B, over the ` +
            `${MAX_INLINE} B inline limit. Either raise 'level' (each level halves ` +
            `both axes), pass 'window' to read just the part you need, or set ` +
            `'out_path' to write it to a file instead.`);
        return {
          content: [
            { type: "text", text: r.out.trim() },
            { type: "image", data: bytes.toString("base64"), mimeType: "image/png" },
          ],
        };
      } finally {
        // one temp dir per inline call used to be left behind forever
        if (tmp) rmSync(tmp, { recursive: true, force: true });
      }
    },
  },
  {
    name: "oham_seal_image",
    description:
      "Seal a picture (png/jpg/...) into a .tsb container through the public converter. This is the WRITE side and it needs no token and no endpoint — the service picks block size, tile count and mode from the image's own dimensions and reports what it chose. The response is kept only if it passes the container law. Reading the result back needs no service at all.",
    inputSchema: {
      type: "object",
      properties: {
        image: { type: "string", description: "path to the source picture" },
        output: { type: "string", description: "path to write the .tsb; must not exist unless force" },
        api: { type: "string", description: "override the endpoint (default: the public converter)" },
        force: { type: "boolean", description: "overwrite an existing output file" },
      },
      required: ["image", "output"], additionalProperties: false,
    },
    handler: async (a) => {
      const r = await run(["seal", "-o", a.output, "--image", a.image,
                           ...(a.api ? ["--api", a.api] : [])]);
      return r.ok ? text(r.out) : fail(r);
    },
  },
  {
    name: "oham_excerpt",
    description:
      "Cut frames into their own standalone .tsb — no re-encode, records carried byte-for-byte. One tick makes a full-quality still. ticks accepts '300', '50,300,900', '0..120' (end-exclusive), or 'all'. NOTE: the output's ticks are RENUMBERED FROM 0 — excerpting tick 300 gives a file whose only frame is tick 0, so read it back with tick 0, not 300. The source ticks are not recorded in the output; keep that mapping yourself if you need it. Refuses to overwrite an existing output unless force is set, and never allows input == output.",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string", description: "path to the source .tsb" },
        output: { type: "string", description: "path to write; must not exist unless force" },
        ticks: { type: "string", description: "'300' | '50,300,900' | '0..120' | 'all'" },
        force: { type: "boolean", description: "overwrite an existing output file" },
      },
      required: ["input", "output", "ticks"], additionalProperties: false,
    },
    handler: async (a) => {
      const r = await run(["excerpt", a.input, a.output, "--tick", a.ticks,
                           ...(a.force ? ["--force"] : [])]);
      return r.ok ? text(r.out) : fail(r);
    },
  },
  {
    name: "oham_repack",
    description:
      "Convert wire forms losslessly: 'v2' compresses (~55% size), 'v1' restores byte-identically. Every record is verified to round-trip BEFORE the output file exists. To find a file's CURRENT form, call oham_info and read `version` (1 or 2) and `records_deflated`. Note that the round-trip check proves the BYTES survive, not that the payload is valid — a corrupt container repacks cleanly; use oham_verify for integrity. Refuses to overwrite an existing output unless force is set, and never allows input == output.",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string", description: "path to the source .tsb" },
        output: { type: "string", description: "path to write; must not exist unless force" },
        form: { type: "string", enum: ["v1", "v2"], description: "target wire form" },
        force: { type: "boolean", description: "overwrite an existing output file" },
      },
      required: ["input", "output", "form"], additionalProperties: false,
    },
    handler: async (a) => {
      // `--${form}` used to be interpolated unchecked: form:"help" returned
      // `oham repack --help` and reported success. argv-based, so never a
      // shell hole, but agent-controlled input reaching a flag parser is a
      // hole the moment repack grows a destructive flag.
      const flag = { v1: "--v1", v2: "--v2" }[a.form];
      if (!flag) return text(`REFUSED: form must be v1 or v2, got ${JSON.stringify(a.form)}`);
      const r = await run(["repack", a.input, a.output, flag, ...(a.force ? ["--force"] : [])]);
      return r.ok ? text(r.out) : fail(r);
    },
  },
  {
    name: "oham_serve",
    description:
      "Start, stop, or query a local range-request file server (what the OHAM web player streams from). action 'start' serves root on port (default 8207) and keeps it running across tool calls; 'status' reports whether one is running and where; 'stop' ends it. Refuses to start if the port is already taken, rather than reporting a URL that belongs to someone else. Only one server per session; it dies when this server does.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["start", "stop", "status"] },
        root: { type: "string" }, port: { type: "integer", default: 8207 },
      },
      required: ["action"], additionalProperties: false,
    },
    handler: async (a) => {
      if (a.action === "status") {
        return text(serveChild
          ? `serving ${serveRoot} at http://127.0.0.1:${servePort}/ (pid ${serveChild.pid})`
          : "no server running (started by this session)");
      }
      if (a.action === "stop") {
        if (!serveChild) return text("no server running");
        serveChild.kill(); serveChild = null; serveRoot = servePort = null;
        return text("server stopped");
      }
      if (!a.root) return text("REFUSED: root required to start");
      if (serveChild) return text("REFUSED: a server is already running — stop it first");
      const { spawn } = await import("node:child_process");
      const { createServer } = await import("node:net");
      const port = a.port ?? 8207;
      // CHECK THE PORT FIRST. This used to spawn and immediately report
      // success; when the port was already held by an unrelated process the
      // tool returned a confident URL serving SOMEONE ELSE'S directory, and
      // with no `status` action the caller had no way to find out.
      const free = await new Promise((res) => {
        const s = createServer();
        s.once("error", () => res(false));
        s.once("listening", () => s.close(() => res(true)));
        s.listen(port, "127.0.0.1");
      });
      if (!free)
        return text(`REFUSED: port ${port} is already in use by another process. ` +
                    `Pick a different --port, or stop whatever holds it.`);
      serveChild = spawn(OHAM, ["serve", a.root, "--port", String(port)],
                         { stdio: "ignore" });
      serveChild.on("exit", () => { serveChild = null; });
      serveRoot = a.root; servePort = port;
      // give it a moment and confirm it is actually up before claiming so
      await new Promise((r) => setTimeout(r, 250));
      if (!serveChild || serveChild.exitCode !== null)
        return text(`REFUSED: the server exited immediately — check that ${a.root} exists`);
      return text(`serving ${a.root} at http://127.0.0.1:${port}/ (ranges + CORS)`);
    },
  },
  {
    name: "oham_export",
    description:
      "Translate a sealed container BACK to legacy media, chosen by the output extension: .png poster (EXACT), a directory of png frames (EXACT), .wav from an audiopcm .tsb2 object (EXACT — byte-identical to the stored payload, digest-gated), .mp4/.gif through a DISCOVERED external encoder ($OHAM_FFMPEG, then PATH). The lossy legs NAME the re-encode in the receipt (EXACT_FRAMES_TO_LOSSY_LEGACY_ENCODER + the encoder version) — never silent; an absent encoder is a typed refusal that says what to install. Read-side only: sealing stays the service's.",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string", description: "a .tsb container, or a .tsb2 audiopcm object for wav" },
        output: { type: "string", description: "out.png | frames_dir/ | out.wav | out.mp4 | out.gif" },
        tick: { type: "string", description: "one tick ('300') or a range ('0..120'); default: poster tick 0, moving = all" },
        level: { type: "integer", minimum: 0, default: 0, description: "the rung to decode (0 = native)" },
        fps: { type: "string", description: "override the output frame rate, e.g. '30:1' (default: the container's own)" },
        force: { type: "boolean", description: "overwrite an existing output" },
      },
      required: ["input", "output"], additionalProperties: false,
    },
    handler: async (a) => {
      const args = ["export", a.input, a.output, "--json"];
      if (a.tick) args.push("--tick", a.tick);
      if (a.level !== undefined) args.push("--level", String(a.level));
      if (a.fps) args.push("--fps", a.fps);
      if (a.force) args.push("--force");
      const r = await run(args);
      return r.ok ? text(r.out) : fail(r);
    },
  },
  {
    name: "oham_tape",
    description:
      "Make, read, or append lawful etch tapes: JSONL events packed as 8-byte etch words on the frozen layout [t:16|lane:4|word_id:20|tidx:15|leaf:8|rail:1]. action 'make' packs an input JSONL file (one {\"t\":N,\"lane\":N,\"word_id\":N,\"tidx\":N,\"leaf\":N,\"rail\":N} per line — t required, the rest default 0) into a tape; 'read' decodes a tape back to events (limit bounds the returned count); 'append' extends a tape staged+atomic. Out-of-range values refuse with the ROW and FIELD named. Store a tape typed with oham_object action 'store', domain 'etchtape'.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["make", "read", "append"] },
        input: { type: "string", description: "JSONL events file (make, append)" },
        tape: { type: "string", description: "the tape file (read, append)" },
        output: { type: "string", description: "the tape to write (make)" },
        limit: { type: "integer", minimum: 1, description: "read: return at most this many events" },
        force: { type: "boolean", description: "make: overwrite an existing output" },
      },
      required: ["action"], additionalProperties: false,
    },
    handler: async (a) => {
      let args;
      if (a.action === "make") {
        if (!a.input || !a.output) return text("REFUSED: 'make' needs input (JSONL) and output (tape)");
        args = ["tape", "make", a.input, a.output, ...(a.force ? ["--force"] : [])];
      } else if (a.action === "read") {
        if (!a.tape) return text("REFUSED: 'read' needs tape");
        args = ["tape", "read", a.tape, ...(a.limit ? ["--limit", String(a.limit)] : [])];
      } else {
        if (!a.tape || !a.input) return text("REFUSED: 'append' needs tape and input (JSONL)");
        args = ["tape", "append", a.tape, a.input];
      }
      const r = await run([...args, "--json"]);
      return r.ok ? text(r.out) : fail(r);
    },
  },
  {
    name: "oham_object",
    description:
      "Exact typed TSB/2 objects — byte custody for ANY file (domains: blobfile, modelbin, textutf8, tablecsv, geojson, dnaascii, audiopcm, etchtape, ...). action 'store' seals a file as an exact typed object; 'inspect' reads the typed directory WITHOUT materializing the payload; 'verify' checks structure + the stored SHA-256 payload digest; 'restore' writes the exact payload back byte-identical (digest-gated); 'range' reads an exact byte range to a file; 'stream' reads one bounded chunk and returns the resume cursor (next_offset). Transport and restore are EXACT; no semantic decode happens here. Verification is a corruption checksum, not cryptography.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["store", "inspect", "verify", "restore", "range", "stream"] },
        file: { type: "string", description: "store: the source file to seal" },
        object: { type: "string", description: "the .tsb2 object (all actions but store)" },
        output: { type: "string", description: "store: object path to write · restore/range/stream: payload output file" },
        domain: { type: "string", description: "store: the typed domain (default blobfile); a mismatched payload REFUSES — e.g. etchtape takes only whole 8-byte events" },
        offset: { type: "integer", minimum: 0, description: "range: byte offset · stream: resume cursor (default 0)" },
        length: { type: "integer", minimum: 1, description: "range: byte count" },
        chunk_size: { type: "integer", minimum: 0, description: "stream: bytes per chunk (0 = the safe 64 KiB default)" },
        force: { type: "boolean", description: "overwrite an existing output" },
      },
      required: ["action"], additionalProperties: false,
    },
    handler: async (a) => {
      const F = a.force ? ["--force"] : [];
      let args;
      if (a.action === "store") {
        if (!a.file) return text("REFUSED: 'store' needs file");
        args = ["object", "store", a.file, ...(a.output ? [a.output] : []),
                ...(a.domain ? ["--domain", a.domain] : []), ...F];
      } else if (!a.object) {
        return text(`REFUSED: '${a.action}' needs object`);
      } else if (a.action === "inspect" || a.action === "verify") {
        args = ["object", a.action, a.object];
      } else if (a.action === "restore") {
        if (!a.output) return text("REFUSED: 'restore' needs output");
        args = ["object", "restore", a.object, a.output, ...F];
      } else if (a.action === "range") {
        if (!a.output || a.offset === undefined || a.length === undefined)
          return text("REFUSED: 'range' needs output, offset and length");
        args = ["object", "range", a.object, a.output,
                "--offset", String(a.offset), "--length", String(a.length), ...F];
      } else {
        if (!a.output) return text("REFUSED: 'stream' needs output");
        args = ["object", "stream", a.object, a.output,
                ...(a.chunk_size !== undefined ? ["--chunk-size", String(a.chunk_size)] : []),
                ...(a.offset !== undefined ? ["--offset", String(a.offset)] : []), ...F];
      }
      const r = await run([...args, "--json"]);
      return r.ok ? text(r.out) : fail(r);
    },
  },
  {
    name: "oham_bundle",
    description:
      "Typed multistream TSB/2 bundles with a dedicated integrity ledger. action 'create' packs streams given as 'DOMAIN=PATH' entries — stasis is the order-blind lane, flux the order-sensitive lane (the two rails, never conflated); 'append' atomically extends by rebuilding the directory and ledger; 'list' shows typed stream metadata WITHOUT materializing payloads; 'extract' writes one stream (index, or a unique domain); 'verify' checks the final LEDGER against every payload and aux section. Exact transport; the ledger is a corruption checksum, not cryptography.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["create", "append", "list", "extract", "verify"] },
        bundle: { type: "string", description: "the bundle file (all actions but create)" },
        output: { type: "string", description: "create: bundle to write · extract: stream output file" },
        stasis: { type: "array", items: { type: "string" }, description: "'DOMAIN=PATH' entries for the order-blind lane" },
        flux: { type: "array", items: { type: "string" }, description: "'DOMAIN=PATH' entries for the order-sensitive lane" },
        index: { type: "integer", minimum: 0, description: "extract: stream index (default 0)" },
        domain: { type: "string", description: "extract: select by unique domain instead of index" },
        force: { type: "boolean", description: "overwrite an existing output" },
      },
      required: ["action"], additionalProperties: false,
    },
    handler: async (a) => {
      const lanes = [
        ...(a.stasis || []).flatMap((s) => ["--stasis", s]),
        ...(a.flux || []).flatMap((s) => ["--flux", s]),
      ];
      const F = a.force ? ["--force"] : [];
      let args;
      if (a.action === "create") {
        if (!a.output) return text("REFUSED: 'create' needs output");
        if (!lanes.length) return text("REFUSED: 'create' needs at least one stasis or flux 'DOMAIN=PATH' entry");
        args = ["bundle", "create", a.output, ...lanes, ...F];
      } else if (!a.bundle) {
        return text(`REFUSED: '${a.action}' needs bundle`);
      } else if (a.action === "append") {
        if (!lanes.length) return text("REFUSED: 'append' needs at least one stasis or flux 'DOMAIN=PATH' entry");
        args = ["bundle", "append", a.bundle, ...lanes];
      } else if (a.action === "extract") {
        if (!a.output) return text("REFUSED: 'extract' needs output");
        args = ["bundle", "extract", a.bundle, a.output,
                ...(a.index !== undefined ? ["--index", String(a.index)] : []),
                ...(a.domain ? ["--domain", a.domain] : []), ...F];
      } else {
        args = ["bundle", a.action, a.bundle];
      }
      const r = await run([...args, "--json"]);
      return r.ok ? text(r.out) : fail(r);
    },
  },
  {
    name: "oham_transfer",
    description:
      "Verified, bounded network transfer of exact bytes. action 'pull' fetches a URL with strict HTTP ranges + resume and gates the result on a final SHA-256 you supply (sha256, or a trusted manifest file); 'fetch' is the container-aware verified fetch for an evd-carrying .tsb — records striped across the primary and every mirror, EACH record verified against its own stored digest as it lands, and a record that fails on one source is refetched from another with the bad source NAMED. Transport verification only: bytes against a digest / the container's own lane — it authenticates no one (corruption checksum, not cryptography).",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["pull", "fetch"] },
        url: { type: "string", description: "the primary source URL" },
        output: { type: "string", description: "file to write" },
        sha256: { type: "string", description: "pull: the expected final digest (hex)" },
        manifest: { type: "string", description: "pull: a trusted local manifest file naming the digest" },
        mirrors: { type: "array", items: { type: "string" }, description: "fetch: additional record sources" },
        timeout_seconds: { type: "integer", minimum: 1 },
        retries: { type: "integer", minimum: 0 },
        force: { type: "boolean", description: "overwrite an existing output" },
      },
      required: ["action", "url", "output"], additionalProperties: false,
    },
    handler: async (a) => {
      const common = [
        ...(a.timeout_seconds ? ["--timeout-seconds", String(a.timeout_seconds)] : []),
        ...(a.retries !== undefined ? ["--retries", String(a.retries)] : []),
        ...(a.force ? ["--force"] : []),
      ];
      let args;
      if (a.action === "pull") {
        args = ["transfer", "pull", a.url, a.output,
                ...(a.sha256 ? ["--sha256", a.sha256] : []),
                ...(a.manifest ? ["--manifest", a.manifest] : []), ...common];
      } else {
        args = ["transfer", "fetch", a.url, a.output,
                ...(a.mirrors || []).flatMap((m) => ["--mirror", m]), ...common];
      }
      const r = await run([...args, "--json"]);
      return r.ok ? text(r.out) : fail(r);
    },
  },
];

const text = (t) => ({ content: [{ type: "text", text: t }] });

// The inputSchema was decorative until now: nothing read it, so a missing
// required argument reached the CLI as the literal string "undefined" and
// came back as `REFUSED: undefined: No such file or directory` — a
// FILESYSTEM error for what is actually a caller mistake, which is the least
// actionable framing available. A context-free agent dogfooding this surface
// hit exactly that and ranked it as the most common agent error.
function validate(schema, args) {
  const props = schema.properties || {};
  for (const k of schema.required || [])
    if (args[k] === undefined) return `missing required argument \`${k}\``;
  for (const [k, v] of Object.entries(args)) {
    const p = props[k];
    if (!p) {
      if (schema.additionalProperties === false)
        return `unknown argument \`${k}\` — accepted: ${Object.keys(props).join(", ")}`;
      continue;
    }
    const t = Array.isArray(v) ? "array" : typeof v;
    if (p.type === "integer" && (!Number.isInteger(v)))
      return `\`${k}\` must be an integer, got ${JSON.stringify(v)}` +
             (k === "tick" ? " — this tool decodes ONE frame; use oham_excerpt for ranges like '0..120'" : "");
    if (p.type === "string" && t !== "string")
      return `\`${k}\` must be a string, got ${t}`;
    if (p.type === "array" && t !== "array")
      return `\`${k}\` must be an array, got ${t}`;
    if (p.type === "integer" && p.minimum !== undefined && v < p.minimum)
      return `\`${k}\` must be >= ${p.minimum}, got ${v}`;
    if (p.enum && !p.enum.includes(v))
      return `\`${k}\` must be one of ${p.enum.join(" | ")}, got ${JSON.stringify(v)}`;
    if (p.type === "array" && Array.isArray(v)) {
      if (p.minItems && v.length < p.minItems)
        return `\`${k}\` needs ${p.minItems} items, got ${v.length}`;
      if (p.maxItems && v.length > p.maxItems)
        return `\`${k}\` takes at most ${p.maxItems} items, got ${v.length}`;
      if (p.items?.type === "integer" && v.some((x) => !Number.isInteger(x)))
        return `\`${k}\` must contain integers only`;
    }
  }
  return null;
}
const fail = (r) => ({ content: [{ type: "text", text: (r.err || r.out).trim() }], isError: true });

const reply = (id, result) =>
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
const replyErr = (id, code, message) =>
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n");

createInterface({ input: process.stdin }).on("line", async (line) => {
  line = line.trim();
  if (!line) return;
  let m;
  try { m = JSON.parse(line); } catch { return; }
  const { id, method, params } = m;
  try {
    if (method === "initialize") {
      reply(id, {
        protocolVersion: params?.protocolVersion || "2024-11-05",
        serverInfo: { name: "oham-mcp", version: PKG_VERSION },
        capabilities: { tools: {} },
      });
    } else if (method === "notifications/initialized" || method === "notifications/cancelled") {
      /* notifications carry no reply */
    } else if (method === "ping") {
      reply(id, {});
    } else if (method === "tools/list") {
      reply(id, { tools: TOOLS.map(({ name, description, inputSchema }) =>
        ({ name, description, inputSchema })) });
    } else if (method === "tools/call") {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) return replyErr(id, -32602, `unknown tool ${params?.name}`);
      const args = params?.arguments || {};
      const bad = validate(tool.inputSchema, args);
      if (bad) return replyErr(id, -32602, `${tool.name}: ${bad}`);
      reply(id, await tool.handler(args));
    } else if (id !== undefined) {
      replyErr(id, -32601, `method not found: ${method}`);
    }
  } catch (e) {
    if (id !== undefined) replyErr(id, -32603, String(e?.message || e));
  }
});
