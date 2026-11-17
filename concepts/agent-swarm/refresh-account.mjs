/** Public-only, read-only GitHub account snapshot collector.
 * Node.js 20+, no packages. Exports pure logic for offline tests.
 * Never collects private repository details or stores GitHub tokens.
 */
import {writeFileSync,renameSync,unlinkSync,mkdirSync} from "node:fs";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {normaliseSnapshot} from "./scene.mjs";

const HOME=dirname(fileURLToPath(import.meta.url));
const DAY=86400000;
const LOGIN=/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const FULL=/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const toDate=ms=>new Date(ms).toISOString().slice(0,10);

export function calendarStart(timestamp){
 const today=Date.parse(timestamp.slice(0,10)+"T00:00:00Z");
 const start=today-(new Date(today).getUTCDay()+52*7)*DAY;
 return toDate(start);
}

export function parseSearchIssue(item,login,now){
 if(!item||item.user?.login?.toLowerCase()!==login.toLowerCase())return [];
 if(typeof item.created_at!=="string"||item.created_at>now)return [];
 const prefix="https://api.github.com/repos/";
 if(typeof item.repository_url!=="string"||!item.repository_url.startsWith(prefix))return [];
 const repo=item.repository_url.slice(prefix.length);
 if(!FULL.test(repo)||!Number.isSafeInteger(item.number)||item.number<1)return [];
 const url="https://github.com/"+repo+"/"+(item.pull_request?"pull":"issues")+"/"+item.number;
 if(item.html_url!==url)return [];
 const mk=(kind,date)=>({id:kind+":"+repo+"#"+item.number,kind,
  repo_full_name:repo,occurred_at:date,url,count:1});
 const records=[mk(item.pull_request?"pr_opened":"issue_opened",item.created_at)];
 const merged=item.pull_request?.merged_at;
 if(item.pull_request&&typeof merged==="string"&&merged<=now){
  records.push(mk("pr_merged",merged));
 }
 return records;
}

export function parseCommit(commit,repo,login,from,until){
 if(!commit||commit.author?.login?.toLowerCase()!==login.toLowerCase())return null;
 if(!/^[a-f0-9]{40}$/.test(commit.sha||""))return null;
 const date=commit.commit?.author?.date;
 if(typeof date!=="string"||date<from||date>until)return null;
 return {id:"commit:"+repo+"@"+commit.sha,kind:"commit",
  repo_full_name:repo,occurred_at:date,url:"https://github.com/"+repo+"/commit/"+commit.sha,count:1};
}

