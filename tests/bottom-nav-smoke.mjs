import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("site/beta4-stable.html", "utf8");
const loader = fs.readFileSync("site/beta4-square-loader.js", "utf8");
const css = fs.readFileSync("site/legacy-nav-final-beta4.css", "utf8");
const nav = fs.readFileSync("site/legacy-nav-final-beta4.js", "utf8");
const attendance = fs.readFileSync("site/legacy-event-attendance-beta4.js", "utf8");

assert.ok(html.includes("beta4-square-loader.js"), "Previous modular application must be restored");
assert.ok(!html.includes("bali-user-clean.js"), "The replacement clean application must not be loaded");
assert.ok(loader.includes("legacy-nav-final-beta4.css"), "Stable legacy navigation CSS must be loaded");
assert.ok(loader.includes("legacy-nav-final-beta4.js"), "Final navigation composer must be loaded");
assert.ok(loader.includes("legacy-event-attendance-beta4.js"), "Unified event attendance must be loaded");
assert.ok(!loader.includes("night-crown-nav-fix-beta4.js"), "The old navigation MutationObserver must not be loaded");
assert.ok(!loader.includes("bottom-nav-controller-beta4.js"), "The conflicting navigation interceptor must not be loaded");
assert.ok(!loader.includes("bottom-nav-dedupe-beta4.js"), "The old navigation deduper must not be loaded");

assert.match(css, /nav\.nav:not\(\[data-navigation-ready="true"\]\)\{visibility:hidden/, "Intermediate navigation states must stay hidden");
assert.match(css, /display:flex!important/, "Final navigation must use one stable flex row");
assert.match(css, /flex:1 1 0!important/, "Every button must own an equal physical hit area");
assert.match(css, /pointer-events:none!important/, "Icon and label taps must resolve to the button itself");
assert.ok(!nav.includes("MutationObserver"), "Final navigation must not be rebuilt by an observer");
assert.equal((nav.match(/\["(?:home|events|menu|dating|crown|profile)"/g) || []).length, 6, "Final navigation must contain exactly six sections");
assert.ok(nav.includes("replaceChildren"), "Navigation must be finalized atomically once");

assert.ok(attendance.includes("ХОТЯТ ПОЙТИ"), "Event detail must show one unified counter");
assert.ok(attendance.includes("sum + row.guests"), "A booking must add the full guest count");
assert.ok(attendance.includes("row.guests - 1"), "A booking must display additional guests beyond the owner");
assert.ok(attendance.includes("Вы уже идёте · бронь"), "A booking owner must automatically be marked as attending");
assert.ok(attendance.includes("#eventGoing{display:none!important}"), "The separate no-booking action must be removed");

console.log("BALI restored legacy navigation and attendance smoke test passed");
