import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {makeScene} from "../scene.mjs";
import {calendarData} from "../calendar.mjs";
import {makeStory,forgeProgress,forgeCrewTargets,forgeCrewPosition,storyState,signalPosition,renderStorySvg,storyGifFrame,renderStoryGif} from "../swarm-stories.mjs";
import {readGifMetadata} from "../gif.mjs";

const fixture=JSON.parse(readFileSync(new URL("../../../../shared/fixtures/demo-activity.json",import.meta.url),"utf8"));
const construct=(raw)=>makeStory(calendarData(makeScene(raw),raw),raw);
const copy=()=>structuredClone(fixture);

test("Forge builds every observed day without inventing days",()=>{
 const s=construct(fixture);
 assert.equal(s.window_events,s.calendar.days.reduce((n,d)=>n+d.events,0));
 assert.equal(storyState(s,"forge",0).revealed_days,0);
 assert.equal(storyState(s,"forge",11).revealed_days,s.calendar.observed_days);
 assert.equal(storyState(s,"forge",11).revealed_events,s.window_events);
 assert.equal(storyState(s,"relay",0).revealed_events,s.window_events);
 assert.equal(forgeProgress(-2),1);
});

test("Relay routes use real repository-specific source dates",()=>{
 const s=construct(fixture),known=new Set(fixture.activity.map(e=>e.repo_full_name+"@"+e.occurred_at.slice(0,10)));
 for(const g of s.signals)for(const e of g.events){
  assert(known.has(g.repo.full_name+"@"+e.date));
  for(const t of [0,1,2,5,12,13.9]){
   const p=signalPosition(e,g.repo,t);
   assert(Number.isFinite(p.x)&&Number.isFinite(p.y));
  }
 }
 const again=construct(fixture);
 assert.deepEqual(s,again);
});

test("Full real account snapshot: all visible events are preserved",()=>{
 const raw=JSON.parse(readFileSync(new URL("../data/adityasreevatsak-public.json",import.meta.url),"utf8"));
 const s=construct(raw);
 assert.equal(s.source,"github");
 assert.equal(storyState(s,"forge",11).revealed_events,s.window_events);
 assert(s.calendar.observed_days>0);
 assert(s.window_events<=s.event_total);
 assert(s.signals.every(g=>g.events.length<=5));
});

test("No observations and no repository hubs render valid, labelled SVG",()=>{
 const x=copy();x.activity=[];x.repositories=[];
 const s=construct(x);
 assert.equal(s.window_events,0);
 assert.equal(s.signals.length,0);
 for(const mode of ["forge","relay"])assert.match(renderStorySvg(s,{mode}),/0 OBSERVED EVENTS/);
});

test("Both modes and both colour themes have animated and accessible stills",()=>{
 const s=construct(fixture);
 for(const mode of ["forge","relay"])for(const theme of ["dark","light"]){
  const animated=renderStorySvg(s,{mode,theme});
  const still=renderStorySvg(s,{mode,theme,animated:false,time:11});
  assert.match(animated,/role="img"/);
  assert.match(animated,/<title id="swarm-title">/);
  assert.match(animated,/SYNTHETIC DEMO/);
  assert.match(animated,/<animate/);
  assert(!still.includes("<animate"));
  assert.notEqual(animated,still);
  assert.equal(renderStorySvg(s,{mode,theme}),animated);
 }
});

test("User-controlled labels escape unsafe characters",()=>{
 const x=copy();
 x.user.login='evil<&"';
 x.repositories[0].name='<script>&';
 const svg=renderStorySvg(construct(x),{mode:"relay"});
 assert(!svg.includes('<script>'));
 assert(svg.includes('&lt;script&gt;'));
 assert(svg.includes('evil&lt;&amp;&quot;'));
});

test("GIF frames change materially during build and transfer",()=>{
 const s=construct(fixture);
 const forgeStart=storyGifFrame(s,{mode:"forge",time:0});
 const forgeDone=storyGifFrame(s,{mode:"forge",time:11});
 assert.equal(forgeStart.length,800*250);
 assert.notDeepEqual(forgeStart,forgeDone);
 const relayStart=storyGifFrame(s,{mode:"relay",time:0});
 const relayWorking=storyGifFrame(s,{mode:"relay",time:3});
 assert.notDeepEqual(relayStart,relayWorking);
});

