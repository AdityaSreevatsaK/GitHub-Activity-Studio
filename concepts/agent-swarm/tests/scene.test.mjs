import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeScene, normaliseSnapshot, phaseAt, agentPosition, renderSvg, timelineValues } from "../scene.mjs";
import { renderGif, readGifMetadata, lzwEncode, lzwDecode, drawGifFrame } from "../gif.mjs";

const fixture = JSON.parse(readFileSync(new URL("../../../shared/fixtures/demo-activity.json", import.meta.url), "utf8"));
const clone = () => structuredClone(fixture);

test("fixture schedules every event, with non-overlapping pairs of helpers", () => {
 const s=makeScene(fixture);
 assert.equal(s.shown,10);assert.equal(s.repositories.length,5);
 for(let i=0;i<s.jobs.length;i++){
   const a=s.jobs[i];
   assert.equal(a.agents.length,2);assert(a.start+a.duration<s.period);
   for(let k=i+1;k<s.jobs.length;k++){
     const b=s.jobs[k];
     if(a.agents.some(v=>b.agents.includes(v)))assert(a.start+a.duration<=b.start||b.start+b.duration<=a.start);
   }
 }
});
test("same input produces byte-identical scenes and SVGs",()=>{
 const a=makeScene(fixture),b=makeScene(fixture);
 assert.deepEqual(a,b);
 assert.equal(renderSvg(a,{style:"geometric"}),renderSvg(b,{style:"geometric"}));
 assert.equal(renderSvg(a,{style:"robots",theme:"light"}),renderSvg(b,{style:"robots",theme:"light"}));
});
test("duplicate source event IDs do not become invented activity",()=>{
 const x=clone();x.activity.push(structuredClone(x.activity[0]));
 assert.equal(normaliseSnapshot(x).activity.length,10);assert.equal(makeScene(x).event_total,10);
});
test("no activity or no repositories is a valid, labelled empty state",()=>{
 const x=clone();x.activity=[];assert.equal(makeScene(x).shown,0);
 assert.match(renderSvg(makeScene(x)),/NO OBSERVED EVENTS/);
 x.repositories=[];assert.equal(makeScene(x).repository_total,0);
 assert.match(renderSvg(makeScene(x)),/Awaiting repositories/);
});
test("one repository, repeated display names and missing optional fields",()=>{
 const x=clone();x.repositories=[{full_name:"a/repo",name:"shared"},{full_name:"b/repo",name:"shared"}];
 x.activity=[{id:"a",kind:"release",repo_full_name:"a/repo",occurred_at:"2026-11-12T10:00:00Z",count:1}];
 assert.equal(makeScene(x).shown,1);assert.equal(makeScene(x).repositories.length,2);
 x.repositories=[x.repositories[0]];assert.equal(makeScene(x).repositories.length,1);
});
test("malformed and unsupported required fields fail closed",()=>{
 const mutations=[
 x=>x.schema_version="2",x=>x.source="random",x=>x.generated_at="yesterday",
 x=>x.activity[0].kind="push",x=>x.activity[0].count=0,
 x=>x.activity[0].count=1.5,x=>x.activity[0].repo_full_name="missing/repo",
 x=>x.activity[0].occurred_at="2026-09-01",x=>x.repositories[0].full_name="",
 x=>x.activity[0].id=""
 ];
 for(const mutate of mutations){const x=clone();mutate(x);assert.throws(()=>makeScene(x));}
});
test("every task phase is observable and changes at stable boundaries",()=>{
 const s=makeScene(fixture),j=s.jobs[0];
 assert.equal(phaseAt(j,j.start-.1),"queued");
 assert.equal(phaseAt(j,j.start+.1),"assigned");
 assert.equal(phaseAt(j,j.start+.4),"travelling");
 assert.equal(phaseAt(j,j.start+1),"working");
 assert.equal(phaseAt(j,j.start+1.8),"complete");
 assert.equal(phaseAt(j,j.start+2.3),"delivered");
 assert.equal(timelineValues(j).split(";").length,7);
});
test("path positions stay finite at every point of choreography",()=>{
 const s=makeScene(fixture);
 for(const j of s.jobs)for(let t=0;t<14;t+=.19)for(let side=0;side<2;side++){
   const p=agentPosition(j,t,side,s.repositories.length);
   assert(Number.isFinite(p.x)&&Number.isFinite(p.y));
 }
});
test("bursty activity is clipped visibly, not counted as all animated",()=>{
 const x=clone();
 x.repositories=[...x.repositories,...Array.from({length:7},(_,i)=>({full_name:"other/p"+i,name:"p"+i}))];
 x.activity=Array.from({length:240},(_,i)=>({id:"new-"+i,kind:i%2?"commit":"pr_opened",repo_full_name:x.repositories[i%12].full_name,occurred_at:"2026-11-14T10:00:00Z",count:1}));
 const s=makeScene(x);
 assert.equal(s.repositories.length,5);assert(s.shown<=10);assert.equal(s.event_total,240);
 assert(s.truncated);assert.match(renderSvg(s),/SHOWING/);
});
test("stale snapshots carry both provenance and warning",()=>{
 const x=clone();x.generated_at="2027-05-01T00:00:00Z";
 const s=makeScene(x);assert(s.stale_days>30);
 assert.match(renderSvg(s),/STALE SNAPSHOT/);
 assert.match(renderSvg(s),/DEMO DATA/);assert.match(renderSvg(s),/METAPHOR/);
});
test("untrusted input is escaped and no URL is embedded in assets",()=>{
 const x=clone();x.repositories[0].name="<script>&evil</script>";
 x.activity[0].id='bad" onload="alert(1)';
 const s=makeScene(x),svg=renderSvg(s);
 assert(!svg.includes("<script>"));assert(!svg.includes('data-event="bad" onload='));
 assert(svg.includes("&lt;script&gt;"));assert(svg.includes("&quot;"));
 assert(!svg.includes("github.com/example"));
});
test("all four SVG variants animate; stills do not animate",()=>{
 const s=makeScene(fixture);
 for(const style of ["geometric","robots"])for(const theme of ["dark","light"]){
   const anim=renderSvg(s,{style,theme});
   assert(anim.startsWith("<svg"));assert.match(anim,/<animateMotion/);
   assert.match(anim,/role="img"/);assert.match(anim,/aria-labelledby=/);assert.match(anim,/viewBox="0 0 1120 350"/);
   const still=renderSvg(s,{style,theme,animated:false,time:4});
   assert(!still.includes("<animateMotion"));
 }
});
test("GIF indexed frame is exactly 16:5 at a stable frame time",()=>{
 const s=makeScene(fixture);
 const first=drawGifFrame(s,{style:"geometric",theme:"dark",time:3});
 const second=drawGifFrame(s,{style:"geometric",theme:"dark",time:3});
 assert.equal(first.length,800*250);assert.deepEqual(first,second);
 assert(first.some(px=>px!==0));
});
test("GIF LZW round-trips over repeated code-width boundaries",()=>{
 for(const source of [
   Uint8Array.from({length:9000},(_,i)=>(i*17+(i>>4))%32),
   Uint8Array.from({length:4000},()=>1),
   Uint8Array.from({length:20000},(_,i)=>i%32)]){
   const packed=lzwEncode(source,5),decoded=lzwDecode(packed,5);
   assert.deepEqual(decoded,source);
 }
});
test("both GIF designs loop for exactly 14 seconds and reproduce",()=>{
 const s=makeScene(fixture);
 for(const style of ["geometric","robots"]){
   const theme=style==="robots"?"light":"dark";
   const gif=renderGif(s,{style,theme,frames:12});
   const meta=readGifMetadata(gif);
   assert.equal(meta.width,800);assert.equal(meta.height,250);
   assert.equal(meta.frames,12);assert.equal(meta.duration_centi,1400);
   assert.equal(meta.looping,true);assert(gif.length>5000);
   assert.deepEqual(renderGif(s,{style,theme,frames:12}),gif);
 }
});
test("GIF exporter rejects unsupported options",()=>{
 const s=makeScene(fixture);
 assert.throws(()=>renderGif(s,{frames:0}));
 assert.throws(()=>drawGifFrame(s,{style:"other"}));
});
