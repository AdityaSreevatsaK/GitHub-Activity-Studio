import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {makeScene} from "../scene.mjs";
import {calendarData,svgCalendar} from "../calendar.mjs";
import {readGifMetadata} from "../gif.mjs";
const get=path=>readFileSync(new URL("../"+path,import.meta.url));
const source=JSON.parse(get("data/adityasreevatsak-public.json").toString("utf8"));
const scene=calendarData(makeScene(source),source);

test("account snapshot is authentic public-source data, never synthetic showcase",()=>{
 assert.equal(source.schema_version,"1");
 assert.equal(source.source,"github");
 assert.equal(source.user.login,"AdityaSreevatsaK");
 assert.equal(source.coverage.public_only,true);
 assert(source.activity.length>500);
 assert(source.activity.every(e=>e.url.startsWith("https://github.com/")));
 assert(source.repositories.every(r=>r.url.startsWith("https://github.com/")));
 assert(source.activity.some(e=>e.kind==="pr_opened"));
 assert(source.activity.some(e=>e.kind==="pr_merged"));
 assert(source.activity.some(e=>e.kind==="commit"));
 assert(source.activity.some(e=>e.kind==="issue_opened"));
 assert.equal(new Set(source.activity.map(e=>e.id)).size,source.activity.length);
});
test("account SVG is explicitly branded and date-accurate",()=>{
 assert.equal(scene.source,"github");
 const svg=svgCalendar(scene,{style:"geometric",theme:"dark"});
 assert.match(svg,/@AdityaSreevatsaK/);
 assert(!svg.includes("DEMO DATA"));
 assert.equal((svg.match(/class="day-cell"/g)||[]).length,371);
 assert(scene.calendar.observed_days>40);
 assert(scene.jobs.every(j=>source.activity.some(e=>e.id===j.id)));
});
test("account exports are reproducible and have all four GIF variants",()=>{
 const styles=["geometric","robots"],themes=["dark","light"];
 for(const style of styles)for(const theme of themes){
  const prefix="exports/account/"+style+"-"+theme;
  const svg=get(prefix+".svg").toString("utf8");
  assert.equal(svg,svgCalendar(scene,{style,theme}));
  const still=get(prefix+"-still.svg").toString("utf8");
  assert.equal(still,svgCalendar(scene,{style,theme,animated:false,time:5.2}));
  const meta=readGifMetadata(get(prefix+".gif"));
  assert.deepEqual([meta.width,meta.height,meta.frames,meta.duration_centi,meta.looping],[800,250,70,1400,true]);
 }
});
