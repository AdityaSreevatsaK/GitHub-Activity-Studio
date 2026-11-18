import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeScene} from '../scene.mjs';
import {calendarData} from '../calendar.mjs';
import {bloomScene,bloomState,bloomGifFrame,renderBloomSvg,renderBloomGif} from '../signal-bloom.mjs';
import {readGifMetadata} from '../gif.mjs';

const sample=JSON.parse(readFileSync(new URL('../../../shared/fixtures/demo-activity.json',import.meta.url),'utf8'));
const copy=()=>structuredClone(sample);
const prepare=(input,metric='events')=>bloomScene(calendarData(makeScene(input),input),{metric});

test('source-observed event and commit metrics remain separate',()=>{
 const events=prepare(sample),commits=prepare(sample,'commits');
 const total=sample.activity.length;
 const onlyCommits=sample.activity.filter(e=>e.kind==='commit').length;
 assert.equal(events.metric_total,total);
 assert.equal(commits.metric_total,onlyCommits);
 assert(commits.metric_total<events.metric_total);
 assert(commits.days.every(d=>d.count===(d.kind_counts?.commit||0)));
 assert(events.days.every(d=>d.count===d.events));
 assert(commits.drones.every(d=>commits.days.some(x=>x.date===d.date&&x.count>0)));
});

test('bloom is cumulative, does not erase source cells or invent days',()=>{
 const b=prepare(sample);
 assert.equal(bloomState(b,0).activated_days,0);
 assert.equal(bloomState(b,11).activated_days,b.active_days);
 assert.equal(bloomState(b,12).metric_total,b.metric_total);
 assert.equal(b.drones.length,Math.min(12,b.active_days));
 const dates=new Set(sample.activity.map(e=>e.occurred_at.slice(0,10)));
 for(const d of b.days)assert(dates.has(d.date));
});

test('empty snapshots, sparse commits, one repo, and bursty days behave deterministically',()=>{
 const raw=copy();raw.activity=[];raw.repositories=[];
 const empty=prepare(raw),commitOnly=prepare(raw,'commits');
 assert.equal(empty.active_days,0);assert.equal(commitOnly.metric_total,0);
 assert.equal(empty.drones.length,0);
 assert.match(renderBloomSvg(empty,{animated:false}),/0 ACTIVE OBSERVED DAYS/);
 const concentrated=copy();
 concentrated.activity=Array.from({length:35},(_,n)=>({
  id:'event-'+n,kind:'commit',repo_full_name:concentrated.repositories[0].full_name,
  occurred_at:'2026-11-14T11:00:00Z',count:1
 }));
 const a=prepare(concentrated,'commits'),b=prepare(concentrated,'commits');
 assert.deepEqual(a,b);
 assert.equal(a.active_days,1);
 assert.equal(a.days[0].level,4);
 assert.equal(a.metric_total,35);
});

test('SVG themes animate new blooms and offer genuinely non-animated stills',()=>{
 const data=prepare(sample);
 for(const theme of ['dark','light']){
  const svg=renderBloomSvg(data,{theme}),still=renderBloomSvg(data,{theme,animated:false,time:11.3});
  assert.match(svg,/aria-labelledby="bloom-title bloom-desc"/);
  assert.match(svg,/class="day-cell"/);
  assert.match(svg,/<animate/);
  assert(!still.includes('<animate'));
  assert.match(still,/SIGNAL BLOOM/);
  assert.equal(renderBloomSvg(data,{theme}),svg);
 }
 assert.match(renderBloomSvg(data),/SYNTHETIC DEMO/);
});

test('raster GIF frames change and loops last exactly 14 seconds',()=>{
 const data=prepare(sample);
 for(const theme of ['dark','light']){
  const early=bloomGifFrame(data,{theme,time:0});
  const late=bloomGifFrame(data,{theme,time:11});
  assert.equal(early.length,800*250);
  assert.notDeepEqual(early,late);
  const gif=renderBloomGif(data,{theme,frames:8}),meta=readGifMetadata(gif);
  assert.equal(meta.width,800);assert.equal(meta.height,250);
  assert.equal(meta.frames,8);assert.equal(meta.duration_centi,1400);
  assert.equal(meta.looping,true);
  assert.deepEqual(renderBloomGif(data,{theme,frames:8}),gif);
 }
});

test('real account snapshot retains provenance with a separate commits-only calendar',()=>{
 const raw=JSON.parse(readFileSync(new URL('../data/adityasreevatsak-public.json',import.meta.url),'utf8'));
 const events=prepare(raw),commits=prepare(raw,'commits');
 assert.equal(events.source,'github');
 assert.equal(events.metric_total,events.observed_events);
 assert(commits.metric_total>0&&commits.metric_total<=events.metric_total);
 assert(commits.active_days<=events.active_days);
 assert.equal(events.login,'AdityaSreevatsaK');
 const valid=new Set(events.days.filter(d=>d.count>0).map(d=>d.date));
 for(const beam of events.drones)assert(valid.has(beam.date));
});

test('untrusted account text is XML escaped and unsafe settings fail closed',()=>{
 const data=prepare(sample);data.login='<img onload="x">&';
 const svg=renderBloomSvg(data);
 assert(!svg.includes('<img'));
 assert(svg.includes('&lt;img'));
 assert(svg.includes('&amp;'));
 assert.throws(()=>renderBloomSvg(data,{theme:'invalid'}));
 assert.throws(()=>renderBloomGif(data,{frames:0}));
 assert.throws(()=>bloomGifFrame(data,{theme:'invalid'}));
 assert.throws(()=>bloomScene({calendar:{days:[]}}, {metric:'invented'}));
});
