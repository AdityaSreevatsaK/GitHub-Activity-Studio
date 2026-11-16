import {KIND_META,phaseAt} from './scene.mjs';
import {lzwEncode} from './gif.mjs';
import {GRID,agentAt} from './calendar.mjs';
const FONT = {
 A:"01110 10001 10001 11111 10001 10001 10001",
 B:"11110 10001 10001 11110 10001 10001 11110",
 C:"01111 10000 10000 10000 10000 10000 01111",
 D:"11110 10001 10001 10001 10001 10001 11110",
 E:"11111 10000 10000 11110 10000 10000 11111",
 F:"11111 10000 10000 11110 10000 10000 10000",
 G:"01111 10000 10000 10111 10001 10001 01111",
 H:"10001 10001 10001 11111 10001 10001 10001",
 I:"11111 00100 00100 00100 00100 00100 11111",
 J:"00111 00010 00010 00010 10010 10010 01100",
 K:"10001 10010 10100 11000 10100 10010 10001",
 L:"10000 10000 10000 10000 10000 10000 11111",
 M:"10001 11011 10101 10101 10001 10001 10001",
 N:"10001 11001 10101 10011 10001 10001 10001",
 O:"01110 10001 10001 10001 10001 10001 01110",
 P:"11110 10001 10001 11110 10000 10000 10000",
 Q:"01110 10001 10001 10001 10101 10010 01101",
 R:"11110 10001 10001 11110 10100 10010 10001",
 S:"01111 10000 10000 01110 00001 00001 11110",
 T:"11111 00100 00100 00100 00100 00100 00100",
 U:"10001 10001 10001 10001 10001 10001 01110",
 V:"10001 10001 10001 10001 01010 01010 00100",
 W:"10001 10001 10001 10101 10101 10101 01010",
 X:"10001 10001 01010 00100 01010 10001 10001",
 Y:"10001 10001 01010 00100 00100 00100 00100",
 Z:"11111 00001 00010 00100 01000 10000 11111",
 "0":"01110 10011 10101 10101 11001 10001 01110",
 "1":"00100 01100 00100 00100 00100 00100 01110",
 "2":"01110 10001 00001 00110 01000 10000 11111",
 "3":"11110 00001 00001 01110 00001 00001 11110",
 "4":"00010 00110 01010 10010 11111 00010 00010",
 "5":"11111 10000 10000 11110 00001 00001 11110",
 "6":"01110 10000 10000 11110 10001 10001 01110",
 "7":"11111 00001 00010 00100 01000 01000 01000",
 "8":"01110 10001 10001 01110 10001 10001 01110",
 "9":"01110 10001 10001 01111 00001 00001 01110",
 " ":"00000 00000 00000 00000 00000 00000 00000",
 ".":"00000 00000 00000 00000 00000 00110 00110",
 ":":"00000 00110 00110 00000 00110 00110 00000",
 "/":"00001 00001 00010 00100 01000 10000 10000",
 "-":"00000 00000 00000 11111 00000 00000 00000",
 "+":"00000 00100 00100 11111 00100 00100 00000",
 "?":"01110 10001 00001 00010 00100 00000 00100",
 "*":"00000 10101 01110 11111 01110 10101 00000",
 "#":"01010 11111 01010 01010 11111 01010 00000",
 "=":"00000 11111 00000 11111 00000 00000 00000"
};

const DARK_PALETTE=[
"#091321","#edf7ff","#9bb5c9","#11243a","#375068",
"#60dcc1","#8abaff","#e7a5ff","#ffbd84","#ff8fb2",
"#b8da70","#1b3046","#ffe4a1","#0e1d2e","#637e90",
"#274450","#4c7085","#486c61","#6e5588","#836047",
"#7d465f","#19293d","#fbffff","#cbdbe6","#204459",
"#405579","#faf0e7","#e4a9bb","#638c79","#334d67",
"#f4b46c","#8899ab"
];
const LIGHT_PALETTE=[
"#f5f2e9","#24374b","#556e80","#ffffff","#b9ccd4",
"#247d70","#4276b8","#8b5db7","#ad671f","#b54163",
"#648338","#e9eff0","#f6ce76","#e0e5e4","#a1b5c1",
"#d3e9e2","#b5d4e3","#d5e4cb","#e4d3ef","#efdac5",
"#f5d3df","#dfe9eb","#0f2739","#718597","#c7e2e0",
"#d5dae8","#cddadd","#ead1d8","#b6c6af","#e0d8cb",
"#ddaa55","#8499a9"
];