test("GIF output remains an exact, looping 14-second GitHub-compatible export",()=>{
 const s=construct(fixture);
 for(const mode of ["forge","relay"]){
  const bytes=renderStoryGif(s,{mode,theme:"dark",frames:8});
  const m=readGifMetadata(bytes);
  assert.equal(m.width,800);assert.equal(m.height,250);
  assert.equal(m.frames,8);assert.equal(m.duration_centi,1400);
  assert.equal(m.looping,true);
  assert.deepEqual(renderStoryGif(s,{mode,theme:"dark",frames:8}),bytes);
 }
});

test("Invalid source snapshots, modes and GIF options are rejected",()=>{
 const x=copy(),s=construct(x);
 const changed=copy();changed.generated_at="2024-01-01T00:00:00Z";
 assert.throws(()=>makeStory(calendarData(makeScene(x),x),changed),/provenance/);
 assert.throws(()=>storyState(s,"made-up",2));
 assert.throws(()=>renderStorySvg(s,{theme:"unknown"}));
 assert.throws(()=>storyGifFrame(s,{mode:"unknown"}));
 assert.throws(()=>renderStoryGif(s,{frames:0}));
});


test("Relay stills show source-backed destinations without permanent cross-chart cables",()=>{
 const story=construct(fixture);
 const still=renderStorySvg(story,{mode:"relay",animated:false,time:4});
 assert.match(still,/r="10" fill="none" stroke=/);
 assert(!still.includes('<path d="M '));
 const animated=renderStorySvg(story,{mode:"relay"});
 assert.match(animated,/<animateMotion/);
 assert(!animated.includes('stroke-width="1.5" opacity="0"><animate attributeName="opacity"'));
});

test("Forge completion displays the synchronised team badge and preserves cells",()=>{
 const story=construct(fixture);
 const complete=renderStorySvg(story,{mode:"forge",animated:false,time:11.6});
 const starting=renderStorySvg(story,{mode:"forge",animated:false,time:0});
 assert.match(complete,/circle cx="565" cy="49" r="13"/);
 assert(!starting.includes('circle cx="565" cy="49" r="13"'));
 assert.equal((complete.match(/class="day-cell"/g)||[]).length,story.calendar.observed_days);
});


test("Forge teams visit only dates observed in their own repositories",()=>{
 const raw=JSON.parse(readFileSync(new URL("../data/adityasreevatsak-public.json",import.meta.url),"utf8"));
 const story=construct(raw);
 const allowed=new Set(raw.activity.map(e=>e.repo_full_name+"|"+e.occurred_at.slice(0,10)));
 let assigned=0;
 for(let i=0;i<story.repositories.length;i++){
  const targets=forgeCrewTargets(story,i);
  assert.equal(targets.length,53);
  for(const target of targets){
   if(target.date){assert(allowed.has(target.repo_full_name+"|"+target.date));assigned++;}
   assert(Number.isFinite(target.x)&&Number.isFinite(target.y));
  }
  for(const t of [0,.85,2.5,5.5,10.6,11.5,13.9]){
   const pos=forgeCrewPosition(targets,t);
   assert(Number.isFinite(pos.x)&&Number.isFinite(pos.y));
  }
 }
 assert(assigned>0);
 assert.throws(()=>forgeCrewTargets(story,100));
});

test("Story inspector preserves bounded, safe, source-backed hyperlinks",()=>{
 const raw=JSON.parse(readFileSync(new URL("../data/adityasreevatsak-public.json",import.meta.url),"utf8"));
 const story=construct(raw);
 const events=new Map(raw.activity.map(e=>[e.url,e]));
 const links=story.calendar.days.flatMap(day=>day.links);
 assert(links.length>0);
 assert(story.calendar.days.every(day=>day.links.length<=3));
 for(const link of links){
  assert.match(link.url,/^https:\/\/github\.com\/[^/]+\/[^/]+\/(?:issues|pull|commit|releases)\//);
  const source=events.get(link.url);
  assert(source);
  assert.equal(source.repo_full_name,link.repo_full_name);
  assert.equal(source.kind,link.kind);
 }
 const injected=copy();
 injected.activity[0].url="https://github.com.evil.invalid/a/b/pull/3";
 injected.activity[1].url="javascript:alert(1)";
 injected.activity[2].url="https://github.com/example/hello/pull/3";
 const updated=construct(injected);
 assert(updated.calendar.days.every(day=>day.links.every(link=>!link.url.includes("evil.invalid")&&!link.url.startsWith("javascript:"))));
});

test("Relay packets carry an event-type marker instead of anonymous dots",()=>{
 const story=construct(fixture);
 const svg=renderStorySvg(story,{mode:"relay"});
 assert.match(svg,/font-size="8.5" font-weight="bold"/);
 const gif=storyGifFrame(story,{mode:"relay",time:3});
 assert.equal(gif.length,800*250);
});
