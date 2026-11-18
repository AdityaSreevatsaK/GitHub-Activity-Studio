import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeScene } from "./scene.mjs";
import { calendarData, svgCalendar } from "./calendar.mjs";
import { renderCalendarGif } from "./calendar-gif.mjs";
import { showcaseData } from "./showcase.mjs";
import { makeStory, renderStorySvg, renderStoryGif } from "./swarm-stories.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
let input = resolve(here, "../../shared/fixtures/demo-activity.json");
let out = join(here, "exports");
let verify = false;
let includeShowcase = true;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--verify") verify = true;
  else if (args[i] === "--account") {
    input = join(here, "data", "adityasreevatsak-public.json");
    out = join(here, "exports", "account");
    includeShowcase = false;
  }
  else if (args[i] === "--no-showcase") includeShowcase = false;
  else if (args[i] === "--input" && args[i + 1]) input = resolve(args[++i]);
  else if (args[i] === "--out" && args[i + 1]) out = resolve(args[++i]);
  else throw new Error("Usage: node concepts/agent-swarm/build.mjs [--input file.json] [--out directory] [--verify] [--account] [--no-showcase]");
}
let payload;
try { payload = JSON.parse(readFileSync(input, "utf8")); }
catch (error) { throw new Error("Cannot read valid snapshot JSON from " + input + ": " + error.message); }
const scene = calendarData(makeScene(payload),payload);
// Verification mode re-renders deterministically and compares actual bytes to
// the checked-in assets, without overwriting them or requiring extra tools.
function outputFile(path,data,encoding){
 if(verify){
  const expected=Buffer.isBuffer(data)?data:Buffer.from(data,encoding||"utf8");
  let current;
  try {current=readFileSync(path);}
  catch(error){throw new Error("Missing output: "+path+" (run build without --verify)");}
  if(!current.equals(expected))throw new Error("Outdated output: "+path+" (regenerate and review assets)");
 }else{
  writeFileSync(path,data,encoding);
 }
}

if(!verify)mkdirSync(out, { recursive: true });
outputFile(join(out, "scene.json"), JSON.stringify(scene, null, 2) + "\n", "utf8");
for (const style of ["geometric", "robots"]) {
  for (const theme of ["dark", "light"]) {
    const prefix=style+"-"+theme;
    const svg=svgCalendar(scene,{style,theme});
    outputFile(join(out,prefix+".svg"),svg,"utf8");
    outputFile(join(out,prefix+"-still.svg"),svgCalendar(scene,{style,theme,animated:false,time:5.2}),"utf8");
    const gif=renderCalendarGif(scene,{style,theme});
    outputFile(join(out,prefix+".gif"),Buffer.from(gif));
    console.log("SVG / STILL / GIF  "+prefix);
  }
}

// New readable swarm narratives, derived from all source-observed calendar dates.
// Keep the earlier geometric/robot styles intact as alternatives.
const story=makeStory(scene,payload);
outputFile(join(out,"story.json"),JSON.stringify(story,null,2)+"\n","utf8");
for(const mode of ["forge","relay"])for(const theme of ["dark","light"]){
 const name=mode+"-"+theme;
 outputFile(join(out,name+".svg"),renderStorySvg(story,{mode,theme}),"utf8");
 outputFile(join(out,name+"-still.svg"),renderStorySvg(story,{mode,theme,animated:false,time:mode==="forge"?11.2:4}),"utf8");
 outputFile(join(out,name+".gif"),Buffer.from(renderStoryGif(story,{mode,theme})));
 console.log("STORY SVG / STILL / GIF  "+name);
}

// Optional richer synthetic demo, useful for judging the swarm's choreography
// on a populated chart. Never substitute it for genuine GitHub contributions.
if(includeShowcase){
const synthetic=showcaseData();
const richer=calendarData(makeScene(synthetic),synthetic);
const demoOut=join(out,"showcase");
if(!verify)mkdirSync(demoOut,{recursive:true});
outputFile(join(demoOut,"scene.json"),JSON.stringify(richer,null,2)+"\n","utf8");
for(const [style,theme] of [["geometric","dark"],["robots","light"]]){
 const prefix=style+"-"+theme;
 outputFile(join(demoOut,prefix+".svg"),svgCalendar(richer,{style,theme}),"utf8");
 outputFile(join(demoOut,prefix+"-still.svg"),svgCalendar(richer,{style,theme,animated:false,time:8.3}),"utf8");
 outputFile(join(demoOut,prefix+".gif"),Buffer.from(renderCalendarGif(richer,{style,theme})));
 console.log("SYNTHETIC SHOWCASE  "+prefix);
}

}
console.log("Rendered " + scene.shown + " / " + scene.event_total + " event packets; " +
  scene.repositories.length + " / " + scene.repository_total + " repository hubs.");
console.log((verify?"Verified existing assets in ":"Files available under ") + out);
