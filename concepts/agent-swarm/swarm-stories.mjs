// Agent Swarm: two source-backed narratives, not simulations of GitHub work.
// One renders the full observed calendar being assembled; the other shows
// repository-specific source events as travelling signals on a permanent grid.
// Offline, deterministic and dependency-free beyond the existing GIF encoder.
import { normaliseSnapshot, escapeXml } from './scene.mjs';
import { lzwEncode } from './gif.mjs';

export const STORY_PERIOD = 14;
export const MODES = ['forge', 'relay'];
const G = { x: 99, y: 128, dx: 17.25, dy: 16.6, size: 12.4 };
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const COLOURS = ['#53e0c8','#7bc5ff','#be9dff','#ffc47a','#ff8eb4'];
const DAY = 86400000;
const themeColours = {
 dark: { bg:'#07131e',panel:'#102336',panel2:'#152b41',grid:'#22394b',line:'#344f63',text:'#eefaff',muted:'#a3bace',bright:'#f8ffff',off:'#192e40',low:'#27615f',mid:'#248f83',high:'#37c3a7',peak:'#a1ffe1' },
 light:{ bg:'#f2f4f3',panel:'#ffffff',panel2:'#e2ebed',grid:'#cbd6d9',line:'#aec3cc',text:'#182b3b',muted:'#466174',bright:'#112536',off:'#dee8e7',low:'#addbd0',mid:'#71c6b4',high:'#2b9c89',peak:'#116858' }
};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const s=(v)=>escapeXml(String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,''));
const dateFrom=(start,index)=>new Date(Date.parse(start+'T00:00:00Z')+index*DAY).toISOString().slice(0,10);
const maxLevel=(n)=>n>=5?4:n>=3?3:n>=2?2:n?1:0;
const safeName=(s,n=15)=>Array.from(String(s)).slice(0,n).join('');
const hex=(cx,cy,r)=>Array.from({length:6},(_,i)=>{const a=Math.PI/3*i+Math.PI/6;return (cx+Math.cos(a)*r).toFixed(1)+','+(cy+Math.sin(a)*r).toFixed(1)}).join(' ');

export function makeStory(scene,raw){
 if(!scene||!scene.calendar||!Array.isArray(scene.calendar.days))throw Error('Calendar scene required');
 const input=normaliseSnapshot(raw);
 if(input.user.login!==scene.user.login || input.source!==scene.source ||
    input.generated_at!==scene.generated_at)throw Error('Scene and activity snapshot have different provenance');
 const byDate=new Map(scene.calendar.days.map(d=>[d.date,d]));
 const dates=scene.calendar.days.map(d=>({
   date:d.date, week:Math.floor((Date.parse(d.date+'T00:00:00Z')-Date.parse(scene.calendar.start+'T00:00:00Z'))/DAY/7),
   weekday:Math.round((Date.parse(d.date+'T00:00:00Z')-Date.parse(scene.calendar.start+'T00:00:00Z'))/DAY)%7,
   events:d.events,units:d.units,kinds:d.kinds
 }));
 const repos=scene.repositories.map((r,i)=>({name:r.name,full_name:r.full_name,index:i,colour:COLOURS[i%5],events:r.events}));
 const repoByName=new Map(repos.map(r=>[r.full_name,r]));
 const signals=repos.map(r=>{
   const perDay=new Map();
   for(const ev of input.activity){
     if(ev.repo_full_name!==r.full_name || ev.occurred_at>input.generated_at)continue;
     const d=ev.occurred_at.slice(0,10);
     if(!byDate.has(d))continue;
     const item=perDay.get(d)||{date:d,events:0,kind:ev.kind};
     item.events++;perDay.set(d,item);
   }
   const sorted=[...perDay.values()].sort((a,b)=>a.date.localeCompare(b.date));
   const selected=sorted.length<=5?sorted:Array.from({length:5},(_,k)=>sorted[Math.round(k*(sorted.length-1)/4)]);
   return {repo:r,all_days:sorted.map(a=>({date:a.date,events:a.events,kind:a.kind})),events:selected.map((a,k)=>{
     const day=dates.find(x=>x.date===a.date);
     const x=G.x+day.week*G.dx+G.size/2;
     const y=G.y+day.weekday*G.dy+G.size/2;
     return {...a,x,y,start:0.9+k*2.15+r.index*0.19,duration:1.65};
   })};
 });
 // Public source links allow a viewer to verify individual observed events.
 // Accept only canonical GitHub HTTPS event URLs from the original snapshot.
 const originalById=new Map((Array.isArray(raw.activity)?raw.activity:[]).map(e=>[e.id,e]));
 const linksByDate=new Map();
 for(const ev of input.activity){
   if(ev.occurred_at>input.generated_at)continue;
   const date=ev.occurred_at.slice(0,10);
   if(!byDate.has(date))continue;
   const url=originalById.get(ev.id)?.url;
   if(typeof url!=='string'||url.length>400||!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/(?:pull\/\d+|issues\/\d+|commit\/[A-Fa-f0-9]{7,64}|releases\/tag\/[A-Za-z0-9_.-]+)$/.test(url))continue;
   const links=linksByDate.get(date)||[];
   if(links.length<3)links.push({kind:ev.kind,repo_full_name:ev.repo_full_name,url});
   linksByDate.set(date,links);
 }
 const inspectedDays=dates.map(d=>({...d,links:linksByDate.get(d.date)||[]}));
 const total=dates.reduce((n,d)=>n+d.events,0);
 return {source:scene.source,user:scene.user,generated_at:scene.generated_at,
   calendar:{start:scene.calendar.start,end:scene.calendar.end,days:inspectedDays,observed_days:dates.length},
   event_total:scene.event_total,window_events:total,repositories:repos,signals,
   snapshot_age_days:scene.stale_days,period:STORY_PERIOD,
   note:'Observed public events only. The robots are fictional and perform no GitHub actions.'};
}

