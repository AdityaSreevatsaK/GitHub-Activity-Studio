import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validSnapshot,calendarModel,selectedModel,dayMachines,render,TYPES } from "../calendar-factory.mjs";
const fixture=JSON.parse(readFileSync(new URL("../../../shared/fixtures/demo-activity.json",import.meta.url),"utf8"));
const publicAccount=JSON.parse(readFileSync(new URL("../fixtures/adityasreevatsak-public-activity.json",import.meta.url),"utf8"));
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
 assert.equal((svg.match(/class="active" data-repo="sample-dev\/harbour"/g)||[]).length,1);
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

test("renders a source-backed release and inspection week without unrelated machinery",()=>{
 const release=render(fixture,{selectedWeek:48,layout:"isometric",theme:"light"});
 assert.match(release,/data-kind="release"/);
 assert.match(release,/data-repo="sample-dev\/aurora"/);
 assert.doesNotMatch(release,/data-kind="pr_opened"/);
 assert.match(release,/DISPATCH 1/);
 const inspect=render(fixture,{selectedWeek:45,layout:"pixel",theme:"dark"});
 assert.match(inspect,/data-kind="issue_opened"/);
 assert.match(inspect,/data-repo="sample-dev\/orbit"/);
 assert.match(inspect,/INSPECT 1/);
 assert.doesNotMatch(inspect,/data-kind="release"/);
});
test("future same-day timestamps are not silently counted in activity calendar",()=>{
 const d=clone(fixture);
 d.generated_at="2026-11-16T00:00:00Z";
 d.activity.push({...d.activity[0],id:"after-snapshot",occurred_at:"2026-11-16T01:00:00Z"});
 const model=selectedModel(d);
 assert.equal(model.outside,1);
 assert.equal(model.week.units,5);
});
test("heavy input preserves 10k valid source records with bounded SVG complexity",()=>{
 const d=clone(fixture);
 const prototype=d.activity[0];
 d.activity=Array.from({length:10000},(_,i)=>({...prototype,id:"large-"+i,occurred_at:"2026-11-09T09:00:00Z"}));
 const model=selectedModel(d);
 assert.equal(model.week.units,30000);
 assert.equal(model.week.records,10000);
 assert.equal(dayMachines(model.week.days[1]).length,1);
 const svg=render(d);
 assert.match(svg,/data-records="10000" data-units="30000"/);
 assert.ok(svg.length<150000,"SVG should remain compact under heavy activity");
});

test("mixed ISO UTC precision sorts chronologically and equivalent timestamps deduplicate",()=>{
 const d=clone(fixture);
 d.generated_at="2026-11-16T00:00:00.123Z";
 d.activity=[
  {...fixture.activity[0],id:"later",occurred_at:"2026-11-09T07:45:00.100Z"},
  {...fixture.activity[0],id:"earlier",occurred_at:"2026-11-09T07:45:00Z"},
  {...fixture.activity[0],id:"earlier",occurred_at:"2026-11-09T07:45:00.000Z"},
 ];
 const snap=validSnapshot(d);
 assert.equal(snap.events.length,2);
 assert.deepEqual(snap.events.map(e=>e.id),["earlier","later"]);
 assert.match(render(d),/6 UNITS/);
});

