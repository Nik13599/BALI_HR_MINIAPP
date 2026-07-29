import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("site/index.html", "utf8");
const loader = fs.readFileSync("site/beta4-square-loader.js", "utf8");
const css = fs.readFileSync("site/legacy-nav-final-beta4.css", "utf8");
const nav = fs.readFileSync("site/legacy-nav-final-beta4.js", "utf8");

assert.ok(html.includes("beta4-square-loader.js?v=bali-full-demo-8-stable25"), "Published page must load the latest application build");
assert.ok(loader.includes("legacy-nav-final-beta4.css"), "Stable bottom navigation styles must load");
assert.ok(loader.includes("legacy-nav-final-beta4.js"), "Stable bottom navigation must load");
assert.ok(loader.indexOf("legacy-nav-final-beta4.js") < loader.indexOf("beta4-social-page.js"), "Navigation must mount before BALI People");
assert.ok(loader.includes("nav-icons-core-beta4.js"), "Admin-configurable navigation icons must load");
assert.ok(loader.includes("match3-game-ui-beta4.js"), "The current Match 3 game must load");
assert.ok(loader.includes("bali-temple-theme-beta4.css"), "The latest temple visual theme must load");
assert.ok(loader.includes("bali-people-clans-beta4.js"), "Clan UI must be integrated into BALI People");
assert.ok(loader.indexOf("beta4-social-page.js") < loader.indexOf("bali-people-clans-beta4.js"), "Clan UI must extend the existing BALI People screen");
assert.ok(!loader.includes("bottom-nav-controller-beta4.js"), "The conflicting navigation controller must stay disabled");
assert.ok(!loader.includes("bottom-nav-dedupe-beta4.js"), "The obsolete navigation deduper must stay disabled");

assert.match(css, /display:flex!important/, "Bottom navigation must remain one flex row");
assert.match(css, /flex:1 1 0!important/, "Every bottom-navigation button must have an equal hit area");
assert.ok(nav.includes("replaceChildren"), "Navigation must update atomically");
assert.ok(nav.includes("nav.dataset.navigationReady = 'true'"), "Navigation must expose its ready state");
assert.ok(!nav.includes("MutationObserver"), "Navigation must not be repeatedly rebuilt by an observer");

console.log("Latest BALI navigation and integrated BALI People clan smoke test passed");
