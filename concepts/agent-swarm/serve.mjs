import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const types = {".html":"text/html; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml",".gif":"image/gif",".png":"image/png",".js":"text/javascript; charset=utf-8",".mjs":"text/javascript; charset=utf-8"};
createServer((request,response) => {
  try {
    const raw = new URL(request.url || "/", "http://localhost").pathname;
    const pathname = decodeURIComponent(raw);
    const target = resolve(root, "." + (pathname === "/" ? "/preview.html" : pathname));
    if (target !== root && !target.startsWith(root + sep)) {
      response.writeHead(403);response.end("Forbidden");return;
    }
    if (!["GET","HEAD"].includes(request.method || "GET")) {response.writeHead(405);response.end("Method not allowed");return;}
    const content = readFileSync(target);
    response.writeHead(200,{"Content-Type":types[extname(target)]||"application/octet-stream","X-Content-Type-Options":"nosniff","Cache-Control":"no-store","Content-Security-Policy":"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; object-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'"});
    response.end(request.method === "HEAD" ? undefined : content);
  } catch(error) {response.writeHead(404,{"Content-Type":"text/plain"});response.end("Not found. Run node concepts/agent-swarm/build.mjs first.");}
}).listen(8000,"127.0.0.1",()=>console.log("Agent Swarm preview: http://127.0.0.1:8000/  (Ctrl+C to stop)"));
