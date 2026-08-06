// OHAM range-serving Cloudflare Worker — bind an R2 bucket as CLIPS and
// upload .tsb files + the web/ tree; the player streams straight from the
// edge. Deploy: wrangler deploy (see STATUS.md).
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const key = decodeURIComponent(url.pathname.slice(1)) || "index.html";
    const range = req.headers.get("Range");
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Accept-Ranges": "bytes",
    };
    let obj, status = 200, extra = {};
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      if (m) {
        const head = await env.CLIPS.head(key);
        if (!head) return new Response("not found", { status: 404, headers: cors });
        const size = head.size;
        let [a, b] = [m[1], m[2]];
        let start, end;
        if (a === "") { const n = +b; start = Math.max(0, size - n); end = size - 1; }
        else { start = +a; end = b === "" ? size - 1 : Math.min(+b, size - 1); }
        if (start >= size || start > end)
          return new Response("range not satisfiable",
            { status: 416, headers: { ...cors, "Content-Range": `bytes */${size}` } });
        obj = await env.CLIPS.get(key, { range: { offset: start, length: end - start + 1 } });
        status = 206;
        extra = { "Content-Range": `bytes ${start}-${end}/${size}`,
                  "Content-Length": String(end - start + 1) };
      }
    }
    if (!obj) obj = await env.CLIPS.get(key);
    if (!obj) return new Response("not found", { status: 404, headers: cors });
    const type = key.endsWith(".html") ? "text/html;charset=utf-8"
      : key.endsWith(".js") ? "application/javascript"
      : key.endsWith(".wasm") ? "application/wasm" : "application/octet-stream";
    return new Response(obj.body, { status,
      headers: { ...cors, ...extra, "Content-Type": type } });
  },
};
