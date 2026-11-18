import test from "node:test";
import assert from "node:assert/strict";
import {resolve} from "node:path";
import {resolvePublicFile} from "../server-paths.mjs";

const root=resolve("concepts","agent-swarm");
test("preview server exposes only the preview pages and exported media",()=>{
 assert.equal(resolvePublicFile(root,"/"),resolve(root,"preview.html"));
 assert.equal(resolvePublicFile(root,"/preview.html"),resolve(root,"preview.html"));
 assert.equal(resolvePublicFile(root,"/showcase.html"),resolve(root,"showcase.html"));
 assert.equal(resolvePublicFile(root,"/compare.html"),resolve(root,"compare.html"));
 assert.equal(resolvePublicFile(root,"/exports/showcase/robots-light.gif"),
   resolve(root,"exports","showcase","robots-light.gif"));
 assert.equal(resolvePublicFile(root,"/exports/geometric-dark.svg"),resolve(root,"exports","geometric-dark.svg"));
 assert.equal(resolvePublicFile(root,"/exports/scene.json"),resolve(root,"exports","scene.json"));
});
test("preview server denies secrets, source, nested escapes and invalid encodings",()=>{
 const denied=["/build.mjs","/scene.mjs","/README.md","/.env","/tests/scene.test.mjs",
  "/exports/.env","/exports/secrets.txt","/exports/../README.md",
  "/exports/%2e%2e/build.mjs","/exports/%2e%2e/%2e%2e/AGENTS.md",
  "/exports/showcase/%2e%2e/%2e%2e/README.md","/%ZZ","/exports/file.js"];
 for(const path of denied)assert.equal(resolvePublicFile(root,path),null,path);
 assert.equal(resolvePublicFile(root,"\\0"),null);
});
