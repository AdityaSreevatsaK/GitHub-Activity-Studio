"use strict";
// Additional SYNTHETIC visual stress fixture, not GitHub contribution history.
// Default preview always loads ../../shared/fixtures/demo-activity.json.
// Stable generation: no clock, network, randomness, private data, or external dependencies.
function hash(s){
 let h=2166136261;
 for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);
 return h>>>0;
}
function generateShowcase(shared){
 if(!shared||shared.schema_version!=="1"||shared.source!=="demo"||
   !Array.isArray(shared.repositories)||!shared.repositories.length)throw Error("Expected the shared demo snapshot");
 const cutoff=Date.parse(shared.generated_at);
 if(!Number.isFinite(cutoff))throw Error("Invalid demo generated_at");
 const start=Date.UTC(2025,10,16),dayMs=86400000;
 const repos=shared.repositories.map(r=>r.full_name);
 const activity=[];
 let serial=0;
 for(let week=0;week<53;week++){
  for(let day=0;day<7;day++){
   const dateMs=start+(week*7+day)*dayMs+9*3600000;
   if(dateMs>cutoff)continue;
   const signal=hash("showcase:"+week+":"+day);
   const density=week<10?5:week<24?7:week<42?8:7;
   if(signal%12>=density)continue;
   const repo=repos[hash("repo:"+week+":"+day)%repos.length];
   const kind=(serial%37===0?"release":serial%13===0?"pr_merged":serial%9===0?"pr_opened":serial%7===0?"issue_opened":"commit");
   const weight=signal%11===0?10+(signal%5):signal%5===0?6+(signal%4):1+(signal%5);
   const occurredAt=new Date(dateMs).toISOString().replace(".000Z","Z");
   activity.push({id:"showcase-"+String(++serial).padStart(4,"0"),kind,repo_full_name:repo,occurred_at:occurredAt,url:"https://github.com/example",count:weight});
   // Some days genuinely have two separately identifiable *synthetic* events.
   if(signal%8===0){
    const second=repos[hash("second:"+week+":"+day)%repos.length];
    activity.push({id:"showcase-"+String(++serial).padStart(4,"0"),kind:"commit",repo_full_name:second,occurred_at:new Date(dateMs+3600000).toISOString().replace(".000Z","Z"),url:"https://github.com/example",count:1+(signal%3)});
   }
  }
 }
 return {
  schema_version:"1",source:"demo",generated_at:shared.generated_at,
  user:{login:"showcase-dev",url:"https://github.com/example"},
  repositories:shared.repositories.map(r=>({...r})),
  activity
 };
}
if(require.main===module){
 const fs=require("node:fs"),path=require("node:path");
 const base=path.resolve(__dirname,"../../shared/fixtures/demo-activity.json");
 process.stdout.write(JSON.stringify(generateShowcase(JSON.parse(fs.readFileSync(base,"utf8"))),null,2)+"\n");
}
module.exports={generateShowcase};
