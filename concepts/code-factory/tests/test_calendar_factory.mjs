import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalise, render } from '../calendar-factory.mjs';
const fixture = JSON.parse(readFileSync(new URL('../../../shared/fixtures/demo-activity.json', import.meta.url), 'utf8'));
const clone = x => structuredClone(x);
test('demo fixture is deduplicated, counts remain typed and accurate', () => {
  const scene = normalise(fixture);
  assert.equal(scene.events.length, 10);
  assert.equal(scene.repoTotal, 5);
  assert.deepEqual(scene.sums, {commit:14, pr_opened:2, pr_merged:2, issue_opened:1, release:1});
});
test('every theme and layout produces distinct, profile-sized calendar exports', () => {
  for (const layout of ['isometric','pixel']) for (const theme of ['dark','light']) {
    for (const animated of [true,false]) {
      const svg=render(fixture,{layout,theme,animated});
      assert.match(svg,/viewBox="0 0 1000 320"/);
      assert.match(svg,/52-WEEK ACTIVITY GRID/);
      assert.match(svg,/SYNTHETIC DEMO/);
      assert.match(svg,/<\/svg>\s*$/);
      assert.equal(svg.includes('<animateMotion'),animated);
      assert.equal(svg.includes('not official contribution totals'),true);
    }
  }
  assert.notEqual(render(fixture,{layout:'pixel'}),render(fixture,{layout:'isometric'}));
});
test('render is deterministic and independent of incoming event order', () => {
  const other=clone(fixture);
  other.activity.reverse();
  assert.equal(render(other),render(fixture));
});
test('identical duplicate events cannot inflate counts, conflicting IDs fail', () => {
  const dup=clone(fixture); dup.activity.push(clone(dup.activity[0]));
  assert.equal(normalise(dup).events.length,10);
  dup.activity.at(-1).count=99;
  assert.throws(()=>normalise(dup),/conflicting event/);
});
test('empty repository/activity sets create an honest idle factory', () => {
  const empty=clone(fixture);empty.repositories=[];empty.activity=[];
  assert.match(render(empty),/EMPTY FACTORY/);
  const one=clone(fixture);one.repositories=one.repositories.slice(0,1);one.activity=[];
  assert.match(render(one),/IDLE SHIFT/);
  assert.doesNotMatch(render(one),/<animateMotion/);
});
test('full names preserve owners even if short names collide', () => {
  const data=clone(fixture);
  data.repositories[0].name='duplicate';
  data.repositories[1].name='duplicate';
  assert.equal(normalise(data).repos.size,5);
});
test('unsafe repository names are XML escaped', () => {
  const data=clone(fixture);
  data.repositories[0].name='<img src=x onerror=alert(1)>';
  const svg=render(data);
  assert.doesNotMatch(svg,/<img /);
  assert.doesNotMatch(svg,/onerror="/);
});
test('invalid data and time zone offsets are rejected',()=>{
  for (const mutate of [
    d=>d.schema_version='x',d=>d.source='private',d=>d.generated_at='2026-02-30T00:00:00Z',
    d=>d.activity[0].count=true,d=>d.activity[0].count=-1,d=>d.activity[0].kind='deployment',
    d=>d.activity[0].occurred_at='2026-11-01T10:00:00+05:30',
    d=>d.activity[0].repo_full_name='other/repo',
    d=>d.repositories[0].full_name='invalid',d=>d.repositories.push(clone(d.repositories[0])),
  ]) {const data=clone(fixture);mutate(data);assert.throws(()=>normalise(data));}
});
test('calendar includes all valid events even if parcel and machine display is truncated',()=>{
  const d=clone(fixture);
  d.activity=Array.from({length:24},(_,i)=>({...d.activity[0],id:'extra-'+i,occurred_at:'2026-10-'+String(i+1).padStart(2,'0')+'T10:00:00Z'}));
  const svg=render(d);
  assert.match(svg,/Showing 5\/5 stations · 9\/24 packages/);
  assert.match(svg,/2026-10-01: 3 recorded event units/);
});
test('render invalid options fail instead of silently changing output',()=>{
  assert.throws(()=>render(fixture,{theme:'purple'}));
  assert.throws(()=>render(fixture,{layout:'3d'}));
});
