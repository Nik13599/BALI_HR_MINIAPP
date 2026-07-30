import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("site/index.html", "utf8");
const loader = fs.readFileSync("site/beta4-square-loader.js", "utf8");
const home = fs.readFileSync("site/production-integrated-home-beta4.js", "utf8");
const adminHtml = fs.readFileSync("site/admin-beta4.html", "utf8");
const admin = fs.readFileSync("site/admin-integrated-overview-beta4.js", "utf8");

assert.ok(html.includes("BETA 25 · INTEGRATED"), "User preview must visibly identify the integrated beta");
assert.ok(loader.includes('"production-integrated-home-beta4.js"'), "Integrated home must load in the existing user app");
assert.ok(home.includes('id = "baliProductionHome"'), "Integrated home must mount into the existing home screen");
assert.ok(home.includes('data-page="dating"'), "Integrated home must link to BALI People and clans");
assert.ok(home.includes('data-page="crown"'), "Integrated home must link to Match-3");
assert.ok(home.includes('data-page="menu"'), "Menu and shop must remain accessible outside the five-button bottom navigation");
assert.ok(home.includes('data-event="${esc(event.id)}"'), "Nearest event must expose attendance and booking actions");
assert.ok(home.includes('[data-screen="home"] .inner>:not(.hero):not(#baliProductionHome)'), "Legacy home blocks must not be mixed into the integrated home screen");
assert.ok(home.includes('card.style.setProperty("display", "none", "important")'), "The nearest event must not be duplicated in the legacy event list");
assert.ok(adminHtml.includes("admin-integrated-overview-beta4.js"), "Integrated overview must load in the existing admin");
assert.ok(admin.includes('data-admin-production-view="clans"'), "Admin overview must expose clan management");
assert.ok(admin.includes('data-admin-production-view="bonuses"'), "Admin overview must expose rewards, points, VIP and gifts");
assert.ok(admin.includes('data-admin-production-view="settings"'), "Admin overview must expose design and navigation controls");
assert.ok(admin.includes('#content>.bali-admin-control~*{display:none!important}'), "Legacy dashboard widgets must not be mixed into the admin control center");

console.log("integrated visible beta smoke passed");