export function forgeProgress(time){
 const t=((time%STORY_PERIOD)+STORY_PERIOD)%STORY_PERIOD;
 return clamp((t-0.85)/9.8,0,1);
}
export function sourceDaysAt(story,time){
 const visibleWeek=Math.floor(forgeProgress(time)*53);
 return story.calendar.days.filter(d=>d.week<visibleWeek).length;
}

export function forgeCrewTargets(story,teamIndex){
 if(!Number.isInteger(teamIndex)||teamIndex<0||teamIndex>=story.repositories.length)throw Error('Invalid repository team');
 // Each team can work only on an observed day for its own repository.
 const days=new Map(story.calendar.days.map(d=>[d.date,d]));
 const work=story.signals[teamIndex]?.all_days||story.signals[teamIndex]?.events||[];
 const byWeek=new Map();
 for(const item of work){
   const day=days.get(item.date);
   if(!day)continue;
   const current=byWeek.get(day.week);
   if(!current||item.events>current.events||(item.events===current.events&&item.date<current.date))
     byWeek.set(day.week,{date:item.date,events:item.events,weekday:day.weekday});
 }
 return Array.from({length:53},(_,week)=>{
   const record=byWeek.get(week),x=G.x+week*G.dx+G.size/2;
   const y=record?G.y+record.weekday*G.dy+G.size/2:115+(teamIndex%5)*2.1;
   return {week,x,y,date:record?.date||null,events:record?.events||0,
     repo_full_name:story.repositories[teamIndex].full_name};
 });
}

export function forgeCrewPosition(targets,time){
 if(!Array.isArray(targets)||targets.length!==53)throw Error('53-week team targets required');
 const cycle=((time%STORY_PERIOD)+STORY_PERIOD)%STORY_PERIOD;
 if(cycle<0.85)return {x:G.x-9,y:115,active:false,date:null,phase:'ready'};
 const p=forgeProgress(time);
 if(p<1){
   const step=p*53,w=Math.min(52,Math.floor(step)),q=step-w;
   const a=targets[w],b=targets[Math.min(52,w+1)];
   return {x:a.x+(b.x-a.x)*q,y:a.y+(b.y-a.y)*q,
     active:!!a.date,date:a.date,phase:a.date?'working':'travelling'};
 }
 const last=targets.slice().reverse().find(d=>d.date),start=targets[52];
 const target=last||{x:G.x+53*G.dx,y:start.y,date:null};
 const q=clamp((cycle-10.65)/1.2,0,1);
 const eased=q*q*(3-2*q);
 return {x:start.x+(target.x-start.x)*eased,y:start.y+(target.y-start.y)*eased,
   active:!!last,date:last?.date||null,phase:q>=1?'complete':'converging'};
}

function svgCrewSchedule(targets){
 const values=[],times=[],add=(t,p)=>{times.push((t/STORY_PERIOD).toFixed(6));values.push(p.x.toFixed(2)+' '+p.y.toFixed(2))};
 add(0,{x:G.x-9,y:115});
 add(.85,targets[0]);
 for(let w=1;w<53;w++)add(.85+9.8*w/53,targets[w]);
 add(10.65,targets[52]);
 const last=targets.slice().reverse().find(d=>d.date)||targets[52];
 add(11.85,last);
 add(STORY_PERIOD,last);
 return {times:times.join(';'),values:values.join(';')};
}

