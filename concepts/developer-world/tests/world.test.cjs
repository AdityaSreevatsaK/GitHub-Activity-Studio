"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),http=require("node:http");
const {spawnSync}=require("node:child_process"),world=require("../renderer.js"),{createServer}=require("../server.cjs");
const fixture=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../../../shared/fixtures/demo-activity.json"),"utf8"));
const copy=x=>JSON.parse(JSON.stringify(x));
test("shared demo: five repositories, ten events and 20 recorded units",()=>{
 const n=world.normalise(fixture),f=world.statsFor(n);
 assert.equal(n.repositories.length,5);assert.equal(n.activity.length,10);assert.equal(f.units,20);
 assert.equal(f.repositories.filter(v=>v.stage>0).length,5);
});
test("growth thresholds 0, 1, 3, 6 and 10",()=>{
 for(const [units,growth] of [[0,0],[1,1],[2,1],[3,2],[5,2],[6,3],[9,3],[10,4],[100,4]])assert.equal(world.stage(units),growth);
});
test("timeline displays only recorded events",()=>{
 const n=world.normalise(fixture);
 assert.equal(world.statsFor(n,0).units,0);assert.equal(world.statsFor(n,4).units,7);assert.equal(world.statsFor(n,10).units,20);
});
test("deduplicate by event ID but not by timestamp",()=>{
 const input=copy(fixture);input.activity.push(copy(input.activity[0]));
 assert.equal(world.normalise(input).activity.length,10);
 const newEvent=copy(input.activity[0]);newEvent.id="separate-event";input.activity.push(newEvent);
 assert.equal(world.statsFor(world.normalise(input)).units,23);
});
test("stable rendering irrespective of source list order",()=>{
 const reversed=copy(fixture);reversed.repositories.reverse();reversed.activity.reverse();
 const opts={layout:"archipelago",theme:"dark",animated:false};
 assert.equal(world.render(reversed,opts),world.render(fixture,opts));
 assert.equal(world.render(fixture,opts),world.render(fixture,opts));
});
test("two distinct layouts with light and dark styles",()=>{
 const a=world.render(fixture,{layout:"archipelago",theme:"dark"});
 const b=world.render(fixture,{layout:"village",theme:"light"});
 assert.match(a,/Isles of Code/);assert.match(b,/Little Buildtown/);
 assert.match(a,/dw-sea/);assert.match(b,/dw-bg/);assert.notEqual(a,b);
 assert.match(a,/SYNTHETIC DEMO/);assert.match(b,/prefers-reduced-motion/);
});
test("empty input creates a safe quiet world",()=>{
 const input=copy(fixture);input.activity=[];input.repositories=[];
 for(const layout of ["archipelago","village"]){
  const svg=world.render(input,{layout});assert.match(svg,/quiet world awaits its first recorded event/);assert.match(svg,/0 recorded units/);
 }
});
test("single repository and large source count reach growth four",()=>{
 const input=copy(fixture);input.repositories=input.repositories.slice(0,1);
 input.activity=[{id:"large",kind:"commit",repo_full_name:input.repositories[0].full_name,occurred_at:"2026-11-01T00:00:00Z",count:20}];
 assert.equal(world.statsFor(world.normalise(input)).repositories[0].stage,4);
 assert.match(world.render(input),/stage 4/);
});
test("invalid schema, timestamps, kinds, counts and repos are rejected",()=>{
 const cases=[
  o=>o.schema_version="2",o=>o.source="private",o=>o.generated_at="2026-11-16T05:30:00+05:30",
  o=>o.activity[0].kind="unknown",o=>o.activity[0].count=0,o=>o.activity[0].count=1.5,
  o=>o.activity[0].repo_full_name="somebody/else",o=>o.repositories[0].full_name="",
  o=>o.repositories.push(copy(o.repositories[0]))
 ];
 for(const edit of cases){const input=copy(fixture);edit(input);assert.throws(()=>world.normalise(input));}
});
test("untrusted names are XML escaped",()=>{
 const input=copy(fixture);input.repositories[0].name='<script>&';
 const svg=world.render(input);assert.doesNotMatch(svg,/<script>/);assert.match(svg,/&lt;script&gt;/);assert.match(svg,/&amp;/);
});
test("overflow is disclosed explicitly",()=>{
 const input=copy(fixture);input.repositories.push({full_name:"sample-dev/zeta",name:"zeta"});
 assert.match(world.render(input),/\+1 repositories omitted/);
});
test("invalid rendering options are rejected",()=>{
 assert.throws(()=>world.render(fixture,{layout:"map"}));assert.throws(()=>world.render(fixture,{progress:-1}));
});
test("CLI creates reproducible animated and still SVG files",()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"dw-test-"));
 try{
  const args=["../export.cjs","--out",dir,"--layout","village","--theme","light"];
  const first=spawnSync(process.execPath,args,{cwd:__dirname,encoding:"utf8"});
  assert.equal(first.status,0,first.stderr);
  const file=path.join(dir,"village-light.svg"),text=fs.readFileSync(file,"utf8");
  assert.match(text,/Little Buildtown/);
  assert.ok(fs.existsSync(path.join(dir,"village-light-still.svg")));
  const second=spawnSync(process.execPath,args,{cwd:__dirname,encoding:"utf8"});
  assert.equal(second.status,0,second.stderr);assert.equal(fs.readFileSync(file,"utf8"),text);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test("local server serves preview and fixture but blocks private dotfiles",async()=>{
 const server=createServer(path.resolve(__dirname,"../../.."));
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 try{
  const port=server.address().port;
  const get=pathname=>new Promise((resolve,reject)=>{
   http.get({hostname:"127.0.0.1",port,path:pathname},res=>{
    let body="";res.on("data",part=>body+=part);res.on("end",()=>resolve({code:res.statusCode,body}));
   }).on("error",reject);
  });
  const page=await get("/");assert.equal(page.code,200);assert.match(page.body,/Developer World/);
  const data=await get("/shared/fixtures/demo-activity.json");assert.equal(data.code,200);assert.equal(JSON.parse(data.body).source,"demo");
  assert.equal((await get("/.git/config")).code,403);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test("contribution calendar is an actual 53-week by 7-day UTC grid",()=>{
 const data=world.normalise(fixture),calendar=world.calendarFor(data);
 assert.equal(calendar.cells.length,371);
 assert.equal(calendar.cells[0].date,"2025-11-16");
 assert.equal(calendar.cells.at(-1).date,"2026-11-21");
 assert.equal(calendar.cells[0].d,0);
 for(let w=0;w<53;w++)for(let d=0;d<7;d++){
  const c=calendar.cells[w*7+d];assert.equal(c.w,w);assert.equal(c.d,d);
  assert.equal(new Date(c.date+"T00:00:00Z").getUTCDay(),d);
 }
 assert.equal(calendar.activeDays,10);
 assert.equal(calendar.observed,20);
 assert.equal(calendar.outside,0);
});
test("daily buckets use source event counts, not inferred GitHub contribution totals",()=>{
 const data=world.normalise(fixture),c=world.calendarFor(data);
 assert.equal(c.lookup.get("2026-10-17").units,5);
 assert.equal(c.lookup.get("2026-10-17").level,2);
 assert.equal(c.lookup.get("2026-11-09").byKind.commit,4);
 assert.equal(c.lookup.get("2026-11-09").byRepo["sample-dev/harbour"],4);
 assert.equal(c.lookup.get("2026-08-21").byKind.pr_opened,1);
 assert.equal(c.lookup.get("2026-11-16").units,0);
 assert.equal(c.activeDays,10);
});
test("partial timeline changes intensity without shifting repo landmark dates",()=>{
 const data=world.normalise(fixture);
 const empty=world.calendarFor(data,0),part=world.calendarFor(data,4),full=world.calendarFor(data,10);
 assert.equal(empty.observed,0);assert.equal(empty.activeDays,0);
 assert.equal(part.observed,7);assert.equal(part.activeDays,4);
 assert.deepEqual([...empty.anchors],[...full.anchors]);
 assert.equal(full.anchors.size,5);
 assert.equal(new Set(full.anchors.values()).size,5);
});
test("events outside calendar and after snapshot are not painted as observed days",()=>{
 const f=copy(fixture);
 f.activity.push({id:"outside-window",kind:"release",repo_full_name:"sample-dev/aurora",occurred_at:"2025-01-01T00:00:00Z",count:99});
 f.activity.push({id:"future-event",kind:"commit",repo_full_name:"sample-dev/aurora",occurred_at:"2026-11-20T00:00:00Z",count:100});
 const c=world.calendarFor(world.normalise(f));
 assert.equal(c.observed,20);assert.equal(c.outside,2);assert.equal(c.activeDays,10);
 assert.equal(c.lookup.get("2026-11-20").future,true);
 assert.equal(c.lookup.get("2026-11-20").units,0);
 assert.match(world.render(f),/2 events outside calendar window/);
});
test("calendar render has every date once, clear source disclosure and no script tags",()=>{
 for(const layout of ["archipelago","village"])for(const theme of ["light","dark"]){
  const svg=world.render(fixture,{layout,theme,animated:false});
  assert.equal((svg.match(/data-date="/g)||[]).length,371);
  assert.equal((svg.match(/<g\b/g)||[]).length,(svg.match(/<\/g>/g)||[]).length);
  assert.match(svg,/SYNTHETIC DEMO/);
  assert.match(svg,/Empty cells mean no events recorded/);
  assert.match(svg,/animation:none!important/);
  assert.doesNotMatch(svg,/<script[\s>]/i);
  assert.ok(Buffer.byteLength(svg,"utf8")<350000);
 }
});
test("high activity changes calendar tile level and preserves calendar geometry",()=>{
 const f=copy(fixture);
 f.activity.push({id:"bonus",kind:"commit",repo_full_name:"sample-dev/aurora",occurred_at:"2026-11-15T08:00:00Z",count:12});
 const calendar=world.calendarFor(world.normalise(f));
 const cell=calendar.lookup.get("2026-11-15");
 assert.equal(cell.level,4);assert.equal(cell.units,12);
 assert.match(world.render(f),/data-date="2026-11-15" data-level="4"/);
});

test("legend and repository totals exclude events outside the chart window",()=>{
 const f=copy(fixture);
 f.activity.push({id:"outside-extra",kind:"commit",repo_full_name:"sample-dev/aurora",occurred_at:"2025-01-01T00:00:00Z",count:100});
 const c=world.calendarFor(world.normalise(f));
 assert.equal(c.byRepo.get("sample-dev/aurora").units,4);
 assert.equal(c.byRepo.get("sample-dev/aurora").events,2);
 assert.match(world.render(f),/4 units · 2 events · stage 2/);
 assert.equal(c.outside,1);
});

test("both worlds include five distinct evolving repository landmark illustrations",()=>{
 for(const layout of ["archipelago","village"]){
  const first=world.render(fixture,{layout,progress:0,animated:false});
  const final=world.render(fixture,{layout,animated:false});
  assert.equal((final.match(/<ellipse cy="25" rx="20"/g)||[]).length,5);
  assert.equal((first.match(/<ellipse cy="25" rx="20"/g)||[]).length,5);
  assert.match(final,/Pinned to recorded day/);
  assert.notEqual(first,final);
 }
});

test("same-day timestamps later than generated_at are excluded from calendar and anchors",()=>{
 const data=copy(fixture);
 data.activity.push({id:"not-yet",kind:"release",repo_full_name:"sample-dev/aurora",occurred_at:"2026-11-16T15:35:00Z",count:40});
 const c=world.calendarFor(world.normalise(data));
 assert.equal(c.outside,1);assert.equal(c.observed,20);
 assert.equal(c.byRepo.get("sample-dev/aurora").units,4);
 assert.equal(c.lookup.get("2026-11-16").units,0);
 assert.equal(c.anchors.get("sample-dev/aurora"),"2026-08-03");
});
test("invalid Gregorian dates are rejected even if Date.parse normalises them",()=>{
 for(const value of ["2026-02-30T00:00:00Z","2026-11-31T22:00:00Z","2026-13-01T00:00:00Z"]){
  const data=copy(fixture);data.activity[0].occurred_at=value;
  assert.throws(()=>world.normalise(data));
 }
});
test("frame-based environmental motion is deterministic and never changes activity tiles",()=>{
 const a=world.render(fixture,{layout:"archipelago",frame:0,animated:false});
 const b=world.render(fixture,{layout:"archipelago",frame:3,animated:false});
 assert.notEqual(a,b);assert.equal(a,world.render(fixture,{layout:"archipelago",frame:0,animated:false}));
 const dates=svg=>[...svg.matchAll(/data-date="([^"]+)" data-level="([^"]+)" data-units="([^"]+)"/g)].map(m=>m.slice(1).join(":"));
 assert.deepEqual(dates(a),dates(b));
 assert.throws(()=>world.render(fixture,{frame:-1}));
 assert.throws(()=>world.render(fixture,{frame:1.5}));
});
test("selecting an inspected date only outlines its tile, not its source values",()=>{
 const base=world.render(fixture,{animated:false});
 const focus=world.render(fixture,{animated:false,focusDate:"2026-11-09"});
 assert.match(focus,/data-date="2026-11-09"/);
 assert.notEqual(base,focus);
 const level=svg=>svg.match(/data-date="2026-11-09" data-level="([^"]+)" data-units="([^"]+)"/).slice(1);
 assert.deepEqual(level(base),level(focus));
});
