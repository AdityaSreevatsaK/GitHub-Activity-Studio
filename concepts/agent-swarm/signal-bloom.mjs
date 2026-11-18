// Signal Bloom: deterministic, non-destructive swarm animation for GitHub-style
// source-observed events. This is a visual metaphor, not autonomous operation.
import { escapeText } from './calendar.mjs';
import { lzwEncode } from './gif.mjs';

export const BLOOM_PERIOD = 14;
export const BLOOM_METRICS = ['events','commits'];
const GRID = {x:99,y:128,dx:17.25,dy:16.6,size:12.4};
const MONTHS=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const DAY=86400000;
const W=800,H=250;
const THEMES={
 dark:{bg:'#06121f',panel:'#0d2234',stroke:'#274359',empty:'#152b3d',text:'#edfaff',muted:'#a6c3cf',low:'#3bd2b7',mid:'#73ebcc',high:'#ffb96b',peak:'#ef81ee'},
 light:{bg:'#f1f5f1',panel:'#ffffff',stroke:'#bacfd0',empty:'#e1eae5',text:'#173244',muted:'#4c6777',low:'#2e9e87',mid:'#138b7c',high:'#c87526',peak:'#ae478c'}
};
const PALETTE={
 dark:['#06121f','#edfaff','#a6c3cf','#0d2234','#274359','#3bd2b7','#73ebcc','#ffb96b','#ef81ee','#152b3d','#ffffff','#276e6a','#449a8b','#996b4a','#8b568d','#284a58','#536d7a','#bcefe2','#fbe1af','#ffd3fd','#315066','#ffdeb1','#8869bf','#a9b8da','#65adbf','#163448','#d4f4eb','#dfb0d6','#34516a','#778da4','#cdb882','#edf3ff'],
 light:['#f1f5f1','#173244','#4c6777','#ffffff','#bacfd0','#2e9e87','#138b7c','#c87526','#ae478c','#e1eae5','#ffffff','#99c9bd','#6cb3a5','#d9ad80','#d4a5c8','#d1e0dd','#698c90','#e0f3e9','#ffe3b7','#f9d6ef','#b8cacf','#efd9af','#c8bce2','#d2dded','#7eb6c3','#e9f1ee','#edf9f3','#f3d0e8','#d1dbdd','#93a2b5','#decdac','#ffffff']
};
const limit=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=v=>{const x=limit(v,0,1);return x*x*(3-2*x)};
const stamp=(date)=>Date.parse(date+'T00:00:00Z');
const atDate=(start,step)=>new Date(stamp(start)+step*DAY).toISOString().slice(0,10);
function tier(count,metric){if(count<=0)return 0;return metric==='commits'?(count>=5?4:count>=3?3:count>=2?2:1):(count>=25?4:count>=7?3:count>=3?2:1)}
const cx=d=>GRID.x+d.week*GRID.dx+GRID.size/2;
const cy=d=>GRID.y+d.weekday*GRID.dy+GRID.size/2;
const startOf=d=>.75+8.75*d.week/52+.08*d.weekday/6;
const activation=(d,t)=>smooth((t-startOf(d))/.54);
const tone=(n)=>['none','low','mid','high','peak'][n];
function xml(s){return escapeText(String(s));}

