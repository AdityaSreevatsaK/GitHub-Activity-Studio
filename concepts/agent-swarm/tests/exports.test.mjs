import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {makeScene} from "../scene.mjs";
import {calendarData,svgCalendar} from "../calendar.mjs";
import {renderCalendarGif} from "../calendar-gif.mjs";
import {readGifMetadata} from "../gif.mjs";
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
