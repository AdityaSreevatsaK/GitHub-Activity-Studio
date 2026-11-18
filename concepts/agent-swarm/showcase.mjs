/** Deterministic synthetic showcase, never an owner's actual GitHub contributions. */
export function showcaseData(){
 let seed=0xA61E5A8F;
 const rand=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
 const names=["agent-garden","orchestration-lab","trace-lantern","context-forge","tiny-runtime"];
 const repositories=names.map(name=>({full_name:"synthetic-showcase/"+name,name,language:"Python",
   stars:0,url:"https://github.com/example"}));
 const start=Date.UTC(2025,10,16),dayMs=86400000,activity=[];
 let index=0;
 for(let d=0;d<366;d++){
  const instant=new Date(start+d*dayMs),day=instant.toISOString().slice(0,10);
  if(day>="2026-11-16")break;
  const weekday=instant.getUTCDay(),working=weekday!==0&&weekday!==6;
  const season=(Math.sin(d/21)+Math.cos(d/43))*.11;
  const wave=(d>74&&d<116)||(d>232&&d<278)?0.19:0;
  if(rand()>(working?.53:.19)+season+wave)continue;
  const events=1+(rand()<.36?1:0)+(rand()<(.14+wave*.5)?2:0);
  for(let k=0;k<events;k++){
   const repo=repositories[Math.floor(rand()*repositories.length)];
   const kinds=["commit","commit","commit","pr_opened","pr_merged","issue_opened","release"];
   const kind=kinds[Math.floor(rand()*kinds.length)];
   const hh=String(8+Math.floor(rand()*12)).padStart(2,"0");
   const mm=String(Math.floor(rand()*60)).padStart(2,"0");
   activity.push({id:"showcase-"+String(++index).padStart(4,"0"),kind,
    repo_full_name:repo.full_name,occurred_at:day+"T"+hh+":"+mm+":00Z",
    url:"https://github.com/example",count:kind==="commit"?1+Math.floor(rand()*4):1});
  }
 }
 return {schema_version:"1",source:"demo",generated_at:"2026-11-16T00:00:00Z",
  user:{login:"synthetic-showcase",url:"https://github.com/example"},
  repositories,activity};
}
