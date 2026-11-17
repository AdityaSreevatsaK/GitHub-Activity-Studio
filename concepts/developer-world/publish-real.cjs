"use strict";
// Turn a previously fetched, verified real-account snapshot into visible GitHub
// branch images. Never fetches network data or mutates another concept.
const fs=require("node:fs"),path=require("node:path"),world=require("./renderer.js");
function generateRealPreviews(raw,{directory=path.join(__dirname,"previews"),login="AdityaSreevatsaK"}={}){
 const data=world.normalise(raw);
 if(data.source!=="github"||!data.contribution_calendar||data.user.login!==login)throw Error("Refusing to publish non-real or mismatched GitHub profile");
 if(data.contribution_calendar.days.length<300)throw Error("Refusing incomplete account calendar");
 const grid=world.calendarFor(data);
 if(grid.hasOfficialCalendar!==true)throw Error("The renderer did not use the official calendar");
 fs.mkdirSync(directory,{recursive:true});
 const files=[];
 for(const layout of ["archipelago","village"])for(const theme of ["dark","light"]){
  const filename="real-"+layout+"-"+theme+".svg",output=path.join(directory,filename);
  const svg=world.render(raw,{layout,theme,animated:true});
  if(!svg.includes("REAL GITHUB CONTRIBUTIONS")||svg.includes("SYNTHETIC DEMO")||(svg.match(/data-date=/g)||[]).length!==371)throw Error("Preview provenance or grid invalid");
  fs.writeFileSync(output,svg,"utf8");files.push(filename);
 }
 const still="real-archipelago-still.svg";
 fs.writeFileSync(path.join(directory,still),world.render(raw,{layout:"archipelago",theme:"dark",animated:false}),"utf8");
 files.push(still);
 return {files,login:data.user.login,activeDays:grid.activeDays,contributions:grid.observed,calendarDays:data.contribution_calendar.days.length,publicEvents:data.activity.length};
}
if(require.main===module){
 const source=path.join(__dirname,"real-activity.json"),output=path.join(__dirname,"previews");
 if(!fs.existsSync(source))throw Error("real-activity.json is missing; run collect-github.cjs first");
 const summary=generateRealPreviews(JSON.parse(fs.readFileSync(source,"utf8")),{directory:output});
 console.log("Published truthful account previews:",JSON.stringify(summary));
}
module.exports={generateRealPreviews};
