"use strict";
// Optional Chromium integration smoke test. No npm packages or credentials.
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {spawn,spawnSync}=require("node:child_process");
const {createServer}=require("../server.cjs");
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(callback,label,timeoutMs=20000){
 const untilAt=Date.now()+timeoutMs;
 let last;
 while(Date.now()<untilAt){
  try{const result=await callback();if(result)return result;}catch(err){last=err;}
  await sleep(125);
 }
 throw Error(label+" timed out"+(last?": "+last.message:""));
}
function chromeExecutable(){
 for(const candidate of [process.env.CHROME_BIN,"google-chrome","google-chrome-stable","chromium"]){
  if(!candidate)continue;
  if(candidate.includes(path.sep)&&fs.existsSync(candidate))return candidate;
  const found=spawnSync("which",[candidate],{encoding:"utf8"});
  if(found.status===0)return found.stdout.trim();
 }
 throw Error("Chrome or Chromium executable not found");
}
function cdp(url){
 const socket=new WebSocket(url),pending=new Map();
 let sequence=0;
 socket.onmessage=ev=>{
  const packet=JSON.parse(ev.data);
  if(!packet.id)return;
  const wait=pending.get(packet.id);if(!wait)return;
  pending.delete(packet.id);
  packet.error?wait.reject(Error(packet.error.message)):wait.resolve(packet.result);
 };
 socket.onclose=()=>{for(const wait of pending.values())wait.reject(Error("Chrome debugging socket closed"));pending.clear();};
 return {
  socket,
  ready:new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=()=>reject(Error("Cannot connect to Chrome debugging socket"));}),
  send(method,params={}){
   const id=++sequence;
   return new Promise((resolve,reject)=>{
    pending.set(id,{resolve,reject});
    socket.send(JSON.stringify({id,method,params}));
   });
  }
 };
}
async function main(){
 const server=createServer(),profile=fs.mkdtempSync(path.join(os.tmpdir(),"dw-browser-"));
 let chrome=null,connection=null;
 try{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const port=server.address().port;
  const mode=process.env.DW_SAMPLE==="real"?"real":"showcase";
  const url="http://127.0.0.1:"+port+"/?sample="+mode+"&layout=archipelago&theme=dark";
  chrome=spawn(chromeExecutable(),[
   "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
   "--disable-extensions","--no-first-run","--no-default-browser-check",
   "--remote-allow-origins=*","--remote-debugging-port=0",
   "--user-data-dir="+profile,url
  ],{stdio:"ignore"});
  const active=path.join(profile,"DevToolsActivePort");
  const debuggingPort=await until(()=>{
   if(chrome.exitCode!==null)throw Error("Chrome exited: "+chrome.exitCode);
   if(!fs.existsSync(active))return null;
   const lines=fs.readFileSync(active,"utf8").split("\n");
   return /^\d+$/.test(lines[0])?Number(lines[0]):null;
  },"Chrome debugging port");
  const target=await until(async()=>{
   const response=await fetch("http://127.0.0.1:"+debuggingPort+"/json/list");
   const targets=await response.json();
   return targets.find(t=>t.type==="page"&&t.webSocketDebuggerUrl);
  },"Chrome page target");
  connection=cdp(target.webSocketDebuggerUrl);
  await connection.ready;
  await connection.send("Runtime.enable");
  const evaluate=async expression=>{
   const result=await connection.send("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true});
   if(result.exceptionDetails)throw Error("Browser JS exception: "+result.exceptionDetails.text);
   return result.result.value;
  };
  const ready=await until(async()=>{
   const info=await evaluate('({dates:document.querySelectorAll("svg [data-date]").length,sample:document.querySelector("#sample")?.value,layout:document.querySelector("#layout")?.value,status:document.querySelector("#status")?.textContent})');
   return info?.dates===371&&info.status?.includes(mode==="real"?"REAL GITHUB CONTRIBUTIONS":"212 dates")?info:null;
  },"GitHub contribution calendar DOM",30000);
  if(ready.sample!==mode||ready.layout!=="archipelago")throw Error("Incorrect browser preset: "+JSON.stringify(ready));
  await evaluate('(() => {window.__gifSmoke=null;const original=window.DeveloperWorldGif.createGif;window.DeveloperWorldGif.createGif=function(frames,width,height,delay){const bytes=original.apply(this,arguments);window.__gifSmoke={magic:Array.from(bytes.slice(0,6),b=>String.fromCharCode(b)).join(""),size:bytes.length,frames:frames.length,width,height,delay};window.__gifSmokeBytes=bytes;return bytes;};document.querySelector("#gif").click();return true;})()');
  const gif=await until(async()=>{
   const info=await evaluate('({data:window.__gifSmoke,status:document.querySelector("#status")?.textContent,busy:document.querySelector("#gif")?.disabled})');
   if(info.status?.startsWith("GIF export failed:"))throw Error(info.status);
   return info.data&&info.status?.startsWith("GIF created")&&!info.busy?info.data:null;
  },"real browser GIF export",90000);
  if(gif.magic!=="GIF89a"||gif.width!==896||gif.height!==280||
     gif.frames!==16||gif.size<5000||gif.size>12*1024*1024){
    throw Error("GIF export metadata unexpected: "+JSON.stringify(gif));
  }
  // Keep one real browser-produced GIF as a downloadable, profile-ready CI artifact.
  const encoded=await evaluate('(() => {const bytes=window.__gifSmokeBytes;if(!bytes)throw Error("GIF capture missing");let parts=[];for(let i=0;i<bytes.length;i+=16384)parts.push(String.fromCharCode(...bytes.subarray(i,i+16384)));return btoa(parts.join(""));})()');
  const sample=Buffer.from(encoded,"base64");
  if(sample.length!==gif.size||sample.subarray(0,6).toString("ascii")!=="GIF89a")throw Error("Browser GIF bytes invalid");
  const output=path.resolve(__dirname,"../"+(mode==="real"?"previews/real-archipelago.gif":"exports/archipelago-showcase.gif"));
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,sample);
  console.log("Browser GIF export passed:",JSON.stringify(gif),"saved:",output);
 }finally{
  if(connection)connection.socket.close();
  if(chrome&&chrome.exitCode===null){
   await new Promise(resolve=>{
    const timeout=setTimeout(resolve,5000);
    chrome.once("exit",()=>{clearTimeout(timeout);resolve();});
    chrome.kill("SIGTERM");
   });
  }
  await new Promise(resolve=>server.close(resolve));
  // Some Chromium children briefly retain files after the parent exits.
  // A cleanup race must never hide a successful rendering/GIF assertion.
  try{fs.rmSync(profile,{force:true,recursive:true,maxRetries:20,retryDelay:200});}
  catch(err){console.warn("Temporary Chromium profile cleanup skipped:",err.message);}
 }
}
main().catch(err=>{console.error(err.stack||err);process.exitCode=1;});
