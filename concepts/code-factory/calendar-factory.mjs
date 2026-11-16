// Browser-safe calendar renderer: Node-only imports are loaded on CLI execution.
// Calendar-driven Code Factory. All event-derived machinery is selected-week only.
// Counts represent units in a normalised event snapshot, NOT GitHub's official totals.
const DAY=86400000;
const KINDS=["commit","pr_opened","pr_merged","issue_opened","release"];
const TYPES={"commit":{"name":"PARTS","verb":"Part forge","colour":"#63d9bc","symbol":"●"},"pr_opened":{"name":"ASSEMBLY","verb":"Assembly arm","colour":"#90b6ff","symbol":"◇"},"pr_merged":{"name":"SEALED","verb":"Sealing press","colour":"#ffc27f","symbol":"◆"},"issue_opened":{"name":"INSPECT","verb":"Inspection lens","colour":"#ff98a7","symbol":"!"},"release":{"name":"DISPATCH","verb":"Dispatch crane","colour":"#c8adff","symbol":"✦"}};
const PALETTE={"dark":{"bg":"#071923","panel":"#102936","panel2":"#163441","line":"#42606c","line2":"#678893","empty":"#29454b","ink":"#fbefd9","muted":"#b8cbd0","metal":"#557c8e","metal2":"#91b3b6","floor":"#244b51","accent":"#f3bf7a","shadow":"#06121d","grid":["#29454b","#256d5e","#358a6c","#50aa7e","#85d99c","#c9f3ae"]},"light":{"bg":"#ebe6d9","panel":"#fff8e9","panel2":"#e6f0e9","line":"#a8c1bd","line2":"#6e969a","empty":"#d3dfd4","ink":"#29454b","muted":"#5d7778","metal":"#90b3b7","metal2":"#c7d9d0","floor":"#d5e5d9","accent":"#b8814e","shadow":"#53716f","grid":["#d3dfd4","#afd3b0","#83c69c","#51a77d","#2e8865","#16684e"]}};
function h(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));}

function dateUTC(value){if(typeof value!=="string"||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value))throw Error("timestamp must be ISO 8601 UTC with optional milliseconds");const expected=value.includes(".")?value.replace(/\.(\d{1,3})Z$/,(_,digits)=>"."+digits.padEnd(3,"0")+"Z"):value.replace(/Z$/,".000Z");const dt=new Date(value);if(!Number.isFinite(+dt)||dt.toISOString()!==expected)throw Error("invalid UTC calendar date");return dt;}

function validSnapshot(input){if(!input||typeof input!=="object"||Array.isArray(input)||input.schema_version!=="1"||!["demo","github"].includes(input.source))throw Error("invalid schema/source");const generated=dateUTC(input.generated_at);if(!Array.isArray(input.repositories)||!Array.isArray(input.activity)||input.repositories.length>5000||input.activity.length>10000)throw Error("invalid/oversized snapshot");const repos=new Map();for(const r of input.repositories){if(!r||typeof r.full_name!=="string"||!/^([^/\s]+)\/([^/\s]+)$/.test(r.full_name)||r.full_name.length>240||repos.has(r.full_name))throw Error("invalid or duplicated repository full_name");const name=r.name??r.full_name.split("/")[1];if(typeof name!=="string"||name.length>240)throw Error("invalid repository name");repos.set(r.full_name,{full_name:r.full_name,name});}const seen=new Map();for(const e of input.activity){if(!e||typeof e.id!=="string"||e.id.length<1||e.id.length>240||!KINDS.includes(e.kind)||!repos.has(e.repo_full_name)||!Number.isSafeInteger(e.count)||e.count<1||e.count>100000)throw Error("invalid event");const when=dateUTC(e.occurred_at);const norm={id:e.id,kind:e.kind,repo:e.repo_full_name,count:e.count,when:when.toISOString().replace(".000Z","Z")};if(seen.has(e.id)){if(JSON.stringify(seen.get(e.id))!==JSON.stringify(norm))throw Error("conflicting duplicate event id");continue;}seen.set(e.id,norm);}const events=[...seen.values()].sort((a,b)=>a.when.localeCompare(b.when)||a.id.localeCompare(b.id));return {source:input.source,generated,repos,events};}

