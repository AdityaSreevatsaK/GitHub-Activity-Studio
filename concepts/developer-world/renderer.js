const DeveloperWorld = (function developerWorld() {
"use strict";
const kinds=["commit","pr_opened","pr_merged","issue_opened","release"];
const colours={
 dark:{sky:"#14223b",sky2:"#2e4c64",sea:"#1a3859",water:"#315e73",wave:"#87b7b5",grass:"#629274",grass2:"#99bd83",shore:"#dfbd83",soil:"#746559",ink:"#f1f5e9",sub:"#b9c9c9",panel:"#1a2e47",line:"#67858d",roof:"#c77e74",roof2:"#e4ac71",wall:"#f0ddbd",brick:"#b69781",window:"#ffe9a7",tree:"#376452",tree2:"#a8c78b",sun:"#f8cb8a"},
 light:{sky:"#e5f3ee",sky2:"#b4dadd",sea:"#b7dddc",water:"#87c4c6",wave:"#e1fbf1",grass:"#a0c78b",grass2:"#cadd9e",shore:"#ecd39d",soil:"#9d836c",ink:"#2d4655",sub:"#54737d",panel:"#f7f8ed",line:"#97b9b5",roof:"#bb6e69",roof2:"#da955e",wall:"#fff0d6",brick:"#c9a588",window:"#f2be67",tree:"#4e8263",tree2:"#82ab6e",sun:"#e8b76d"}
};
const esc=x=>String(x).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
const check=(ok,message)=>{if(!ok)throw new Error(message);};
const utc=v=>typeof v==="string"&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(Date.parse(v)).toISOString().slice(0,19)===v.slice(0,19);
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
function calendarFor(data,progress){
 const seen=Math.min(data.activity.length,progress===undefined?data.activity.length:progress);
 const asof=data.generated_at.slice(0,10), dayMs=86400000;
 const anchor=Date.parse(asof+"T00:00:00Z");
 const sunday=anchor-new Date(anchor).getUTCDay()*dayMs;
 const first=sunday-52*7*dayMs;
 const cells=[], lookup=new Map(),byRepo=new Map(data.repositories.map(r=>[r.full_name,{units:0,events:0}]));
 for(let w=0;w<53;w++)for(let d=0;d<7;d++){
  const time=first+(w*7+d)*dayMs,date=new Date(time).toISOString().slice(0,10);
  const item={date,w,d,future:date>asof,units:0,events:0,byKind:{commit:0,pr_opened:0,pr_merged:0,issue_opened:0,release:0},byRepo:{},level:0};
  cells.push(item);lookup.set(date,item);
 }
 let outside=0;
 for(const e of data.activity.slice(0,seen)){
  const date=e.occurred_at.slice(0,10),cell=lookup.get(date);
  if(!cell||cell.future||e.occurred_at>data.generated_at){outside++;continue;}
  cell.units+=e.count;cell.events++;cell.byKind[e.kind]+=e.count;cell.byRepo[e.repo_full_name]=(cell.byRepo[e.repo_full_name]||0)+e.count;
  const observed=byRepo.get(e.repo_full_name);observed.units+=e.count;observed.events++;
 }
 for(const cell of cells)cell.level=stage(cell.units);
 const all=new Map();
 for(const e of data.activity){
  const date=e.occurred_at.slice(0,10),cell=lookup.get(date);
  if(!cell||cell.future||e.occurred_at>data.generated_at)continue;
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
 return {cells,lookup,anchors,byRepo,first,asof,seen,outside,observed:cells.reduce((s,c)=>s+c.units,0),activeDays:cells.filter(c=>c.units>0).length};
}
function calendarRender(raw,options={}){
 const data=normalise(raw),layout=options.layout||"archipelago",theme=options.theme||"dark";
 check(layout==="archipelago"||layout==="village","Invalid layout");
 check(theme==="light"||theme==="dark","Invalid theme");
 if(options.progress!==undefined)check(Number.isSafeInteger(options.progress)&&options.progress>=0,"Invalid progress");
 const frame=options.frame===undefined?0:options.frame;
 check(Number.isSafeInteger(frame)&&frame>=0&&frame<=10000,"Invalid animation frame");
 const grid=calendarFor(data,options.progress);
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
   const wx=32+(hash("sea-wave-"+i)%1050+frame*3)%1050, wy=83+hash("sea-row-"+i)%178;
   out.push(line(`M${wx} ${wy}q5 -3 11 0t10 0`,palette.wave,1,`opacity=".35" class="dw-wave" style="animation-delay:-${i%11}s"`));
  }
 }else{
  out.push(path("M0 188Q78 167 152 191T305 191T465 187T635 190T795 181T950 187T1120 178V271H0Z",palette.grass2,`opacity=".25"`));
  for(let i=0;i<16;i++){
   const cx=18+(hash("cloud-x"+i)%1080+frame*2)%1080,cy=90+hash("cloud-y"+i)%148;
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
 out.push(textAt(740,76,"RECORDED UNITS",8,palette.muted,800));
 for(const [i,label] of ["none","1–2","3–5","6–9","10+"].entries()){
  const lx=834+i*51,shade=[palette.dim,palette.sand,palette.grass2,palette.grass,palette.bright][i];
  out.push(rect(lx,67,10,10,shade,2,`stroke="${palette.stroke}" stroke-width=".7"`));
  out.push(textAt(lx+13,76,label,8,palette.muted,600));
 }
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
  if(options.focusDate===cell.date)out.push(rect(x-2,y-2,tw+4,th+4,"none",3,`stroke="${palette.gold}" stroke-width="2"`));
  out.push("</g>");
 }
function repositoryLandmarkSprite(i,units,x,y,p,tint){
 const s=stage(units),windowColour=s>=1?p.gold:p.muted;
 const rect=(x,y,w,h,c,r=0,extra="")=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${c}" ${extra}/>`;
 const path=(d,c,attr="")=>`<path d="${d}" fill="${c}" ${attr}/>`;
 const line=(d,c,n=1,extra="")=>`<path d="${d}" fill="none" stroke="${c}" stroke-width="${n}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
 const circle=(x,y,r,c,a="")=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" ${a}/>`;
 let out=`<g transform="translate(${x} ${y})" aria-hidden="true">`;
 out+=`<ellipse cy="25" rx="20" ry="3.5" fill="${p.shade}" opacity=".22"/>`;
 if(i===0){
  // Beacon keeper: circular sea lighthouse with stripes and a soft lantern
  out+=rect(-9,0,18,24,p.wall,2)+path("M-11 0L0-9L11 0Z",p.roof);
  out+=rect(-9,9,18,5,p.roof)+rect(-9,19,18,4,p.roof);
  out+=rect(-3,1,6,7,windowColour,2,`class="${s?"dw-lantern":""}"`);
  out+=rect(-3,17,6,7,p.shade,2);
  if(s>=3)out+=line("M-11 3h22",p.gold,1.5);
  if(s>=4)out+=line("M0-9v-7",p.wall,1.4)+path("M0-16l10 3-10 4Z",tint);
 }else if(i===1){
  // Wayfinder bridgeworks: a compact arch bridge and surveyor's frame
  out+=rect(-14,8,28,13,p.wall,1)+path("M-16 8L0-1L16 8Z",p.roof);
  out+=path("M-5 21V13Q0 7 5 13V21Z",p.shade);
  out+=line("M-19 24h38M-16 22l7-5 9 5 9-5 7 5",p.gold,1.4);
  out+=rect(-4,4,8,5,windowColour,1,`class="${s?"dw-lantern":""}"`);
  if(s>=3)out+=line("M-14 0V-11h27M9-11v8",tint,1.6);
  if(s>=4)out+=path("M12-11l7 3-7 2Z",tint);
 }else if(i===2){
  // Ember forge: a glowing kiln with a red chimney and curling smoke
  out+=rect(-16,4,32,20,p.wall,2)+path("M-18 4l18-11 18 11Z",p.roof);
  out+=rect(8,-13,6,13,p.roof,1)+rect(-7,10,14,14,p.shade,3);
  out+=rect(-4,15,8,9,windowColour,2,`class="${s?"dw-lantern":""}"`);
  out+=rect(-14,11,4,5,p.brick||p.roof,1)+rect(10,11,4,5,p.brick||p.roof,1);
  if(s>=2)out+=circle(-14,23,3,p.grass2);
  if(s>=3)out+=circle(11,-16,3,p.muted,`opacity=".65" class="dw-smoke"`);
  if(s>=4)out+=circle(12,-25,2,tint);
 }else if(i===3){
  // Orbit observatory: domed starwatch tower and rotating telescope arm
  out+=rect(-12,4,24,20,p.wall,2)+path("M-15 4Q-12-12 0-13Q12-12 15 4Z",p.roof);
  out+=circle(0,-3,5,windowColour,`class="${s?"dw-lantern":""}"`);
  out+=rect(-4,12,8,12,p.shade,3);
  out+=line("M4-9l16-8",p.gold,2)+circle(18,-17,3,tint);
  if(s>=2)out+=circle(-11,19,3,p.grass2);
  if(s>=3)out+=line("M-12 7h24",p.gold,1.3);
  if(s>=4)out+=path("M-16-16l2-5 2 5 5 2-5 2-2 5-2-5-5-2Z",tint);
 }else{
  // Harbour quay: dock warehouse with moored sailboat
  out+=rect(-15,3,30,20,p.wall,2)+path("M-17 3L0-7L17 3Z",p.roof);
  out+=rect(-9,9,7,14,windowColour,1,`class="${s?"dw-lantern":""}"`)+rect(4,9,7,14,windowColour,1);
  out+=line("M-19 24h38",p.sand,2);
  if(s>=2)out+=path("M-18 22h13l-3 4h-7Z",tint)+line("M-11 21v-11",p.wall,1)+path("M-11 10l7 10h-7Z",p.gold);
  if(s>=3)out+=rect(13,9,3,15,p.roof);
  if(s>=4)out+=path("M0-7l10 4-10 3Z",tint);
 }
 out+=circle(16,-4,6,tint,`stroke="${p.shade}" stroke-width="1"`);
 out+=`<text x="16" y="-1" font-family="Arial,sans-serif" font-size="8" font-weight="900" text-anchor="middle" fill="${p.shade}">${i+1}</text>`;
 return out+"</g>";
}
 // The environment is atmospheric. Only populated date cells indicate recorded activity.
 if(arch){
  out.push(`<g class="dw-boat" transform="translate(${(frame*3)%31} 0)" opacity=".92">${path("M24 243h24l-6 7H30Z",palette.roof)}${line("M37 243v-17",palette.wall,1.4)}${path("M38 228l11 12H38Z",palette.wall)}</g>`);
  out.push(`<g class="dw-boat" transform="translate(${-(frame*2)%24} 0)" style="animation-delay:-3s" opacity=".68">${path("M1082 93h21l-5 6h-10Z",palette.roof)}${line("M1092 93v-15",palette.wall,1.4)}${path("M1093 79l9 11h-9Z",palette.wall)}</g>`);
 }else{
  out.push(line("M7 258Q145 252 285 258T565 258T845 258T1113 258",palette.sand,2,`opacity=".5"`));
 }
 out.push(rect(0,272,1120,78,palette.panel));
 out.push(line("M0 272H1120",palette.stroke,1));
 visible.forEach((r,i)=>{
  const xx=24+i*218,st=grid.byRepo.get(r.full_name);
  out.push(rect(xx,284,207,54,theme==="dark"?"#223b50":"#f5f3e6",8,`stroke="${palette.stroke}" stroke-width=".7"`));
  out.push(repositoryLandmarkSprite(i,st.units,xx+25,300,palette,repoColours[i]));
  const name=r.name.length>17?r.name.slice(0,15)+"…":r.name;
  out.push(textAt(xx+51,303,name,12,palette.text,750));
  out.push(textAt(xx+51,320,`${st.units} units · ${st.events} events · stage ${stage(st.units)}`,10,palette.muted,500));
  out.push(textAt(xx+51,332,grid.anchors.has(r.full_name)?"Pinned to recorded day":"No in-range landmark",8,palette.muted,500));
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
