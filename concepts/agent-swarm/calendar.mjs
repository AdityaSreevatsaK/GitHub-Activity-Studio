import {makeScene,normaliseSnapshot,KIND_META,REPO_COLOURS,PERIOD,phaseAt,timelineValues} from './scene.mjs';
const GRID={"x":99,"y":128,"dx":17.25,"dy":16.6,"size":12.4,"weeks":53};
const ONE_DAY=86400000;
export function calendarData(scene,raw) {
  const snap=normaliseSnapshot(raw),today=Date.parse(snap.generated_at.slice(0,10)+"T00:00:00Z"),generated=Date.parse(snap.generated_at);
  const start=today-(new Date(today).getUTCDay()+52*7)*ONE_DAY;
  const startDay=new Date(start).toISOString().slice(0,10);
  const lastDay=new Date(today).toISOString().slice(0,10);
  const daily=new Map(),validEventIds=new Set();let outside=0,future=0;
  for(const e of snap.activity) {
    const when=Date.parse(e.occurred_at);
    if(when>generated){future++;continue;}
    if(when<start){outside++;continue;}
    validEventIds.add(e.id);
    const day=e.occurred_at.slice(0,10);
    const value=daily.get(day)||{date:day,events:0,units:0,kinds:{}};
    value.events++;value.units+=e.count;value.kinds[e.kind]=(value.kinds[e.kind]||0)+1;
    daily.set(day,value);
  }
  const days=[...daily.values()].sort((a,b)=>a.date.localeCompare(b.date));
  const dateCell=(date)=> {
    if(date>lastDay)return null;
    const delta=Math.round((Date.parse(date+"T00:00:00Z")-start)/ONE_DAY);
    if(delta<0||delta>=53*7)return null;
    const week=Math.floor(delta/7),weekday=delta%7;
    return {week,weekday,x:Number((GRID.x+week*GRID.dx+GRID.size/2).toFixed(2)),y:Number((GRID.y+weekday*GRID.dy+GRID.size/2).toFixed(2))};
  };
  const jobs=scene.jobs.filter(j=>validEventIds.has(j.id)).map(j=>({...j,date:j.occurred_at.slice(0,10),cell:dateCell(j.occurred_at.slice(0,10))}));
  return {...scene,jobs,shown:jobs.length,calendar:{start:startDay,end:lastDay,generated_at:snap.generated_at,days,observed_days:days.length,window_events:validEventIds.size,outside_window_events:outside,future_events:future,semantics:"Source-observed events only; not GitHub's complete contributions graph."},truncated:scene.truncated||jobs.length!==scene.jobs.length||outside>0||future>0};
}

export function agentAt(job,t,side) {
  const d=((t%PERIOD)+PERIOD)%PERIOD-job.start,aid=job.agents[side];
  const start={x:157+aid*94,y:290},target={x:job.cell.x+(side===0?-14:14),y:job.cell.y+(side===0?-14:14)},end={x:1021,y:290};
  const ease=q=>q*q*(3-2*q);
  if(d<.18)return start;
  if(d<.68){const k=(d-.18)/.5,v=ease(k);return{x:start.x+(target.x-start.x)*v,y:start.y+(target.y-start.y)*v-21*Math.sin(Math.PI*k)};}
  if(d<1.56)return {x:target.x+2*Math.sin((d-.68)*9+side),y:target.y+2*Math.cos((d-.68)*10+side)};
  const k=Math.max(0,Math.min(1,(d-1.56)/.64)),v=ease(k);
  return{x:target.x+(end.x-target.x)*v,y:target.y+(end.y-target.y)*v-24*Math.sin(Math.PI*k)};
}

export function escapeText(s) {return String(s).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[ch]));}

