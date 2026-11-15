// Agent Swarm core: deterministic event scheduling and dependency-free SVG renderer.
// No network calls, no AI inference and no GitHub write operations.
export const KIND_META = {
  "commit": {
    "label": "COMMIT",
    "glyph": "C",
    "colour": "#58d7bf"
  },
  "pr_opened": {
    "label": "PR OPENED",
    "glyph": "P+",
    "colour": "#83b7ff"
  },
  "pr_merged": {
    "label": "PR MERGED",
    "glyph": "PM",
    "colour": "#b69bff"
  },
  "issue_opened": {
    "label": "ISSUE",
    "glyph": "?",
    "colour": "#ffbd79"
  },
  "release": {
    "label": "RELEASE",
    "glyph": "R",
    "colour": "#ff91ab"
  }
};
export const REPO_COLOURS = ["#60dcc1","#8abaff","#e7a5ff","#ffbd84","#ff8fb2","#b8da70"];
export const PERIOD = 14;
export function assert(ok,message){if(!ok)throw Error(message)}

export function escapeXml(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));}

export function shortLabel(value,max=17){const chars=Array.from(String(value));return chars.length<=max?chars.join(""):chars.slice(0,max-1).join("")+"…";}

export function validTimestamp(value,field){assert(typeof value==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)&&!Number.isNaN(Date.parse(value)),field+" must be ISO 8601 UTC");return value;}

export function normaliseSnapshot(raw){
 assert(raw&&typeof raw==="object"&&!Array.isArray(raw),"Snapshot must be an object");
 assert(raw.schema_version==="1","Unsupported schema_version");
 assert(raw.source==="demo"||raw.source==="github","source must be demo or github");
 validTimestamp(raw.generated_at,"generated_at");
 assert(raw.user&&typeof raw.user.login==="string"&&raw.user.login.length<=120,"user.login missing or invalid");
 assert(Array.isArray(raw.repositories)&&Array.isArray(raw.activity),"repositories and activity must be arrays");
 assert(raw.repositories.length<=3000&&raw.activity.length<=100000,"Snapshot exceeds safety limit");
 const repos=[],seenRepos=new Set();
 for(const r of raw.repositories){
   assert(r&&typeof r==="object"&&typeof r.full_name==="string"&&r.full_name.length>0&&r.full_name.length<=240,"Repository full_name invalid");
   if(seenRepos.has(r.full_name))continue;
   seenRepos.add(r.full_name);
   const name=typeof r.name==="string"&&r.name.trim()?r.name:r.full_name.split("/").at(-1);
   assert(name.length<=240,"Repository name too long");
   const stars=Number.isSafeInteger(r.stars)&&r.stars>=0?r.stars:null;
   repos.push({full_name:r.full_name,name,language:typeof r.language==="string"?r.language.slice(0,70):"",stars});
 }
 const events=[],ids=new Set();
 for(const e of raw.activity){
   assert(e&&typeof e==="object"&&typeof e.id==="string"&&e.id.length>0&&e.id.length<=240,"Event id invalid");
   if(ids.has(e.id))continue;
   ids.add(e.id);
   assert(KIND_META[e.kind],"Unknown event kind: "+String(e.kind));
   assert(typeof e.repo_full_name==="string"&&seenRepos.has(e.repo_full_name),"Event references unknown repository");
   assert(Number.isSafeInteger(e.count)&&e.count>=1&&e.count<=100000000,"count must be a positive, bounded integer");
   validTimestamp(e.occurred_at,"occurred_at");
   events.push({id:e.id,kind:e.kind,repo_full_name:e.repo_full_name,occurred_at:e.occurred_at,count:e.count});
 }
 events.sort((a,b)=>a.occurred_at.localeCompare(b.occurred_at)||a.id.localeCompare(b.id));
 return {schema_version:"1",source:raw.source,generated_at:raw.generated_at,user:{login:raw.user.login},repositories:repos,activity:events};
}

