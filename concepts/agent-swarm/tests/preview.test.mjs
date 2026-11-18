import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const markup=readFileSync(new URL("../preview.html",import.meta.url),"utf8");
test("SVG load handler is installed before changing the object URL",()=>{
 const start=markup.indexOf("function loadArt()"),end=markup.indexOf("function setPlaying(",start);
 assert(start>=0&&end>start);
 const load=markup.slice(start,end);
 assert(load.indexOf("art.onload=")>=0);
 assert(load.indexOf("art.data=")>load.indexOf("art.onload="));
});
test("preview exposes keyboard controls, date selection and reduced-motion guidance",()=>{
 for(const attribute of ['id="recorded-date"','id="scrub"','id="play"','id="reset"','id="theme"']){
  assert(markup.includes(attribute),attribute);
 }
 assert.match(markup,/prefers-reduced-motion:reduce/);
 assert.match(markup,/aria-live="polite"/);
 assert.match(markup,/courier/);
 assert.match(markup,/builder/);
});

test("account mode uses its own media and scene rather than the demo artwork",()=>{
 assert.match(markup,/accountView\?\"exports\/account\/\":\"exports\/\"/);
 assert.match(markup,/fetch\(assetRoot\+\"scene\.json\"/);
 assert.match(markup,/renderState\(\);loadArt\(\);setPlaying\(!reduced\)/);
 const start=markup.indexOf("function loadArt()"),end=markup.indexOf("function setPlaying(",start);
 assert(start>0&&end>start);
 const load=markup.slice(start,end);
 assert(load.includes('art.data=assetRoot+style+"-"+theme+".svg"'));
 assert(load.includes('el("gif").href=assetRoot+style+"-"+theme+".gif"'));
});
