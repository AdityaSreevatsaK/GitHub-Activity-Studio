import {resolve,extname,sep} from "node:path";

/**
 * Restrict the private preview server to shipped entry pages and generated
 * images/scene JSON. Do not expose local .env files or arbitrary source files.
 */
export function resolvePublicFile(root,urlPath){
 if(typeof urlPath!=="string")return null;
 let decoded;
 try{decoded=decodeURIComponent(urlPath)}catch{return null;}
 if(!decoded.startsWith("/")||decoded.includes("\0"))return null;
 const target=resolve(root,"."+(decoded==="/"?"/preview.html":decoded));
 if(target===resolve(root,"preview.html")||target===resolve(root,"showcase.html"))return target;
 const exportDir=resolve(root,"exports");
 if(target.startsWith(exportDir+sep)&&[".gif",".svg",".png",".webp",".json"].includes(extname(target).toLowerCase()))return target;
 return null;
}
