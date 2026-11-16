/* Developer World GIF89a encoder. Original implementation, no external dependencies. */
(function(root){
"use strict";
function compress(data){
 const clear=256,end=257,dict=new Map(),out=[];
 let next=258,width=9,bits=0,used=0;
 function write(code){bits|=code<<used;used+=width;while(used>=8){out.push(bits&255);bits>>>=8;used-=8;}}
 write(clear);let prefix=data[0];
 for(let i=1;i<data.length;i++){
  const nextPixel=data[i],key=prefix*256+nextPixel,existing=dict.get(key);
  if(existing!==undefined){prefix=existing;continue;}
  write(prefix);
  if(next<4096){dict.set(key,next++);if(next>(1<<width)&&width<12)width++;}
  else{write(clear);dict.clear();next=258;width=9;}
  prefix=nextPixel;
 }
 write(prefix);write(end);if(used)out.push(bits&255);
 return out;
}
function createGif(rgbaFrames,width,height,delayCentiseconds=45){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>1600||height>1200)throw Error("Invalid GIF dimensions");
 if(!Array.isArray(rgbaFrames)||!rgbaFrames.length||rgbaFrames.length>48)throw Error("GIF requires 1 to 48 frames");
 if(!Number.isInteger(delayCentiseconds)||delayCentiseconds<2||delayCentiseconds>1000)throw Error("Invalid GIF delay");
 const out=[];const u16=n=>out.push(n&255,(n>>8)&255);
 const ascii=s=>{for(let i=0;i<s.length;i++)out.push(s.charCodeAt(i));};
 const image=frame=>{
  out.push(0x21,0xf9,4,0x08);u16(delayCentiseconds);out.push(0,0);
  out.push(0x2c);u16(0);u16(0);u16(width);u16(height);out.push(0);
  out.push(8);
  const codes=compress(frame);
  for(let i=0;i<codes.length;i+=255){
   const len=Math.min(255,codes.length-i);out.push(len);
   for(let j=0;j<len;j++)out.push(codes[i+j]);
  }
  out.push(0);
 };
 ascii("GIF89a");u16(width);u16(height);out.push(0xf7,0,0);
 // Deterministic RGB332 palette, robust to light/dark themes and browser rasterisation.
 for(let i=0;i<256;i++)out.push(Math.round((i>>5)*255/7),Math.round(((i>>2)&7)*255/7),Math.round((i&3)*255/3));
 out.push(0x21,0xff,0x0b);ascii("NETSCAPE2.0");out.push(3,1,0,0,0);
 for(const rgba of rgbaFrames){
  if(!rgba||rgba.length!==width*height*4)throw Error("Invalid frame size");
  const indexed=new Uint8Array(width*height);
  for(let i=0,j=0;i<rgba.length;i+=4,j++){
   const a=rgba[i+3]/255,r=Math.round(rgba[i]*a+255*(1-a)),g=Math.round(rgba[i+1]*a+255*(1-a)),b=Math.round(rgba[i+2]*a+255*(1-a));
   indexed[j]=(r&0xe0)|((g&0xe0)>>3)|((b&0xc0)>>6);
  }
  image(indexed);
 }
 out.push(0x3b);
 return Uint8Array.from(out);
}
const api={createGif};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
else root.DeveloperWorldGif=api;
})(typeof globalThis!=="undefined"?globalThis:this);
