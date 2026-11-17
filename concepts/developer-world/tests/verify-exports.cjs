"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,".."),directory=path.resolve(root,"exports");
const layouts=["archipelago","village"],themes=["dark","light"];
let checked=0;
for(const layout of layouts)for(const theme of themes)for(const ending of [".svg","-still.svg"]){
 const file=path.join(directory,layout+"-"+theme+ending);
 const svg=fs.readFileSync(file,"utf8");
 assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'),file);
 assert.ok(svg.endsWith("</svg>"),file);
 assert.match(svg,/SYNTHETIC DEMO/,file);
 assert.match(svg,/RECORDED UNITS/,file);
 assert.equal((svg.match(/data-date="/g)||[]).length,371,file);
 assert.ok(Buffer.byteLength(svg)<350000,file+" should remain compact");
 if(ending.includes("still"))assert.match(svg,/animation:none!important/,file);
 checked++;
}
console.log("Verified "+checked+" synthetic, deterministic profile-ready SVG exports");