export async function collectPublicActivity(login,{requestJson,now=new Date().toISOString(),maxCommitPages=30}={}){
 if(!LOGIN.test(login))throw Error("Invalid GitHub login");
 if(typeof requestJson!=="function")throw Error("requestJson is required");
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(now))throw Error("now must be ISO UTC");
 const start=calendarStart(now),end=now.slice(0,10),activity=[],repos=new Map(),ids=new Set();
 const push=(event)=>{
  if(!event||ids.has(event.id)||event.occurred_at<start+"T00:00:00Z"||event.occurred_at>now)return;
  ids.add(event.id);activity.push(event);
  const full=event.repo_full_name;
  if(!repos.has(full))repos.set(full,{full_name:full,name:full.split("/")[1],url:"https://github.com/"+full});
 };
 async function searchKind(kind,startDate,endDate){
  const filter="author:"+login+" type:"+kind+" is:public created:"+startDate+".."+endDate;
  const pathname="/search/issues?q="+encodeURIComponent(filter)+"&per_page=100&sort=created&order=asc";
  const first=await requestJson(pathname+"&page=1");
  if(!first||!Array.isArray(first.items)||!Number.isSafeInteger(first.total_count)||first.incomplete_results)throw Error("Incomplete public GitHub search");
  if(first.total_count>1000){
   const left=Date.parse(startDate+"T00:00:00Z"),right=Date.parse(endDate+"T00:00:00Z");
   if(left>=right)throw Error("More than 1000 search results on one date; refusing incomplete snapshot");
   const split=left+Math.floor((right-left)/DAY/2)*DAY;
   const leftEnd=toDate(split),rightStart=toDate(split+DAY);
   await searchKind(kind,startDate,leftEnd);
   await searchKind(kind,rightStart,endDate);
   return;
  }
  const pages=Math.ceil(first.total_count/100),all=[...first.items];
  for(let page=2;page<=pages;page++){
   const p=await requestJson(pathname+"&page="+page);
   if(!p||!Array.isArray(p.items)||p.incomplete_results)throw Error("Incomplete public GitHub search page");
   all.push(...p.items);
  }
  if(all.length!==first.total_count)throw Error("Public GitHub search changed during pagination; retry");
  for(const item of all)for(const e of parseSearchIssue(item,login,now))push(e);
 }
 await searchKind("pr",start,end);
 await searchKind("issue",start,end);
 const publicRepos=[];
 for(let page=1;page<=10;page++){
  const list=await requestJson("/users/"+encodeURIComponent(login)+"/repos?type=owner&per_page=100&page="+page);
  if(!Array.isArray(list))throw Error("GitHub public repositories response invalid");
  for(const r of list){
   if(r?.private!==false||r.visibility&&r.visibility!=="public"||r.owner?.login?.toLowerCase()!==login.toLowerCase()||!FULL.test(r.full_name||""))continue;
   publicRepos.push({full_name:r.full_name,branch:r.default_branch||"main"});
  }
  if(list.length<100)break;
  if(page===10)throw Error("Public repository pagination cap exceeded");
 }
 for(const {full_name,branch} of publicRepos){
  const path="/repos/"+full_name+"/commits?author="+encodeURIComponent(login)+
   "&since="+encodeURIComponent(start+"T00:00:00Z")+"&until="+encodeURIComponent(now)+
   "&sha="+encodeURIComponent(branch)+"&per_page=100";
  for(let page=1;page<=maxCommitPages;page++){
   const commits=await requestJson(path+"&page="+page);
   if(!Array.isArray(commits))throw Error("Commit list invalid for "+full_name);
   for(const raw of commits)push(parseCommit(raw,full_name,login,start+"T00:00:00Z",now));
   if(commits.length<100)break;
   if(page===maxCommitPages)throw Error("Commit pagination cap reached for "+full_name);
  }
 }
 activity.sort((a,b)=>a.occurred_at.localeCompare(b.occurred_at)||a.id.localeCompare(b.id));
 const snapshot={schema_version:"1",source:"github",generated_at:now,
  user:{login,url:"https://github.com/"+login},
  repositories:[...repos.values()].sort((a,b)=>a.full_name.localeCompare(b.full_name)),
  activity,
  coverage:{public_only:true,snapshot_at:now,account:login,
   included:["public_pr_opened","public_pr_merged","public_issue_opened","authored_default_branch_commits_on_public_owned_repos"],
   caveats:["Not official GitHub contribution totals","Public-only sources; private details excluded",
    "Public commits on external default branches and non-event contribution types can be missing",
    "PR merge is a separate visual event, not an additional official contribution"],
   method:"GitHub REST public issue search is:public and public authored default-branch commits"}};
 normaliseSnapshot(snapshot);
 return snapshot;
}

export function githubRequest(token=process.env.GITHUB_TOKEN||""){
 return async path=>{
  if(!path.startsWith("/")||path.startsWith("//"))throw Error("Unsafe request path");
  const headers={"Accept":"application/vnd.github+json",
   "User-Agent":"Agent-Swarm-public-snapshot/1.0",
   "X-GitHub-Api-Version":"2022-11-28"};
  if(token)headers.Authorization="Bearer "+token;
  const response=await fetch("https://api.github.com"+path,{headers,signal:AbortSignal.timeout(20000)});
  if(!response.ok){
   const retry=response.headers.get("retry-after");
   throw Error("GitHub public API HTTP "+response.status+(retry?"; retry-after "+retry+"s":"")+
    ". Existing snapshot remains unchanged.");
  }
  return await response.json();
 };
}

async function main(){
 const args=process.argv.slice(2);let login="AdityaSreevatsaK",output=null,dryRun=false;
 for(let i=0;i<args.length;i++){
  if(args[i]==="--user"&&args[i+1])login=args[++i];
  else if(args[i]==="--output"&&args[i+1])output=resolve(args[++i]);
  else if(args[i]==="--dry-run")dryRun=true;
  else throw Error("Usage: node refresh-account.mjs [--user LOGIN] [--output FILE] [--dry-run]");
 }
 if(!output&&login!=="AdityaSreevatsaK")throw Error("Other accounts require an explicit --output path");
 output??=join(HOME,"data","adityasreevatsak-public.json");
 const snapshot=await collectPublicActivity(login,{requestJson:githubRequest()});
 const counts={};for(const event of snapshot.activity)counts[event.kind]=(counts[event.kind]||0)+1;
 console.log("Public activity for @"+login+": "+snapshot.activity.length+
  " source events across "+new Set(snapshot.activity.map(e=>e.occurred_at.slice(0,10))).size+
  " recorded days ("+JSON.stringify(counts)+")");
 if(dryRun){console.log("Dry run, snapshot unchanged");return;}
 mkdirSync(dirname(output),{recursive:true});
 const tmp=output+".pending";
 try{
  writeFileSync(tmp,JSON.stringify(snapshot,null,2)+"\n","utf8");
  renameSync(tmp,output);
 }catch(e){try{unlinkSync(tmp);}catch{}throw e;}
 console.log("Public-only snapshot updated: "+output);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(e=>{console.error("Public refresh failed: "+e.message);process.exitCode=1;});
}