function isoDate(ms){return new Date(ms).toISOString().slice(0,10);}

function dateLabel(ms){const t=new Date(ms),mon=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];return `${t.getUTCDate()} ${mon[t.getUTCMonth()]}`;}

function calendarModel(data){const s=validSnapshot(data),now=Date.UTC(s.generated.getUTCFullYear(),s.generated.getUTCMonth(),s.generated.getUTCDate()),start=(now-s.generated.getUTCDay()*DAY)-52*7*DAY;const weeks=Array.from({length:53},(_,index)=>({index,start:start+index*7*DAY,days:Array.from({length:7},(_,d)=>{const dateMs=start+(index*7+d)*DAY;return {date:isoDate(dateMs),dateMs,events:[],units:0,future:dateMs>now};}),units:0,records:0}));let outside=0;for(const e of s.events){const ms=Date.parse(e.when);if(ms<start||ms>s.generated.getTime()){outside++;continue;}const wi=Math.floor((ms-start)/(DAY*7)),di=new Date(ms).getUTCDay();if(wi<0||wi>=53){outside++;continue;}const day=weeks[wi].days[di];day.events.push(e);day.units+=e.count;weeks[wi].units+=e.count;weeks[wi].records++;}const latestActive=[...weeks].reverse().find(w=>w.records>0);return {...s,weeks,windowStart:start,outside,defaultWeek:latestActive?latestActive.index:52};}

function dayMachines(day){
  // Multiple records from one repository and one stage drive one real station.
  const groups=new Map();
  for(const event of day.events){
    const key=JSON.stringify([event.repo,event.kind]);
    let group=groups.get(key);
    if(!group){group={repo:event.repo,kind:event.kind,count:0,records:0,ids:[]};groups.set(key,group);}
    group.count+=event.count;group.records++;group.ids.push(event.id);
  }
  return [...groups.values()];
}
function selectedModel(input,weekIndex){const model=calendarModel(input),index=weekIndex===undefined?model.defaultWeek:weekIndex;if(!Number.isInteger(index)||index<0||index>=53)throw Error("week index must be between 0 and 52");const week=model.weeks[index],activeRepos=new Set(),stages=new Map();for(const d of week.days)for(const e of d.events){activeRepos.add(e.repo);stages.set(e.kind,(stages.get(e.kind)||0)+e.count);}return {...model,weekIndex:index,week,activeRepos,stages};}

function rect(x,y,w,hh,fill,r=0,extra=""){return `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="${r}" fill="${fill}" ${extra}/>`;}

function line(x1,y1,x2,y2,colour,width=1,extra=""){return `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${colour}" stroke-width="${width}" ${extra}/>`;}

function pathShape(points,fill,extra=""){return `<path d="${points}" fill="${fill}" ${extra}/>`;}

function txt(x,y,string,size,colour,extra=""){return `<text x="${x}" y="${y}" font-size="${size}" fill="${colour}" font-family="system-ui,Segoe UI,sans-serif" ${extra}>${h(string)}</text>`;}

function truncated(s,limit){const clean=String(s).replace(/\s+/g," ").trim();return clean.length>limit?clean.slice(0,limit-1)+"…":clean;}

function level(units){return units<=0?0:units===1?1:units<=3?2:units<=6?3:units<=10?4:5;}

