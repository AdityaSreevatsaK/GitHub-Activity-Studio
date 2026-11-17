/**
 * Refresh a GitHub Code Factory v1 snapshot from PUBLIC activity only.
 *
 * Usage:
 *   node concepts/code-factory/refresh-public-activity.mjs
 *   node concepts/code-factory/refresh-public-activity.mjs --since 2025-11-17
 *
 * Optional GITHUB_TOKEN: only an API rate-limit convenience. Never stored,
 * printed, or copied into the generated JSON. Does not query private repos.
 *
 * Public search is capped at 1,000 results by GitHub. We fail closed rather
 * than writing an incomplete snapshot if any query exceeds that limit.
 */
import { mkdir, writeFile, rename, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ACCOUNT = "AdityaSreevatsaK";
const API = "https://api.github.com";
const DAY = 86_400_000;

function assertDate(day) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw Error("Expected YYYY-MM-DD start date");
  const when = new Date(day+"T00:00:00Z");
  if(!Number.isFinite(+when)||when.toISOString().slice(0,10)!==day) throw Error("Invalid start date");
  return when;
}
function sourceRepo(raw) {
  const match = /^https:\/\/api\.github\.com\/repos\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/.exec(raw??"");
  if(!match) throw Error("Invalid repository URL in public GitHub search");
  return match[1];
}
function createRequester(token) {
  return async function request(route,{allowEmpty=false}={}) {
    const url = API+route;
    const headers = {
      "Accept":"application/vnd.github+json",
      "X-GitHub-Api-Version":"2022-11-28",
      "User-Agent":"github-activity-studio-code-factory"
    };
    if(token) headers.Authorization="Bearer "+token;
    const response=await fetch(url,{headers});
    if(allowEmpty&&response.status===409) return [];
    if(!response.ok) throw Error("GitHub public API HTTP "+response.status+" for "+route.split("?")[0]+". Check GitHub rate limits or token permissions.");
    return response.json();
  };
}
async function collect({request,now=new Date(),since,login=ACCOUNT}) {
  const cutoff=now.toISOString().replace(/\.\d{3}Z$/,"Z");
  const from=assertDate(since??new Date(+now-365*DAY).toISOString().slice(0,10)).toISOString();
  const cutoffMs=+now;
  const seen=new Map(),repositories=new Map(),totals={};
  function add(kind,full_name,when,id,url) {
    const ms=Date.parse(when);
    if(!Number.isFinite(ms)||ms<Date.parse(from)||ms>cutoffMs) return;
    const event={id,kind,repo_full_name:full_name,occurred_at:new Date(ms).toISOString().replace(/\.000Z$/,"Z"),url,count:1};
    const old=seen.get(id);
    if(old){if(JSON.stringify(old)!==JSON.stringify(event))throw Error("Conflicting public event ID");return;}
    if(!url.startsWith("https://github.com/")) throw Error("Untrusted public event URL");
    seen.set(id,event);
    if(!repositories.has(full_name))repositories.set(full_name,{full_name,name:full_name.split("/")[1],url:"https://github.com/"+full_name});
  }
  async function publicSearch(kind) {
    const query="author:"+login+" is:"+(kind==="pr"?"pr":"issue")+" is:public created:>="+from.slice(0,10);
    let total=null,received=0;
    for(let page=1;page<=10;page++){
      const route="/search/issues?q="+encodeURIComponent(query)+"&per_page=100&page="+page;
      const data=await request(route);
      if(data.incomplete_results) throw Error("GitHub public "+kind+" search incomplete; snapshot NOT written");
      if(total===null){total=data.total_count;if(!Number.isInteger(total)||total>1000)throw Error("GitHub public "+kind+" search exceeds 1,000-result API limit; split collection into date windows");}
      const items=data.items;
      if(!Array.isArray(items))throw Error("Invalid GitHub public search response");
      received+=items.length;
      for(const item of items){
        if(item.user?.login?.toLowerCase()!==login.toLowerCase())continue;
        const full=sourceRepo(item.repository_url);
        if(kind==="pr"){
          if(item.pull_request?.merged_at&&Date.parse(item.pull_request.merged_at)<Date.parse(item.created_at))throw Error("Merged public PR predates its opening: "+full+"#"+item.number);
          add("pr_opened",full,item.created_at,"pr-opened:"+full+"#"+item.number,item.html_url);
          if(item.pull_request?.merged_at)add("pr_merged",full,item.pull_request.merged_at,"pr-merged:"+full+"#"+item.number,item.html_url);
        }else add("issue_opened",full,item.created_at,"issue-opened:"+full+"#"+item.number,item.html_url);
      }
      if(received>=total)break;
      if(items.length===0)throw Error("GitHub public search page missing results; snapshot NOT written");
    }
    if(received!==total)throw Error("GitHub public "+kind+" search truncated; snapshot NOT written");
    totals[kind]=total;
  }
  await publicSearch("pr");
  await publicSearch("issue");

  const ownedPublic=new Map();
  for(let page=1;page<=100;page++){
    const items=await request("/users/"+encodeURIComponent(login)+"/repos?type=owner&per_page=100&page="+page);
    if(!Array.isArray(items))throw Error("Public repository listing malformed");
    for(const r of items){
      // Never let a token's enhanced permissions export a private repo.
      if(r.private!==false||r.visibility!=="public"||r.owner?.login?.toLowerCase()!==login.toLowerCase())continue;
      ownedPublic.set(r.full_name,r);
    }
    if(items.length<100)break;
    if(page===100)throw Error("Repository pagination limit reached; snapshot NOT written");
  }
  let scanned=0;
  const pages={};
  for(const full of [...ownedPublic.keys()].sort()){
    let count=0,number=0;
    for(let page=1;page<=100;page++){
      const route="/repos/"+full+"/commits?author="+encodeURIComponent(login)+"&since="+encodeURIComponent(from)+"&until="+encodeURIComponent(cutoff)+"&per_page=100&page="+page;
      const items=await request(route,{allowEmpty:true});
      if(!Array.isArray(items))throw Error("GitHub commits API response malformed");
      number++;
      for(const c of items){
        if(c.author?.login&&c.author.login.toLowerCase()!==login.toLowerCase())continue;
        const time=c.commit?.committer?.date;
        if(!time||typeof c.sha!=="string")continue;
        add("commit",full,time,"commit:"+full+":"+c.sha,c.html_url??"https://github.com/"+full+"/commit/"+c.sha);
        count++;
      }
      if(items.length<100)break;
      if(page===100)throw Error("Commit pagination limit for "+full+"; snapshot NOT written");
    }
    pages[full]={pages:number,records:count};
    scanned++;
  }
  const all=[...seen.values()].sort((a,b)=>a.occurred_at.localeCompare(b.occurred_at)||a.id.localeCompare(b.id));
  if(all.length>10000)throw Error("Snapshot exceeds shared contract 10,000-event cap; snapshot NOT written");
  return {
    schema_version:"1",
    source:"github",
    generated_at:cutoff,
    user:{login,url:"https://github.com/"+login},
    repositories:[...repositories.values()].sort((a,b)=>a.full_name.localeCompare(b.full_name)),
    activity:all,
    coverage:{
      kind:"public-observed-activity",
      start_utc:from,
      end_utc:cutoff,
      search_totals:totals,
      commit_repo_scan:{first_page_repositories:scanned,pages,more:[],errors:[],source:"GitHub REST public owned repository default-branch commits"},
      notes:[
        "Only is:public issue and pull request searches, plus repositories explicitly marked public, are used.",
        "Authored commits are from public owned default branches; feature-branch and external upstream commits may be missing.",
        "PR opening and merging are separate observed stages, not GitHub's official contribution counting.",
        "Partial, point-in-time observed event snapshot; not the official GitHub contributions calendar."
      ]
    },
    provenance:{
      pr_search:"https://github.com/pulls?q="+encodeURIComponent("author:"+login+" is:public"),
      issue_search:"https://github.com/issues?q="+encodeURIComponent("author:"+login+" is:public is:issue")
    }
  };
}
async function main(argv) {
  const here=dirname(fileURLToPath(import.meta.url));
  let since=null,output=resolve(here,"fixtures/adityasreevatsak-public-activity.json");
  for(let i=0;i<argv.length;i++){
    if(argv[i]==="--since"){if(!argv[i+1])throw Error("--since requires YYYY-MM-DD");since=argv[++i];}
    else if(argv[i]==="--output"){if(!argv[i+1])throw Error("--output requires a path");output=resolve(argv[++i]);}
    else if(argv[i]==="--help"){console.log("Usage: node refresh-public-activity.mjs [--since YYYY-MM-DD] [--output path]");return;}
    else throw Error("Unknown argument: "+argv[i]);
  }
  const snapshot=await collect({request:createRequester(process.env.GITHUB_TOKEN),since});
  await mkdir(dirname(output),{recursive:true});
  const temporary=output+"."+process.pid+".tmp";
  try {
    await writeFile(temporary,JSON.stringify(snapshot,null,2)+"\n",{encoding:"utf8",mode:0o600});
    await rename(temporary,output);
  } catch(error) {
    await unlink(temporary).catch(()=>{});
    throw error;
  }
  console.log("Saved "+snapshot.activity.length+" public source events across "+snapshot.repositories.length+" repositories to "+output);
  console.log("Snapshot captured "+snapshot.generated_at+". Not an official GitHub contributions total.");
}
export {collect,assertDate,sourceRepo};
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  main(process.argv.slice(2)).catch(error=>{console.error(String(error));process.exitCode=1;});
}
