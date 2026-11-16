import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validSnapshot,calendarModel,selectedModel,dayMachines,render,TYPES } from "../calendar-factory.mjs";
const fixture=JSON.parse(readFileSync(new URL("../../../shared/fixtures/demo-activity.json",import.meta.url),"utf8"));
const clone=v=>structuredClone(v);
test("shared fixture is real input to normaliser",()=>{
 const m=calendarModel(fixture);
 assert.equal(m.events.length,10);
 assert.equal(m.repos.size,5);
 assert.equal(m.outside,0);
 assert.equal(m.weeks.length,53);
});
test("default selects latest active week, not a random showcase week",()=>{
 const m=selectedModel(fixture);
 assert.equal(m.weekIndex,51);
 assert.equal(m.week.start,Date.parse("2026-11-08T00:00:00Z"));
 assert.equal(m.week.records,2);
 assert.equal(m.week.units,5);
 assert.deepEqual([...m.activeRepos].sort(),["sample-dev/ember","sample-dev/harbour"]);
 assert.deepEqual(m.week.days.map(d=>d.units),[0,4,0,0,0,1,0]);
 assert.equal(m.stages.get("commit"),4);
 assert.equal(m.stages.get("pr_opened"),1);
});
test("current incomplete week stays blank rather than inventing activity",()=>{
 const m=selectedModel(fixture,52);
 assert.equal(m.week.records,0);
 assert.equal(m.activeRepos.size,0);
 assert.equal(m.week.days.filter(d=>d.future).length,5);
 assert.match(render(fixture,{selectedWeek:52}),/IDLE LANE/);
 assert.doesNotMatch(render(fixture,{selectedWeek:52}),/data-repo=/);
});
test("only repositories with selected-week events become machines",()=>{
 const svg=render(fixture,{selectedWeek:51});
 assert.match(svg,/data-repo="sample-dev\/harbour"/);
 assert.match(svg,/data-repo="sample-dev\/ember"/);
 assert.doesNotMatch(svg,/data-repo="sample-dev\/orbit"/);
 assert.doesNotMatch(svg,/data-repo="sample-dev\/atlas"/);
 assert.match(svg,/2026-11-09: 4 recorded units/);
 assert.match(svg,/2026-11-13: 1 recorded units/);
});
test("event vocabulary has five distinct stages, without conflating PR opening and merger",()=>{
 const m=selectedModel(fixture,51);
 assert.equal(m.week.days[1].events[0].kind,"commit");
 assert.equal(m.week.days[5].events[0].kind,"pr_opened");
 assert.equal(Object.keys(TYPES).length,5);
 assert.notEqual(TYPES.pr_opened.verb,TYPES.pr_merged.verb);
 assert.match(render(fixture,{selectedWeek:51}),/ASSEMBLY 1/);
 assert.match(render(fixture,{selectedWeek:51}),/SEALED 0/);
});
test("date-based selection follows source event time, not file order",()=>{
 const other=clone(fixture);other.activity.reverse();
 assert.equal(render(other),render(fixture));
 assert.equal(calendarModel(other).defaultWeek,51);
});
test("both layouts, both themes and both motion states render deterministic standalone SVGs",()=>{
 for(const layout of ["isometric","pixel"])for(const theme of ["dark","light"])for(const animated of [true,false]){
  const svg=render(fixture,{layout,theme,animated});
  assert.match(svg,/viewBox="0 0 1200 430"/);
  assert.match(svg,/52-WEEK ACTIVITY CALENDAR/);
  assert.match(svg,/SYNTHETIC DEMO/);
  assert.match(svg,/<\/svg>\s*$/);
  assert.equal(svg.includes('class="travelling"'),animated);
  assert.equal(svg,render(clone(fixture),{layout,theme,animated}));
 }
 assert.notEqual(render(fixture,{layout:"pixel"}),render(fixture,{layout:"isometric"}));
});
test("duplicate IDs do not increase calendar units",()=>{
 const d=clone(fixture);d.activity.push(clone(d.activity[0]));
 assert.equal(validSnapshot(d).events.length,10);
 assert.equal(selectedModel(d).week.units,5);
 d.activity.at(-1).count=100;
 assert.throws(()=>validSnapshot(d),/conflicting duplicate/);
});
test("names are XML escaped even in tooltip and aria text",()=>{
 const d=clone(fixture);
 d.repositories.find(r=>r.name==="harbour").name='<img src=x onerror="bad">';
 const svg=render(d);
 assert.doesNotMatch(svg,/<img/);
 assert.doesNotMatch(svg,/onerror="/);
 assert.match(svg,/&lt;img/);
});
test("many activities on one day are represented by bounded machines and an overflow label",()=>{
 const d=clone(fixture);
 d.activity.push(...[0,1,2,3].map(i=>({...d.activity[0],id:"extra"+i,repo_full_name:i%2?"sample-dev/atlas":"sample-dev/orbit",occurred_at:"2026-11-09T12:00:00Z"})));
 const svg=render(d,{selectedWeek:51});
 assert.match(svg,/\+2 more records \(1 stages\)/);
 assert.match(svg,/16 UNITS/);
 assert.equal(selectedModel(d).week.days[1].events.length,5);
});
test("activity outside window and after generated_at is excluded",()=>{
 const d=clone(fixture);
 d.activity.push({...d.activity[0],id:"future",occurred_at:"2026-11-17T00:00:00Z"});
 d.activity.push({...d.activity[0],id:"historic",occurred_at:"2020-01-01T00:00:00Z"});
 const m=selectedModel(d);
 assert.equal(m.outside,2);
 assert.equal(m.week.units,5);
 assert.match(render(d),/Excluded 2 records/);
});
test("no repository and no events is an empty, honest calendar",()=>{
 const d=clone(fixture);d.repositories=[];d.activity=[];
 const m=selectedModel(d);
 assert.equal(m.defaultWeek,52);
 assert.equal(m.activeRepos.size,0);
 assert.match(render(d),/IDLE LANE/);
 assert.doesNotMatch(render(d),/data-repo=/);
});
test("malformed contract inputs and week indices are rejected",()=>{
 for(const f of [
 d=>d.schema_version="2",d=>d.source="private",d=>d.generated_at="2026-11-16T05:30:00+05:30",
 d=>d.activity[0].count=true,d=>d.activity[0].count=0,d=>d.activity[0].kind="deployment",
 d=>d.activity[0].occurred_at="2026-02-30T10:00:00Z",
 d=>d.activity[0].repo_full_name="unknown/x",
 d=>d.repositories[0].full_name="invalid",
 d=>d.repositories.push(clone(d.repositories[0])),
 ]){const d=clone(fixture);f(d);assert.throws(()=>validSnapshot(d));}
 for(const selectedWeek of [-1,53,1.5,"51",null])assert.throws(()=>selectedModel(fixture,selectedWeek),/week index/);
 assert.throws(()=>render(fixture,{layout:"3d"}));
 assert.throws(()=>render(fixture,{theme:"purple"}));
});

test("multiple records at one repository and stage reuse one machine with truthful totals",()=>{
 const d=clone(fixture);
 d.activity.push({...d.activity[8],id:"more-harbour-commits",count:2});
 const selected=selectedModel(d);
 const parts=dayMachines(selected.week.days[1]);
 assert.equal(parts.length,1);
 assert.equal(parts[0].records,2);
 assert.equal(parts[0].count,6);
 assert.deepEqual(parts[0].ids,["demo-009","more-harbour-commits"]);
 const svg=render(d);
 assert.match(svg,/data-records="2" data-units="6"/);
 assert.match(svg,/6 UNITS/);
 assert.equal((svg.match(/data-repo="sample-dev\/harbour"/g)||[]).length,1);
});
test("similarly named repositories from different owners remain separate machines",()=>{
 const d=clone(fixture);
 d.repositories[0].name="identical";
 d.repositories[1].name="identical";
 d.activity.push({...d.activity[0],id:"owner-a",occurred_at:"2026-11-11T10:00:00Z"});
 d.activity.push({...d.activity[1],id:"owner-b",occurred_at:"2026-11-11T12:00:00Z"});
 const selected=selectedModel(d);
 const svg=render(d,{selectedWeek:selected.weekIndex});
 assert.match(svg,/data-repo="sample-dev\/aurora"/);
 assert.match(svg,/data-repo="sample-dev\/atlas"/);
 assert.match(svg,/sample-dev\/aurora/);
 assert.match(svg,/sample-dev\/atlas/);
});
test("units outside snapshot window are disclosed visibly, not only in SVG metadata",()=>{
 const d=clone(fixture);
 d.activity.push({...d.activity[0],id:"historical",occurred_at:"2010-01-01T10:00:00Z"});
 const svg=render(d);
 assert.match(svg,/1 outside calendar/);
});
test("day machine light intensity follows source-backed units",()=>{
 const data=clone(fixture);
 const m=selectedModel(data);
 const d=m.week.days[1];
 assert.equal(dayMachines(d)[0].count,4);
 assert.match(render(data),/data-units="4"/);
 const higher=clone(data);
 higher.activity[8].count=1;
 assert.match(render(higher),/data-units="1"/);
 assert.notEqual(render(higher),render(data));
});
