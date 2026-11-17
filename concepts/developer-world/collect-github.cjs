"use strict";
// Standalone real-account collector for Developer World, not a shared cross-concept API.
// Authoritative daily counts: GitHub GraphQL contributionCalendar.
// Optional repository decorations: the recent PUBLIC Events REST API, max 300 entries.
// Requires GITHUB_TOKEN or GH_TOKEN. Never log or persist the token.
const fs=require("node:fs"),path=require("node:path");
const DEFAULT_LOGIN="AdityaSreevatsaK";
const DAY=86400000;
const query=`query DeveloperWorldContributions($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
    }
  }
}`;
const validLogin=login=>typeof login==="string"&&/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/i.test(login);
function dayIso(value){return new Date(value).toISOString().slice(0,10);}
function interpretEvents(events,cutoff){
 const byId=new Set(),repos=new Map(),activity=[];
 for(const e of events){
  if(!e||typeof e.id!=="string"||byId.has(e.id)||!e.repo||typeof e.repo.name!=="string")continue;
  const repo=e.repo.name;
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo))continue;
  const stamp=Date.parse(e.created_at);
  if(!Number.isFinite(stamp)||stamp>cutoff)continue;
  const p=e.payload||{};
  let kind=null,count=1;
  if(e.type==="PushEvent"){
   const observed=Number.isSafeInteger(p.size)?p.size:Array.isArray(p.commits)?p.commits.length:0;
   if(observed<1)continue;
   kind="commit";count=Math.min(observed,100000);
  }else if(e.type==="PullRequestEvent"&&p.action==="opened")kind="pr_opened";
  else if(e.type==="PullRequestEvent"&&p.action==="closed"&&p.pull_request?.merged===true)kind="pr_merged";
  else if(e.type==="IssuesEvent"&&p.action==="opened")kind="issue_opened";
  else if(e.type==="ReleaseEvent"&&p.action==="published")kind="release";
  if(!kind)continue;
  byId.add(e.id);
  if(!repos.has(repo))repos.set(repo,{
   full_name:repo,name:repo.split("/")[1],url:"https://github.com/"+repo
  });
  activity.push({
   id:"public-"+e.id,kind,repo_full_name:repo,
   occurred_at:new Date(stamp).toISOString().replace(".000Z","Z"),
   url:"https://github.com/"+repo,count
  });
 }
 return {
  repositories:[...repos.values()].sort((a,b)=>a.full_name.localeCompare(b.full_name)).slice(0,500),
  activity:activity.sort((a,b)=>Date.parse(a.occurred_at)-Date.parse(b.occurred_at)||a.id.localeCompare(b.id)).slice(0,20000)
 };
}
async function makeSnapshot({login=DEFAULT_LOGIN,token,now=new Date(),fetchImpl=fetch}={}){
 if(!validLogin(login))throw Error("Invalid GitHub login");
 if(typeof token!=="string"||token.length<10)throw Error("Set GITHUB_TOKEN or GH_TOKEN to access GitHub GraphQL; token is never stored");
 const instant=now instanceof Date?now:new Date(now);
 if(!Number.isFinite(instant.getTime()))throw Error("Invalid collection date");
 const today=dayIso(instant),from=dayIso(Date.parse(today+"T00:00:00Z")-364*DAY);
 const fromTime=from+"T00:00:00Z",toTime=instant.toISOString();
 const headers={"Authorization":"Bearer "+token,"Accept":"application/vnd.github+json","User-Agent":"developer-world-calendar/1","X-GitHub-Api-Version":"2022-11-28"};
 const response=await fetchImpl("https://api.github.com/graphql",{
  method:"POST",headers:{...headers,"Content-Type":"application/json"},
  body:JSON.stringify({query,variables:{login,from:fromTime,to:toTime}}),
  signal:AbortSignal.timeout(25000)
 });
 if(!response.ok)throw Error("GitHub GraphQL failed (HTTP "+response.status+"); verify token permissions");
 const payload=await response.json();
 if(payload.errors?.length)throw Error("GitHub GraphQL: "+payload.errors.map(e=>e.type||e.message).join(", ").slice(0,280));
 const calendar=payload.data?.user?.contributionsCollection?.contributionCalendar;
 if(!calendar||!Array.isArray(calendar.weeks))throw Error("No GitHub contribution calendar for "+login);
 const validLevels=new Set(["NONE","FIRST_QUARTILE","SECOND_QUARTILE","THIRD_QUARTILE","FOURTH_QUARTILE"]);
 const seen=new Set(),days=[];
 for(const week of calendar.weeks){
  if(!Array.isArray(week.contributionDays))throw Error("Malformed contribution week");
  for(const day of week.contributionDays){
   if(typeof day.date!=="string"||day.date<from||day.date>today)continue;
   if(seen.has(day.date))throw Error("Duplicate GitHub contribution date");
   const time=Date.parse(day.date+"T00:00:00Z");
   if(!Number.isFinite(time)||dayIso(time)!==day.date)throw Error("Invalid GitHub contribution date");
   if(!Number.isSafeInteger(day.contributionCount)||day.contributionCount<0||
       !validLevels.has(day.contributionLevel))throw Error("Invalid GitHub contribution count/level");
   if((day.contributionCount===0)!==(day.contributionLevel==="NONE"))throw Error("Inconsistent GitHub contribution level");
   seen.add(day.date);days.push({date:day.date,count:day.contributionCount,level:day.contributionLevel});
  }
 }
 days.sort((a,b)=>a.date.localeCompare(b.date));
 if(days.length<300)throw Error("Incomplete GitHub GraphQL contribution calendar ("+days.length+" days); refusing to fabricate missing history");
 // GitHub's public event feed is finite and can omit events and repositories.
 // These entries colour *decorations*, never the authoritative daily totals.
 let events=[],restWarning=null;
 try{
  for(let page=1;page<=3;page++){
   const r=await fetchImpl("https://api.github.com/users/"+encodeURIComponent(login)+"/events/public?per_page=100&page="+page,{
    headers,signal:AbortSignal.timeout(18000)
   });
   if(!r.ok){restWarning="Public events API HTTP "+r.status;break;}
   const batch=await r.json();
   if(!Array.isArray(batch))throw Error("Invalid public events response");
   events.push(...batch);
   if(batch.length<100)break;
  }
 }catch(err){restWarning="Public events unavailable";events=[];}
 const recent=interpretEvents(events,instant.getTime());
 const snapshot={
  schema_version:"1",source:"github",
  generated_at:toTime.replace(".000Z","Z"),
  user:{login,url:"https://github.com/"+login},
  repositories:recent.repositories,
  activity:recent.activity,
  contribution_calendar:{
   from,to:today,total_contributions:days.reduce((total,d)=>total+d.count,0),days
  },
  coverage:{
   calendar:"GitHub GraphQL contributionsCollection, visible to the workflow token",
   events:"GitHub REST public events, up to 300 most recent events; incomplete by design",
   rest_events_checked:events.length,
   public_event_warning:restWarning
  }
 };
 // Verify against the actual renderer before writing any public artefacts.
 const world=require("./renderer.js");
 const normal=world.normalise(snapshot),rendered=world.calendarFor(normal);
 if(rendered.observed!==snapshot.contribution_calendar.total_contributions||
   rendered.activeDays!==days.filter(d=>d.count>0).length)throw Error("Contribution data and renderer disagree");
 return snapshot;
}
async function main(args=process.argv.slice(2)){
 if(args.includes("--help")||args.includes("-h")){
  console.log("Usage: GITHUB_TOKEN=<token> node collect-github.cjs [--login GitHubUsername] [--out path]\nCollects real GitHub-visible contributions; optional public events never replace GraphQL totals.");
  return;
 }
 let login=DEFAULT_LOGIN,out=path.join(__dirname,"real-activity.json");
 for(let i=0;i<args.length;i++){
  if(args[i]==="--login"&&args[i+1])login=args[++i];
  else if(args[i]==="--out"&&args[i+1])out=path.resolve(args[++i]);
  else throw Error("Unknown/incomplete argument "+args[i]);
 }
 const snapshot=await makeSnapshot({login,token:process.env.GITHUB_TOKEN||process.env.GH_TOKEN});
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,JSON.stringify(snapshot,null,2)+"\n","utf8");
 console.log("Real GitHub-visible account calendar:",login,
  snapshot.contribution_calendar.days.length,"verified dates,",
  snapshot.contribution_calendar.total_contributions,"contributions,",
  snapshot.activity.length,"partial public events");
 if(snapshot.coverage.public_event_warning)console.warn(snapshot.coverage.public_event_warning);
 console.log("Saved",out);
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={makeSnapshot,interpretEvents,DEFAULT_LOGIN};