export function bloomScene(scene,{metric='events'}={}){
 if(!BLOOM_METRICS.includes(metric))throw Error('Invalid metric');
 if(!scene||!scene.calendar||!Array.isArray(scene.calendar.days)||typeof scene.calendar.start!=='string')throw Error('Calendar scene required');
 const first=stamp(scene.calendar.start);
 const days=scene.calendar.days.map(d=>{
  const index=Math.round((stamp(d.date)-first)/DAY),week=Math.floor(index/7),weekday=index%7;
  if(index<0||index>=371||d.events<0)throw Error('Invalid recorded calendar day');
  const count=metric==='commits'?(d.kinds?.commit||0):d.events;
  return {date:d.date,week,weekday,count,events:d.events,kind_counts:d.kinds,level:tier(count,metric)};
 }).sort((a,b)=>a.date.localeCompare(b.date));
 const active=days.filter(d=>d.count>0);
 const targets=active.length<=12?active: Array.from({length:12},(_,i)=>active[Math.round(i*(active.length-1)/11)]);
 const drones=targets.map((d,index)=>({date:d.date,week:d.week,weekday:d.weekday,level:d.level,index:index%4,at:Number((startOf(d)+.22).toFixed(4)),x:cx(d),y:cy(d)}));
 return {metric,source:scene.source,login:scene.user.login,generated_at:scene.generated_at,start:scene.calendar.start,end:scene.calendar.end,
   days,active_days:active.length,observed_days:days.length,observed_events:scene.calendar.window_events,metric_total:active.reduce((n,d)=>n+d.count,0),drones,
   notice:'Counts are observed public source events, not official GitHub contributions. Robots and beams are symbolic.'};
}
export function bloomState(scene,time){
 const t=(time%BLOOM_PERIOD+BLOOM_PERIOD)%BLOOM_PERIOD;
 const done=scene.days.filter(d=>d.level>0&&activation(d,t)>.99);
 return {activated_days:done.length,total_days:scene.active_days,metric_total:scene.metric_total,finished:t>=10.2,beacons:scene.drones.filter(x=>Math.abs(t-x.at)<.25).length};
}
function positionFor(drone,t){
 const start=(t-.65)/9.1;
 const p=limit(start,0,1);
 const x=GRID.x+53*GRID.dx*p;
 const y=GRID.y+GRID.dy*(1+drone*1.5)+Math.sin(t*2+drone*2)*3;
 return {x,y};
}
function svgBloom(d,theme,opacity=1){
 const c=THEMES[theme],centreX=cx(d),centreY=cy(d),colour=c[tone(d.level)];
 const radius=[0,4.5,6.8,9.3,11.2][d.level],petals=[0,4,5,6,8][d.level];
 const out=[`<circle r="${radius*.79}" fill="${colour}" opacity=".12"/>`];
 for(let i=0;i<petals;i++){
  const angle=i*Math.PI*2/petals-Math.PI/2;
  const px=(Math.cos(angle)*radius*.75).toFixed(2),py=(Math.sin(angle)*radius*.75).toFixed(2);
  out.push(`<ellipse cx="${px}" cy="${py}" rx="${(radius*.23).toFixed(2)}" ry="${(radius*.35).toFixed(2)}" transform="rotate(${(angle*180/Math.PI+90).toFixed(1)} ${px} ${py})" fill="${colour}" opacity="${opacity}"/>`);
 }
 out.push(`<circle r="${(radius*.33).toFixed(2)}" fill="${c.text}"/>`,`<circle r="${(radius*.16).toFixed(2)}" fill="${colour}"/>`);
 if(d.level>=3)out.push(`<circle r="${(radius+1.5).toFixed(2)}" fill="none" stroke="${colour}" stroke-width=".85" opacity=".6"/>`);
 if(d.level===4)out.push(`<path d="M 0 -${radius+4} L 0 ${radius+4} M -${radius+4} 0 L ${radius+4} 0" stroke="${colour}" stroke-width="1" opacity=".65"/>`);
 return `<g transform="translate(${centreX.toFixed(2)} ${centreY.toFixed(2)})">${out.join('')}</g>`;
}
export function renderBloomSvg(scene,{theme='dark',animated=true,time=11.3}={}){
 if(!THEMES[theme])throw Error('Invalid theme');
 const c=THEMES[theme],lines=[];
 const label=(x,y,s,size=11,color=c.text,attr='')=>`<text x="${x}" y="${y}" fill="${color}" font-family="Verdana,Arial,sans-serif" font-weight="600" font-size="${size}" ${attr}>${xml(s)}</text>`;
 lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1120 350" width="1120" height="350" role="img" aria-labelledby="bloom-title bloom-desc">`);
 lines.push(`<title id="bloom-title">Signal Bloom for ${xml(scene.login)}</title>`,
 `<desc id="bloom-desc">${scene.metric==='commits'?'Observed authored public default-branch commit events':'Observed public GitHub events'} bloom as geometric flowers whose sizes vary with activity. ${scene.active_days} observed dates. This is an artistic metaphor, not GitHub's complete contribution graph.</desc>`);
 lines.push(`<defs><linearGradient id="bloom-sky" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${c.bg}"/><stop offset="1" stop-color="${c.panel}"/></linearGradient></defs>`);
 lines.push(`<rect width="1120" height="350" rx="20" fill="url(#bloom-sky)"/>`,
 `<rect x="18" y="17" width="1084" height="316" rx="17" fill="none" stroke="${c.stroke}"/>`,
 `<circle cx="40" cy="45" r="12" fill="none" stroke="${c.peak}" stroke-width="2"/>`,
 `<circle cx="40" cy="45" r="5" fill="${c.mid}"/>`,
 label(62,48,'SIGNAL BLOOM',24,c.text,'letter-spacing="1.5"'),
 label(62,66,'SWARM DRONES CULTIVATE AN ACTIVITY GARDEN',10,c.muted,'letter-spacing="1.0"'),
 label(1075,41,'@'+scene.login,13,c.text,'text-anchor="end"'),
 label(1075,57,scene.metric==='commits'?`${scene.metric_total} OBSERVED COMMIT EVENTS`:`${scene.metric_total} OBSERVED PUBLIC EVENTS`,10,c.muted,'text-anchor="end"'));
 if(scene.source==='demo')lines.push(`<rect x="891" y="66" width="184" height="16" rx="8" fill="#823a61"/>`,label(983,78,'SYNTHETIC DEMO',10,'#fff','text-anchor="middle"'));
 lines.push(`<rect x="72" y="89" width="978" height="171" rx="12" fill="${c.panel}" stroke="${c.stroke}"/>`);
 let prevMonth=-1;
 for(let week=0;week<53;week++){
  const month=new Date(stamp(atDate(scene.start,week*7))).getUTCMonth();
  if(month!==prevMonth){lines.push(label((GRID.x+week*GRID.dx).toFixed(1),117,MONTHS[month],9,c.muted));prevMonth=month;}
 }
 for(const [day,name] of [[1,'M'],[3,'W'],[5,'F']])lines.push(label(81,(GRID.y+day*GRID.dy+10).toFixed(1),name,10,c.muted));
 const lookup=new Map(scene.days.map(d=>[d.date,d]));
 lines.push('<g id="bloom-calendar">');
 for(let week=0;week<53;week++)for(let weekday=0;weekday<7;weekday++){
  const date=atDate(scene.start,week*7+weekday),d=lookup.get(date);
  const x=GRID.x+week*GRID.dx,y=GRID.y+weekday*GRID.dy;
  lines.push(`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${GRID.size}" height="${GRID.size}" rx="3" fill="${c.empty}" opacity="${d?.level?'.7':'.85'}"/>`);
  if(!d||!d.level)continue;
  const shape=svgBloom(d,theme),appear=(startOf(d)/BLOOM_PERIOD).toFixed(5),done=((startOf(d)+.54)/BLOOM_PERIOD).toFixed(5);
  if(animated)lines.push(`<g class="day-cell" data-date="${date}" opacity="0">${shape}<animate attributeName="opacity" values="0;0;1;1" keyTimes="0;${appear};${done};1" dur="14s" repeatCount="indefinite"/></g>`);
  else if(activation(d,time)>0)lines.push(`<g class="day-cell" data-date="${date}" opacity="${activation(d,time).toFixed(3)}">${shape}</g>`);
 }
 lines.push('</g>');
 // Four specialised non-destructive pollinator drones move along the grid.
 for(let agent=0;agent<4;agent++){
  const hue=[c.low,c.mid,c.high,c.peak][agent];
  const p=positionFor(agent,time),xx=animated?GRID.x:p.x,yy=animated?GRID.y+GRID.dy*(1+agent*1.5):p.y;
  let body=`<g><path d="M 0 -8 L 8 0 L 0 8 L -8 0 Z" fill="${c.panel}" stroke="${hue}" stroke-width="2"/><circle r="2.4" fill="${hue}"/><circle cx="-10" cy="0" r="2" fill="${hue}" opacity=".7"/></g>`;
  if(animated){
   body=`<g transform="translate(${xx.toFixed(2)} ${yy.toFixed(2)})">${body}<animateTransform attributeName="transform" type="translate" values="0 0;0 0;${(GRID.dx*53).toFixed(2)} 0;${(GRID.dx*53).toFixed(2)} 0" keyTimes="0;.04;.71;1" dur="14s" repeatCount="indefinite"/></g>`;
  }else if(time<10.7)body=`<g transform="translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})">${body}</g>`;
  else continue;
  lines.push(body);
 }
 // Small short beams mark actual recorded dates, and are never shown on empty cells.
 for(const d of scene.drones){
  const colour=c[tone(d.level)],y=cy(d),x=cx(d),lo=(d.at-.15)/BLOOM_PERIOD,hi=(d.at+.14)/BLOOM_PERIOD;
  if(animated)lines.push(`<g opacity="0"><path d="M ${x.toFixed(2)} ${(y-22).toFixed(2)} L ${x.toFixed(2)} ${(y-4).toFixed(2)}" stroke="${colour}" stroke-width="2.4" stroke-linecap="round"/><circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="13" fill="none" stroke="${colour}" stroke-width="1.4"/><animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;${Math.max(0,lo).toFixed(5)};${(d.at/BLOOM_PERIOD).toFixed(5)};${Math.min(.99,hi).toFixed(5)};1" dur="14s" repeatCount="indefinite"/></g>`);
  else if(Math.abs(time-d.at)<.19)lines.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="13" fill="none" stroke="${colour}" stroke-width="1.5"/>`);
 }
 lines.push(`<rect x="72" y="273" width="978" height="45" rx="10" fill="${c.panel}" stroke="${c.stroke}"/>`);
 lines.push(label(89,290,'BLOOM INTENSITY',10,c.muted));
 for(let i=1;i<=4;i++){
  const x=260+(i-1)*118;const levelLabel=scene.metric==='commits'?['1','2','3–4','5+'][i-1]:['1–2','3–6','7–24','25+'][i-1];
  lines.push(`<circle cx="${x}" cy="286" r="${i+2}" fill="${c[tone(i)]}"/>`,label(x+12,291,levelLabel,10,c.text));
 }
 lines.push(label(1030,291,'OBSERVED '+(scene.metric==='commits'?'COMMITS':'EVENTS'),10,c.muted,'text-anchor="end"'),
 label(89,306,`${scene.active_days} ACTIVE OBSERVED DAYS  /  53-WEEK SOURCE WINDOW`,10,c.muted),
 label(1043,330,'NOT OFFICIAL GITHUB CONTRIBUTION TOTALS  ·  NO AUTONOMOUS GITHUB ACTIONS',9,c.muted,'text-anchor="end"'));
 return lines.join('')+'</svg>';
}

const FONT={
 A:'01110 10001 10001 11111 10001 10001 10001',B:'11110 10001 10001 11110 10001 10001 11110',C:'01111 10000 10000 10000 10000 10000 01111',D:'11110 10001 10001 10001 10001 10001 11110',E:'11111 10000 10000 11110 10000 10000 11111',F:'11111 10000 10000 11110 10000 10000 10000',G:'01111 10000 10000 10111 10001 10001 01111',H:'10001 10001 10001 11111 10001 10001 10001',I:'11111 00100 00100 00100 00100 00100 11111',J:'00111 00010 00010 00010 10010 10010 01100',K:'10001 10010 10100 11000 10100 10010 10001',L:'10000 10000 10000 10000 10000 10000 11111',M:'10001 11011 10101 10101 10001 10001 10001',N:'10001 11001 10101 10011 10001 10001 10001',O:'01110 10001 10001 10001 10001 10001 01110',P:'11110 10001 10001 11110 10000 10000 10000',Q:'01110 10001 10001 10001 10101 10010 01101',R:'11110 10001 10001 11110 10100 10010 10001',S:'01111 10000 10000 01110 00001 00001 11110',T:'11111 00100 00100 00100 00100 00100 00100',U:'10001 10001 10001 10001 10001 10001 01110',V:'10001 10001 10001 10001 01010 01010 00100',W:'10001 10001 10001 10101 10101 10101 01010',X:'10001 10001 01010 00100 01010 10001 10001',Y:'10001 10001 01010 00100 00100 00100 00100',Z:'11111 00001 00010 00100 01000 10000 11111',
 '0':'01110 10001 10001 10001 10001 10001 01110','1':'00100 01100 00100 00100 00100 00100 01110','2':'01110 10001 00001 00110 01000 10000 11111','3':'11110 00001 00001 01110 00001 00001 11110','4':'00010 00110 01010 10010 11111 00010 00010','5':'11111 10000 10000 11110 00001 00001 11110','6':'01110 10000 10000 11110 10001 10001 01110','7':'11111 00001 00010 00100 01000 01000 01000','8':'01110 10001 10001 01110 10001 10001 01110','9':'01110 10001 10001 01111 00001 00001 01110',
 ' ':'00000 00000 00000 00000 00000 00000 00000','-':'00000 00000 00000 11111 00000 00000 00000','/':'00001 00001 00010 00100 01000 10000 10000','.':'00000 00000 00000 00000 00000 00110 00110',':':'00000 00110 00110 00000 00110 00110 00000','+':'00000 00100 00100 11111 00100 00100 00000','@':'01110 10001 10111 10101 10111 10000 01110'
};
export function bloomGifFrame(scene,{theme='dark',time=11.3}={}){
 if(!THEMES[theme])throw Error('Invalid theme');
 const p=new Uint8Array(W*H),sx=W/1120,sy=H/350;
 const pix=(x,y,c)=>{x=Math.round(x);y=Math.round(y);if(x>=0&&x<W&&y>=0&&y<H)p[y*W+x]=c};
 const box=(x,y,w,h,c)=>{x=Math.round(x);y=Math.round(y);w=Math.round(w);h=Math.round(h);const x0=Math.max(0,x),y0=Math.max(0,y),x1=Math.min(W,x+w),y1=Math.min(H,y+h);if(x1>x0)for(let i=y0;i<y1;i++)if(i>=0)p.fill(c,i*W+x0,i*W+x1)};
 const line=(x,y,X,Y,c)=>{let n=Math.ceil(Math.max(Math.abs(X-x),Math.abs(Y-y)));for(let i=0;i<=n;i++)pix(x+(X-x)*i/Math.max(1,n),y+(Y-y)*i/Math.max(1,n),c)};
 const ring=(x,y,r,c,fill=false)=>{x=Math.round(x);y=Math.round(y);r=Math.round(r);for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const d=dx*dx+dy*dy;if(fill?d<=r*r:(d<=r*r&&d>=(r-1.2)*(r-1.2)))pix(x+dx,y+dy,c)}};
 const label=(x,y,str,col=1,scale=1,max=80)=>{for(const [i,ch] of Array.from(String(str).toUpperCase()).slice(0,max).entries()){
   const rows=(FONT[ch]||FONT[' ']).split(' ');for(let ry=0;ry<7;ry++)for(let rx=0;rx<5;rx++)if(rows[ry][rx]==='1')box(x+(i*6+rx)*scale,y+ry*scale,scale,scale,col);
 }};
 const scaleX=x=>x*sx,scaleY=y=>y*sy;
 box(12,11,776,40,3);box(17,17,5,28,8);
 label(30,20,'SIGNAL BLOOM',1,2);label(30,40,'SWARM DRONES CULTIVATE YOUR ACTIVITY',2,1);
 label(552,19,'@'+scene.login,1,1,37);
 label(552,34,scene.metric_total+' '+(scene.metric==='commits'?'COMMIT EVENTS':'PUBLIC EVENTS'),2,1,37);
 box(51,61,698,130,3);
 label(69,67,'53 WEEK ACTIVITY GARDEN',2,1);
 if(scene.source==='demo')label(638,68,'DEMO DATA',8,1);
 const byDate=new Map(scene.days.map(d=>[d.date,d]));
 let m=-1;for(let week=0;week<53;week++){
  const month=new Date(stamp(atDate(scene.start,week*7))).getUTCMonth();
  if(month!==m){label(scaleX(GRID.x+week*GRID.dx),82,MONTHS[month],2,1);m=month}
 }
 for(const [y,txt] of [[103,'M'],[126,'W'],[150,'F']])label(58,y,txt,2);
 for(let week=0;week<53;week++)for(let weekday=0;weekday<7;weekday++){
  const d=byDate.get(atDate(scene.start,week*7+weekday));
  const x=scaleX(GRID.x+week*GRID.dx),y=scaleY(GRID.y+weekday*GRID.dy),xx=x+4,yy=y+4;
  box(x,y,9,9,9);
  if(!d||!d.level)continue;
  const a=activation(d,time);if(a<=0)continue;
  const radius=[0,3,4,5,7][d.level],colour=[0,5,6,7,8][d.level];
  const r=Math.max(1,Math.round(radius*a));
  if(d.level===4&&a>.7)ring(xx,yy,r+2,14);
  const petals=[0,4,5,6,8][d.level];
  for(let i=0;i<petals;i++){
   const angle=2*Math.PI*i/petals-Math.PI/2;
   const px=xx+Math.cos(angle)*r,py=yy+Math.sin(angle)*r;
   ring(px,py,d.level===1?1:2,colour,true);
  }
  ring(xx,yy,d.level>=3?3:2,10,true);
  pix(xx,yy,colour);
  if(d.level>=3&&a>.92){pix(xx-r-2,yy,colour);pix(xx+r+2,yy,colour)}
 }
 // Drones are beneficial pollinators, sweeping across the observed dates.
 if(time<10.7){for(let agent=0;agent<4;agent++){
   const pt=positionFor(agent,time),x=scaleX(pt.x),y=scaleY(pt.y),col=5+agent;
   line(x,y-5,x+5,y,col);line(x+5,y,x,y+5,col);line(x,y+5,x-5,y,col);line(x-5,y,x,y-5,col);
   ring(x,y,2,10,true);pix(x-8,y,15);pix(x-12,y,15);
 }}
 for(const d of scene.drones){if(Math.abs(time-d.at)>.22)continue;
  const x=scaleX(d.x),y=scaleY(d.y),col=[0,5,6,7,8][d.level];
  ring(x,y,10,col);line(x,y-14,x,y-5,col);
 }
 const state=bloomState(scene,time);
 box(51,195,698,16,3);box(52,196,Math.round(695*limit((time-.75)/9.5,0,1)),14,15);
 label(57,199,state.finished?'GARDEN IN FULL BLOOM':'BLOOMING '+state.activated_days+' / '+state.total_days+' OBSERVED DAYS',1,1,70);
 box(51,214,698,19,3);
 label(59,217,'INTENSITY',2);for(let i=1;i<=4;i++){
  const x=158+(i-1)*103,r=1+i;
  ring(x,224,r,4+i,true);
  label(x+12,218,(scene.metric==='commits'?['1','2','3-4','5+']:['1-2','3-6','7-24','25+'])[i-1],1);
 }
 label(600,218,scene.metric==='commits'?'COMMIT EVENTS':'PUBLIC EVENTS',2);
 label(52,239,'OBSERVED PUBLIC SOURCES ONLY / NO ACTUAL AI DRONES / NOT COMPLETE GITHUB TOTALS',2,1,88);
 return p;
}
export function renderBloomGif(scene,{theme='dark',frames=56}={}){
 if(!THEMES[theme]||!Number.isInteger(frames)||frames<1||frames>140)throw Error('Unsupported GIF settings');
 const bytes=[],put=(...a)=>bytes.push(...a),word=v=>put(v&255,(v>>8)&255),str=t=>{for(const ch of t)put(ch.charCodeAt(0))};
 str('GIF89a');word(W);word(H);put(0xF4,0,0);
 for(const color of PALETTE[theme])put(parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16));
 str('!\xFF\x0BNETSCAPE2.0\x03\x01\x00\x00\x00');
 for(let f=0;f<frames;f++){
   const data=bloomGifFrame(scene,{theme,time:f*BLOOM_PERIOD/frames}),compressed=lzwEncode(data,5);
   const delay=Math.round(BLOOM_PERIOD*100*(f+1)/frames)-Math.round(BLOOM_PERIOD*100*f/frames);
   put(0x21,0xF9,4,4);word(delay);put(0,0);
   put(0x2C);word(0);word(0);word(W);word(H);put(0);
   put(5);for(let i=0;i<compressed.length;i+=255){const size=Math.min(255,compressed.length-i);put(size);for(let j=i;j<i+size;j++)bytes.push(compressed[j])}put(0);
 }
 put(0x3B);return Uint8Array.from(bytes);
}
