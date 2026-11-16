const DeveloperWorld = (function developerWorld() {
"use strict";
const kinds=["commit","pr_opened","pr_merged","issue_opened","release"];
const colours={
 dark:{sky:"#14223b",sky2:"#2e4c64",sea:"#1a3859",water:"#315e73",wave:"#87b7b5",grass:"#629274",grass2:"#99bd83",shore:"#dfbd83",soil:"#746559",ink:"#f1f5e9",sub:"#b9c9c9",panel:"#1a2e47",line:"#67858d",roof:"#c77e74",roof2:"#e4ac71",wall:"#f0ddbd",brick:"#b69781",window:"#ffe9a7",tree:"#376452",tree2:"#a8c78b",sun:"#f8cb8a"},
 light:{sky:"#e5f3ee",sky2:"#b4dadd",sea:"#b7dddc",water:"#87c4c6",wave:"#e1fbf1",grass:"#a0c78b",grass2:"#cadd9e",shore:"#ecd39d",soil:"#9d836c",ink:"#2d4655",sub:"#54737d",panel:"#f7f8ed",line:"#97b9b5",roof:"#bb6e69",roof2:"#da955e",wall:"#fff0d6",brick:"#c9a588",window:"#f2be67",tree:"#4e8263",tree2:"#82ab6e",sun:"#e8b76d"}
};
const esc=x=>String(x).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
const check=(ok,message)=>{if(!ok)throw new Error(message);};
const utc=v=>typeof v==="string"&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(v)&&Number.isFinite(Date.parse(v));
const safeUrl=v=>typeof v==="string"&&v.length<=2048&&/^https:\/\/[a-z0-9][a-z0-9.-]*(?:[/:?#]|$)/i.test(v)?v:"";
function normalise(raw){
 check(raw&&typeof raw==="object"&&!Array.isArray(raw),"Invalid snapshot");
 check(raw.schema_version==="1","Unsupported schema version");
 check(raw.source==="demo"||raw.source==="github","Invalid source");
 check(utc(raw.generated_at),"Invalid generated_at");
 check(raw.user&&typeof raw.user.login==="string"&&raw.user.login.length<=150,"Invalid user");
 check(Array.isArray(raw.repositories)&&raw.repositories.length<=500,"Invalid repositories");
 check(Array.isArray(raw.activity)&&raw.activity.length<=20000,"Invalid activity");
 const names=new Set(), repositories=[];
 raw.repositories.forEach((r,i)=>{
  check(r&&typeof r.full_name==="string"&&r.full_name.length>0&&r.full_name.length<=220&&!/[\u0000-\u001f]/.test(r.full_name),"Invalid repository "+i);
  check(!names.has(r.full_name),"Duplicate repository "+r.full_name);
  names.add(r.full_name);
  repositories.push({full_name:r.full_name,name:typeof r.name==="string"&&r.name.length<=220?r.name:r.full_name.split("/").pop(),url:safeUrl(r.url),language:typeof r.language==="string"&&r.language.length<=40?r.language:""});
 });
 repositories.sort((a,b)=>a.full_name<b.full_name?-1:a.full_name>b.full_name?1:0);
 const ids=new Set(),activity=[];
 raw.activity.forEach((e,i)=>{
  check(e&&typeof e.id==="string"&&e.id.length>0&&e.id.length<=220,"Invalid event id "+i);
  if(ids.has(e.id))return;
  check(kinds.includes(e.kind)&&names.has(e.repo_full_name),"Invalid event kind/repository "+i);
  check(utc(e.occurred_at),"Invalid occurred_at "+i);
  check(Number.isSafeInteger(e.count)&&e.count>0&&e.count<=100000,"Invalid count "+i);
  ids.add(e.id);activity.push({id:e.id,kind:e.kind,repo_full_name:e.repo_full_name,occurred_at:e.occurred_at,count:e.count});
 });
 activity.sort((a,b)=>a.occurred_at.localeCompare(b.occurred_at)||a.id.localeCompare(b.id));
 return {source:raw.source,generated_at:raw.generated_at,user:{login:raw.user.login,url:safeUrl(raw.user.url)},repositories,activity};
}
const stage=n=>n>=10?4:n>=6?3:n>=3?2:n>=1?1:0;
function statsFor(data,progress){
 const max=progress===undefined?data.activity.length:Math.max(0,Math.min(data.activity.length,Math.trunc(progress)));
 const byName=new Map(data.repositories.map(repository=>[repository.full_name,{repository,units:0,commit:0,pr_opened:0,pr_merged:0,issue_opened:0,release:0,events:0,stage:0}]));
 for(const e of data.activity.slice(0,max)){const o=byName.get(e.repo_full_name);o[e.kind]+=e.count;o.units+=e.count;o.events++;}
 const repositories=[...byName.values()];repositories.forEach(o=>o.stage=stage(o.units));
 return {repositories,units:repositories.reduce((n,o)=>n+o.units,0),eventCount:max,totalEvents:data.activity.length};
}
function hash(s){let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
const R=(x,y,w,h,fill,rx=0,attr="")=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${attr}/>`;
const C=(x,y,r,fill,attr="")=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${attr}/>`;
const P=(d,fill,attr="")=>`<path d="${d}" fill="${fill}" ${attr}/>`;
const T=(x,y,t,size,fill,weight=500,attr="")=>`<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" ${attr}>${esc(t)}</text>`;
const G=(x,y,b,attr="")=>`<g transform="translate(${x} ${y})" ${attr}>${b}</g>`;
function sprig(x,y,p){return G(x,y,P("M0 0V-15M0-6q-9-10-14-6M0-9q8-13 14-9","none",`stroke="${p.tree}" stroke-width="2.2" stroke-linecap="round"`)+C(-11,-13,3,p.tree2)+C(11,-19,3,p.tree2));}
function flower(x,y,p,i){return G(x,y,P("M0 0v-10","none",`stroke="${p.tree}" stroke-width="2"`)+C(0,-13,4,i%2?p.roof:p.sun)+C(0,-13,1.5,p.wall));}
function tree(x,y,p){return G(x,y,P("M0 0v-13","none",`stroke="${p.soil}" stroke-width="4"`)+C(0,-19,12,p.tree)+C(-8,-19,8,p.tree2)+C(6,-25,7,p.tree2));}
function topBuilding(i,v,p){
 let b=R(-35,-13,70,46,p.wall,5,`stroke="${p.brick}" stroke-width="2"`),roof=i%2?p.roof:p.roof2;
 if(i===0)b+=C(0,-4,27,roof)+C(0,-4,19,p.brick)+P("M-17-4L0-22L17-4L0 14Z",p.roof2)+C(0,-4,6,p.window);
 if(i===1)b+=P("M-39-13L0-36L39-13L39 16L0 35L-39 16Z",roof)+P("M0-33V30","none",`stroke="${p.wall}" stroke-width="4"`)+R(-26,-9,15,21,p.window,2);
 if(i===2)b+=R(-40,-27,80,53,roof,5)+P("M-39-9H39M-39 8H39","none",`stroke="${p.brick}" stroke-width="3"`)+R(21,-37,13,16,p.brick,2)+C(27,-43,8,p.sub,`class="smoke" opacity=".5"`);
 if(i===3)b+=C(0,-4,26,roof)+C(0,-4,17,p.brick)+C(0,-4,11,p.window)+P("M0-4L25-30","none",`stroke="${p.ink}" stroke-width="3"`);
 if(i===4)b+=R(-38,-27,76,52,roof,6)+R(-28,-16,18,29,p.wall,2)+R(10,-16,18,29,p.wall,2)+P("M-36 4H36","none",`stroke="${p.brick}" stroke-width="3"`);
 if(v.stage>=1)b+=C(-24,22,4,p.window,`class="lamp"`)+C(24,22,4,p.window,`class="lamp"`);
 if(v.stage>=3)b+=P("M-37-32l11-13h52l11 13M-27-43h54","none",`stroke="${p.roof2}" stroke-width="4"`);
 if(v.stage>=4)b+=P("M0-32V-58","none",`stroke="${p.ink}" stroke-width="2"`)+P("M0-58l20 7-20 8Z",p.sun);
 if(v.commit>=3)for(let j=0;j<3;j++)b+=sprig(-45+j*9,26,p);
 if(v.pr_opened)b+=P("M39-30V20M54-30V20M39-17H54M39-1H54","none",`stroke="${p.sun}" stroke-width="3"`);
 if(v.pr_merged)b+=P("M-39 28Q0 43 39 28","none",`stroke="${p.brick}" stroke-width="5"`);
 if(v.issue_opened)b+=R(-53,-18,13,16,p.sun,2)+R(-50,-14,7,2,p.ink,1);
 if(v.release)b+=C(0,-4,36,"none",`stroke="${p.sun}" stroke-width="2" stroke-dasharray="4 9" class="beacon"`);
 return b;
}
function archipelago(values,p){
 let s=R(0,68,1120,215,"url(#water-gradient)");
 for(let i=0;i<48;i++){const x=12+hash("wa"+i)%1094,y=85+hash("wb"+i)%184;s+=P(`M${x} ${y}q7-3 14 0t14 0`,"none",`stroke="${p.wave}" stroke-width="1.7" opacity=".25" class="ripple" style="animation-delay:-${i%9}s"`);}
 const xs=[121,337,556,773,994],ys=[177,158,177,157,176];
 for(let i=0;i<values.length;i++){
  const v=values[i],x=xs[i],y=ys[i]+hash(v.repository.full_name)%7-3;
  s+=G(x,y+50,`<ellipse rx="80" ry="18" fill="${p.sea}" opacity=".5"/>`);
  let ground=P("M-78 5Q-89-16-65-38L-35-50Q-11-58 21-49L55-39Q78-27 79 2Q80 28 50 39L12 47L-31 42Q-66 34-78 5Z",p.shore);
  ground+=P("M-69 0Q-80-19-57-30L-27-41Q0-48 27-39L58-29Q71-18 69 1Q66 24 43 29L9 37L-29 31Q-57 27-69 0Z",p.grass,`stroke="${p.grass2}" stroke-width="2"`);
  ground+=tree(-49,-18,p)+tree(48,3,p)+flower(-48,20,p,i)+flower(45,-16,p,i+1);
  if(v.stage>=2)ground+=P("M-36 28Q0 49 35 27","none",`stroke="${p.shore}" stroke-width="6" stroke-dasharray="6 3"`);
  if(v.commit>=1)ground+=flower(29,24,p,i);
  ground+=topBuilding(i,v,p);
  s+=G(x,y,ground);
  if(v.pr_merged)s+=G(x+82,y+31,`<g class="boat" style="animation-delay:-${i}s">`+P("M-15 10h29l-7 8h-14Z",p.roof2)+P("M0 9V-15L15 8Z",p.wall)+"</g>");
 }
 if(!values.length)s+=T(560,182,"A quiet sea, waiting for its first repository",18,p.ink,600,`text-anchor="middle"`);
 return s;
}
function house(i,v,p){
 const top=-100-(v.stage>=3?18:0),roof=i%2?p.roof:p.roof2;
 let b=`<ellipse cy="4" rx="76" ry="10" fill="${p.soil}" opacity=".3"/>`+R(-46,0,92,9,p.brick,3)+R(-51,9,102,5,p.shore,2);
 if(i===0)b+=R(-31,top+24,62,-top-24,p.wall,4)+P(`M-41 ${top+25}L0 ${top-5}L41 ${top+25}Z`,roof)+R(-15,top+43,30,18,p.brick,3);
 if(i===1)b+=R(-38,top+24,76,-top-24,p.wall,4)+P(`M-49 ${top+27}L-26 ${top-8}H28L49 ${top+27}Z`,roof)+R(-28,top+40,17,19,p.window,3)+R(11,top+40,17,19,p.window,3);
 if(i===2)b+=R(-41,top+15,82,-top-15,p.wall,5)+P(`M-50 ${top+18}L-36 ${top-8}H36L50 ${top+18}Z`,roof)+R(27,top-27,13,26,p.brick,2)+C(33,top-33,8,p.sub,`class="smoke" opacity=".5"`);
 if(i===3)b+=R(-33,top+25,66,-top-25,p.wall,4)+P(`M-40 ${top+25}Q-32 ${top-19}0 ${top-21}Q32 ${top-19}40 ${top+25}Z`,roof)+C(0,top+7,17,p.brick)+C(0,top+7,11,p.window)+P(`M0 ${top+7}l24-20`,"none",`stroke="${p.ink}" stroke-width="3"`);
 if(i===4)b+=R(-40,top+30,80,-top-30,p.wall,4)+P(`M-50 ${top+32}L-26 ${top}H30L50 ${top+32}Z`,roof)+R(-30,top+43,19,21,p.window,3)+R(11,top+43,19,21,p.window,3);
 b+=R(-11,-40,22,40,p.brick,4)+R(-7,-35,14,35,p.roof2,3)+C(3,-17,2,p.ink);
 b+=R(-30,-61,14,16,v.stage>=1?p.window:p.sub,3,`class="${v.stage>=1?"lamp":""}"`)+R(17,-61,14,16,v.stage>=1?p.window:p.sub,3,`class="${v.stage>=1?"lamp":""}"`);
 if(v.stage>=2)b+=flower(-58,1,p,i)+flower(58,1,p,i+1)+P("M-53 0l-13 8M53 0l13 8","none",`stroke="${p.shore}" stroke-width="6"`);
 if(v.stage>=4)b+=P(`M0 ${top}V${top-38}`,"none",`stroke="${p.ink}" stroke-width="2"`)+P(`M0 ${top-38}l20 7-20 8Z`,p.sun);
 if(v.commit>=3)b+=sprig(-72,1,p)+sprig(72,1,p);
 if(v.pr_opened)b+=P("M43-7V-79M61-7V-79M43-55H61M43-30H61","none",`stroke="${p.sun}" stroke-width="3"`);
 if(v.pr_merged)b+=P("M-50-9L-69-20L-85-9","none",`stroke="${p.brick}" stroke-width="4"`)+C(-69,-20,4,p.sun);
 if(v.issue_opened)b+=R(42,-41,17,20,p.brick,2)+R(45,-38,11,13,p.sun,1);
 if(v.release)b+=C(0,top-18,29,"none",`stroke="${p.sun}" stroke-width="2" stroke-dasharray="4 8" class="beacon"`);
 return b;
}
function cloud(x,y,p,n){return `<g class="cloud" style="animation-delay:-${n}s" opacity=".35">`+C(x,y,18,p.wall)+C(x+18,y-9,23,p.wall)+C(x+39,y,15,p.wall)+R(x,y,40,12,p.wall,6)+"</g>";}
function village(values,p){
 let s=R(0,68,1120,215,"url(#sky-gradient)")+C(1020,112,30,p.sun)+C(1020,112,45,"none",`stroke="${p.sun}" opacity=".25" stroke-width="2"`);
 s+=cloud(107,116,p,2)+cloud(596,112,p,8)+cloud(871,147,p,14);
 s+=P("M0 236Q135 160 270 231T560 222T870 216T1120 198V281H0Z",p.grass2,`opacity=".55"`);
 s+=P("M0 253Q150 209 270 241T552 231T862 240T1120 232V281H0Z",p.grass);
 s+=R(0,236,1120,47,p.grass)+P("M0 237H1120","none",`stroke="${p.grass2}" stroke-width="5"`);
 for(let j=0;j<43;j++){const x=10+hash("blade-"+j)%1100;s+=P(`M${x} 270l-4-10m4 10l5-13`,"none",`stroke="${p.tree}" stroke-width="1.6" opacity=".3"`);}
 const xs=[118,337,556,775,994];
 values.forEach((v,i)=>{s+=G(xs[i],235,house(i,v,p));if(i<values.length-1)s+=P(`M${xs[i]+76} 237Q${xs[i]+108} 246 ${xs[i]+136} 237`,"none",`stroke="${p.shore}" stroke-width="5" stroke-dasharray="9 6"`);});
 if(!values.length)s+=T(560,177,"A quiet village, waiting for its first repository",18,p.ink,600,`text-anchor="middle"`);
 return s;
}
function render(raw,options={}){
 const data=normalise(raw),layout=options.layout||"archipelago",theme=options.theme||"dark";
 check(layout==="archipelago"||layout==="village","Invalid layout");
 check(theme==="dark"||theme==="light","Invalid theme");
 if(options.progress!==undefined)check(Number.isSafeInteger(options.progress)&&options.progress>=0,"Invalid progress");
 const p=colours[theme],f=statsFor(data,options.progress),items=f.repositories.slice(0,5),hidden=f.repositories.length-items.length;
 const title=layout==="archipelago"?"The Isles of Making":"The Little Buildtown",label=data.source==="demo"?"DEMO DATA • FICTIONAL ACTIVITY":"PUBLIC GITHUB SNAPSHOT";
 let s=`<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="350" viewBox="0 0 1120 350" role="img" aria-labelledby="dw-title dw-desc">`;
 s+=`<title id="dw-title">${esc(title)} | Developer World</title><desc id="dw-desc">${data.source==="demo"?"Synthetic demonstration. ":"Public GitHub data. "}${f.eventCount} of ${f.totalEvents} distinct recorded events, ${f.units} source-backed activity units. ${esc(items.map(o=>o.repository.full_name+": "+o.units+" units at growth stage "+o.stage).join("; "))}.${hidden?" "+hidden+" further repositories omitted.":""}</desc>`;
 s+=`<defs><linearGradient id="water-gradient" x2="0" y2="1"><stop stop-color="${p.sea}"/><stop offset="1" stop-color="${p.water}"/></linearGradient><linearGradient id="sky-gradient" x2="0" y2="1"><stop stop-color="${p.sky}"/><stop offset="1" stop-color="${p.sky2}"/></linearGradient><clipPath id="dw-clip">${R(0,0,1120,350,"white",17)}</clipPath></defs>`;
 s+=`<style>text{font-family:'Trebuchet MS',Verdana,Arial,sans-serif;letter-spacing:.15px}.lamp{animation:lamp 3.2s ease-in-out infinite}.ripple{animation:ripple 5s ease-in-out infinite}.cloud{animation:cloud 17s ease-in-out infinite alternate}.boat{animation:boat 6s ease-in-out infinite alternate}.beacon{animation:beacon 5s linear infinite;transform-box:fill-box;transform-origin:center}.smoke{animation:smoke 4s ease-in-out infinite}@keyframes lamp{50%{opacity:.65}}@keyframes ripple{50%{opacity:.1;transform:translateX(6px)}}@keyframes cloud{from{transform:translateX(-12px)}to{transform:translateX(23px)}}@keyframes boat{from{transform:translateX(-7px)}to{transform:translateX(10px)}}@keyframes beacon{to{transform:rotate(360deg)}}@keyframes smoke{50%{opacity:.15;transform:translateY(-5px)}}${options.animated===false?"*{animation:none!important}":""}@media(prefers-reduced-motion:reduce){*{animation:none!important}}</style>`;
 s+=`<g clip-path="url(#dw-clip)">`+R(0,0,1120,350,p.panel,17)+R(0,0,1120,68,p.sky);
 s+=T(30,28,"DEVELOPER WORLD",11,p.sun,800,`letter-spacing="2.5"`)+T(30,55,title,24,p.ink,800);
 s+=T(1090,25,label,10,p.sun,800,`letter-spacing="1.3" text-anchor="end"`)+T(1090,49,`${f.eventCount}/${f.totalEvents} events  ·  ${f.units} activity units`,12,p.sub,500,`text-anchor="end"`);
 s+=layout==="archipelago"?archipelago(items,p):village(items,p);
 s+=R(0,283,1120,67,p.panel)+P("M0 283H1120","none",`stroke="${p.line}" stroke-width="1" opacity=".6"`);
 items.forEach((o,i)=>{const x=24+i*219,n=o.repository.name.length>18?o.repository.name.slice(0,16)+"…":o.repository.name;
 s+=C(x+6,306,5,[p.roof,p.roof2,p.tree2,p.sun,p.wave][i])+T(x+19,311,n,13,p.ink,750)+T(x+19,331,`${o.units} units · growth ${o.stage}/4`,11,p.sub);});
 s+=T(1090,348,hidden?`+${hidden} repositories not shown`:data.source==="demo"?"SYNTHETIC FIXTURE":"SOURCE-BACKED INPUT",9,p.sub,650,`text-anchor="end" letter-spacing=".7"`);
 return s+"</g></svg>";
}
function calendarFor(data,progress){
 const seen=Math.min(data.activity.length,progress===undefined?data.activity.length:progress);
 const asof=data.generated_at.slice(0,10), dayMs=86400000;
 const anchor=Date.parse(asof+"T00:00:00Z");
 const sunday=anchor-new Date(anchor).getUTCDay()*dayMs;
 const first=sunday-52*7*dayMs;
 const cells=[], lookup=new Map();
 for(let w=0;w<53;w++)for(let d=0;d<7;d++){
  const time=first+(w*7+d)*dayMs,date=new Date(time).toISOString().slice(0,10);
  const item={date,w,d,future:date>asof,units:0,events:0,byKind:{commit:0,pr_opened:0,pr_merged:0,issue_opened:0,release:0},byRepo:{},level:0};
  cells.push(item);lookup.set(date,item);
 }
 let outside=0;
 for(const e of data.activity.slice(0,seen)){
  const date=e.occurred_at.slice(0,10),cell=lookup.get(date);
  if(!cell||cell.future){outside++;continue;}
  cell.units+=e.count;cell.events++;cell.byKind[e.kind]+=e.count;cell.byRepo[e.repo_full_name]=(cell.byRepo[e.repo_full_name]||0)+e.count;
 }
 for(const cell of cells)cell.level=stage(cell.units);
 const all=new Map();
 for(const e of data.activity){
  const date=e.occurred_at.slice(0,10),cell=lookup.get(date);
  if(!cell||cell.future)continue;
  let dates=all.get(e.repo_full_name);
  if(!dates){dates=new Map();all.set(e.repo_full_name,dates);}
  dates.set(date,(dates.get(date)||0)+e.count);
 }
 const anchors=new Map(),taken=new Set();
 data.repositories.slice(0,5).forEach(r=>{
  const ranked=[...(all.get(r.full_name)||new Map()).entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  const match=ranked.find(([date])=>!taken.has(date));
  if(match){anchors.set(r.full_name,match[0]);taken.add(match[0]);}
 });
 return {cells,lookup,anchors,first,asof,seen,outside,observed:cells.reduce((s,c)=>s+c.units,0),activeDays:cells.filter(c=>c.units>0).length};
}
function calendarRender(raw,options={}){
 const data=normalise(raw),layout=options.layout||"archipelago",theme=options.theme||"dark";
 check(layout==="archipelago"||layout==="village","Invalid layout");
 check(theme==="light"||theme==="dark","Invalid theme");
 if(options.progress!==undefined)check(Number.isSafeInteger(options.progress)&&options.progress>=0,"Invalid progress");
 const grid=calendarFor(data,options.progress),totals=statsFor(data,options.progress);
 const p=colours[theme],arch=layout==="archipelago",dark=theme==="dark",isDemo=data.source==="demo";
 const visible=data.repositories.slice(0,5),overflow=data.repositories.length-visible.length;
 const x0=68,y0=99,dx=19,dy=21,tw=15,th=16;
 const palette=dark?{base:"#102b42",panel:"#182d42",stroke:"#3f7081",dim:"#2a475a",sea:"#163e58",wave:"#4c8094",sand:"#d9bd86",grass:"#83b880",grass2:"#b3d797",bright:"#eacb91",wall:"#f0dcba",roof:"#c87773",shade:"#14283f",text:"#f1f5ed",muted:"#a8c6cb",sky:"#274d65",gold:"#f8d78d",water:"#24495f",path:"#d9d0a8"}:{base:"#e7f2ed",panel:"#fcf9ed",stroke:"#a3c7c5",dim:"#cdded7",sea:"#b6d8d5",wave:"#7caeac",sand:"#efd9a5",grass:"#a1c985",grass2:"#d1df9b",bright:"#d79069",wall:"#fff3d9",roof:"#b86f6b",shade:"#567179",text:"#304b53",muted:"#618188",sky:"#d6eae7",gold:"#d68a54",water:"#cce8e2",path:"#cfb992"};
 const repoColours=["#f8c77e","#89cfaa","#ed9d9b","#97bce9","#d8b6e8"];
 const out=[];
 const rect=(x,y,w,h,fill,rx=0,other="")=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${other}/>`;
 const line=(d,stroke,width=1,extra="")=>`<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
 const path=(d,fill,extra="")=>`<path d="${d}" fill="${fill}" ${extra}/>`;
 const circle=(x,y,r,fill,extra="")=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
 const textAt=(x,y,value,size=11,fill=palette.text,weight=600,extra="")=>`<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" ${extra}>${esc(value)}</text>`;
 out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1120 350" width="1120" height="350" role="img" aria-labelledby="dw-title dw-desc">`);
 out.push(`<title id="dw-title">Developer World: ${arch?"The Isles of Code":"The Little Buildtown"} contribution calendar</title>`);
 out.push(`<desc id="dw-desc">${isDemo?"Synthetic demonstration. ":"Supplied public GitHub event snapshot. "}53 weeks by 7 weekdays ending ${esc(grid.asof)}; ${grid.activeDays} days with recorded events; ${grid.observed} activity units shown. Empty cells mean no events recorded in this snapshot, not proof of zero GitHub contributions. ${overflow} repositories omitted.</desc>`);
 out.push(`<defs><linearGradient id="dw-bg" x2="0" y2="1"><stop stop-color="${palette.sky}"/><stop offset="1" stop-color="${palette.base}"/></linearGradient><linearGradient id="dw-sea" x2="0" y2="1"><stop stop-color="${palette.sea}"/><stop offset="1" stop-color="${palette.water}"/></linearGradient><clipPath id="dw-mask">${rect(0,0,1120,350,"white",16)}</clipPath></defs>`);
 out.push(`<style>text{font-family:Trebuchet MS,Verdana,Arial,sans-serif}.dw-wave{animation:dw-wave 7s ease-in-out infinite alternate}.dw-lantern{animation:dw-glow 3s ease-in-out infinite alternate}.dw-cloud{animation:dw-drift 16s ease-in-out infinite alternate}.dw-boat{animation:dw-sail 8s ease-in-out infinite alternate}.dw-smoke{animation:dw-smoke 5s ease-out infinite}.dw-tile{transition:opacity .2s}.dw-tile:hover{opacity:.75}@keyframes dw-wave{to{transform:translateX(8px);opacity:.35}}@keyframes dw-glow{to{opacity:.55}}@keyframes dw-drift{to{transform:translateX(14px)}}@keyframes dw-sail{to{transform:translateX(11px)}}@keyframes dw-smoke{to{transform:translateY(-9px);opacity:0}}${options.animated===false?"*{animation:none!important;transition:none!important}":""}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}</style>`);
 out.push(`<g clip-path="url(#dw-mask)">`);
 out.push(rect(0,0,1120,350,"url(#dw-bg)"));
 out.push(rect(0,0,1120,61,palette.panel));
 out.push(rect(0,61,1120,211,arch?"url(#dw-sea)":palette.sky));
 if(arch){
  for(let i=0;i<36;i++){
   const wx=32+hash("sea-wave-"+i)%1050, wy=83+hash("sea-row-"+i)%178;
   out.push(line(`M${wx} ${wy}q5 -3 11 0t10 0`,palette.wave,1,`opacity=".35" class="dw-wave" style="animation-delay:-${i%11}s"`));
  }
 }else{
  out.push(path("M0 188Q78 167 152 191T305 191T465 187T635 190T795 181T950 187T1120 178V271H0Z",palette.grass2,`opacity=".25"`));
  for(let i=0;i<16;i++){
   const cx=18+hash("cloud-x"+i)%1080,cy=90+hash("cloud-y"+i)%148;
   if(i%4===0)out.push(`<g class="dw-cloud" opacity=".14" style="animation-delay:-${i}s">${circle(cx,cy,12,palette.wall)}${circle(cx+13,cy-7,15,palette.wall)}${rect(cx,cy,28,6,palette.wall,3)}</g>`);
  }
 }
 out.push(textAt(29,20,"GITHUB ACTIVITY STUDIO  /  CONCEPT 05",9,palette.gold,800,`letter-spacing="1.9"`));
 out.push(textAt(29,46,arch?"The Isles of Code":"The Little Buildtown",22,palette.text,800));
 out.push(textAt(1090,22,isDemo?"SYNTHETIC DEMO  •  NOT REAL ACTIVITY":"RECORDED PUBLIC EVENTS",10,palette.gold,800,`text-anchor="end" letter-spacing="1"`));
 out.push(textAt(1090,44,`${grid.activeDays} active dates  ·  ${grid.observed} recorded units  ·  ${grid.seen}/${data.activity.length} events`,11,palette.muted,500,`text-anchor="end"`));
 const monthLabels=[];
 for(let w=0;w<53;w++){
  const sunday=new Date(grid.first+w*7*86400000), thursday=new Date(grid.first+(w*7+4)*86400000);
  const month=thursday.toLocaleString("en-GB",{timeZone:"UTC",month:"short"});
  if(!w||month!==monthLabels.at(-1)?.month)monthLabels.push({w,month});
 }
 for(const m of monthLabels)out.push(textAt(x0+m.w*dx,87,m.month,9,palette.muted,700));
 for(const [d,name] of [[0,"Sun"],[2,"Tue"],[4,"Thu"],[6,"Sat"]])out.push(textAt(19,y0+d*dy+12,name,9,palette.muted,600));
 const landmarkByDate=new Map();
 for(const [name,date] of grid.anchors){
  const i=visible.findIndex(r=>r.full_name===name);
  if(i>=0)landmarkByDate.set(date,{index:i,name});
 }
 const activeFill=[palette.dim,palette.sand,palette.grass2,palette.grass,palette.bright];
 // Tiles are strictly arranged in Sunday-to-Saturday rows and chronological week columns.
 for(const cell of grid.cells){
  const x=x0+cell.w*dx,y=y0+cell.d*dy,level=cell.level;
  const marks=Object.entries(cell.byRepo).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  const description=`${cell.date}: ${cell.units} recorded units from ${cell.events} distinct events${marks.length?"; "+marks.map(([k,v])=>k+" "+v).join(", "):"; no event recorded"}${cell.future?"; after snapshot":""}`;
  out.push(`<g class="dw-tile" data-date="${cell.date}" data-level="${level}" data-units="${cell.units}" role="img" aria-label="${esc(description)}"><title>${esc(description)}</title>`);
  if(cell.future){
   out.push(rect(x,y,tw,th,palette.dim,3,`opacity=".23" stroke="${palette.stroke}" stroke-width=".7"`));
   out.push(line(`M${x+4} ${y+5}l7 7`,palette.stroke,.8,`opacity=".5"`));
  }else if(arch){
   out.push(rect(x,y,tw,th,level?palette.wave:palette.sea,3,`stroke="${palette.stroke}" stroke-width=".7" opacity="${level?1:.84}"`));
   if(!level){
    if((hash(cell.date)%5)===0)out.push(line(`M${x+3} ${y+10}q3-2 6 0`,palette.wave,.9,`opacity=".5" class="dw-wave"`));
   }else{
    out.push(path(`M${x+3} ${y+4}l5-2 4 3 1 6-5 3-5-2-1-5Z`,activeFill[level]));
    if(level>=2)out.push(rect(x+5,y+5,5,6,palette.grass,1));
    if(level===2)out.push(circle(x+10,y+7,1.8,palette.grass2));
    if(level>=3){
     out.push(rect(x+4,y+6,8,6,palette.wall,1));
     out.push(path(`M${x+3} ${y+6}l5-4 5 4Z`,palette.roof));
     out.push(rect(x+7,y+8,2,3,palette.gold,.5,`class="dw-lantern"`));
    }
    if(level>=4)out.push(line(`M${x+11} ${y+4}v-4`,palette.wall,1.2)+path(`M${x+11} ${y}l4 1-4 2Z`,palette.gold));
   }
  }else{
   out.push(rect(x,y,tw,th,level?palette.grass:palette.dim,2,`stroke="${palette.stroke}" stroke-width=".8" opacity="${level?1:.7}"`));
   out.push(rect(x,y+12,tw,4,level?palette.sand:palette.shade,1,`opacity=".7"`));
   if(!level){
    if(hash(cell.date)%4===0)out.push(line(`M${x+5} ${y+11}l-1-2m1 2l2-3`,palette.muted,.7,`opacity=".7"`));
   }else if(level===1){
    out.push(line(`M${x+3} ${y+11}v-5m0 2l-2-2m2 2l2-2`,palette.grass2,1.5));
    out.push(circle(x+11,y+9,2,palette.gold));
   }else if(level===2){
    out.push(rect(x+3,y+7,9,5,palette.wall,1));
    out.push(path(`M${x+2} ${y+7}l6-5 6 5Z`,palette.roof));
    out.push(circle(x+11,y+11,1.5,palette.gold,`class="dw-lantern"`));
   }else{
    out.push(rect(x+3,y+5,9,8,palette.wall,1));
    out.push(path(`M${x+2} ${y+5}l6-5 6 5Z`,palette.roof));
    out.push(rect(x+6,y+7,3,3,palette.gold,.7,`class="dw-lantern"`));
    if(level===4){out.push(rect(x+10,y+1,2,4,palette.shade)+circle(x+11,y,2,palette.gold,`class="dw-smoke"`));}
   }
  }
  // Event-specific decorations are sourced exclusively from each UTC day's actual events.
  if(cell.units){
   const k=cell.byKind;
   if(k.release)out.push(circle(x+2,y+3,2,palette.gold,`class="dw-lantern"`));
   else if(k.pr_merged)out.push(path(`M${x+1} ${y+14}l3-3 3 3 3-3 3 3`, "none",`stroke="${palette.wall}" stroke-width="1.3"`));
   else if(k.pr_opened)out.push(line(`M${x+1} ${y+3}h4m-2-2v5`,palette.gold,1.3));
   else if(k.issue_opened)out.push(rect(x+1,y+1,3,4,palette.gold,.6));
   else if(k.commit>=3)out.push(circle(x+2,y+3,1.5,palette.grass2));
   const mark=landmarkByDate.get(cell.date);
   if(mark && (cell.byRepo[mark.name]||0)>0){
    const mx=x+11,my=y+2;
    out.push(circle(mx,my,4.4,repoColours[mark.index],`stroke="${palette.shade}" stroke-width="1"`));
    out.push(textAt(mx,my+2,String(mark.index+1),6,palette.shade,900,`text-anchor="middle"`));
   }
  }
  out.push("</g>");
 }
 // The environment is atmospheric. Only populated date cells indicate recorded activity.
 if(arch){
  out.push(`<g class="dw-boat" opacity=".92">${path("M24 243h24l-6 7H30Z",palette.roof)}${line("M37 243v-17",palette.wall,1.4)}${path("M38 228l11 12H38Z",palette.wall)}</g>`);
  out.push(`<g class="dw-boat" style="animation-delay:-3s" opacity=".68">${path("M1082 93h21l-5 6h-10Z",palette.roof)}${line("M1092 93v-15",palette.wall,1.4)}${path("M1093 79l9 11h-9Z",palette.wall)}</g>`);
 }else{
  out.push(line("M7 258Q145 252 285 258T565 258T845 258T1113 258",palette.sand,2,`opacity=".5"`));
 }
 out.push(rect(0,272,1120,78,palette.panel));
 out.push(line("M0 272H1120",palette.stroke,1));
 visible.forEach((r,i)=>{
  const xx=24+i*218,st=totals.repositories.find(s=>s.repository.full_name===r.full_name);
  out.push(rect(xx,284,207,54,theme==="dark"?"#223b50":"#f5f3e6",8,`stroke="${palette.stroke}" stroke-width=".7"`));
  out.push(circle(xx+16,302,9,repoColours[i]));
  out.push(textAt(xx+16,305,String(i+1),10,palette.shade,900,`text-anchor="middle"`));
  const name=r.name.length>19?r.name.slice(0,17)+"…":r.name;
  out.push(textAt(xx+31,303,name,12,palette.text,750));
  out.push(textAt(xx+31,320,`${st.units} units · ${st.events} events · stage ${st.stage}`,10,palette.muted,500));
  out.push(textAt(xx+31,332,grid.anchors.has(r.full_name)?"Landmark on recorded day":"No in-range landmark",8,palette.muted,500));
 });
 if(!visible.length)out.push(textAt(560,315,"A quiet world awaits its first recorded event",15,palette.muted,600,`text-anchor="middle"`));
 out.push(textAt(1090,347,overflow?`+${overflow} repositories omitted`:grid.outside?`${grid.outside} events outside calendar window`:"53 weeks · Sunday to Saturday",8,palette.muted,500,`text-anchor="end"`));
 out.push("</g></svg>");
 return out.join("");
}
return {normalise,statsFor,stage,render:calendarRender,calendarFor,esc};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = DeveloperWorld;
else if (typeof globalThis !== 'undefined') globalThis.DeveloperWorld = DeveloperWorld;
