"use strict";
const fs=require("node:fs"),path=require("node:path"),http=require("node:http");
const root=path.resolve(__dirname,"../.."),mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml",".gif":"image/gif",".css":"text/css; charset=utf-8"};
function createServer(dir=root){
 const base=path.resolve(dir);
 return http.createServer((req,res)=>{
  if(!["GET","HEAD"].includes(req.method)){res.writeHead(405,{"Allow":"GET, HEAD"});res.end();return;}
  let pathname,requestUrl;try{requestUrl=new URL(req.url,"http://localhost");pathname=decodeURIComponent(requestUrl.pathname);}catch{res.writeHead(400);res.end();return;}
  if(pathname==="/"){
   // Preserve only known preview options. Arbitrary query strings are never reflected.
   const accepted={sample:["shared","showcase"],layout:["archipelago","village"],theme:["dark","light"]},params=new URLSearchParams();
   for(const [key,values] of Object.entries(accepted)){
    const value=requestUrl.searchParams.get(key);
    if(value!==null&&values.includes(value))params.set(key,value);
   }
   const target="/concepts/developer-world/index.html"+(params.size?"?"+params.toString():"");
   res.writeHead(302,{"Location":target,"Cache-Control":"no-store"});res.end();return;
  }
  const file=path.resolve(base,"."+pathname),relative=path.relative(base,file),ext=path.extname(file).toLowerCase();
  if(relative.startsWith("..")||path.isAbsolute(relative)||pathname.includes("\\")||!mime[ext]||relative.split(path.sep).some(x=>x.startsWith("."))){res.writeHead(403);res.end("Forbidden");return;}
  fs.stat(file,(err,stat)=>{
   if(err||!stat.isFile()){res.writeHead(404);res.end("Not found");return;}
   res.writeHead(200,{"Content-Type":mime[ext],"Content-Length":stat.size,"X-Content-Type-Options":"nosniff","Cache-Control":"no-store","Content-Security-Policy":"default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
   if(req.method==="HEAD"){res.end();return;}fs.createReadStream(file).pipe(res);
  });
 });
}
if(require.main===module){
 const port=Number(process.env.PORT||8787);
 if(!Number.isInteger(port)||port<1||port>65535){console.error("PORT must be 1..65535");process.exitCode=1;}
 else createServer().listen(port,"127.0.0.1",()=>console.log("Developer World preview: http://127.0.0.1:"+port+"/"));
}
module.exports={createServer};
