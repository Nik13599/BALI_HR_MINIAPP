import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("site/beta4-stable.html", "utf8");
const css = fs.readFileSync("site/bali-user-clean.css", "utf8");
const js = fs.readFileSync("site/bali-user-clean.js", "utf8");

assert.ok(html.includes("bali-user-clean.css"), "Clean user CSS must be loaded");
assert.ok(html.includes("bali-user-clean.js"), "Clean user application must be loaded");
assert.ok(!html.includes("beta4-square-loader.js"), "Legacy modular loader must not be loaded");
assert.ok(!html.includes("bottom-nav-controller-beta4.js"), "Legacy navigation controller must not be loaded");
assert.ok(!html.includes("bottom-nav-dedupe-beta4.js"), "Legacy navigation deduper must not be loaded");

assert.match(css, /\.clean-nav\{display:flex!important/, "Bottom navigation must be one fixed flex row");
assert.match(css, /\.clean-nav button\{flex:1 1 0;width:0/, "Each button must own an equal physical hit area");
assert.match(css, /\.clean-nav button i,\.clean-nav button span\{pointer-events:none\}/, "Icon and label taps must resolve to their button");
assert.ok(!js.includes("MutationObserver"), "Clean app must not rebuild navigation through MutationObserver");
assert.equal((js.match(/<button[^>]+data-page=\\"(?:home|events|menu|people|crown|profile)\\"/g) || []).length, 10, "The template must contain six navigation buttons and four internal page links");
assert.equal((js.match(/<nav class=\\"clean-nav\\"/g) || []).length, 1, "Only one bottom navigation may be created");

assert.ok(js.includes("ХОТЯТ ПОЙТИ"), "Event detail must show the interested counter");
assert.ok(!js.includes("БЕЗ СТОЛА"), "General-admission counter must be removed");
assert.ok(!js.includes("ЗА СТОЛАМИ"), "Booked-guests counter must be removed");
assert.ok(!js.includes("СВОБОДНО</span>"), "Free-table counter must be removed from event statistics");

console.log("BALI clean navigation and event counters smoke test passed");
