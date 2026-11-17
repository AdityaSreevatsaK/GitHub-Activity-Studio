"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const world=require("../renderer.js");
const {generateShowcase}=require("../generate-showcase.cjs");
const root=path.resolve(__dirname,"../../..");
const shared=JSON.parse(fs.readFileSync(path.join(root,"shared/fixtures/demo-activity.json"),"utf8"));
const stored=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../showcase-activity.json"),"utf8"));

test("showcase is reproducible byte-for-byte from the shared fixture",()=>{
 const generated=generateShowcase(shared);
 assert.deepEqual(generated,stored,"Do not manually edit the generated showcase");
 assert.deepEqual(generateShowcase(shared),generated);
 assert.equal(stored.source,"demo");
 assert.equal(stored.user.login,"showcase-dev");
 assert.equal(stored.generated_at,shared.generated_at);
});
test("showcase never claims to be the owner's real activity",()=>{
 assert.equal(stored.source,"demo");
 assert.equal(stored.repositories.length,shared.repositories.length);
 assert.deepEqual(stored.repositories,shared.repositories);
 assert.ok(stored.activity.every(e=>e.id.startsWith("showcase-")&&e.url==="https://github.com/example"));
 assert.ok(stored.activity.every(e=>new Date(e.occurred_at).getTime()<=Date.parse(stored.generated_at)));
 assert.equal(new Set(stored.activity.map(e=>e.id)).size,stored.activity.length);
});
test("showcase exercises the complete contribution chart without fictitious filler",()=>{
 const parsed=world.normalise(stored),calendar=world.calendarFor(parsed);
 assert.equal(parsed.activity.length,243);
 assert.equal(calendar.cells.length,371);
 assert.equal(calendar.activeDays,212);
 assert.equal(calendar.observed,1050);
 assert.equal(calendar.outside,0);
 assert.equal(calendar.featured.length,5);
 assert.ok(calendar.cells.some(x=>x.level===4));
 assert.ok(calendar.cells.some(x=>x.level===0));
 assert.deepEqual(world.calendarFor(parsed,0).featured,calendar.featured);
});
test("showcase previews remain explicitly synthetic and renderer-compatible",()=>{
 for(const layout of ["archipelago","village"])for(const theme of ["dark","light"]){
  const svg=world.render(stored,{layout,theme,animated:false});
  assert.match(svg,/SYNTHETIC DEMO/);
  assert.equal((svg.match(/data-date="/g)||[]).length,371);
  assert.match(svg,/212 active dates/);
  assert.ok(Buffer.byteLength(svg)<350000);
 }
});
test("invalid showcase source is rejected before generation",()=>{
 assert.throws(()=>generateShowcase(null));
 assert.throws(()=>generateShowcase({...shared,source:"github"}));
 assert.throws(()=>generateShowcase({...shared,repositories:[]}));
});
