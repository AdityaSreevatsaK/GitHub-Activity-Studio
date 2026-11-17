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

test("invalid UTC calendar dates and impossible hours fail closed",()=>{
 for(const invalid of ["2026-02-30T10:00:00Z","2026-11-31T10:00:00Z","2026-11-16T24:00:00Z","2026-04-31T10:00:00Z"]){
  const raw=structuredClone(fixture);raw.activity[0].occurred_at=invalid;
  assert.throws(()=>sceneFor(raw),/invalid UTC calendar date or time/);
 }
 const leap=structuredClone(fixture);leap.activity[0].occurred_at="2024-02-29T10:00:00Z";
 assert.equal(sceneFor(leap).calendar.outside_window_events,1);
});
test("out-of-window and future source events do not displace valid jobs",()=>{
 const raw=structuredClone(fixture);
 for(let i=0;i<25;i++)raw.activity.push({id:"outlier-"+i,kind:"release",repo_full_name:"sample-dev/harbour",
  occurred_at:i%2?"2027-01-01T00:00:00Z":"2022-01-01T00:00:00Z",count:1});
 const result=sceneFor(raw);
 assert.equal(result.shown,10);assert.equal(result.calendar.observed_days,10);
 assert.equal(result.calendar.outside_window_events,13);
 assert.equal(result.calendar.future_events,12);
 assert.equal(result.event_total,35);
 assert(result.jobs.every(job=>job.cell));
});
test("bursty in-window events show ten latest jobs without changing calendar truth",()=>{
 const raw=structuredClone(fixture);
 for(let i=0;i<50;i++)raw.activity.push({id:"in-"+i,kind:"commit",repo_full_name:"sample-dev/aurora",
  occurred_at:"2026-11-15T10:00:00Z",count:2});
 const result=sceneFor(raw);
 assert.equal(result.calendar.window_events,60);
 assert.equal(result.calendar.observed_days,11);
 assert.equal(result.jobs.length,10);
 assert(result.jobs.some(j=>j.date==="2026-11-15"));
 assert(result.truncated);
});

test("all style/theme combinations have a matching GIF and static SVG",()=>{
 const scene=sceneFor(fixture);
 for(const style of ["geometric","robots"])for(const theme of ["dark","light"]){
  const still=svgCalendar(scene,{style,theme,animated:false});
  const animated=svgCalendar(scene,{style,theme});
  assert(!still.includes("<animateMotion"));
  assert(animated.includes("<animateMotion"));
  const gif=renderCalendarGif(scene,{style,theme,frames:2});
  const meta=readGifMetadata(gif);
  assert.equal(meta.duration_centi,1400);
  assert.equal(meta.frames,2);
 }
});

test("stratified choreography reaches distant calendar weeks",()=>{
 const raw=structuredClone(fixture);
 for(let week=0;week<40;week++){
  const date=new Date(Date.UTC(2026,0,1)+week*7*86400000).toISOString().slice(0,10)+"T12:00:00Z";
  raw.activity.push({id:"weekly-"+week,kind:"commit",repo_full_name:"sample-dev/aurora",occurred_at:date,count:1});
 }
 const scene=sceneFor(raw);
 const weeks=new Set(scene.jobs.map(j=>j.cell.week));
 assert.equal(scene.jobs.length,10);
 assert(weeks.size>=6);
 assert(scene.jobs.some(j=>j.cell.week<20));
 assert(scene.jobs.some(j=>j.cell.week>35));
});

test("observed-day links use only consecutive recorded dates",()=>{
 const raw=structuredClone(fixture);
 raw.activity=[
  {id:"a",kind:"commit",repo_full_name:"sample-dev/aurora",occurred_at:"2026-11-09T09:00:00Z",count:1},
  {id:"b",kind:"commit",repo_full_name:"sample-dev/aurora",occurred_at:"2026-11-10T09:00:00Z",count:1},
  {id:"c",kind:"commit",repo_full_name:"sample-dev/aurora",occurred_at:"2026-11-12T09:00:00Z",count:1}
 ];
 const svg=svgCalendar(sceneFor(raw),{style:"geometric",theme:"dark"});
 assert.equal((svg.match(/class="observed-link"/g)||[]).length,1);
 assert(svg.includes("Adjacent recorded activity: 2026-11-09 and 2026-11-10"));
 assert(!svg.includes("Adjacent recorded activity: 2026-11-10 and 2026-11-12"));
});
test("invalid XML control characters are excluded from SVG text and attributes",()=>{
 const raw=structuredClone(fixture);
 raw.repositories[0].name="test\\u0000\\u0001\\u000bname";
 raw.activity[0].id="event\\u0001id";
 const svg=svgCalendar(sceneFor(raw));
 assert(!svg.includes("\\u0000"));assert(!svg.includes("\\u0001"));assert(!svg.includes("\\u000b"));
});
test("reduced-motion SVG hides all movement and task pulse layers",()=>{
 const svg=svgCalendar(sceneFor(fixture));
 assert.match(svg,/prefers-reduced-motion:reduce/);
 assert.match(svg,/\\.swarm-motion,\\.symbolic-task\\{display:none!important\\}/);
});
test("high-density source days receive indicators, not invented activity",()=>{
 const raw=structuredClone(fixture);
 for(let i=0;i<3;i++)raw.activity.push({id:"dense-"+i,kind:"commit",
  repo_full_name:"sample-dev/aurora",occurred_at:"2026-11-15T08:00:00Z",count:1});
 const s=svgCalendar(sceneFor(raw));
 assert.equal((s.match(/class="busy-day-indicator"/g)||[]).length,1);
});
