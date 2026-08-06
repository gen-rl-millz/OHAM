#!/usr/bin/env node
/* oham-mcp — OHAM as a native tool for any MCP agent (Claude, Cursor, …).
 *
 * Zero dependencies: a newline-delimited JSON-RPC 2.0 stdio server speaking
 * the Model Context Protocol, wrapping the `oham` CLI. Every tool returns
 * plain text or an image; errors come back as the CLI's own REFUSED lines,
 * which always say why.
 *
 * Binary resolution: $OHAM_BIN, else the repo's bin/linux-x86_64/oham
 * relative to this file, else `oham` on PATH.
 *
 * Paul Phillips — solo developer · OHAM / OrthoHolonic Accessible Memory
 * involvedinvolutions.com · Apache-2.0 + Commons Clause
 */
import { execFile } from "node:child_process";
import { readFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const here = dirname(fileURLToPath(import.meta.url));
const OHAM =
  process.env.OHAM_BIN ||
  [join(here, "../../bin/linux-x86_64/oham"), join(here, "bin/oham")]
    .find(existsSync) || "oham";

const run = (args) =>
  new Promise((resolve) => {
    execFile(OHAM, args, { maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) =>
      resolve({ ok: !err, out: stdout, err: stderr || (err ? String(err) : "") }));
  });

let serveChild = null;

const TOOLS = [
  {
    name: "oham_onboard",
    description:
      "Start here. Everything OHAM does in ten copy-paste commands with the exact hashes that prove each one worked. OHAM stores video/images as exact integer addresses in sealed .tsb files — any frame readable at any moment at the same cost, every conversion reversible, decoding fully local.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async () => text((await run(["onboard"])).out),
  },
  {
    name: "oham_info",
    description:
      "Inspect a .tsb sealed container: dimensions, frame count, record sizes, section digests, structural verdict. Returns JSON. Refuses corrupt files with the reason.",
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
        file: { type: "string" },
        tick: { type: "integer", minimum: 0 },
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
      const png = a.out_path ||
        join(mkdtempSync(join(tmpdir(), "oham-mcp-")), "frame.png");
      const args = ["unseal", a.file, "--tick", String(a.tick),
                    "--level", String(a.level ?? 0), "--png", png];
      if (a.window) args.push("--window", a.window.join(","));
      const r = await run(args);
      if (!r.ok) return fail(r);
      if (!inline) return text(r.out.trim() + `\nwritten: ${png}`);
      const bytes = readFileSync(png);
      if (bytes.length > 8 * 1024 * 1024)
        return text(`image is ${bytes.length} B — too large to inline; call again with out_path. ` + r.out.trim());
      return {
        content: [
          { type: "text", text: r.out.trim() },
          { type: "image", data: bytes.toString("base64"), mimeType: "image/png" },
        ],
      };
    },
  },
  {
    name: "oham_excerpt",
    description:
      "Cut frames into their own standalone .tsb — no re-encode, records carried byte-for-byte. One tick makes a full-quality still. ticks accepts '300', '50,300,900', '0..120' (end-exclusive), or 'all'.",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string" }, output: { type: "string" },
        ticks: { type: "string" },
      },
      required: ["input", "output", "ticks"], additionalProperties: false,
    },
    handler: async (a) => {
      const r = await run(["excerpt", a.input, a.output, "--tick", a.ticks]);
      return r.ok ? text(r.out) : fail(r);
    },
  },
  {
    name: "oham_repack",
    description:
      "Convert wire forms losslessly: 'v2' compresses (~54% size), 'v1' restores byte-identically. Every record is verified to round-trip BEFORE the output file exists.",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string" }, output: { type: "string" },
        form: { type: "string", enum: ["v1", "v2"] },
      },
      required: ["input", "output", "form"], additionalProperties: false,
    },
    handler: async (a) => {
      const r = await run(["repack", a.input, a.output, `--${a.form}`]);
      return r.ok ? text(r.out) : fail(r);
    },
  },
  {
    name: "oham_serve",
    description:
      "Start or stop a local range-request file server (what the OHAM web player streams from). action 'start' serves root on port (default 8207) and keeps it running across tool calls; 'stop' ends it.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["start", "stop"] },
        root: { type: "string" }, port: { type: "integer", default: 8207 },
      },
      required: ["action"], additionalProperties: false,
    },
    handler: async (a) => {
      if (a.action === "stop") {
        if (!serveChild) return text("no server running");
        serveChild.kill(); serveChild = null;
        return text("server stopped");
      }
      if (!a.root) return text("REFUSED: root required to start");
      if (serveChild) return text("REFUSED: a server is already running — stop it first");
      const { spawn } = await import("node:child_process");
      const port = a.port ?? 8207;
      serveChild = spawn(OHAM, ["serve", a.root, "--port", String(port)],
                         { stdio: "ignore" });
      serveChild.on("exit", () => { serveChild = null; });
      return text(`serving ${a.root} at http://127.0.0.1:${port}/ (ranges + CORS)`);
    },
  },
];

const text = (t) => ({ content: [{ type: "text", text: t }] });
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
        serverInfo: { name: "oham-mcp", version: "0.2.0" },
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
      reply(id, await tool.handler(params?.arguments || {}));
    } else if (id !== undefined) {
      replyErr(id, -32601, `method not found: ${method}`);
    }
  } catch (e) {
    if (id !== undefined) replyErr(id, -32603, String(e?.message || e));
  }
});
