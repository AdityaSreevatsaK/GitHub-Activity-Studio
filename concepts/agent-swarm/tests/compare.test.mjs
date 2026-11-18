import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const html=readFileSync(new URL("../compare.html",import.meta.url),"utf8");
const controller=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test("the two account-specific designs are compared at the same aspect ratio",()=>{
 assert.match(html,/id="forge-image"/);
 assert.match(html,/id="relay-image"/);
 assert.match(html,/aspect-ratio:16\/5/);
 assert.match(html,/exports\/account\/forge-dark\.gif/);
 assert.match(html,/exports\/account\/relay-dark\.gif/);
 assert.match(html,/not official GitHub contribution totals/i);
});

test("comparison separates real and synthetic data and supports static, light and dark exports",()=>{
 assert.match(html,/SYNTHETIC DEMONSTRATION/);
 for(const key of ['id="theme"','id="motion"','id="source"','prefers-reduced-motion: reduce'])
  assert(html.includes(key),key);
 assert.match(html,/mode\+"-"\+theme/);
 assert.match(html,/motion==="still"\?"-still\.svg":"\.gif"/);
});

test("comparison controller parses and does not access any remote service",()=>{
 assert(controller,"inline gallery controller is missing");
 assert.doesNotThrow(()=>new Function(controller));
 assert(!/https?:\/\//.test(controller));
 assert(!/fetch\s*\(/.test(controller));
});
