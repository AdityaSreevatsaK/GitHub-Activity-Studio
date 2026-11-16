import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {makeScene} from "../scene.mjs";
import {calendarData,agentAt,svgCalendar} from "../calendar.mjs";
import {calendarGifFrame,renderCalendarGif} from "../calendar-gif.mjs";
import {readGifMetadata} from "../gif.mjs";
const fixture=JSON.parse(readFileSync(new URL("../../../shared/fixtures/demo-activity.json",import.meta.url),"utf8"));
const sceneFor=raw=>calendarData(makeScene(raw),raw);
test("53-week UTC calendar maps observed dates faithfully",()=>{
 const scene=sceneFor(fixture);
 assert.equal(scene.calendar.start,"2025-11-16");assert.equal(scene.calendar.end,"2026-11-16");
 assert.equal(scene.calendar.observed_days,10);assert.equal(scene.calendar.window_events,10);
 assert.equal(scene.jobs.length,10);
 for(const job of scene.jobs){assert.equal(job.date,job.occurred_at.slice(0,10));assert(job.cell.week<53);assert(job.cell.weekday<7);}
});
test("event IDs deduplicated and unlike units retained separately",()=>{
 const raw=structuredClone(fixture),first=raw.activity[0];
 raw.activity.push({...first,id:"independent",count:7},structuredClone(first));
 const s=sceneFor(raw),day=s.calendar.days.find(d=>d.date===first.occurred_at.slice(0,10));
 assert.equal(day.events,2);assert.equal(day.units,10);
 assert.equal(s.calendar.window_events,11);assert.equal(s.event_total,11);
});
test("all observed repositories contribute to the calendar, not just animated hubs",()=>{
 const raw=structuredClone(fixture);
 raw.repositories.push({full_name:"another/new",name:"new"});
 raw.activity.push({id:"extra",kind:"release",repo_full_name:"another/new",occurred_at:"2026-06-15T12:00:00Z",count:1});
 assert(sceneFor(raw).calendar.days.some(day=>day.date==="2026-06-15"));
});
test("historical, future and empty inputs cannot invent days",()=>{
 const raw=structuredClone(fixture);raw.activity=[];
 assert.equal(sceneFor(raw).calendar.observed_days,0);
 assert.match(svgCalendar(sceneFor(raw)),/NO OBSERVED EVENTS/);
 const withOutliers=structuredClone(fixture);
 withOutliers.activity.push({id:"old",kind:"commit",repo_full_name:"sample-dev/aurora",occurred_at:"2024-05-11T00:00:00Z",count:1});
 withOutliers.activity.push({id:"future",kind:"release",repo_full_name:"sample-dev/aurora",occurred_at:"2027-05-11T00:00:00Z",count:1});
 const s=sceneFor(withOutliers);
 assert.equal(s.calendar.outside_window_events,1);assert.equal(s.calendar.future_events,1);
 assert.equal(s.calendar.observed_days,10);
});
test("two SVG styles and light/dark themes have 371 actual calendar cells",()=>{
 const scene=sceneFor(fixture);
 for(const style of ["geometric","robots"])for(const theme of ["dark","light"]){
  const a=svgCalendar(scene,{style,theme});
  assert.equal(a,svgCalendar(scene,{style,theme}));
  assert.equal((a.match(/class="day-cell"/g)||[]).length,371);
  assert.match(a,/DEMO DATA/);assert.match(a,/animateMotion/);
  const still=svgCalendar(scene,{style,theme,animated:false});
  assert(!still.includes("<animateMotion"));
 }
});
test("untrusted repository names are escaped",()=>{
 const raw=structuredClone(fixture);raw.repositories[0].name="<script>alert(1)</script>";
 const svg=svgCalendar(sceneFor(raw));
 assert(!svg.includes("<script>"));
});
test("agent paths are finite and remain on the canvas",()=>{
 const s=sceneFor(fixture);
 for(const job of s.jobs)for(const side of [0,1])for(let t=0;t<14;t+=.13){
  const p=agentAt(job,t,side);
  assert(p.x>=0&&p.x<=1120&&p.y>=0&&p.y<=350);
 }
});
test("both GIFs are deterministic profile-ready 14-second loops",()=>{
 const s=sceneFor(fixture),frame=calendarGifFrame(s,{style:"robots",time:4});
 assert.equal(frame.length,800*250);assert(new Set(frame).size>=7);
 for(const [style,theme] of [["geometric","dark"],["robots","light"]]){
  const gif=renderCalendarGif(s,{style,theme,frames:4});
  assert.deepEqual(renderCalendarGif(s,{style,theme,frames:4}),gif);
  const m=readGifMetadata(gif);
  assert.deepEqual([m.width,m.height,m.frames,m.duration_centi,m.looping],[800,250,4,1400,true]);
 }
});
