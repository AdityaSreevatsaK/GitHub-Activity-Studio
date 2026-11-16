import test from "node:test";
import assert from "node:assert/strict";
import {makeScene} from "../scene.mjs";
import {calendarData} from "../calendar.mjs";
import {showcaseData} from "../showcase.mjs";

test("showcase source is deterministic and unambiguously fictional",()=>{
 const a=showcaseData(),b=showcaseData();
 assert.deepEqual(a,b);
 assert.equal(a.source,"demo");
 assert.equal(a.user.login,"synthetic-showcase");
 assert(a.repositories.every(repo=>repo.full_name.startsWith("synthetic-showcase/")));
 assert(a.activity.every(e=>e.url==="https://github.com/example"));
 assert(a.activity.length>=250);
});
test("showcase spreads legitimate synthetic source events across 53 weeks",()=>{
 const data=showcaseData(),scene=calendarData(makeScene(data),data);
 assert(scene.calendar.observed_days>=150);
 assert(scene.calendar.window_events===data.activity.length);
 assert(scene.jobs.length===10);
 assert(new Set(scene.jobs.map(job=>job.cell.week)).size>=8);
 assert(scene.jobs.every(job=>data.activity.some(e=>e.id===job.id)));
});
