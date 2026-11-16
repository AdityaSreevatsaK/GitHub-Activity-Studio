import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeScene } from "./scene.mjs";
import { calendarData, svgCalendar } from "./calendar.mjs";
import { renderCalendarGif } from "./calendar-gif.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
let input = resolve(here, "../../shared/fixtures/demo-activity.json");
let out = join(here, "exports");
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--input" && args[i + 1]) input = resolve(args[++i]);
  else if (args[i] === "--out" && args[i + 1]) out = resolve(args[++i]);
  else throw new Error("Usage: node concepts/agent-swarm/build.mjs [--input file.json] [--out directory]");
}
let payload;
try { payload = JSON.parse(readFileSync(input, "utf8")); }
catch (error) { throw new Error("Cannot read valid snapshot JSON from " + input + ": " + error.message); }
const scene = calendarData(makeScene(payload),payload);
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "scene.json"), JSON.stringify(scene, null, 2) + "\n", "utf8");
for (const style of ["geometric", "robots"]) {
  for (const theme of ["dark", "light"]) {
    const name = style + "-" + theme + ".svg";
    writeFileSync(join(out, name), svgCalendar(scene, {style, theme}), "utf8");
    console.log("SVG  " + name);
  }
}
writeFileSync(join(out,"geometric-dark-still.svg"),svgCalendar(scene,{style:"geometric",theme:"dark",animated:false,time:5.2}),"utf8");
writeFileSync(join(out,"robots-light-still.svg"),svgCalendar(scene,{style:"robots",theme:"light",animated:false,time:9.5}),"utf8");
for (const [style,theme] of [["geometric","dark"],["robots","light"]]) {
  const name = style + "-" + theme + ".gif";
  writeFileSync(join(out,name),Buffer.from(renderCalendarGif(scene,{style,theme})));
  console.log("GIF  " + name);
}
console.log("Rendered " + scene.shown + " / " + scene.event_total + " event packets; " +
  scene.repositories.length + " / " + scene.repository_total + " repository hubs.");
console.log("Files available under " + out);