export function svgCalendar(scene,{style="geometric",theme="dark",animated=true,time=5.2}={}) {
  if(!["geometric","robots"].includes(style)||!["dark","light"].includes(theme))throw Error("Unknown variant");
  const robot=style==="robots",dark=theme==="dark",c=dark?{
    bg:"#071523",end:"#112b39",panel:"#0c2031",ink:"#e7f9ff",muted:"#99b7c5",edge:"#315062",empty:"#203746",levels:["#203746","#164d3c","#167b5c","#24b289","#76edc0"]
  }:{bg:"#f3f4ee",end:"#e0eee7",panel:"#ffffff",ink:"#182d36",muted:"#536e77",edge:"#b6cacb",empty:"#e5ebe5",levels:["#e5ebe5","#b4dfc2","#7fc897","#34a375","#17774d"]};
  const tag=robot?"THE LITTLE SWARM WORKSHOP":"AGENT / SWARM";
  const rect=(x,y,w,h,fill,rx=0,stroke="none",sw=1)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  const txt=(x,y,text,size=11,fill=c.ink,extra="")=>`<text x="${x}" y="${y}" fill="${fill}" font-family="Segoe UI,Arial,sans-serif" font-size="${size}" ${extra}>${escapeText(text)}</text>`;
  const out=[`<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="350" viewBox="0 0 1120 350" role="img" aria-labelledby="swarm-title swarm-desc">`,
  `<title id="swarm-title">${escapeText(tag)} · ${scene.source==="demo"?"demonstration":"source-observed"} activity calendar</title>`,
  `<desc id="swarm-desc">GitHub-style calendar of observed source events, with a deterministic swarm of ${robot?"tiny robots":"geometric helpers"} ferrying symbolic work to recorded event dates. This does not represent the complete GitHub contribution graph or autonomous GitHub actions.</desc>`,
  `<defs><linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${c.bg}"/><stop offset="1" stop-color="${c.end}"/></linearGradient><filter id="halo" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="4"/></filter></defs>`,
  `<style>text{font-weight:500}.small{letter-spacing:1.2px;font-weight:700}@media(prefers-reduced-motion:reduce){.swarm-motion{display:none!important}}</style>`,
  rect(0,0,1120,350,"url(#sky)"),rect(14,13,1092,324,"none",19,c.edge,1),
  txt(39,45,tag,robot?22:24,c.ink,'font-weight="800" letter-spacing="1.5"'),
  txt(40,64,"SOURCE-OBSERVED EVENTS · THE AGENTS ARE A VISUAL METAPHOR",10,c.muted,'class="small"'),
  rect(946,24,130,29,scene.source==="demo"?"#ffdc97":c.panel,15),
  txt(1011,43,scene.source==="demo"?"● DEMO DATA":"● GITHUB DATA",11,scene.source==="demo"?"#49320d":c.ink,'text-anchor="middle" font-weight="800"'),
  `<path d="M39 79H1080" stroke="${c.edge}"/>`,
  txt(42,98,"53-WEEK CONTRIBUTION-STYLE CALENDAR",10,c.muted,'class="small"'),
  txt(1077,98,`${scene.calendar.observed_days} OBSERVED DAYS · ${scene.event_total} EVENTS`,10,c.muted,'text-anchor="end" class="small"'),
  rect(40,104,1040,142,c.panel,14,c.edge,1)];
  const start=Date.parse(scene.calendar.start+"T00:00:00Z");
  for(let col=0;col<GRID.weeks;col++){
    const ms=start+col*7*ONE_DAY,month=new Date(ms).getUTCMonth(),oldMonth=new Date(ms-7*ONE_DAY).getUTCMonth();
    if(col===0||month!==oldMonth)out.push(txt(GRID.x+col*GRID.dx,119,new Date(ms).toLocaleString("en-GB",{month:"short",timeZone:"UTC"}).toUpperCase(),9,c.muted,'class="small"'));
  }
  for(const [day,label] of [[1,"MON"],[3,"WED"],[5,"FRI"]]){
    out.push(txt(85,GRID.y+day*GRID.dy+9.8,label,8,c.muted,'text-anchor="end"'));
  }
  const byDay=new Map(scene.calendar.days.map(d=>[d.date,d]));
  for(let col=0;col<53;col++)for(let day=0;day<7;day++){
    const date=new Date(start+(col*7+day)*ONE_DAY).toISOString().slice(0,10),daily=byDay.get(date);
    const intensity=daily?(daily.events>=5?4:daily.events>=3?3:daily.events>=2?2:1):0;
    const x=(GRID.x+col*GRID.dx).toFixed(2),y=(GRID.y+day*GRID.dy).toFixed(2);
    out.push(`<rect class="day-cell" data-date="${date}" data-events="${daily?.events||0}" data-units="${daily?.units||0}" x="${x}" y="${y}" width="${GRID.size}" height="${GRID.size}" rx="${robot?3.5:2.2}" fill="${c.levels[intensity]}" fill-opacity="${date>scene.calendar.end?.26:1}" stroke="${daily?c.levels[4]:"none"}" stroke-opacity=".6" stroke-width=".6"><title>${date}: ${daily?`${daily.events} observed event(s), ${daily.units} original activity units`:"no recorded events in input snapshot"}</title></rect>`);
  }
  if(scene.repositories.length===0)out.push(txt(560,192,"Awaiting repositories",20,c.muted,'text-anchor="middle"'));
  if(scene.calendar.days.length===0)out.push(txt(560,241,"NO OBSERVED EVENTS IN THIS CALENDAR WINDOW",11,c.muted,'text-anchor="middle" class="small"'));
  if(robot){
    out.push(`<path d="M44 110h20 M1054 110h20 M44 241h20 M1054 241h20" stroke="#f1c17c" opacity=".8" stroke-width="2"/>`);
  } else {
    out.push(`<path d="M49 108h19 M1052 108h19" stroke="#5de2b2" opacity=".7" stroke-width="2"/>`);
  }
  // The activity grid is authoritative within snapshot coverage; repo beacons are secondary.
  const railWidth=960/Math.max(1,scene.repositories.length);
  for(let i=0;i<scene.repositories.length;i++){
    const r=scene.repositories[i],x=55+i*railWidth,col=REPO_COLOURS[i%REPO_COLOURS.length];
    const max=Math.max(6,Math.floor(railWidth/11)),name=Array.from(r.name).slice(0,max).join("");
    out.push(`<g class="repository-beacon" data-repository="${escapeText(r.full_name)}"><circle cx="${x}" cy="260" r="${robot?5:4}" fill="${col}"/>${txt(x+11,264,name,10,c.muted,'font-weight="700"')}</g>`);
  }
  out.push(rect(40,276,1040,30,c.panel,10,c.edge,1),txt(54,295,robot?"BOT CHARGING DOCK":"SWARM DISPATCH",10,c.muted,'class="small"'));
  for(let i=0;i<8;i++){
    const x=157+i*94,colour=REPO_COLOURS[i%REPO_COLOURS.length];
    out.push(robot?
      `${rect(x-7,283,14,12,c.bg,4,colour,1.3)}<circle cx="${x-3}" cy="289" r="1.2" fill="${colour}"/><circle cx="${x+3}" cy="289" r="1.2" fill="${colour}"/><path d="M${x} 283v-4" stroke="${colour}"/>`:
      `<path d="M${x} 281l6 7-6 7-6-7Z" fill="${c.bg}" stroke="${colour}" stroke-width="1.4"/>`);
  }
  out.push(txt(1066,295,robot?"8 LITTLE HELPERS":"8 COORDINATED AGENTS",9,c.muted,'class="small" text-anchor="end"'));
  const glyph=(colour)=>{
    if(robot)return `<g><path d="M-7 -7l-5 -4 M7 -7l5 -4 M0 -10v-5" stroke="${colour}" stroke-width="1.8" stroke-linecap="round"/><circle cx="0" cy="-16" r="2" fill="${colour}"/><rect x="-11" y="-9" width="22" height="20" rx="6" fill="${dark?"#e6f0ef":"#fffef9"}" stroke="${colour}" stroke-width="2"/><rect x="-7" y="-3" width="14" height="7" rx="3.5" fill="${dark?"#183a45":"#e9eee8"}"/><circle cx="-3.2" cy=".6" r="1.6" fill="${colour}"/><circle cx="3.2" cy=".6" r="1.6" fill="${colour}"/><path d="M-6 11l-3 4 M6 11l3 4" stroke="${colour}" stroke-width="2" stroke-linecap="round"/></g>`;
    return `<g><circle r="14" fill="${colour}" opacity=".18" filter="url(#halo)"/><path d="M0 -9L9 0 0 9-9 0Z" fill="${dark?"#122a38":"#ffffff"}" stroke="${colour}" stroke-width="2"/><circle r="2.7" fill="${colour}"/></g>`;
  };
  for(const job of scene.jobs){
    const x=job.cell.x,y=job.cell.y,colour=KIND_META[job.kind].colour,phase=phaseAt(job,time);
    const active=phase!=="queued"&&phase!=="delivered";
    const tm=timelineValues(job);
    const px=Math.min(1009,x+16),py=Math.max(109,y-25);
    out.push(`<g class="symbolic-task" data-event="${escapeText(job.id)}" opacity="${animated?0:active?1:0}"><circle cx="${x}" cy="${y}" r="${robot?19:16}" stroke="${colour}" fill="none" stroke-width="1.6" stroke-dasharray="2 4"/><circle cx="${x}" cy="${y}" r="25" stroke="${colour}" fill="none" stroke-width=".7" opacity=".5"/>${rect(px,py,45,15,c.panel,6,colour)}${txt(px+23,py+10,`${KIND_META[job.kind].glyph} ×${job.count}`,9,c.ink,'text-anchor="middle"')}${animated?`<animate attributeName="opacity" values="0;0;1;1;1;0;0" keyTimes="${tm}" dur="${PERIOD}s" repeatCount="indefinite"/>`:""}</g>`);
    for(let side=0;side<2;side++){
      const aid=job.agents[side],sx=157+aid*94,sy=290,hx=x+(side===0?-14:14),hy=y+(side===0?-14:14);
      const path=`M ${sx} ${sy} Q ${(sx+hx)/2} ${Math.min(sy,hy)-53} ${hx} ${hy} Q ${(hx+1021)/2} ${Math.min(290,hy)-57} 1021 290`;
      const pos=agentAt(job,time,side);
      if(animated)out.push(`<g class="swarm-motion" data-agent="${aid}" data-task="${escapeText(job.id)}" opacity="0">${glyph(colour)}<animateMotion path="${path}" dur="${PERIOD}s" repeatCount="indefinite" keyTimes="${tm}" keyPoints="0;0;0;0.5;0.5;1;1" calcMode="linear"/><animate attributeName="opacity" values="0;0;1;1;1;0;0" keyTimes="${tm}" dur="${PERIOD}s" repeatCount="indefinite"/></g>`);
      else if(active)out.push(`<g transform="translate(${pos.x.toFixed(2)} ${pos.y.toFixed(2)})">${glyph(colour)}</g>`);
    }
  }
  let keyX=42;
  for(const [kind,meta] of Object.entries(KIND_META)){
    const count=scene.jobs.filter(j=>j.kind===kind).length;
    if(!count)continue;
    out.push(`<circle cx="${keyX}" cy="322" r="3.5" fill="${meta.colour}"/>`,txt(keyX+9,325,`${meta.label} ${count}`,9,c.muted));keyX+=meta.label.length*6.6+43;
  }
  out.push(txt(1077,324,"NO AUTONOMOUS GITHUB ACTIONS",9,c.muted,'text-anchor="end" class="small"'));
  if(scene.stale_days!==null&&scene.stale_days>30)out.push(rect(781,53,145,17,dark?"#514335":"#ffdcac",8),txt(854,65,"HISTORICAL SNAPSHOT",9,dark?"#ffefcb":"#604020",'text-anchor="middle"'));
  out.push(txt(560,343,scene.truncated?
    `OBSERVED SNAPSHOT ONLY · ANIMATED ${scene.shown}/${scene.eligible_total} ELIGIBLE EVENTS · ${scene.calendar.outside_window_events} OUTSIDE WINDOW`:
    "OBSERVED SNAPSHOT ONLY · BLANK CELLS DO NOT PROVE ZERO GITHUB CONTRIBUTIONS",9,c.muted,'text-anchor="middle" class="small"'));
  out.push("</svg>");
  return out.join("\n")+"\n";
}