test("README still exports contain source-backed packages, including correct day, repo and units",()=>{
 const still=render(fixture,{animated:false});
 const packages=[...still.matchAll(/data-package="([^"]+)" data-day="([^"]+)" data-repo="([^"]+)" data-units="([^"]+)"/g)];
 assert.deepEqual(packages.map(x=>x.slice(1)),[
  ["commit","2026-11-09","sample-dev/harbour","4"],
  ["pr_opened","2026-11-13","sample-dev/ember","1"]
 ]);
 assert.doesNotMatch(still,/<animateMotion/);
 assert.equal(packages.length,2);
});
test("animated packages only originate from the same visible selected-week machine groups",()=>{
 const animation=render(fixture,{animated:true,selectedWeek:51});
 assert.equal((animation.match(/data-package="/g)||[]).length,2);
 assert.equal((animation.match(/<animateMotion/g)||[]).length,2);
 const idle=render(fixture,{animated:true,selectedWeek:52});
 assert.doesNotMatch(idle,/data-package="/);
 assert.doesNotMatch(idle,/<animateMotion/);
});
test("unsafe XML controls and directional overrides cannot corrupt exported SVG",()=>{
 for(const bad of ["\u0000","\u0001","\u001f","\u007f","\u202e","\u2066","\ud800","\ufffe"]){
  const d=clone(fixture);d.repositories[0].name="repo"+bad+"test";
  assert.throws(()=>render(d),/unsafe XML/);
 }
 const d=clone(fixture);d.activity[0].id="e\u0007vil";
 assert.throws(()=>render(d),/unsafe XML/);
});
test("only selected calendar week is focusable and every column is discoverable",()=>{
 const svg=render(fixture,{selectedWeek:51});
 assert.equal((svg.match(/data-week-index="/g)||[]).length,53);
 assert.equal((svg.match(/role="button" tabindex="0"/g)||[]).length,1);
 assert.equal((svg.match(/role="button" tabindex="-1"/g)||[]).length,52);
 assert.match(svg,/data-week-index="51" role="button" tabindex="0"/);
 assert.match(svg,/aria-pressed="true"/);
});

test("moving cargo fades at the loop boundaries but static images do not rely on animation",()=>{
 const animated=render(fixture,{animated:true});
 const still=render(fixture,{animated:false});
 const fades=[...animated.matchAll(/<animate attributeName="opacity" values="0;1;1;0"/g)];
 assert.equal(fades.length,2);
 assert.doesNotMatch(still,/attributeName="opacity"/);
 assert.equal((still.match(/data-package="/g)||[]).length,2);
});

test("seven calendar-to-factory signals reflect each selected day's actual recorded units",()=>{
 const active=render(fixture,{selectedWeek:51});
 assert.match(active,/<title>2026-11-09: 4 recorded units<\/title>/);
 assert.match(active,/<title>2026-11-13: 1 recorded units<\/title>/);
 assert.match(active,/<title>2026-11-10: 0 recorded units<\/title>/);
 const idle=render(fixture,{selectedWeek:52});
 assert.doesNotMatch(idle,/data-package="/);
 assert.match(idle,/<title>2026-11-16: 0 recorded units<\/title>/);
});

test("personal snapshot comes from public GitHub records rather than the demonstration",()=>{
 const snap=validSnapshot(publicAccount);
 assert.equal(snap.source,"github");
 assert.equal(snap.userLogin,"AdityaSreevatsaK");
 assert.notEqual(publicAccount.generated_at,fixture.generated_at);
 assert.ok(snap.events.length>100);
 assert.ok(snap.repos.size>5);
 assert.ok(snap.events.every(e=>publicAccount.repositories.some(r=>r.full_name===e.repo)));
 assert.ok(publicAccount.activity.every(e=>e.url.startsWith("https://github.com/")));
 assert.ok(publicAccount.repositories.every(r=>r.url.startsWith("https://github.com/")));
 assert.ok(!publicAccount.access_token&&!publicAccount.token);
});
test("account-specific stills display the actual username and only selected-week events",()=>{
 const model=calendarModel(publicAccount);
 const selected=model.weeks[51];
 assert.ok(selected.records>0);
 const activeRepos=[...new Set(selected.days.flatMap(day=>day.events.map(e=>e.repo)))];
 assert.ok(activeRepos.length>=2);
 for(const layout of ["isometric","pixel"])for(const theme of ["dark","light"]){
   const svg=render(publicAccount,{layout,theme,selectedWeek:51,animated:false});
   assert.match(svg,/@AdityaSreevatsaK/);
   assert.match(svg,/PUBLIC GITHUB SNAPSHOT/);
   assert.doesNotMatch(svg,/SYNTHETIC DEMO/);
   assert.match(svg,/aria-pressed="true"/);
   assert.equal((svg.match(/data-week-index="/g)||[]).length,53);
   assert.equal((svg.match(/data-package="/g)||[]).length,selected.days.reduce((total,d)=>total+Math.min(2,dayMachines(d).length),0));
   assert.doesNotMatch(svg,/<animateMotion/);
 }
});
test("unsafe account labels cannot become SVG markup",()=>{
 const data=clone(publicAccount);
 data.user.login="<svg onload=alert(1)>";
 assert.throws(()=>render(data),/invalid public username/);
});