function machineArt(x,y,kind,repoName,count,p,style,records=1,fullName=repoName){const col=TYPES[kind].colour,o=[];const c=(dx,dy,w,hh,f,r=0,extra="")=>rect(x+dx,y+dy,w,hh,f,r,extra);const l=(dx,dy,ex,ey,f,sw=2,extra="")=>line(x+dx,y+dy,x+ex,y+ey,f,sw,extra);
if(style==="isometric"){o.push(pathShape(`M${x-33} ${y+24}l29 -13 36 15 -30 15z`,p.shadow,'opacity=".45"'));o.push(pathShape(`M${x-27} ${y+11}l22 -9 31 12 -22 10z`,p.metal2));o.push(pathShape(`M${x-27} ${y+11}l31 13v13l-31 -13z`,p.metal));o.push(pathShape(`M${x+4} ${y+24}l22 -10v13l-22 10z`,p.shadow));o.push(pathShape(`M${x-19} ${y+19}l13 5v7l-13 -5z`,col));o.push(pathShape(`M${x-4} ${y+26}l5 2v4l-5 -2z`,p.accent));}else{o.push(c(-29,9,57,26,p.shadow,1));o.push(c(-27,11,53,22,p.metal,1));o.push(c(-22,16,18,13,p.panel2,1));o.push(c(-20,18,14,9,col));o.push(c(1,16,18,5,col));o.push(c(2,24,5,5,p.shadow));o.push(c(11,24,5,5,p.shadow));} 
if(kind==="commit"){o.push(c(-18,-1,20,10,p.shadow,2));o.push(c(-14,1,12,6,col,1));o.push(c(4,-4,8,15,p.metal2,1));o.push(c(3,-6,11,3,p.accent));o.push(l(9,-8,12,-13,col,1));o.push(l(2,-10,3,-16,col,1));}
if(kind==="pr_opened"){o.push(c(-8,-5,4,17,p.metal2));o.push(l(-6,-3,7,-12,col,4,'stroke-linecap="square"'));o.push(c(4,-15,12,5,col,1));o.push(l(10,-10,10,1,p.shadow,3));o.push(l(10,1,17,5,p.accent,2));}
if(kind==="pr_merged"){o.push(c(-12,-9,24,5,col,1));o.push(c(-3,-4,6,13,p.metal2));o.push(c(-13,7,28,4,col));o.push(c(-8,-17,16,5,p.accent,1));}
if(kind==="issue_opened"){o.push(`<circle cx="${x+1}" cy="${y-8}" r="10" stroke="${col}" stroke-width="4" fill="${p.panel}"/>`);o.push(l(8,-1,17,8,p.metal2,4,'stroke-linecap="round"'));o.push(c(-14,7,10,3,p.accent));}
if(kind==="release"){o.push(c(-15,-6,5,18,p.metal2));o.push(l(-13,-5,14,-5,col,4));o.push(l(14,-5,14,8,p.metal2,2));o.push(c(7,8,15,12,col,1));o.push(c(11,8,4,12,p.accent));}
for(let i=0;i<5;i++)o.push(c(-17+i*8,-18,5,3,i<level(count)?col:p.empty,1));
o.push(`<title>${h(`${fullName} · ${kind} · ${records} record${records===1?"":"s"} · ${count} recorded unit${count===1?"":"s"}`)}</title>`);
return `<g class="machine ${style}" ${style==="pixel"?'shape-rendering="crispEdges"':""}><g class="machine-part">${o.join("")}</g>${txt(x,y+48,truncated(repoName,12),10,p.ink,'font-weight="700" text-anchor="middle"')}${txt(x,y-21,`×${count}`,9,p.ink,'font-weight="800" text-anchor="middle"')}</g>`;
}

