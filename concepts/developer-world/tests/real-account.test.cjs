"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {makeSnapshot,interpretEvents}=require("../collect-github.cjs");
const world=require("../renderer.js");
const now=new Date("2026-11-17T08:15:00Z"),start=Date.parse("2026-11-17T00:00:00Z")-364*86400000;
function sampleDays(){
 const days=[];
 for(let i=0;i<365;i++){
  const date=new Date(start+i*86400000).toISOString().slice(0,10);
  const count=i%10===0?6:i%3===0?2:0;
  days.push({date,contributionCount:count,contributionLevel:count===0?"NONE":count===2?"FIRST_QUARTILE":"FOURTH_QUARTILE"});
 }
 return days;
}
function makeFetch({badGraph=false,restStatus=200}={}){
 const days=sampleDays(),chunks=[];
 for(let i=0;i<days.length;i+=7)chunks.push({contributionDays:days.slice(i,i+7)});
 const events=[
  {id:"1",type:"PushEvent",repo:{name:"someone/important"},created_at:"2026-11-16T09:00:00Z",payload:{size:3}},
  {id:"2",type:"PullRequestEvent",repo:{name:"someone/important"},created_at:"2026-11-15T09:00:00Z",payload:{action:"closed",pull_request:{merged:true}}},
  {id:"3",type:"IssuesEvent",repo:{name:"AdityaSreevatsaK/something"},created_at:"2026-11-14T09:00:00Z",payload:{action:"opened"}},
  {id:"4",type:"WatchEvent",repo:{name:"someone/important"},created_at:"2026-11-14T09:00:00Z",payload:{action:"started"}},
  {id:"5",type:"PushEvent",repo:{name:"someone/important"},created_at:"2026-11-15T00:00:00Z",payload:{size:0}}
 ];
 return async(url,opts)=>{
  if(url.endsWith("/graphql")){
   assert.equal(opts.method,"POST");
   assert.equal(opts.headers.Authorization,"Bearer test-token-value");
   const body=JSON.parse(opts.body);
   assert.equal(body.variables.login,"AdityaSreevatsaK");
   assert.equal(body.variables.from,"2025-11-18T00:00:00Z");
   return {ok:true,status:200,json:async()=>({data:{user:{contributionsCollection:{contributionCalendar:{weeks:badGraph?[]:chunks,totalContributions:222}}}}})};
  }
  assert.match(url,/\/users\/AdityaSreevatsaK\/events\/public/);
  return {ok:restStatus===200,status:restStatus,json:async()=>events};
 };
}
test("real calendar uses exact GitHub-visible daily counts, not partial REST totals",async()=>{
 const result=await makeSnapshot({token:"test-token-value",now,fetchImpl:makeFetch()});
 assert.equal(result.source,"github");assert.equal(result.user.login,"AdityaSreevatsaK");
 assert.equal(result.contribution_calendar.days.length,365);
 assert.equal(result.activity.length,3);
 assert.equal(result.repositories.length,2);
 assert.equal(result.activity.find(e=>e.kind==="commit").count,3);
 const sum=sampleDays().reduce((n,d)=>n+d.contributionCount,0);
 assert.equal(result.contribution_calendar.total_contributions,sum);
 assert.notEqual(sum,result.activity.reduce((n,e)=>n+e.count,0));
 const calendar=world.calendarFor(world.normalise(result));
 assert.equal(calendar.observed,sum);
 assert.equal(calendar.activeDays,sampleDays().filter(d=>d.contributionCount>0).length);
 assert.ok(calendar.unknownDays>0&&calendar.unknownDays<=7);
 assert.match(world.render(result),/REAL GITHUB CONTRIBUTIONS/);
 assert.doesNotMatch(world.render(result),/SYNTHETIC DEMO/);
});
test("failure of REST events must not fabricate or erase the authoritative calendar",async()=>{
 const result=await makeSnapshot({token:"test-token-value",now,fetchImpl:makeFetch({restStatus:403})});
 assert.equal(result.activity.length,0);assert.equal(result.repositories.length,0);
 assert.match(result.coverage.public_event_warning,/403/);
 const calendar=world.calendarFor(world.normalise(result));
 assert.equal(calendar.observed,result.contribution_calendar.total_contributions);
});
test("incomplete GraphQL calendar fails closed instead of displaying misleading zeroes",async()=>{
 await assert.rejects(()=>makeSnapshot({token:"test-token-value",now,fetchImpl:makeFetch({badGraph:true})}),/Incomplete/);
 await assert.rejects(()=>makeSnapshot({token:"bad",now,fetchImpl:makeFetch()}),/GITHUB_TOKEN/);
});
test("public events keep PR merges distinct and exclude unsupported or zero pushes",()=>{
 const result=interpretEvents([
  {id:"a",repo:{name:"owner/one"},type:"PushEvent",created_at:"2026-11-15T10:00:00Z",payload:{size:0}},
  {id:"b",repo:{name:"owner/one"},type:"PullRequestEvent",created_at:"2026-11-15T10:00:00Z",payload:{action:"closed",pull_request:{merged:true}}},
  {id:"c",repo:{name:"owner/one"},type:"PullRequestEvent",created_at:"2026-11-16T10:00:00Z",payload:{action:"closed",pull_request:{merged:false}}},
  {id:"d",repo:{name:"owner/one"},type:"PushEvent",created_at:"2026-11-16T10:00:00Z",payload:{commits:[{sha:"x"}]}},
  {id:"d",repo:{name:"owner/one"},type:"PushEvent",created_at:"2026-11-16T10:00:00Z",payload:{commits:[{sha:"x"}]}}
 ],Date.parse("2026-11-17T08:15:00Z"));
 assert.deepEqual(result.activity.map(e=>e.kind),["pr_merged","commit"]);
 assert.equal(result.repositories.length,1);
});
test("contribution calendar validation rejects inconsistent, duplicated or invented dates",async()=>{
 const snapshot=await makeSnapshot({token:"test-token-value",now,fetchImpl:makeFetch()});
 const mutate=fn=>{const copy=JSON.parse(JSON.stringify(snapshot));fn(copy.contribution_calendar);return copy};
 assert.throws(()=>world.normalise(mutate(c=>c.days.push({...c.days[0]}))),/Duplicate calendar/);
 assert.throws(()=>world.normalise(mutate(c=>{c.days[0].count=1;c.days[0].level="NONE"})),/Inconsistent/);
 assert.throws(()=>world.normalise(mutate(c=>{c.days[0].date="2026-02-30"})),/Invalid calendar/);
});
