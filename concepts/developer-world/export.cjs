"use strict";
const fs=require("node:fs"),path=require("node:path"),world=require("./renderer.js");
const fixture=path.resolve(__dirname,"../../shared/fixtures/demo-activity.json");
function usage(){return "Node 18+: node concepts/developer-world/export.cjs [--input snapshot.json] [--out directory] [--layout archipelago|village|both] [--theme dark|light|both] [--progress N] [--still]\nNo flags: create 4 animated and 4 still SVG exports from the bundled synthetic fixture.\n";}
function run(args=process.argv.slice(2)){
 const opt={input:fixture,out:path.join(__dirname,"exports"),layout:"both",theme:"both",still:false,progress:undefined};
 for(let i=0;i<args.length;i++){
  const key=args[i];
  if(key==="-h"||key==="--help"){process.stdout.write(usage());return [];}
  if(key==="--still"){opt.still=true;continue;}
  if(!["--input","--out","--layout","--theme","--progress"].includes(key))throw Error("Unknown argument: "+key);
  if(++i>=args.length)throw Error("Missing value after "+key);
  const value=args[i];
  if(key==="--input")opt.input=path.resolve(value);
  else if(key==="--out")opt.out=path.resolve(value);
  else if(key==="--layout")opt.layout=value;
  else if(key==="--theme")opt.theme=value;
  else{if(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value)))throw Error("Invalid progress");opt.progress=Number(value);}
 }
 if(!["both","archipelago","village"].includes(opt.layout)||!["both","dark","light"].includes(opt.theme))throw Error("Invalid layout or theme");
 const data=JSON.parse(fs.readFileSync(opt.input,"utf8"));world.normalise(data);fs.mkdirSync(opt.out,{recursive:true});
 const layouts=opt.layout==="both"?["archipelago","village"]:[opt.layout],themes=opt.theme==="both"?["dark","light"]:[opt.theme];
 const files=[];
 for(const layout of layouts)for(const theme of themes)for(const animated of(opt.still?[false]:[true,false])){
  const name=layout+"-"+theme+(animated?"":"-still")+".svg",file=path.join(opt.out,name);
  const svg=world.render(data,{layout,theme,progress:opt.progress,animated});
  fs.writeFileSync(file,svg,"utf8");files.push(file);
  process.stdout.write(name+" ("+Buffer.byteLength(svg)+" bytes)\n");
 }
 return files;
}
if(require.main===module){try{run();}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={run,usage};
