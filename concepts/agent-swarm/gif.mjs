// Pure JavaScript, dependency-free 5-bit indexed GIF renderer.
// Shares the source-backed, deterministic scene and task phases with the vector design.
import { phaseAt, agentPosition, KIND_META } from "./scene.mjs";

export const GIF_WIDTH = 800;
export const GIF_HEIGHT = 250;
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
function hexBytes(hex){return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];}
export function drawGifFrame(scene,{style="geometric",theme="dark",time=0}={}){
 if(!["geometric","robots"].includes(style)||!["dark","light"].includes(theme))throw Error("Invalid GIF style/theme");
 const robot=style==="robots",pixels=new Uint8Array(GIF_WIDTH*GIF_HEIGHT);
 const width=GIF_WIDTH,height=GIF_HEIGHT;
 function dot(x,y,col){x=Math.round(x);y=Math.round(y);if(x>=0&&y>=0&&x<width&&y<height)pixels[y*width+x]=col;}
 function box(x,y,w,h,col){x=Math.round(x);y=Math.round(y);w=Math.round(w);h=Math.round(h);
   const x0=Math.max(0,x),y0=Math.max(0,y),x1=Math.min(width,x+w),y1=Math.min(height,y+h);
   for(let yy=y0;yy<y1;yy++)pixels.fill(col,yy*width+x0,yy*width+x1);
 }
 function outline(x,y,w,h,col,thick=1){
   box(x,y,w,thick,col);box(x,y+h-thick,w,thick,col);box(x,y,thick,h,col);box(x+w-thick,y,thick,h,col);
 }
 function circle(cx,cy,r,col,fill=true){
   cx=Math.round(cx);cy=Math.round(cy);r=Math.round(r);
   for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++){
     const rr=x*x+y*y;if(fill?rr<=r*r:rr<=r*r&&rr>=(r-2)*(r-2))dot(cx+x,cy+y,col);
   }
 }
 function segment(x0,y0,x1,y1,col,thick=1){
   let dx=x1-x0,dy=y1-y0,steps=Math.max(1,Math.round(Math.max(Math.abs(dx),Math.abs(dy))));
   for(let k=0;k<=steps;k++)box(x0+dx*k/steps,y0+dy*k/steps,thick,thick,col);
 }
 function label(x,y,value,col=1,scale=1,max=80){
   const str=Array.from(String(value).toUpperCase()).slice(0,max);
   for(let idx=0;idx<str.length;idx++){
     const rows=(FONT[str[idx]]||FONT["?"]).split(" ");
     for(let r=0;r<7;r++)for(let c=0;c<5;c++)if(rows[r][c]==="1")box(x+idx*6*scale+c*scale,y+r*scale,scale,scale,col);
   }
 }
 // Background grid and frame
 for(let y=12;y<height;y+=18)for(let x=14;x<width;x+=18)dot(x,y,11);
 outline(9,9,width-18,height-18,4);
 box(10,10,width-20,42,3);
 label(24,20,robot?"TINY ROBOT CREW":"AGENT / SWARM",1,2);
 label(24,40,robot?"HAPPY LITTLE HELPERS":"CHOREOGRAPHED SIGNALS",2,1);
 box(681,22,92,22,12);outline(681,22,92,22,8);
 label(688,30,scene.source==="demo"?"DEMO DATA":"GITHUB",1,1);
 box(20,61,760,1,4);
 const n=scene.repositories.length,cell=760/Math.max(1,n);
 if(n===0)label(240,130,"AWAITING REPOSITORIES",2,2);
 const repoColours=[5,6,7,8,9],kindColour={commit:5,pr_opened:6,pr_merged:7,issue_opened:8,release:9};
 for(let i=0;i<n;i++){
   const r=scene.repositories[i],x=Math.round(20+i*cell),w=Math.round(cell-10),cx=x+w/2,col=repoColours[i%5];
   box(x,72,w,110,3);outline(x,72,w,110,4);
   if(robot){
     box(x+5,77,w-10,9,11);box(x+8,79,5,4,col);box(x+w-13,79,5,4,col);
     circle(cx,119,22,13);circle(cx,119,18,col,false);
     box(cx-14,106,28,28,1);outline(cx-14,106,28,28,col,2);
     circle(cx-6,117,2,col);circle(cx+6,117,2,col);
     box(cx-7,125,14,2,col);segment(cx,104,cx,99,col,2);circle(cx,98,3,col);
   }else{
     box(x+8,79,w-16,2,col);
     circle(cx,121,23,11);circle(cx,121,19,col,false);
     segment(cx,105,cx+13,121,col,2);segment(cx+13,121,cx,137,col,2);
     segment(cx,137,cx-13,121,col,2);segment(cx-13,121,cx,105,col,2);
     circle(cx,121,4,col);
   }
   label(cx-Math.min(11,r.name.length)*6,146,r.name,1,2,11);
   label(x+9,167,String(r.events)+" EV  "+String(r.units)+" U",2,1,20);
 }
 box(20,193,760,30,3);outline(20,193,760,30,4);
 label(29,202,robot?"BOT DOCK":"AGENT POOL",2,1);
 for(let aid=0;aid<8;aid++){
   const x=160+aid*31;
   if(robot){box(x,202,16,13,1);outline(x,202,16,13,6);dot(x+5,208,6);dot(x+11,208,6);}
   else{segment(x+6,200,x+12,207,6,1);segment(x+12,207,x+6,214,6,1);segment(x+6,214,x,207,6,1);segment(x,207,x+6,200,6,1);}
 }
 label(670,204,"8 HELPERS",2,1);
 // Tasks: all positions derive exclusively from the normalised scene.
 for(const j of scene.jobs){
   const phase=phaseAt(j,time);
   if(phase==="queued"||phase==="delivered")continue;
   const x=Math.round(20+j.repo_index*cell),w=Math.round(cell-10),cx=x+w/2,col=kindColour[j.kind]||5;
   box(x+8,85,Math.min(w-16,105),16,11);
   outline(x+8,85,Math.min(w-16,105),16,col);
   const token=KIND_META[j.kind].glyph;
   label(x+13,90,token+" "+j.count+"U",1,1);
   if(phase==="working"||phase==="complete"){
     const progress=phase==="complete"?1:Math.max(0,Math.min(1,(time-j.start-.68)/.88));
     box(x+8,177,Math.round((w-16)*progress),3,col);
     if(Math.floor(time*10)%2===0)circle(cx,121,26,col,false);
   }
   for(let side=0;side<2;side++){
     const p=agentPosition(j,time,side,n),ax=p.x*width/1120,ay=p.y*height/350;
     if(robot){
       box(ax-9,ay-8,18,17,1);outline(ax-9,ay-8,18,17,col,2);
       box(ax-4,ay-2,8,5,13);dot(ax-2,ay, col);dot(ax+2,ay,col);
       segment(ax,ay-9,ax,ay-14,col,2);circle(ax,ay-14,2,col);
       segment(ax-7,ay+9,ax-9,ay+13,col,2);segment(ax+7,ay+9,ax+9,ay+13,col,2);
     }else{
       circle(ax,ay,11,11);
       segment(ax,ay-10,ax+10,ay,col,2);segment(ax+10,ay,ax,ay+10,col,2);
       segment(ax,ay+10,ax-10,ay,col,2);segment(ax-10,ay,ax,ay-10,col,2);
       circle(ax,ay,3,col);
     }
   }
 }
 box(20,227,760,1,4);
 label(24,235,"C COMMIT  P+ PR OPEN  PM PR MERGE  ? ISSUE  R RELEASE",2,1);
 label(24,63,"",2,1);
 if(scene.truncated)label(420,233,"LIMITED VIEW",8,1);
 // Unmissable source warning; not a claim that AI agents did anything.
 label(527,20,"",2,1);
 return pixels;
}
export function lzwEncode(data,minCodeSize=5){
 if(!(data instanceof Uint8Array)||data.length===0)throw Error("LZW input must be nonempty Uint8Array");
 const clear=1<<minCodeSize,end=clear+1,base=1<<minCodeSize;
 let size=minCodeSize+1,next=end+1,dict=new Map(),acc=0,bits=0,out=[];
 function emit(value){acc|=value<<bits;bits+=size;while(bits>=8){out.push(acc&255);acc>>>=8;bits-=8;}}
 function reset(){dict=new Map();size=minCodeSize+1;next=end+1;}
 emit(clear);
 let prefix=data[0];
 for(let i=1;i<data.length;i++){
   const pixel=data[i];if(pixel>=base)throw Error("Palette index out of range");
   const key=prefix*base+pixel,found=dict.get(key);
   if(found!==undefined){prefix=found;continue;}
   emit(prefix);
   if(next<4096){dict.set(key,next++);if(next>(1<<size)&&size<12)size++;}
   else{emit(clear);reset();}
   prefix=pixel;
 }
 emit(prefix);emit(end);
 if(bits>0)out.push(acc&255);
 return Uint8Array.from(out);
}
// Independent reference LZW decoder used by tests to detect invalid code widths.
export function lzwDecode(bytes,minCodeSize=5){
 const clear=1<<minCodeSize,end=clear+1,base=1<<minCodeSize;
 let next=end+1,size=minCodeSize+1,dict=[],offset=0,acc=0,bits=0,prev=null,result=[];
 function reset(){dict=[];for(let i=0;i<base;i++)dict[i]=[i];next=end+1;size=minCodeSize+1;prev=null;}
 function read(){while(bits<size){if(offset>=bytes.length)throw Error("Truncated GIF LZW");acc|=bytes[offset++]<<bits;bits+=8;}const v=acc&((1<<size)-1);acc>>>=size;bits-=size;return v;}
 reset();
 for(;;){
   const code=read();
   if(code===clear){reset();continue;}
   if(code===end)break;
   let cur=dict[code];
   if(!cur&&code===next&&prev)cur=[...prev,prev[0]];
   if(!cur)throw Error("Invalid GIF LZW code "+code);
   result.push(...cur);
   if(prev){dict[next++]=[...prev,cur[0]];if(next===(1<<size)&&size<12)size++;}
   prev=cur;
 }
 return Uint8Array.from(result);
}
export function renderGif(scene,{style="geometric",theme="dark",frames=70}={}){
 if(!Number.isInteger(frames)||frames<1||frames>140)throw Error("frames must be 1..140");
 const bytes=[];
 const put=(...v)=>bytes.push(...v),word=v=>put(v&255,(v>>8)&255);
 const str=s=>{for(const c of s)put(c.charCodeAt(0));};
 str("GIF89a");word(GIF_WIDTH);word(GIF_HEIGHT);
 put(0xF4,0,0); // 32-colour global palette, 5-bit LZW symbols
 const colours=theme==="dark"?DARK_PALETTE:LIGHT_PALETTE;
 for(const colour of colours)put(...hexBytes(colour));
 str("!\xFF\x0BNETSCAPE2.0\x03\x01\x00\x00\x00");
 for(let f=0;f<frames;f++){
   const image=drawGifFrame(scene,{style,theme,time:(f*scene.period/frames)});
   const compressed=lzwEncode(image,5);
   const delay=Math.round(scene.period*100*(f+1)/frames)-Math.round(scene.period*100*f/frames);
   put(0x21,0xF9,4,4);word(delay);put(0,0);
   put(0x2C);word(0);word(0);word(GIF_WIDTH);word(GIF_HEIGHT);put(0);
   put(5);
   for(let k=0;k<compressed.length;k+=255){const n=Math.min(255,compressed.length-k);put(n);for(let i=0;i<n;i++)bytes.push(compressed[k+i]);}
   put(0);
 }
 put(0x3B);
 return Uint8Array.from(bytes);
}
export function readGifMetadata(data){
 const b=data;
 const str=(i,n)=>String.fromCharCode(...b.slice(i,i+n));
 if(str(0,6)!=="GIF89a")throw Error("Not GIF89a");
 const w=b[6]|b[7]<<8,h=b[8]|b[9]<<8;
 let pos=13+3*(1<<((b[10]&7)+1)),frames=0,looping=false,duration=0;
 const u16=i=>b[i]|(b[i+1]<<8);
 while(pos<b.length){
   const c=b[pos++];
   if(c===0x3B)break;
   if(c===0x21){
     const kind=b[pos++];
     if(kind===0xF9){const n=b[pos++];if(n!==4)throw Error("Invalid GCE");duration+=u16(pos+1);pos+=n+1;continue;}
     if(kind===0xFF){const n=b[pos++],name=str(pos,n);pos+=n;if(name==="NETSCAPE2.0")looping=true;}
     else if(kind===0x01){const n=b[pos++];pos+=n;}
     while(true){const n=b[pos++];if(!n)break;pos+=n;}
     continue;
   }
   if(c===0x2C){
     frames++;const pack=b[pos+8];pos+=9;
     if(pack&0x80)pos+=3*(1<<((pack&7)+1));
     pos++; // minimum LZW code size
     while(true){const n=b[pos++];if(!n)break;pos+=n;}
     continue;
   }
   throw Error("Invalid GIF block "+c+" at "+(pos-1));
 }
 if(b[pos-1]!==0x3B)throw Error("Truncated GIF trailer");
 return {width:w,height:h,frames,looping,duration_centi:duration};
}