export function makeScene(raw){
 const input=normaliseSnapshot(raw), events=input.activity, latest=new Map();
 for(const e of events)latest.set(e.repo_full_name,e.occurred_at);
 const ranked=[...input.repositories].sort((a,b)=>(latest.get(b.full_name)||"").localeCompare(latest.get(a.full_name)||"")||a.full_name.localeCompare(b.full_name));
 const repositories=ranked.slice(0,5).map((r,index)=>{
   const own=events.filter(e=>e.repo_full_name===r.full_name);
   return {...r,index,events:own.length,units:own.reduce((s,e)=>s+e.count,0)};
 });
 const chosen=new Set(repositories.map(r=>r.full_name));
 const eligible=events.filter(e=>chosen.has(e.repo_full_name));
 const visible=eligible.slice(-10);
 const spacing=visible.length>1?10.8/(visible.length-1):0;
 const jobs=visible.map((e,i)=>({id:e.id,kind:e.kind,repo_full_name:e.repo_full_name,repo_index:repositories.findIndex(r=>r.full_name===e.repo_full_name),count:e.count,occurred_at:e.occurred_at,start:Number((0.55+i*spacing).toFixed(4)),duration:2.2,agents:[(i%4)*2,(i%4)*2+1]}));
 const last=events.at(-1);
 const stale_days=last?Math.max(0,Math.floor((Date.parse(input.generated_at)-Date.parse(last.occurred_at))/86400000)):null;
 return {schema_version:"1",source:input.source,generated_at:input.generated_at,user:input.user,
         period:PERIOD,repository_total:input.repositories.length,event_total:events.length,
         eligible_total:eligible.length,repositories,jobs,shown:jobs.length,
         truncated:input.repositories.length>5||eligible.length>10,stale_days,
         note:"Visual metaphor only. Agents do not perform GitHub actions."};
}

export function phaseAt(job,t){
 const d=((t%PERIOD)+PERIOD)%PERIOD-job.start;
 if(d<0)return "queued";
 if(d<0.18)return "assigned";
 if(d<0.68)return "travelling";
 if(d<1.56)return "working";
 if(d<2.2)return "complete";
 return "delivered";
}

export function agentPosition(job,t,side=0,repoCount=5){
 const n=Math.max(1,repoCount),w=1036/n,cx=42+job.repo_index*w+(w-12)/2;
 const startx=125+job.agents[side]*113, starty=275;
 const endx=1002, endy=275;
 const hx=cx+(side===0?-22:22),hy=174+(side===0?-3:7);
 let d=((t%PERIOD)+PERIOD)%PERIOD-job.start;
 if(d<0.18)return {x:startx,y:starty};
 if(d<0.68){const k=(d-0.18)/0.5,q=k*k*(3-2*k);return{x:startx+(hx-startx)*q,y:starty+(hy-starty)*q-33*Math.sin(Math.PI*k)};}
 if(d<1.56)return{x:hx+Math.sin((d-0.68)*10+side)*2,y:hy+Math.cos((d-0.68)*12+side)*2};
 const k=Math.min(1,Math.max(0,(d-1.56)/0.64)),q=k*k*(3-2*k);
 return{x:hx+(endx-hx)*q,y:hy+(endy-hy)*q-32*Math.sin(Math.PI*k)};
}

export function timelineValues(job){
 const t=[0,job.start,job.start+.18,job.start+.68,job.start+1.56,job.start+2.2,PERIOD];
 return t.map(v=>(v/PERIOD).toFixed(6)).join(";");
}