const WIDTH=800,HEIGHT=250,DAY=86400000;
export function calendarGifFrame(scene,{style="geometric",theme="dark",time=0}={}){
 if(!["geometric","robots"].includes(style)||!["dark","light"].includes(theme))throw Error("Invalid style/theme");
 const robot=style==="robots",pixels=new Uint8Array(WIDTH*HEIGHT);
 const pixel=(x,y,col)=>{x=Math.round(x);y=Math.round(y);if(x>=0&&x<WIDTH&&y>=0&&y<HEIGHT)pixels[y*WIDTH+x]=col};
 const box=(x,y,w,h,col)=>{x=Math.round(x);y=Math.round(y);w=Math.round(w);h=Math.round(h);
  const a=Math.max(0,x),b=Math.max(0,y),c=Math.min(WIDTH,x+w),d=Math.min(HEIGHT,y+h);
  if(c<=a||d<=b)return;for(let row=b;row<d;row++)pixels.fill(col,row*WIDTH+a,row*WIDTH+c);
 };
 const circle=(cx,cy,r,col,fill=false)=>{cx=Math.round(cx);cy=Math.round(cy);r=Math.round(r);
  for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++){const d=x*x+y*y;if(fill?d<=r*r:(d<=r*r&&d>=(r-1.8)*(r-1.8)))pixel(cx+x,cy+y,col);}
 };
 const line=(x,y,X,Y,col,thick=1)=>{const steps=Math.max(1,Math.ceil(Math.max(Math.abs(X-x),Math.abs(Y-y))));
  for(let k=0;k<=steps;k++)box(x+(X-x)*k/steps,y+(Y-y)*k/steps,thick,thick,col);
 };
 const label=(x,y,value,col=1,scale=1,max=90)=>{
  const str=Array.from(String(value).toUpperCase()).slice(0,max);
  for(let k=0;k<str.length;k++){const glyph=(FONT[str[k]]||FONT["?"]).split(" ");
   for(let row=0;row<7;row++)for(let column=0;column<5;column++)if(glyph[row][column]==="1")box(x+k*6*scale+column*scale,y+row*scale,scale,scale,col);
  }
 };
 const border=(x,y,w,h,col)=>{box(x,y,w,1,col);box(x,y+h-1,w,1,col);box(x,y,1,h,col);box(x+w-1,y,1,h,col);};
 for(let y=12;y<HEIGHT;y+=18)for(let x=13;x<WIDTH;x+=18)pixel(x,y,11);
 border(9,9,782,232,4);
 box(11,11,778,43,3);
 label(23,21,robot?"TINY BOT SWARM":"AGENT SWARM",1,2);
 label(24,42,"OBSERVED ACTIVITY / REAL DATES / METAPHOR",2,1);
 box(677,22,100,24,12);border(677,22,100,24,8);
 label(685,31,scene.source==="demo"?"DEMO DATA":"GITHUB",1,1);
 box(19,60,761,1,4);
 label(24,66,"53 WEEK CALENDAR",2,1);
 const first=Date.parse(scene.calendar.start+"T00:00:00Z");
 for(let week=0;week<53;week++){
  const date=new Date(first+week*7*DAY),before=new Date(first+(week-1)*7*DAY);
  if(week===0||date.getUTCMonth()!==before.getUTCMonth()){
   const month=["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][date.getUTCMonth()];
   label(Math.round((GRID.x+week*GRID.dx)*WIDTH/1120),80,month,2,1);
  }
 }
 const shades=[11,15,17,10,5],byDate=new Map(scene.calendar.days.map(d=>[d.date,d]));
 for(let col=0;col<53;col++)for(let row=0;row<7;row++){
  const day=new Date(first+(col*7+row)*DAY).toISOString().slice(0,10),record=byDate.get(day);
  const level=record?(record.events>=5?4:record.events>=3?3:record.events>=2?2:1):0;
  const x=Math.round((GRID.x+col*GRID.dx)*WIDTH/1120),y=Math.round((GRID.y+row*GRID.dy)*HEIGHT/350);
  box(x,y,9,9,day>scene.calendar.end?4:shades[level]);
  if(record&&robot){pixel(x+1,y+1,1);pixel(x+7,y+7,1);}
 }
 label(27,101,"M",2);label(27,125,"W",2);label(27,149,"F",2);
 if(scene.calendar.days.length===0)label(275,171,"NO OBSERVED EVENTS",2,1);
 box(20,181,760,15,3);border(20,181,760,15,4);
 label(27,185,robot?"REPO WORKSHOP BEACONS":"REPO SIGNAL BEACONS",2,1);
 for(let i=0;i<scene.repositories.length;i++){
  const r=scene.repositories[i],x=247+i*104;
  circle(x,188,4,5+i%5,true);label(x+9,185,r.name,1,1,11);
 }
 box(20,201,760,25,3);border(20,201,760,25,4);
 label(30,209,robot?"BOT DOCK":"SWARM DOCK",2,1);
 for(let k=0;k<8;k++){
   const x=Math.round((157+k*94)*WIDTH/1120);
   if(robot){box(x-6,208,13,12,1);border(x-6,208,13,12,5+k%5);pixel(x-2,212,5);pixel(x+3,212,5);line(x,208,x,204,6,1);}
   else{line(x,207,x+8,213,5+k%5);line(x+8,213,x,219,5+k%5);line(x,219,x-8,213,5+k%5);line(x-8,213,x,207,5+k%5);}
 }
 label(681,209,"8 AGENTS",2,1);
 const colour={commit:5,pr_opened:6,pr_merged:7,issue_opened:8,release:9};
 for(const job of scene.jobs){
  const state=phaseAt(job,time);if(state==="queued"||state==="delivered")continue;
  const cx=Math.round(job.cell.x*WIDTH/1120),cy=Math.round(job.cell.y*HEIGHT/350),col=colour[job.kind];
  circle(cx,cy,robot?12:10,col);
  if(state==="working"||state==="complete")circle(cx,cy,15,col);
  box(Math.min(750,cx+11),Math.max(89,cy-16),29,11,3);border(Math.min(750,cx+11),Math.max(89,cy-16),29,11,col);
  label(Math.min(752,cx+13),Math.max(91,cy-14),KIND_META[job.kind].glyph+" "+job.count,1,1,5);
  for(let side=0;side<2;side++){
   const pos=agentAt(job,time,side),x=Math.round(pos.x*WIDTH/1120),y=Math.round(pos.y*HEIGHT/350);
   if(robot){
    box(x-6,y-6,13,13,1);border(x-6,y-6,13,13,col);
    box(x-3,y-2,7,4,13);pixel(x-2,y,col);pixel(x+2,y,col);
    line(x,y-7,x,y-11,col);circle(x,y-12,2,col,true);
    line(x-4,y+7,x-6,y+10,col);line(x+4,y+7,x+6,y+10,col);
   }else{
    circle(x,y,8,11,true);
    line(x,y-7,x+7,y,col,2);line(x+7,y,x,y+7,col,2);
    line(x,y+7,x-7,y,col,2);line(x-7,y,x,y-7,col,2);
    circle(x,y,2,col,true);
   }
  }
 }
 box(20,231,760,1,4);
 label(24,235,"C COMMIT  P+ PR OPEN  PM PR MERGE  ? ISSUE  R RELEASE",2,1);
 label(654,235,"NO REAL AI",2,1);
 return pixels;
}

