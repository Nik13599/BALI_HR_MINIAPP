import assert from "node:assert/strict";
import fs from "node:fs";

const userHtml = fs.readFileSync("site/index.html", "utf8");
const loader = fs.readFileSync("site/beta4-square-loader.js", "utf8");
const adminHtml = fs.readFileSync("site/admin-beta4.html", "utf8");
const admin = fs.readFileSync("site/admin-integrated-overview-beta4.js", "utf8");

assert.ok(userHtml.includes("<title>BALI Minsk — Full Browser DEMO</title>"), "User app must use the requested stable27 shell");
assert.ok(userHtml.includes("FULL DEMO 8.5"), "User app must retain the requested stable27 build marker");
assert.ok(userHtml.includes("beta4-square-loader.js?v=bali-full-demo-8-stable27"), "User app must load stable27");
assert.ok(!userHtml.includes("production-integrated-home-beta4.js"), "The later integrated home overlay must not load");
assert.ok(!loader.includes("production-integrated-home-beta4.js"), "The stable27 loader must not add the later home overlay");

assert.ok(adminHtml.includes("admin-integrated-overview-beta4.js"), "The current CRM overview must remain connected");
assert.ok(adminHtml.includes("index.html?v=bali-full-demo-8-stable27&qa=107d533"), "CRM must open the requested user version");
assert.ok(admin.includes('data-admin-production-view="customers"'), "CRM user management must remain available");
assert.ok(admin.includes('data-admin-production-view="clans"'), "CRM clan management must remain available");
assert.ok(admin.includes('data-admin-production-view="bonuses"'), "CRM economy management must remain available");
assert.ok(admin.includes('data-admin-production-view="settings"'), "CRM content management must remain available");

console.log("stable27 user app and current CRM combination smoke passed");