export function renderSvg(scene,{style="geometric",theme="dark",animated=true,time=5.2}={}){
 assert(["geometric","robots"].includes(style),"style must be geometric or robots");
 assert(["dark","light"].includes(theme),"theme must be dark or light");
 const dark=theme==="dark",robot=style==="robots";
 const c=dark?{bg:"#091321",panel:"#101f31",panel2:"#172a40",text:"#edf8ff",muted:"#a1b9ca",line:"#29435b",grid:"#233c52",track:"#263e56"}
 :{bg:"#f6f2e9",panel:"#ffffff",panel2:"#e9eef0",text:"#203044",muted:"#51677b",line:"#bdcbd3",grid:"#e2e4df",track:"#c5d4d9"};
 const rect=(x,y,w,h,r=0,fill=c.panel,stroke="none",sw=1)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
 const txt=(x,y,s,size=12,fill=c.text,extra="")=>`<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${escapeXml(s)}</text>`;
 const line=(x,y,X,Y,stroke=c.line,width=1,dash="")=>`<path d="M ${x} ${y} L ${X} ${Y}" fill="none" stroke="${stroke}" stroke-width="${width}"${dash?` stroke-dasharray="${dash}"`:""}/>`;
 const n=scene.repositories.length, cellw=1036/Math.max(1,n), items=[];
 let s=`<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="350" viewBox="0 0 1120 350" role="img" aria-labelledby="swarm-title swarm-desc">
 <title id="swarm-title">Agent Swarm, ${robot?"miniature robots":"geometric choreography"}, ${escapeXml(theme)} theme</title>
 <desc id="swarm-desc">${scene.source==="demo"?"DEMONSTRATION DATA. ":""}A symbolic, deterministic fourteen-second replay of ${scene.shown} source-backed GitHub event packets across ${n} repository hubs. These agents are only a visual metaphor and do not carry out GitHub operations.</desc>
 <defs>
 <linearGradient id="swarm-bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${c.bg}"/><stop offset="1" stop-color="${dark?"#14253b":"#e9f0ec"}"/></linearGradient>
 <pattern id="dotfield" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.8" fill="${c.grid}"/></pattern>
 <filter id="softlight" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3"/></filter>
 </defs>
 <style>text{font-family:Segoe UI,Inter,Arial,sans-serif;font-weight:500} .micro{letter-spacing:1.5px;font-weight:700} .repo{font-weight:750} @media(prefers-reduced-motion:reduce){.motion-mark{display:none}}</style>
 ${rect(0,0,1120,350,0,"url(#swarm-bg)")}
 ${rect(0,0,1120,350,0,"url(#dotfield)")}
 ${rect(15,15,1090,320,18,"none",c.line)}
 ${txt(39,46,robot?"TINY OPERATIONS DEPT.":"AGENT / SWARM",23,c.text,'font-weight="800" letter-spacing="1.2"')}
 ${txt(40,66,robot?"Little robots. Real signals. Make-believe work.":"An orchestrated visualisation of repository activity",10.6,c.muted,'class="micro"')}
 ${rect(944,29,133,32,16,scene.source==="demo"?"#ffdf96":c.panel2)}
 ${txt(1010,49,scene.source==="demo"?"● DEMO DATA":"● GITHUB DATA",11,scene.source==="demo"?"#3b301e":c.text,'text-anchor="middle" font-weight="800"')}
 ${line(39,80,1080,80,c.line)}
 ${txt(42,97,robot?"WORKSHOP BAYS":"REPOSITORY HUBS",9.3,c.muted,'class="micro"')}
 ${txt(1077,97,`${scene.repository_total} REPOS · ${scene.event_total} EVENTS`,9.3,c.muted,'text-anchor="end" class="micro"')}
 `;
 if(n===0)s+=`${rect(43,105,1032,147,14,c.panel,c.line)}${txt(560,174,"Awaiting repositories",20,c.text,'text-anchor="middle"')}`;
 for(let i=0;i<n;i++){
   const repo=scene.repositories[i],x=42+i*cellw,w=cellw-12,colour=REPO_COLOURS[i%REPO_COLOURS.length];
   const cx=x+w/2;
   const reach=robot?13:18;
   s+=`<g class="hub" data-repository="${escapeXml(repo.full_name)}">
     ${rect(x,109,w,135,robot?18:10,c.panel,c.line,1)}
     ${robot?`${rect(x+7,117,w-14,17,7,c.panel2)}${rect(x+10,123,8,4,2,colour)}${rect(x+w-18,123,8,4,2,colour)}`:`${rect(x+11,121,w-22,2,1,colour)}`}
     <circle cx="${cx}" cy="165" r="${robot?31:34}" fill="${colour}" fill-opacity="${dark?".08":".11"}" stroke="${colour}" stroke-opacity=".5" stroke-dasharray="${robot?"5 5":"2 6"}"/>
     <circle cx="${cx}" cy="165" r="${reach}" fill="${colour}" fill-opacity=".15" stroke="${colour}" stroke-width="1.6"/>
     ${robot?`<path d="M ${cx-12} 165 l 6 -8 6 8 6 -8 6 8" fill="none" stroke="${colour}" stroke-width="2"/>`:`<path d="M ${cx} 151 L ${cx+14} 165 L ${cx} 179 L ${cx-14} 165 Z" fill="${colour}" fill-opacity=".75"/>`}
     ${txt(cx,211,shortLabel(repo.name,w>175?17:12),15,c.text,'text-anchor="middle" class="repo"')}
     ${txt(cx,229,`${repo.events} events · ${repo.units} units`,9.5,c.muted,'text-anchor="middle"')}
     </g>`;
   s+=`<path d="M ${cx} 245 Q ${cx+10} 263 ${cx} 269" fill="none" stroke="${colour}" stroke-opacity=".33" stroke-dasharray="3 6"/>`;
 }
 s+=`${rect(42,267,1036,35,12,c.panel,c.line,1)}${txt(55,289,robot?"ROBOT DOCK":"AGENT POOL",9,c.muted,'class="micro"')}`;
 for(let k=0;k<8;k++){
   const x=180+k*33;
   s+=robot?`${rect(x,278,13,13,4,c.panel2,c.muted)}<circle cx="${x+4}" cy="284" r="1.2" fill="${c.text}"/><circle cx="${x+9}" cy="284" r="1.2" fill="${c.text}"/>`
     :`<path d="M ${x+6} 276 L ${x+12} 284 L ${x+6} 292 L ${x} 284 Z" fill="${c.panel2}" stroke="${c.muted}" stroke-width="1"/>`;
 }
 s+=`${txt(1061,289,robot?"8 HELPER BOTS":"8 SYMBOLIC AGENTS",9,c.muted,'class="micro" text-anchor="end"')}`;
 if(scene.jobs.length===0){
   s+=`${txt(560,261,"NO OBSERVED EVENTS IN THIS SNAPSHOT",12,c.muted,'text-anchor="middle" class="micro"')}`;
 }
 function insideAgent(colour,side){
   if(robot)return `<g>
    <path d="M -10 -10 l -6 -5 m 26 5 l 6 -5 M 0 -12 v -8" stroke="${colour}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="0" cy="-21" r="2.5" fill="${colour}"/>
    <rect x="-13" y="-11" width="26" height="23" rx="7" fill="${dark?"#e0e8f3":"#ffffff"}" stroke="${colour}" stroke-width="2.4"/>
    <rect x="-7" y="-4" width="14" height="7" rx="3.5" fill="${dark?"#162a44":"#e3f2f4"}"/>
    <circle cx="-3.5" cy="-1" r="1.5" fill="${colour}"/><circle cx="3.5" cy="-1" r="1.5" fill="${colour}"/>
    <path d="M -7 12 l -3 4 M 7 12 l 3 4" stroke="${colour}" stroke-width="2.5" stroke-linecap="round"/>
    </g>`;
   return `<g><circle r="13" fill="${colour}" opacity=".15" filter="url(#softlight)"/>
   <path d="M -11 0 L 0 -11 L 11 0 L 0 11 Z" fill="${dark?"#0d1c2d":"#fff"}" stroke="${colour}" stroke-width="2.2"/>
   <circle r="3.5" fill="${colour}"/>
   <path d="M -17 0 H -12 M 12 0 H 17" stroke="${colour}" stroke-width="1.7" stroke-linecap="round"/></g>`;
 }
 for(const job of scene.jobs){
   const x=42+job.repo_index*cellw,w=cellw-12,cx=x+w/2,colour=KIND_META[job.kind].colour;
   const tm=timelineValues(job),vals=tm.split(";"),d=((time%PERIOD)+PERIOD)%PERIOD-job.start;
   const active=d>=0&&d<2.2,work=d>=.68&&d<1.56;
   const cardX=cx-48,cardY=121;
   const opacity=animated?0:active?1:0;
   s+=`<g opacity="${opacity}" class="task" data-event="${escapeXml(job.id)}">
     ${rect(cardX,cardY,96,22,11,c.panel2,colour,1.2)}
     ${txt(cx,136.5,`${KIND_META[job.kind].glyph} · ${job.count} unit${job.count===1?"":"s"}`,9.3,c.text,'text-anchor="middle" font-weight="700"')}
     <circle cx="${cx}" cy="165" r="41" fill="none" stroke="${colour}" stroke-width="2" stroke-dasharray="2 8" opacity="${work?1:.5}"/>
     ${animated?`<animate attributeName="opacity" values="0;0;1;1;1;0;0" keyTimes="${tm}" dur="${PERIOD}s" repeatCount="indefinite"/>`:""}
     </g>`;
   const barWidth=Math.round(w-28);
   s+=`<g opacity="${animated?0:active?1:0}">
     ${rect(x+14,235,barWidth,3,1,c.track)}
     ${rect(x+14,235,animated?0:barWidth*Math.min(1,Math.max(0,(d-.68)/.88)),3,1,colour)}
     ${animated?`<animate attributeName="opacity" values="0;0;1;1;1;0;0" keyTimes="${tm}" dur="${PERIOD}s" repeatCount="indefinite"/>`:""}
     </g>`;
   for(let side=0;side<2;side++){
     const aid=job.agents[side],startX=125+aid*113,startY=275;
     const hx=cx+(side===0?-22:22),hy=174+(side===0?-3:7);
     const endX=1002,endY=275;
     const path=`M ${startX} ${startY} Q ${(startX+hx)/2} ${Math.min(startY,hy)-76} ${hx} ${hy} Q ${(hx+endX)/2} ${Math.min(endY,hy)-74} ${endX} ${endY}`;
     const pos=agentPosition(job,time,side,n);
     const phase=phaseAt(job,time);
     if(animated){
       s+=`<g class="motion-mark" opacity="0" data-agent="${aid}" data-task="${escapeXml(job.id)}">
         ${insideAgent(colour,side)}
         <animateMotion path="${path}" dur="${PERIOD}s" repeatCount="indefinite" calcMode="linear"
         keyTimes="${tm}" keyPoints="0;0;0;0.5;0.5;1;1"/>
         <animate attributeName="opacity" dur="${PERIOD}s" repeatCount="indefinite"
         values="0;0;1;1;1;0;0" keyTimes="${tm}"/>
         </g>`;
     }else if(phase!=="queued"&&phase!=="delivered"){
       s+=`<g transform="translate(${pos.x.toFixed(2)} ${pos.y.toFixed(2)})">${insideAgent(colour,side)}</g>`;
     }
   }
 }
 const topCounts=Object.entries(KIND_META).map(([k,m])=>({m,n:scene.jobs.filter(j=>j.kind===k).length})).filter(x=>x.n);
 let lx=44;
 for(const {m,n:nk} of topCounts){
   s+=`<circle cx="${lx+4}" cy="321" r="3.5" fill="${m.colour}"/>${txt(lx+13,324,`${m.label} ${nk}`,9,c.muted)}`;
   lx+=m.label.length*6.8+48;
 }
 s+=`${txt(1076,324,"METAPHOR · NOT AUTONOMOUS ACTIONS",9,c.muted,'text-anchor="end" class="micro"')}`;
 if(scene.truncated)s+=`${txt(560,259,`SHOWING ${scene.shown}/${scene.eligible_total} LATEST EVENTS · ${n}/${scene.repository_total} REPOS`,9,c.muted,'text-anchor="middle" class="micro"')}`;
 if(scene.stale_days!==null&&scene.stale_days>30)s+=`${rect(795,54,133,18,9,dark?"#493c32":"#ffdfb8")}${txt(861,66,"STALE SNAPSHOT",8.5,dark?"#ffe8bb":"#65401d",'text-anchor="middle" class="micro"')}`;
 s+=`</svg>`;
 return s;
}
