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
        serverInfo: { name: "oham-mcp", version: "0.2.5" },
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
