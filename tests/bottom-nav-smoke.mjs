import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync("site/bottom-nav-stable-beta4.css", "utf8");
const loader = fs.readFileSync("site/beta4-square-loader.js", "utf8");

assert.match(css, /\.nav\s*\{[\s\S]*display:flex!important/, "Navigation must use one stable flex row");
assert.match(css, /\.nav>button\[data-page\][\s\S]*flex:1 1 0!important/, "Every navigation button must own an equal hit area");
assert.match(css, /width:0!important/, "Equal flex buttons must not retain content-based width");
assert.match(css, /\.nav>button\[data-page\]>i,[\s\S]*pointer-events:none!important/, "Icon taps must resolve to the button itself");
assert.match(css, /touch-action:manipulation!important/, "Touch input must be handled as direct taps");

assert.ok(loader.includes("'bottom-nav-stable-beta4.css'"), "Stable navigation CSS must be loaded");
assert.ok(!loader.includes("'bottom-nav-controller-beta4.js'"), "The conflicting event interceptor must not be loaded");
assert.ok(!loader.includes("'bottom-nav-dedupe-beta4.js'"), "The old DOM-reordering navigation fixer must not be loaded");

console.log("BALI bottom navigation layout smoke test passed");
