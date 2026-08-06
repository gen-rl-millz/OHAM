// OHAM .tsb Tools — inspect + exact frame preview via the oham CLI.
const vscode = require("vscode");
const cp = require("child_process");
const os = require("os");
const path = require("path");

const bin = () => vscode.workspace.getConfiguration("oham").get("binaryPath") || "oham";
const run = (args) => new Promise((res) =>
  cp.execFile(bin(), args, { maxBuffer: 1 << 26 }, (e, out, err) =>
    res({ ok: !e, out, err: err || String(e || "") })));

function activate(ctx) {
  ctx.subscriptions.push(vscode.commands.registerCommand("oham.info", async (uri) => {
    const file = uri?.fsPath; if (!file) return;
    const r = await run(["info", file, "--json"]);
    if (!r.ok) return vscode.window.showErrorMessage(r.err.trim());
    const d = JSON.parse(r.out);
    const p = vscode.window.createWebviewPanel("ohamInfo", "OHAM: " + path.basename(file),
      vscode.ViewColumn.Beside, {});
    p.webview.html = `<body style="font:13px monospace;padding:12px">
      <h3>${path.basename(file)}</h3>
      <p>TSB1 v${d.version} · ${d.fps_num}:${d.fps_den} fps · ${d.bytes} B</p>
      <p>${d.inner ? `${d.inner.magic} ${d.inner.w}x${d.inner.h} · ${d.inner.frames} frames ·
         block ${d.inner.block} · tiles ${d.inner.tiles_x}x${d.inner.tiles_y}` : "no inner header"}</p>
      <p>records ${d.records} · mean ${d.record_len_mean} B ${d.records_deflated ? "· z-wire" : ""}</p>
      <p><b>${d.verdict}</b></p>
      <hr><small>OHAM — OrthoHolonic Accessible Memory · Paul Phillips</small></body>`;
  }));
  ctx.subscriptions.push(vscode.commands.registerCommand("oham.preview", async (uri) => {
    const file = uri?.fsPath; if (!file) return;
    const tick = await vscode.window.showInputBox({ prompt: "Frame (tick)", value: "0" });
    if (tick === undefined) return;
    const png = path.join(os.tmpdir(), `oham_preview_${Date.now()}.png`);
    const r = await run(["unseal", file, "--tick", tick, "--level", "1", "--png", png]);
    if (!r.ok) return vscode.window.showErrorMessage(r.err.trim());
    const p = vscode.window.createWebviewPanel("ohamPrev", `t${tick} · ${path.basename(file)}`,
      vscode.ViewColumn.Beside, { localResourceRoots: [vscode.Uri.file(os.tmpdir())] });
    const src = p.webview.asWebviewUri(vscode.Uri.file(png));
    p.webview.html = `<body style="margin:0;background:#000"><img src="${src}"
      style="max-width:100%"><pre style="color:#9ab;font:11px monospace;padding:6px">${r.out.trim()}</pre></body>`;
  }));
}
module.exports = { activate, deactivate: () => {} };
