import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("site/beta4-stable.html", "utf8");
const loader = fs.readFileSync("site/beta4-square-loader.js", "utf8");
const css = fs.readFileSync("site/legacy-nav-final-beta4.css", "utf8");
const nav = fs.readFileSync("site/legacy-nav-final-beta4.js", "utf8");
const attendance = fs.readFileSync("site/legacy-event-attendance-beta4.js", "utf8");
const profile = fs.readFileSync("site/beta4-profile-v2.js", "utf8");
const controls = fs.readFileSync("site/profile-controls-final-beta4.js", "utf8");

assert.ok(html.includes("bali-event-venue-reviews-2-final"), "Published HTML must use the final event content build");
assert.ok(loader.includes("legacy-nav-final-beta4.js"), "Stable navigation must load");
assert.ok(loader.includes("event-details-lineup-beta4.js"), "Event details and lineup must load");
assert.ok(loader.includes("venue-reviews-user-beta4.js"), "Venue and feedback dialogs must load");
assert.ok(loader.includes("reviews-public-save-beta4.js"), "Private feedback submission must load");
assert.ok(loader.indexOf("legacy-event-attendance-beta4.js") < loader.indexOf("event-details-lineup-beta4.js"), "New event details must load after the existing event actions");
assert.ok(loader.indexOf("profile-full-restore-beta4.js") < loader.indexOf("profile-controls-final-beta4.js"), "Final profile controls must run after legacy guards");

assert.match(css, /display:flex!important/, "Navigation must use one stable row");
assert.match(css, /flex:1 1 0!important/, "Navigation buttons must have equal hit areas");
assert.ok(!nav.includes("MutationObserver"), "Navigation must not be rebuilt by an observer");
assert.equal((nav.match(/\["(?:home|events|menu|dating|crown|profile)"/g) || []).length, 6, "Navigation must contain exactly six sections");
assert.ok(nav.includes("replaceChildren"), "Navigation must mount atomically");

assert.ok(profile.includes("BALI Shop"), "Profile must expose BALI Shop");
assert.ok(profile.includes("Мои награды"), "Profile must expose rewards");
assert.ok(profile.includes("data-open-profile-invitations"), "Profile must expose invitations");
assert.ok(profile.includes("data-open-profile-gifts"), "Profile must expose gifts");
assert.ok(profile.includes('stats.hidden = true'), "Profile counters must remain hidden");
assert.ok(controls.includes('[data-open-profile-settings],[data-open-profile-history]'), "Only settings and history may remain in profile controls");

assert.ok(attendance.includes("ХОТЯТ ПОЙТИ"), "Event attendance counter must remain available");
assert.ok(attendance.includes("Забронировали столик"), "Booked parties must remain visible");
assert.ok(attendance.includes("Хотят пойти без бронирования"), "General-admission interest must remain visible");

console.log("BALI final content, navigation, profile and attendance smoke test passed");