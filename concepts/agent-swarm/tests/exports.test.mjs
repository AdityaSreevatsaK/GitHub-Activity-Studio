import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {makeScene} from "../scene.mjs";
import {calendarData,svgCalendar} from "../calendar.mjs";
import {calendarGifFrame,renderCalendarGif} from "../calendar-gif.mjs";
import {readGifMetadata,lzwDecode} from "../gif.mjs";
import {showcaseData} from "../showcase.mjs";

const path=name=>new URL("../"+name,import.meta.url);
const read=name=>readFileSync(path(name));
const json=name=>JSON.parse(read(name).toString("utf8"));
const canonicalInput=json("../../shared/fixtures/demo-activity.json");
const canonical=calendarData(makeScene(canonicalInput),canonicalInput);
const richInput=showcaseData();
const richer=calendarData(makeScene(richInput),richInput);

test("checked-in normalised scenes match deterministic source generation",()=>{
 assert.deepEqual(json("exports/scene.json"),canonical);
 assert.deepEqual(json("exports/showcase/scene.json"),richer);
 assert.equal(canonical.source,"demo");
 assert.equal(richer.source,"demo");
});
test("all four base designs have matching profile-safe animation, static SVG and GIF",()=>{
 for(const style of ["geometric","robots"])for(const theme of ["dark","light"]){
  const key=style+"-"+theme;
  const svg=read("exports/"+key+".svg").toString("utf8");
  const still=read("exports/"+key+"-still.svg").toString("utf8");
  assert.equal(svg,svgCalendar(canonical,{style,theme}));
  assert.equal(still,svgCalendar(canonical,{style,theme,animated:false,time:5.2}));
  assert(!still.includes("<animateMotion"));
  assert.equal((svg.match(/class="day-cell"/g)||[]).length,371);
  const gif=read("exports/"+key+".gif");
  const meta=readGifMetadata(gif);
  assert.deepEqual([meta.width,meta.height,meta.frames,meta.looping,meta.duration_centi],[800,250,70,true,1400]);
  assert(gif.length<2_000_000);
 }
});
test("synthetic showcase exports reproduce from seeded synthetic input",()=>{
 for(const [style,theme] of [["geometric","dark"],["robots","light"]]){
  const key=style+"-"+theme;
  assert.equal(read("exports/showcase/"+key+".svg").toString("utf8"),
    svgCalendar(richer,{style,theme}));
  assert.equal(read("exports/showcase/"+key+"-still.svg").toString("utf8"),
    svgCalendar(richer,{style,theme,animated:false,time:8.3}));
  const gif=readGifMetadata(read("exports/showcase/"+key+".gif"));
  assert.deepEqual([gif.width,gif.height,gif.frames,gif.looping,gif.duration_centi],[800,250,70,true,1400]);
 }
});
test("embedded README links and accessibility fallbacks are present",()=>{
 const readme=read("README.md").toString("utf8");
 const gallery=read("showcase.html").toString("utf8");
 for(const key of ["geometric-dark","robots-light"]){
  assert(readme.includes("exports/"+key+".gif"));
  assert(readme.includes("exports/showcase/"+key+".gif"));
  assert(gallery.includes("exports/showcase/"+key+"-still.svg"));
 }
 assert.match(gallery,/SYNTHETIC SHOWCASE/);
 assert.match(gallery,/prefers-reduced-motion:reduce/);
});


// Verify decoded pixel content, not merely GIF dimensions and frame count.
// This parses real GIF data subblocks and checks deterministic source-frame fidelity.
function decodeChosenFrames(data,indices){
 let at=13+3*(1<<((data[10]&7)+1));
 const chosen=new Map(),selected=new Set(indices);
 let index=0;
 const u16=pos=>data[pos]|(data[pos+1]<<8);
 while(at<data.length){
  const type=data[at++];
  if(type===0x3b)break;
  if(type===0x21){
   const extension=data[at++];
   if(extension===0xf9){
    const length=data[at++];
    assert.equal(length,4);at+=length+1;continue;
   }
   const length=data[at++];at+=length;
   for(;;){const chunk=data[at++];if(!chunk)break;at+=chunk;}
   continue;
  }
  assert.equal(type,0x2c);
  const width=u16(at+4),height=u16(at+6),packed=data[at+8];at+=9;
  if(packed&0x80)at+=3*(1<<((packed&7)+1));
  const minCodeSize=data[at++],chunks=[];let size=0;
  for(;;){
   const length=data[at++];
   if(!length)break;
   if(selected.has(index)){chunks.push(data.subarray(at,at+length));size+=length;}
   at+=length;
  }
  if(selected.has(index)){
   const compressed=new Uint8Array(size);let offset=0;
   for(const c of chunks){compressed.set(c,offset);offset+=c.length;}
   const raw=lzwDecode(compressed,minCodeSize);
   assert.equal(raw.length,width*height);
   chosen.set(index,raw);
  }
  index++;
 }
 assert.equal(index,70);
 assert.equal(chosen.size,indices.length);
 return chosen;
}
test("encoded GIF pixel content matches the deterministic renderer at multiple phases",()=>{
 const variants=[
  {path:"exports/geometric-dark.gif",scene:canonical,style:"geometric",theme:"dark"},
  {path:"exports/robots-light.gif",scene:canonical,style:"robots",theme:"light"},
  {path:"exports/showcase/geometric-dark.gif",scene:richer,style:"geometric",theme:"dark"},
  {path:"exports/showcase/robots-light.gif",scene:richer,style:"robots",theme:"light"}
 ];
 for(const entry of variants){
  const samples=decodeChosenFrames(read(entry.path),[0,23,69]);
  for(const [i,actual] of samples){
   const expected=calendarGifFrame(entry.scene,{
    style:entry.style,theme:entry.theme,time:i*entry.scene.period/70
   });
   assert.deepEqual(Buffer.from(actual),Buffer.from(expected),entry.path+" frame "+i);
  }
 }
});

test("offline build verification agrees with all checked-in exports",()=>{
 const build=fileURLToPath(new URL("../build.mjs",import.meta.url));
 const result=spawnSync(process.execPath,[build,"--verify"],{
  cwd:fileURLToPath(new URL("../../../",import.meta.url)),encoding:"utf8",timeout:120000
 });
 assert.equal(result.status,0,"Asset verification failed: "+result.stderr+" "+result.stdout);
 assert.match(result.stdout,/Verified existing assets/);
});