function pathFor(signal,repo){
 const x0=144+repo.index*206,y0=292,x1=signal.x,y1=signal.y;
 const control=256-(repo.index%2)*12;
 return 'M '+x0.toFixed(1)+' '+y0.toFixed(1)+' C '+x0.toFixed(1)+' '+control+' '+x1.toFixed(1)+' '+control+' '+x1.toFixed(1)+' '+y1.toFixed(1);
}
export function signalPosition(signal,repo,time){
 const d=((time%STORY_PERIOD)+STORY_PERIOD)%STORY_PERIOD-signal.start;
 const p=clamp(d/signal.duration,0,1),active=d>=0&&d<=signal.duration;
 const x0=144+repo.index*206,y0=292,x1=signal.x,y1=signal.y,control=256-(repo.index%2)*12;
 const b=1-p;
 return {x:b*b*b*x0+3*b*b*p*x0+3*b*p*p*x1+p*p*p*x1,
   y:b*b*b*y0+3*b*b*p*control+3*b*p*p*control+p*p*p*y1,active,progress:p};
}
export function storyState(story,mode,time){
 if(!MODES.includes(mode))throw Error('Invalid story mode');
 const progress=mode==='forge'?forgeProgress(time):1;
 const cells=story.calendar.days.filter(d=>mode==='relay'||d.week<Math.floor(progress*53));
 return {progress,revealed_days:cells.length,revealed_events:cells.reduce((n,d)=>n+d.events,0),
   active_signals:mode==='relay'?story.signals.flatMap(group=>group.events.map(e=>signalPosition(e,group.repo,time))).filter(x=>x.active).length:0};
}
const svgText=(x,y,value,size=11,colour='#fff',attrs='')=>'<text x="'+x+'" y="'+y+'" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="'+size+'" fill="'+colour+'" '+attrs+'>'+s(value)+'</text>';
function svgFrame(story,mode,theme){
 const c=themeColours[theme],r=[];
 r.push('<rect width="1120" height="350" rx="22" fill="'+c.bg+'"/>');
 r.push('<rect x="17" y="16" width="1086" height="318" rx="17" fill="none" stroke="'+c.line+'" opacity=".68"/>');
 r.push('<rect x="30" y="28" width="8" height="34" rx="4" fill="'+(mode==='forge'?COLOURS[0]:COLOURS[1])+'"/>');
 r.push(svgText(53,48,mode==='forge'?'SWARM FORGE':'SWARM RELAY',24,c.text,'letter-spacing="2"'));
 r.push(svgText(53,64,mode==='forge'?'AGENTS ASSEMBLE THE OBSERVED CALENDAR':'REPOSITORY TEAMS TRANSPORT REAL EVENT SIGNALS',10,c.muted,'letter-spacing="1.3"'));
 r.push(svgText(1074,39,'@'+story.user.login,13,c.text,'text-anchor="end"'));
 r.push(svgText(1074,57,String(story.window_events)+' OBSERVED EVENTS  /  '+story.calendar.observed_days+' DAYS',10,c.muted,'text-anchor="end"'));
 r.push('<rect x="69" y="87" width="987" height="173" rx="13" fill="'+c.panel+'" stroke="'+c.line+'"/>');
 r.push(svgText(104,105,'53 WEEKS  ·  SUNDAY TO SATURDAY',10,c.muted,'letter-spacing=".8"'));
 r.push(svgText(1046,105,'LOW  ◼ ◼ ◼ ◼  HIGH',10,c.muted,'text-anchor="end"'));
 let prev=-1;
 for(let w=0;w<53;w++){
   const m=new Date(dateFrom(story.calendar.start,w*7)+'T00:00:00Z').getUTCMonth();
   if(m!==prev){r.push(svgText(G.x+w*G.dx,G.y-6,MONTHS[m],9,c.muted));prev=m;}
 }
 for(const [weekday,label] of [[1,'M'],[3,'W'],[5,'F']])r.push(svgText(78,G.y+weekday*G.dy+10,label,10,c.muted));
 r.push('<rect x="69" y="273" width="987" height="44" rx="10" fill="'+c.panel+'" stroke="'+c.line+'"/>');
 r.push(svgText(75,333,'SOURCE-OBSERVED EVENTS ONLY  ·  NOT GITHUB CONTRIBUTION TOTALS  ·  FICTIONAL AGENT METAPHOR',9,c.muted,'letter-spacing=".4"'));
 if(story.source==='demo')r.push('<rect x="908" y="28" width="150" height="15" rx="7" fill="#84452e"/>'+svgText(983,39,'SYNTHETIC DEMO',10,'#fff','text-anchor="middle"'));
 return r;
}
function cellFill(level,c){return [c.off,c.low,c.mid,c.high,c.peak][level]}
export function renderStorySvg(story,{mode='forge',theme='dark',animated=true,time=11}={}){
 if(!MODES.includes(mode)||!themeColours[theme])throw Error('Invalid SVG mode or theme');
 const c=themeColours[theme],r=svgFrame(story,mode,theme),progress=forgeProgress(time);
 const txt=(x,y,v,sz,col,attr)=>svgText(x,y,v,sz,col,attr);
 const days=new Map(story.calendar.days.map(d=>[d.date,d]));
 const perWeek=Array.from({length:53},()=>[]);
 for(let w=0;w<53;w++)for(let weekday=0;weekday<7;weekday++){
   const date=dateFrom(story.calendar.start,w*7+weekday);
   const d=days.get(date),x=G.x+w*G.dx,y=G.y+weekday*G.dy,fill=d?cellFill(maxLevel(d.events),c):c.off;
   const visibility=d?1:.65;
   let body='<rect class="'+(d?'day-cell':'empty-cell')+'" data-date="'+date+'" x="'+x.toFixed(2)+'" y="'+y.toFixed(2)+'" width="'+G.size+'" height="'+G.size+'" rx="2.4" fill="'+fill+'" opacity="'+visibility+'"/>';
   if(d&&d.events>=5)body+='<circle cx="'+(x+G.size-2).toFixed(2)+'" cy="'+(y+2).toFixed(2)+'" r="1.5" fill="'+c.bright+'"/>';
   if(mode==='forge'&&d){
     if(animated){
       const start=(.85+9.8*w/53)/STORY_PERIOD;
       const end=Math.min(.999,start+.009);
       body='<g opacity=".1"><animate attributeName="opacity" dur="14s" repeatCount="indefinite" keyTimes="0;'+start.toFixed(5)+';'+end.toFixed(5)+';1" values=".1;.1;1;1"/>'+body+'</g>';
     }else if(w>=Math.floor(progress*53))body='<g opacity=".1">'+body+'</g>';
   }
   perWeek[w].push(body);
 }
 r.push('<g id="contributions">'+perWeek.flat().join('')+'</g>');
 if(mode==='forge'){
   const beam=(G.x-3+G.dx*53*(animated?0:progress)).toFixed(1);
   r.push('<g opacity=".85" stroke="'+COLOURS[0]+'" stroke-width="1.5">');
   if(animated)r.push('<line x1="'+(G.x-3)+'" x2="'+(G.x-3)+'" y1="117" y2="249"><animate attributeName="x1" values="'+(G.x-3)+';'+(G.x-3)+';'+(G.x+G.dx*53)+';'+(G.x+G.dx*53)+'" keyTimes="0;.0607;.7607;1" dur="14s" repeatCount="indefinite"/><animate attributeName="x2" values="'+(G.x-3)+';'+(G.x-3)+';'+(G.x+G.dx*53)+';'+(G.x+G.dx*53)+'" keyTimes="0;.0607;.7607;1" dur="14s" repeatCount="indefinite"/></line>');
   else r.push('<line x1="'+beam+'" x2="'+beam+'" y1="117" y2="249"/>');
   r.push('</g>');
   // Each builder follows the genuine dates of its own repository, rather
   // than marching in an arbitrary horizontal line.
   for(let i=0;i<story.repositories.length;i++){
     const targets=forgeCrewTargets(story,i),colour=COLOURS[i],pos=forgeCrewPosition(targets,time);
     const track=svgCrewSchedule(targets),x=animated?0:pos.x,y=animated?0:pos.y;
     r.push('<g transform="translate('+x.toFixed(2)+' '+y.toFixed(2)+')">');
     r.push('<circle cx="0" cy="0" r="7" fill="'+c.panel+'" stroke="'+colour+'" stroke-width="2"/>');
     r.push('<circle cx="0" cy="0" r="2.5" fill="'+colour+'"/>');
     r.push('<path d="M -10 0 L -7 0 M 7 0 L 10 0" stroke="'+colour+'" stroke-width="1.5"/>');
     if(animated)r.push('<animateTransform attributeName="transform" type="translate" calcMode="linear" values="'+track.values+'" keyTimes="'+track.times+'" dur="14s" repeatCount="indefinite"/>');
     r.push('</g>');
   }
   const marker='<g><circle cx="565" cy="49" r="13" fill="'+c.panel+'" stroke="'+COLOURS[0]+'" stroke-width="2"/>'+
    COLOURS.map((colour,i)=>{const angle=i*Math.PI*2/5;return '<circle cx="'+(565+Math.cos(angle)*8).toFixed(1)+'" cy="'+(49+Math.sin(angle)*8).toFixed(1)+'" r="2.6" fill="'+colour+'"/>';}).join('')+'</g>';
   if(animated)r.push('<g opacity="0"><animate attributeName="opacity" dur="14s" keyTimes="0;.76;.77;1" values="0;0;1;1" repeatCount="indefinite"/>'+marker+'</g>');
   else if(progress>=1)r.push(marker);
   r.push(txt(104,272,'ASSEMBLY ROUTE  /  ALL '+story.window_events+' OBSERVED EVENTS',10,c.muted));
   r.push(txt(1040,272,animated?'BUILDING  →  COMPLETE':(Math.floor(progress*100)+'% BUILT'),10,COLOURS[0],'text-anchor="end"'));
 }else{
   for(const group of story.signals){
     const repo=group.repo;
     for(const signal of group.events){
       const path=pathFor(signal,repo),pos=signalPosition(signal,repo,time);
       if(animated){
         const a=signal.start/STORY_PERIOD,b=(signal.start+signal.duration)/STORY_PERIOD;
         r.push('<circle cx="'+signal.x+'" cy="'+signal.y+'" r="10" fill="none" stroke="'+repo.colour+'" stroke-width="2" opacity="0"><animate attributeName="opacity" values="0;0;.9;.9;0;0" keyTimes="0;'+a.toFixed(5)+';'+(a+.006).toFixed(5)+';'+(b-.006).toFixed(5)+';'+b.toFixed(5)+';1" dur="14s" repeatCount="indefinite"/></circle>');
       }else if(pos.active)r.push('<circle cx="'+signal.x+'" cy="'+signal.y+'" r="10" fill="none" stroke="'+repo.colour+'" opacity=".9" stroke-width="2"/>');
       if(animated){
         const a=signal.start/STORY_PERIOD,b=(signal.start+signal.duration)/STORY_PERIOD;
         const shape='<polygon points="'+hex(0,0,6)+'" fill="'+repo.colour+'" stroke="'+c.bright+'" stroke-width="1"/>';
         r.push('<g opacity="0"><animate attributeName="opacity" dur="14s" keyTimes="0;'+a.toFixed(5)+';'+(a+.006).toFixed(5)+';'+(b-.006).toFixed(5)+';'+b.toFixed(5)+';1" values="0;0;1;1;0;0" repeatCount="indefinite"/>'+shape+
           '<animateMotion path="'+path+'" dur="14s" keyPoints="0;0;1;1" keyTimes="0;'+a.toFixed(5)+';'+b.toFixed(5)+';1" calcMode="linear" repeatCount="indefinite"/></g>');
       }else if(pos.active)r.push('<polygon points="'+hex(pos.x,pos.y,6)+'" fill="'+repo.colour+'" stroke="'+c.bright+'"/>');
     }
   }
   r.push(txt(104,272,'LIVE SIGNALS  /  '+story.signals.reduce((n,g)=>n+g.events.length,0)+' SOURCE-BACKED ROUTES',10,c.muted));
   r.push(txt(1040,272,'THE GRID IS NEVER ERASED',10,COLOURS[1],'text-anchor="end"'));
 }
 // Five repository teams and their tally, colour-coded consistently throughout.
 story.repositories.forEach((repo,i)=>{
   const x=86+i*206;
   r.push('<rect x="'+x+'" y="282" width="185" height="26" rx="6" fill="'+c.panel2+'"/>');
   r.push('<circle cx="'+(x+12)+'" cy="295" r="5" fill="'+repo.colour+'"/>');
   r.push(txt(x+23,292,safeName(repo.name,18),10,c.text));
   r.push(txt(x+23,302,repo.events+' OBSERVED EVENTS',8,c.muted));
 });
 const title=mode==='forge'?'Swarm Forge':'Swarm Relay';
 const source=story.source==='demo'?'Synthetic demonstration':'Public GitHub source snapshot';
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1120 350" width="1120" height="350" role="img" aria-labelledby="swarm-title swarm-desc">'+
   '<title id="swarm-title">'+title+' for '+s(story.user.login)+'</title>'+
   '<desc id="swarm-desc">'+source+'. '+story.window_events+' observed events across '+story.calendar.observed_days+' recorded dates. Agents are decorative metaphors, not GitHub actors.</desc>'+
   r.join('')+'</svg>';
}

