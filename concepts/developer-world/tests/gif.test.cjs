"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {createGif}=require("../gif.js");

function solid(width,height,r,g,b){
 const data=new Uint8ClampedArray(width*height*4);
 for(let i=0;i<data.length;i+=4){data[i]=r;data[i+1]=g;data[i+2]=b;data[i+3]=255;}
 return data;
}
const rgb332=(r,g,b)=>(r&224)|((g&224)>>3)|((b&192)>>6);
// Independent minimal GIF parser for validating frame count and LZW pixel indices.
function readGif(bytes){
 let at=0;
 const u8=()=>bytes[at++],u16=()=>u8()|(u8()<<8);
 const str=n=>Array.from({length:n},()=>String.fromCharCode(u8())).join("");
 assert.equal(str(6),"GIF89a");
 const width=u16(),height=u16(),packed=u8();u8();u8();
 assert.ok(packed&128,"global colour table required");
 const palette=3*(1<<((packed&7)+1));at+=palette;
 const frames=[];
 function subblocks(){
  const out=[];let size;
  while((size=u8())!==0){for(let j=0;j<size;j++)out.push(u8());}
  return out;
 }
 while(at<bytes.length){
  const marker=u8();
  if(marker===0x3b)break;
  if(marker===0x21){
   const kind=u8();
   if(kind===0xf9){const length=u8();at+=length;assert.equal(u8(),0);}
   else{const len=u8();at+=len;subblocks();}
   continue;
  }
  assert.equal(marker,0x2c,"expected GIF image descriptor");
  assert.equal(u16(),0);assert.equal(u16(),0);
  assert.equal(u16(),width);assert.equal(u16(),height);
  const flags=u8();assert.equal(flags,0,"frames use one shared palette");
  const min=u8(),encoded=subblocks();
  const clear=1<<min,end=clear+1;
  let dict=[],next=end+1,widthBits=min+1,old=null,bitPos=0;
  const reset=()=>{
   dict=Array.from({length:clear},(_,i)=>[i]);
   next=end+1;widthBits=min+1;old=null;
  };
  const read=()=>{
   let value=0;
   for(let bit=0;bit<widthBits;bit++)value|=((encoded[bitPos>>3]>>(bitPos&7))&1)<<bit,bitPos++;
   return value;
  };
  reset();const decoded=[];
  while(bitPos<encoded.length*8){
   const code=read();
   if(code===clear){reset();continue;}
   if(code===end)break;
   let entry;
   if(code<next&&dict[code])entry=dict[code];
   else if(code===next&&old)entry=old.concat(old[0]);
   else throw Error("Invalid LZW dictionary reference");
   decoded.push(...entry);
   if(old){
    if(next<4096){dict[next++]=old.concat(entry[0]);if(next===(1<<widthBits)&&widthBits<12)widthBits++;}
   }
   old=entry;
  }
  assert.equal(decoded.length,width*height,"fully decoded frame");
  frames.push(decoded);
 }
 assert.equal(at,bytes.length,"no bytes after trailer");
 return {width,height,frames};
}
test("creates a valid deterministic animated GIF89a with a shared 256-colour palette",()=>{
 const a=solid(8,6,240,35,23),b=solid(8,6,22,176,245);
 const output=createGif([a,b],8,6,35),again=createGif([a,b],8,6,35);
 assert.deepEqual(output,again);
 const parsed=readGif(output);
 assert.equal(parsed.width,8);assert.equal(parsed.height,6);assert.equal(parsed.frames.length,2);
 assert.deepEqual(new Set(parsed.frames[0]),new Set([rgb332(240,35,23)]));
 assert.deepEqual(new Set(parsed.frames[1]),new Set([rgb332(22,176,245)]));
 assert.ok(Buffer.from(output).includes(Buffer.from("NETSCAPE2.0")),"infinite loop extension present");
});
test("LZW boundaries preserve pixels in many different tiles and successive frames",()=>{
 const w=96,h=40,a=solid(w,h,0,0,0),b=solid(w,h,0,0,0);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=4*(w*y+x),k=(17*x+31*y)%256;
  a[i]=k;a[i+1]=(k*3)%256;a[i+2]=(k*5)%256;
  b[i]=(k*7)%256;b[i+1]=(k*11)%256;b[i+2]=(k*13)%256;
 }
 const parsed=readGif(createGif([a,b],w,h,50));
 assert.equal(parsed.frames.length,2);
 for(let i=0;i<w*h;i++){
  const p=4*i;
  assert.equal(parsed.frames[0][i],rgb332(a[p],a[p+1],a[p+2]));
  assert.equal(parsed.frames[1][i],rgb332(b[p],b[p+1],b[p+2]));
 }
});
test("transparent pixels are composited against white instead of arbitrary black",()=>{
 const a=solid(2,1,20,20,20);a[3]=0;
 const parsed=readGif(createGif([a],2,1,30));
 assert.deepEqual(parsed.frames[0],[255,rgb332(20,20,20)]);
});
test("encoder validates frame shape, count, dimensions and delays",()=>{
 const one=solid(2,2,1,2,3);
 for(const thunk of [
  ()=>createGif([],2,2),()=>createGif([one],0,2),
  ()=>createGif([one],2,0),()=>createGif([one],2,2,1),
  ()=>createGif([one],2,2,1001),()=>createGif([one],3,2),
  ()=>createGif(Array(49).fill(one),2,2)
 ])assert.throws(thunk);
});
test("solid-colour GIFs compress dramatically and do not mutate source frames",()=>{
 const input=solid(100,60,80,160,200),previous=Uint8ClampedArray.from(input);
 const output=createGif([input,input,input],100,60,20);
 assert.ok(output.byteLength<3000);
 assert.deepEqual(input,previous);
 assert.equal(readGif(output).frames.length,3);
});
