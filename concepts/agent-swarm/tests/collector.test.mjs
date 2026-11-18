import test from "node:test";
import assert from "node:assert/strict";
import {calendarStart,parseCommit,parseSearchIssue,collectPublicActivity} from "../refresh-account.mjs";

const now="2026-11-17T08:58:09Z",login="AdityaSreevatsaK";
const pr={user:{login},number:2,created_at:"2026-11-15T12:00:00Z",
 repository_url:"https://api.github.com/repos/oss/project",
 html_url:"https://github.com/oss/project/pull/2",
 pull_request:{merged_at:"2026-11-16T12:00:00Z"}};
const issue={user:{login},number:3,created_at:"2026-11-16T15:00:00Z",
 repository_url:"https://api.github.com/repos/oss/project",
 html_url:"https://github.com/oss/project/issues/3"};
const sha="a".repeat(40);
const commit={sha,author:{login},commit:{author:{date:"2026-11-14T09:00:00Z"}}};

test("calendar starts at Sunday on the 53-week UTC grid",()=>{
 assert.equal(calendarStart(now),"2025-11-16");
});
test("PR opening and merging are distinct verified source records",()=>{
 const records=parseSearchIssue(pr,login,now);
 assert.deepEqual(records.map(e=>e.kind),["pr_opened","pr_merged"]);
 assert(records.every(e=>e.url==="https://github.com/oss/project/pull/2"));
 assert.equal(parseSearchIssue({...pr,user:{login:"someone-else"}},login,now).length,0);
 assert.equal(parseSearchIssue({...pr,html_url:"https://evil.example/pr/2"},login,now).length,0);
});
test("commits require exact GitHub author and a full verified SHA",()=>{
 assert.equal(parseCommit(commit,"oss/project",login,"2025-11-16T00:00:00Z",now).kind,"commit");
 assert.equal(parseCommit({...commit,sha:"abcd"},"oss/project",login,"2025-11-16T00:00:00Z",now),null);
 assert.equal(parseCommit({...commit,author:{login:"not-owner"}},"oss/project",login,"2025-11-16T00:00:00Z",now),null);
});
test("collector handles public-only mocked PR, issue and authored commit, without real network",async()=>{
 const calls=[];
 const requestJson=async path=>{
  calls.push(path);
  if(path.startsWith("/search/issues?"))return path.includes("type%3Apr")?
    {total_count:1,incomplete_results:false,items:[pr]}:
    {total_count:1,incomplete_results:false,items:[issue]};
  if(path.startsWith("/users/"))return [
   {private:false,visibility:"public",owner:{login},full_name:"oss/project",default_branch:"main"},
   {private:true,visibility:"private",owner:{login},full_name:"oss/private",default_branch:"main"},
   {private:false,visibility:"public",owner:{login:"someone-else"},full_name:"other/third",default_branch:"main"}];
  if(path.includes("/commits?"))return [commit];
  throw Error("Unexpected request: "+path);
 };
 const actual=await collectPublicActivity(login,{now,requestJson});
 assert.equal(actual.source,"github");
 assert.equal(actual.coverage.public_only,true);
 assert.deepEqual(actual.activity.map(e=>e.kind),["commit","pr_opened","pr_merged","issue_opened"]);
 assert.equal(actual.repositories.length,1);
 assert(!calls.some(x=>x.includes("oss/private")));
 assert(calls.some(x=>x.includes("is%3Apublic")));
});
test("collector fails closed on incomplete search, preserving existing input",async()=>{
 await assert.rejects(collectPublicActivity(login,{now,requestJson:async()=>({
  total_count:1,incomplete_results:true,items:[]})}),/Incomplete public GitHub search/);
});