function render(input,{layout="isometric",theme="dark",animated=false,selectedWeek}={}){if(!["isometric","pixel"].includes(layout)||!Object.prototype.hasOwnProperty.call(PALETTE,theme)||typeof animated!=="boolean")throw Error("invalid render options");const m=selectedModel(input,selectedWeek),p=PALETTE[theme],w=m.week,v=[],W=1200,H=430,source=m.source==="demo"?"SYNTHETIC DEMO":"PUBLIC GITHUB SNAPSHOT",x0=154,pitch=18.4,cy=118,dy=12.2,cell=11.3,dayNames=["SUN","MON","TUE","WED","THU","FRI","SAT"];
v.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="factoryTitle factoryDesc">`);
v.push(`<title id="factoryTitle">Code Factory · ${h(layout)} · ${source}</title><desc id="factoryDesc">${h(`GitHub-style weekly grid with selected week ${dateLabel(w.start)} to ${dateLabel(w.start+6*DAY)}. ${w.records} observed event records representing ${w.units} source-backed event units. Each factory machine below corresponds to an event recorded on the same calendar day. This is not the official GitHub contributions calendar or CI/deployment status.`)}</desc>`);
v.push(`<defs><linearGradient id="panelGlow" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${p.panel2}"/><stop offset="100%" stop-color="${p.panel}"/></linearGradient><pattern id="isoTiles" width="28" height="18" patternUnits="userSpaceOnUse"><path d="M0 9L14 1L28 9L14 17Z" stroke="${p.line2}" stroke-opacity=".22" fill="none"/><circle cx="14" cy="9" r="1.2" fill="${p.accent}" opacity=".2"/></pattern><pattern id="pixelTiles" width="24" height="20" patternUnits="userSpaceOnUse"><rect x="0" y="17" width="11" height="2" fill="${p.line2}" opacity=".28"/><rect x="13" y="17" width="11" height="2" fill="${p.line2}" opacity=".28"/><rect x="11" y="1" width="2" height="16" fill="${p.line}" opacity=".22"/><rect x="3" y="5" width="3" height="3" fill="${p.accent}" opacity=".15"/></pattern></defs>`);
if(animated)v.push(`<style>@keyframes machinePulse{0%,100%{filter:brightness(1);opacity:.82}50%{filter:brightness(1.12);opacity:1}}@keyframes movingBelt{to{transform:translateX(16px)}}.active .machine-part{animation:machinePulse 2.2s ease-in-out infinite}.belt-dashes{animation:movingBelt .9s linear infinite}@media(prefers-reduced-motion:reduce){.active .machine-part,.belt-dashes{animation:none!important}.travelling{display:none!important}}</style>`);
v.push(rect(0,0,W,H,p.bg));v.push(rect(14,11,1172,407,p.panel,15,`stroke="${p.line}" stroke-width="1"`));
v.push(txt(39,43,"CODE FACTORY",26,p.ink,'font-weight="900" letter-spacing="2.3"'));v.push(txt(40,62,"Every highlighted week powers its own seven-day workshop",12,p.muted));
v.push(rect(984,25,174,27,p.panel2,13,`stroke="${p.line}"`));v.push(txt(1071,44,source,11,p.ink,'font-weight="800" text-anchor="middle"'));
v.push(rect(28,79,1144,127,p.panel2,9,`stroke="${p.line}" stroke-width="1"`));v.push(txt(42,102,"52-WEEK ACTIVITY CALENDAR",12,p.ink,'font-weight="800" letter-spacing=".7"'));v.push(txt(1155,102,`${m.events.length} event records · partial snapshot${m.outside?" · "+m.outside+" outside calendar":""}`,10,p.muted,'text-anchor="end"'));
let oldMonth=-1;for(let i=0;i<53;i++){const wk=m.weeks[i],startDate=new Date(wk.start),month=startDate.getUTCMonth();if(i>0&&month!==oldMonth)v.push(txt(x0+i*pitch,113,["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][month],9,p.muted,'font-weight="600"'));oldMonth=month;for(let j=0;j<7;j++){const day=wk.days[j],x=(x0+i*pitch).toFixed(2),y=(cy+j*dy).toFixed(2);if(day.future)continue;v.push(`<g><title>${h(`${day.date}: ${day.units} recorded units across ${day.events.length} events${day.events.length?" · "+[...new Set(day.events.map(e=>e.kind))].join(", "):""}`)}</title>`+rect(x,y,cell,cell,p.grid[level(day.units)],2)+`</g>`);}v.push(`<g data-week-index="${i}" tabindex="-1"><title>Week beginning ${isoDate(wk.start)}: ${wk.records} events</title>${rect((x0+i*pitch-2.1).toFixed(1),cy-2,cell+4.3,7*dy+1,"transparent",3)}</g>`);}
for(const [j,label] of [[1,"Mon"],[3,"Wed"],[5,"Fri"]])v.push(txt(137,cy+j*dy+9,label,10,p.muted,'text-anchor="end"'));
const selectedX=x0+m.weekIndex*pitch;v.push(rect((selectedX-3.4).toFixed(2),cy-3,cell+6.8,7*dy-1,"none",4,`stroke="${p.accent}" stroke-width="2.6" pointer-events="none"`));
v.push(pathShape(`M${(selectedX+6).toFixed(2)} 203V215H595V221`,"none",`stroke="${p.accent}" stroke-width="1.7" stroke-dasharray="4 5" opacity=".85"`));
v.push(rect(28,222,1144,163,"url(#panelGlow)",10,`stroke="${p.line}"`));v.push(line(58,219,1143,219,p.accent,1,'stroke-dasharray="3 7" opacity=".35"'));for(let j=0;j<7;j++){const cx=41+j*160+79;v.push(line(cx,219,cx,252,p.accent,1,'opacity=".45"'));v.push(`<circle cx="${cx}" cy="219" r="2.7" fill="${p.accent}" opacity=".7"/>`);}v.push(txt(43,243,`WEEK OF ${dateLabel(w.start).toUpperCase()}  •  ${w.records} RECORD${w.records===1?"":"S"}  •  ${w.units} UNIT${w.units===1?"":"S"}`,12,p.ink,'font-weight="900" letter-spacing=".8"'));v.push(txt(1158,243,"Each lane below maps directly to one calendar day",10,p.muted,'text-anchor="end"'));
v.push(rect(36,250,1128,126,layout==="pixel"?"url(#pixelTiles)":"url(#isoTiles)",5));
const laneWidth=158, spacing=2, laneStart=41;for(let dayIndex=0;dayIndex<7;dayIndex++){const d=w.days[dayIndex],x=laneStart+dayIndex*(laneWidth+spacing),c=x+laneWidth/2;v.push(`<g data-day="${d.date}">`);v.push(rect(x,254,laneWidth-4,120,d.units?(layout==="pixel"?p.panel2:p.floor):p.panel,layout==="pixel"?1:6,`stroke="${d.units?p.line2:p.line}" stroke-opacity="${d.units?".9":".5"}"`));if(layout==="pixel"){for(let q=0;q<5;q++)v.push(rect(x+12+q*27,356,14,3,p.line2,0,'opacity=".23"'));}else v.push(pathShape(`M${x+8} 358l28 9 28 -9 28 9 28 -9`,"none",`stroke="${p.line2}" stroke-opacity=".18" stroke-width="2"`));v.push(rect(x+9,263,12,12,d.future?p.empty:p.grid[level(d.units)],3));v.push(txt(x+26,273,`${dayNames[dayIndex]} ${d.date.slice(8)}`,12,p.ink,'font-weight="850"'));v.push(txt(x+laneWidth-12,272,d.future?"FUTURE":`${d.units} UNITS`,9,p.muted,'text-anchor="end"'));v.push(line(c,279,c,292,d.units?p.accent:p.line,2,d.units?'stroke-dasharray="3 3"':""));if(d.units){const grouped=dayMachines(d),visible=grouped.slice(0,2),xs=visible.length===1?[c]:[x+43,x+110];for(let k=0;k<visible.length;k++){const e=visible[k],repo=m.repos.get(e.repo),duplicates=[...m.activeRepos].filter(other=>m.repos.get(other).name===repo.name).sort(),name=duplicates.length>1?`${truncated(repo.name,8)} #${duplicates.indexOf(e.repo)+1}`:repo.name;v.push(`<g class="active" data-repo="${h(e.repo)}" data-kind="${e.kind}" data-records="${e.records}" data-units="${e.count}">`+machineArt(xs[k],312,e.kind,name,e.count,p,layout,e.records,e.repo)+`</g>`);}if(grouped.length>2){const hidden=grouped.slice(2),hiddenRecords=hidden.reduce((n,g)=>n+g.records,0);v.push(txt(c,368,`+${hiddenRecords} more records (${hidden.length} stages)`,9,p.ink,'text-anchor="middle" font-weight="700"'));}else v.push(txt(c,368,grouped.map(e=>TYPES[e.kind].name).join(" · "),9,p.muted,'text-anchor="middle"'));}else{v.push(rect(c-21,304,42,28,p.panel2,4,`stroke="${p.line}" stroke-dasharray="3 3"`));v.push(line(c-12,319,c+12,319,p.line2,2));v.push(txt(c,351,d.future?"NOT YET RECORDED":"IDLE LANE",10,p.muted,'text-anchor="middle" font-weight="700"'));}v.push(`</g>`);}
v.push(line(47,378,1155,378,p.line2,4,'stroke-linecap="round"'));for(let i=0;i<7;i++){const d=w.days[i],cx=laneStart+i*(laneWidth+spacing)+laneWidth/2;v.push(rect(cx-5,374,10,8,d.units?p.accent:p.line,2));if(animated&&d.events.length){const e=dayMachines(d)[0],colour=TYPES[e.kind].colour;v.push(`<g class="travelling">${rect(-5,-5,10,10,colour,2)}<animateMotion dur="6s" begin="${i*.25}s" repeatCount="indefinite" path="M${cx} 377L${Math.min(1151,cx+94)} 377"/></g>`);}}v.push(rect(28,391,1144,19,p.panel2,5));for(let i=0;i<KINDS.length;i++){const k=KINDS[i],x=43+i*224;v.push(rect(x,395,12,10,TYPES[k].colour,2));v.push(txt(x+17,404,`${TYPES[k].name} ${m.stages.get(k)||0}`,10,p.ink,'font-weight="750"'));}v.push(txt(1157,425,`${layout==="isometric"?"ISOMETRIC FOUNDRY":"PIXEL WORKS"} · SELECTED WEEK ONLY · NOT CI / DEPLOYMENT STATUS`,9,p.muted,'text-anchor="end"'));
if(m.outside)v.push(`<desc id="outside">Excluded ${m.outside} records outside displayed date range or after snapshot time.</desc>`);
v.push(`</svg>`);return v.join("\n")+"\n";}
export {validSnapshot,calendarModel,selectedModel,dayMachines,render,TYPES};

if (typeof process !== "undefined" && process.argv?.[1]) {
  const [{readFileSync,mkdirSync,writeFileSync},{fileURLToPath,pathToFileURL},pathModule] = await Promise.all([import("node:fs"),import("node:url"),import("node:path")]);
  const path=pathModule.default;
  if(import.meta.url !== pathToFileURL(path.resolve(process.argv[1])).href){ /* imported by tests */ }
  else {
  const args=process.argv.slice(2);
  const weekPos=args.indexOf("--week-index");
  let selectedWeek;
  if (weekPos>=0){if(weekPos===args.length-1)throw Error("--week-index requires an integer"); const raw=args[weekPos+1];if(!/^(0|[1-9][0-9]*)$/.test(raw))throw Error("--week-index must be a non-negative integer");selectedWeek=Number(raw);args.splice(weekPos,2);}
  if(args.length>2)throw Error("Usage: node calendar-factory.mjs [snapshot.json] [output-dir] [--week-index N]");
  const here=path.dirname(fileURLToPath(import.meta.url));
  const input=args[0]||path.join(here,"../../shared/fixtures/demo-activity.json");
  const output=args[1]||path.join(here,"exports");
  const data=JSON.parse(readFileSync(input,"utf8"));
  mkdirSync(output,{recursive:true});
  for(const layout of ["isometric","pixel"])for(const theme of ["dark","light"])for(const animated of [true,false]){
    const file=`${layout}-${theme}${animated?"":"-still"}.svg`;
    writeFileSync(path.join(output,file),render(data,{layout,theme,animated,selectedWeek}),"utf8");
    console.log(path.join(output,file));
  }
  }
}