// A compact 32-colour indexed raster with high contrast at actual README size.
// GIF frames are purposefully rendered independently from SVG, using the same
// calendar, event-to-team grouping and event dates.
const PALETTE_DARK=['#07131e','#effaff','#a3bace','#102336','#344f63','#53e0c8','#7bc5ff','#be9dff','#ffc47a','#ff8eb4','#a1ffe1','#192e40','#27615f','#248f83','#37c3a7','#f8ffff','#152b41','#233f51','#39576a','#527085','#648da0','#88b8c5','#ee8e8b','#e3edfb','#23776e','#3d8ab8','#6f6cba','#a37e50','#a45679','#0e2332','#e4c2a1','#6b91a1'];
const PALETTE_LIGHT=['#f2f4f3','#182b3b','#466174','#ffffff','#aec3cc','#247e71','#3b82ae','#8759b3','#ab702c','#ab4971','#116858','#dee8e7','#addbd0','#71c6b4','#2b9c89','#112536','#e2ebed','#d2e3e4','#b6cdd3','#98b9c2','#82aaaa','#668f9d','#ac6b6e','#445869','#d0e9e0','#bdd9e8','#ddc5ed','#e8ddcb','#f2d6e5','#d9e4e4','#9c6637','#a0adb7'];
const FONT={
 'A':'01110 10001 10001 11111 10001 10001 10001','B':'11110 10001 10001 11110 10001 10001 11110',
 'C':'01111 10000 10000 10000 10000 10000 01111','D':'11110 10001 10001 10001 10001 10001 11110',
 'E':'11111 10000 10000 11110 10000 10000 11111','F':'11111 10000 10000 11110 10000 10000 10000',
 'G':'01111 10000 10000 10111 10001 10001 01111','H':'10001 10001 10001 11111 10001 10001 10001',
 'I':'11111 00100 00100 00100 00100 00100 11111','J':'00111 00010 00010 00010 10010 10010 01100',
 'K':'10001 10010 10100 11000 10100 10010 10001','L':'10000 10000 10000 10000 10000 10000 11111',
 'M':'10001 11011 10101 10101 10001 10001 10001','N':'10001 11001 10101 10011 10001 10001 10001',
 'O':'01110 10001 10001 10001 10001 10001 01110','P':'11110 10001 10001 11110 10000 10000 10000',
 'Q':'01110 10001 10001 10001 10101 10010 01101','R':'11110 10001 10001 11110 10100 10010 10001',
 'S':'01111 10000 10000 01110 00001 00001 11110','T':'11111 00100 00100 00100 00100 00100 00100',
 'U':'10001 10001 10001 10001 10001 10001 01110','V':'10001 10001 10001 10001 01010 01010 00100',
 'W':'10001 10001 10001 10101 10101 10101 01010','X':'10001 10001 01010 00100 01010 10001 10001',
 'Y':'10001 10001 01010 00100 00100 00100 00100','Z':'11111 00001 00010 00100 01000 10000 11111',
 '0':'01110 10011 10101 10101 11001 10001 01110','1':'00100 01100 00100 00100 00100 00100 01110',
 '2':'01110 10001 00001 00110 01000 10000 11111','3':'11110 00001 00001 01110 00001 00001 11110',
 '4':'00010 00110 01010 10010 11111 00010 00010','5':'11111 10000 10000 11110 00001 00001 11110',
 '6':'01110 10000 10000 11110 10001 10001 01110','7':'11111 00001 00010 00100 01000 01000 01000',
 '8':'01110 10001 10001 01110 10001 10001 01110','9':'01110 10001 10001 01111 00001 00001 01110',
 ' ':'00000 00000 00000 00000 00000 00000 00000',':':'00000 00110 00110 00000 00110 00110 00000',
 '-':'00000 00000 00000 11111 00000 00000 00000','/':'00001 00001 00010 00100 01000 10000 10000',
 '.':'00000 00000 00000 00000 00000 00110 00110','+':'00000 00100 00100 11111 00100 00100 00000',
 '@':'01110 10001 10111 10101 10111 10000 01110','?':'01110 10001 00001 00010 00100 00000 00100',
 '=':'00000 11111 00000 11111 00000 00000 00000'
};
export function storyGifFrame(story,{mode='forge',theme='dark',time=0}={}){
 if(!MODES.includes(mode)||!themeColours[theme])throw Error('Invalid GIF mode or theme');
 const W=800,H=250,p=new Uint8Array(W*H),scx=W/1120,scy=H/350;
 const pix=(x,y,col)=>{x=Math.round(x);y=Math.round(y);if(x>=0&&x<W&&y>=0&&y<H)p[y*W+x]=col};
 const box=(x,y,w,h,col)=>{x=Math.round(x);y=Math.round(y);w=Math.max(1,Math.round(w));h=Math.max(1,Math.round(h));
   const a=Math.max(0,x),b=Math.max(0,y),c=Math.min(W,x+w),d=Math.min(H,y+h);
   for(let yy=b;yy<d;yy++)if(c>a)p.fill(col,yy*W+a,yy*W+c)};
 const line=(x,y,X,Y,col)=>{const n=Math.max(1,Math.ceil(Math.max(Math.abs(X-x),Math.abs(Y-y))));for(let k=0;k<=n;k++)pix(x+(X-x)*k/n,y+(Y-y)*k/n,col)};
 const ring=(cx,cy,rad,col)=>{for(let k=0;k<36;k++){const a=k*Math.PI/18;pix(cx+Math.cos(a)*rad,cy+Math.sin(a)*rad,col)}};
 const label=(x,y,value,col=1,scale=1,max=70)=>{
   const str=Array.from(String(value).toUpperCase()).slice(0,max);
   for(let k=0;k<str.length;k++){const rows=(FONT[str[k]]||FONT['?']).split(' ');
    for(let r=0;r<7;r++)for(let c=0;c<5;c++)if(rows[r][c]==='1')box(x+k*6*scale+c*scale,y+r*scale,scale,scale,col)}
 };
 const rect=(x,y,w,h,col)=>box(x*scx,y*scy,w*scx,h*scy,col);
 const graphX=x=>x*scx,graphY=y=>y*scy;
 for(let y=9;y<H;y+=14)for(let x=11;x<W;x+=14)pix(x,y,29);
 box(12,12,776,37,3);rect(16,16,5,28,mode==='forge'?5:6);
 const done=mode==='forge'&&forgeProgress(time)>=1;
 const sx=427,sy=30,orb=done?8:14;
 for(let i=0;i<5;i++){
   const angle=2*Math.PI*i/5+time*.28,x=sx+Math.cos(angle)*orb,y=sy+Math.sin(angle)*orb;
   line(sx,sy,x,y,17);box(x-2,y-2,5,5,5+i);
 }
 ring(sx,sy,done?13:6,done?10:1);
 label(451,23,done?'TEAMS SYNCED':'5 ACTIVE TEAMS',done?10:2,1,14);
 label(29,21,mode==='forge'?'SWARM FORGE':'SWARM RELAY',1,2);
 label(30,41,mode==='forge'?'BUILDING THE REAL OBSERVED CALENDAR':'TEAMS RELAY REPOSITORY SIGNALS',2,1);
 label(553,20,'@'+story.user.login,1,1,38);
 label(553,33,story.window_events+' EVENTS / '+story.calendar.observed_days+' DAYS',2,1);
 box(49,60,705,128,3);
 label(70,64,'53 WEEKS / SUN TO SAT',2);
 if(story.source==='demo')label(664,65,'DEMO DATA',8);
 const byDate=new Map(story.calendar.days.map(d=>[d.date,d]));
 const progress=forgeProgress(time),builtWeeks=Math.floor(progress*53);
 for(let w=0;w<53;w++)for(let day=0;day<7;day++){
   const date=dateFrom(story.calendar.start,w*7+day),d=byDate.get(date);
   const x=graphX(G.x+w*G.dx),y=graphY(G.y+day*G.dy);
   let colour=11;
   if(d){
     const level=maxLevel(d.events),shades=[11,12,13,14,10];
     colour=(mode==='forge'&&w>=builtWeeks)?17:shades[level];
   } else colour=11;
   box(x,y,9,9,colour);
   if(d&&d.events>=5&&!(mode==='forge'&&w>=builtWeeks))pix(x+7,y+1,15);
 }
 const first=Date.parse(story.calendar.start+'T00:00:00Z');
 let last=-1;for(let w=0;w<53;w++){
   const month=new Date(first+w*7*DAY).getUTCMonth();
   if(month!==last){label(graphX(G.x+w*G.dx),78,MONTHS[month],2,1,3);last=month}
 }
 label(58,106,'M',2);label(58,129,'W',2);label(58,153,'F',2);
 if(mode==='forge'){
   const head=graphX(G.x+builtWeeks*G.dx),text=storyState(story,mode,time);
   line(head,84,head,179,5);
   for(let k=0;k<story.repositories.length;k++){
     const targets=forgeCrewTargets(story,k),crew=forgeCrewPosition(targets,time);
     const x=graphX(crew.x),y=graphY(crew.y),col=5+k;
     ring(x,y,crew.active?6:4,col);
     box(x-2,y-2,5,5,15);pix(x,y,col);
     if(crew.phase==='complete'&&crew.active)ring(x,y,10,col);
   }
   box(50,190,704,17,3);
   box(51,191,Math.round(702*progress),15,24);
   label(57,194,progress>=1?'ASSEMBLY COMPLETE':('ASSEMBLING '+text.revealed_events+' / '+story.window_events+' EVENTS'),1);
 }else{
   for(const group of story.signals){
     for(const signal of group.events){
       const path=signalPosition(signal,group.repo,time);
       const x0=graphX(144+group.repo.index*206),y0=graphY(292),x1=graphX(signal.x),y1=graphY(signal.y);
       if(path.active){
         const x=graphX(path.x),y=graphY(path.y),colour=5+group.repo.index;
         for(const dt of [.18,.12,.06]){
           const echo=signalPosition(signal,group.repo,time-dt);
           if(echo.active)box(graphX(echo.x)-1,graphY(echo.y)-1,3,3,dt===.06?colour:18);
         }
         ring(x,y,7,colour);box(x-2,y-2,5,5,15);
         ring(x1,y1,10,colour);
       }
     }
   }
   box(50,190,704,17,3);
   const flights=story.signals.flatMap(g=>g.events.filter(e=>signalPosition(e,g.repo,time).active).map(e=>({repo:g.repo,event:e})));
   if(flights.length){
     const current=flights[0],kind=current.event.kind.replaceAll('_',' ').toUpperCase();
     label(57,194,'LIVE DELIVERY  '+safeName(current.repo.name,16)+'  /  '+kind+'  /  '+current.event.date,1,1,105);
   }else label(57,194,'WAITING FOR THE NEXT SOURCE-BACKED SIGNAL / CALENDAR PRESERVED',1);
 }
 for(let i=0;i<story.repositories.length;i++){
   const r=story.repositories[i],x=54+i*141,col=5+i;
   box(x,211,130,18,16);box(x,211,3,18,col);
   label(x+7,214,r.name,1,1,13);
   label(x+7,224,r.events+' EVENTS',2,1);
 }
 label(52,236,'OBSERVED PUBLIC EVENTS ONLY - NO REAL AGENT OPERATIONS',2,1);
 return p;
}
export function renderStoryGif(story,{mode='forge',theme='dark',frames=56}={}){
 if(!Number.isInteger(frames)||frames<1||frames>140)throw Error('Invalid frame count');
 if(!themeColours[theme])throw Error('Invalid theme');
 const bytes=[],put=(...v)=>bytes.push(...v),word=v=>put(v&255,(v>>8)&255),str=t=>{for(const c of t)put(c.charCodeAt(0))};
 str('GIF89a');word(800);word(250);put(0xF4,0,0);
 for(const c of (theme==='dark'?PALETTE_DARK:PALETTE_LIGHT))put(parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16));
 str('!\xFF\x0BNETSCAPE2.0\x03\x01\x00\x00\x00');
 for(let f=0;f<frames;f++){
   const pixels=storyGifFrame(story,{mode,theme,time:f*STORY_PERIOD/frames});
   const compressed=lzwEncode(pixels,5);
   const delay=Math.round(STORY_PERIOD*100*(f+1)/frames)-Math.round(STORY_PERIOD*100*f/frames);
   put(0x21,0xF9,4,4);word(delay);put(0,0);
   put(0x2C);word(0);word(0);word(800);word(250);put(0);
   put(5);for(let i=0;i<compressed.length;i+=255){const n=Math.min(255,compressed.length-i);put(n);for(let j=i;j<i+n;j++)bytes.push(compressed[j]);}put(0);
 }
 put(0x3B);return Uint8Array.from(bytes);
}