export function renderCalendarGif(scene,{style="geometric",theme="dark",frames=70}={}){
 if(!Number.isInteger(frames)||frames<1||frames>140)throw Error("frames must be 1..140");
 const bytes=[],put=(...a)=>bytes.push(...a),word=v=>put(v&255,(v>>8)&255),str=s=>{for(const c of s)put(c.charCodeAt(0));};
 str("GIF89a");word(WIDTH);word(HEIGHT);put(0xF4,0,0);
 const palette=theme==="dark"?DARK_PALETTE:LIGHT_PALETTE;
 for(const h of palette)put(parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16));
 str("!\xFF\x0BNETSCAPE2.0\x03\x01\x00\x00\x00");
 for(let i=0;i<frames;i++){
  const data=calendarGifFrame(scene,{style,theme,time:i*scene.period/frames});
  const compressed=lzwEncode(data,5);
  const delay=Math.round(scene.period*100*(i+1)/frames)-Math.round(scene.period*100*i/frames);
  put(0x21,0xF9,4,4);word(delay);put(0,0);
  put(0x2C);word(0);word(0);word(WIDTH);word(HEIGHT);put(0);
  put(5);for(let j=0;j<compressed.length;j+=255){const n=Math.min(255,compressed.length-j);put(n);for(let k=0;k<n;k++)bytes.push(compressed[j+k]);}put(0);
 }
 put(0x3B);return Uint8Array.from(bytes);
}
