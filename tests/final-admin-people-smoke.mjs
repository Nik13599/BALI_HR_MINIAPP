import assert from "node:assert/strict";
import fs from "node:fs";

const loader = fs.readFileSync("site/beta4-square-loader.js", "utf8");
const publicCards = fs.readFileSync("site/bali-people-public-cards-beta4.js", "utf8");
const adminHtml = fs.readFileSync("site/admin-beta4.html", "utf8");
const adminRuntime = fs.readFileSync("site/admin-mobile-runtime.js", "utf8");
const admin = fs.readFileSync("site/admin.js", "utf8");
const clans = fs.readFileSync("site/admin-clans-beta4.js", "utf8");
const preview = fs.readFileSync("site/preview-deeplink-beta4.js", "utf8");

assert.ok(loader.includes("beta4-reward-icons-core.js"), "The current reward icon module must load");
assert.ok(loader.includes("bali-people-public-cards-beta4.js"), "Public BALI People cards must load");
assert.ok(loader.includes("bali-people-clans-beta4.js"), "Clans must load inside BALI People");
assert.ok(publicCards.includes("social.visiblePeople = publicPeople"), "All public BALI users must remain visible");
assert.ok(publicCards.includes('phone: ""'), "Phone numbers must stay private");
assert.ok(publicCards.includes('telegram: ""'), "Telegram usernames must stay private");
assert.ok(publicCards.includes("Награды пользователя"), "Public cards must show earned rewards");

assert.ok(adminHtml.includes('data-view="clans"'), "Admin must contain the BALI People clans section");
assert.ok(adminHtml.includes("admin-clans-beta4.js"), "Admin clan controls must load");
assert.ok(adminRuntime.includes("admin-gifts-beta4.js"), "Gift management must load");
assert.ok(adminRuntime.includes("admin-match3-game-beta4.js"), "Match 3 configuration must load");
assert.ok(adminRuntime.includes("admin-visual-blocks-beta4.js"), "Visual block configuration must load");
assert.ok(adminRuntime.includes("admin-nav-icons-beta4.js"), "Bottom-menu icon configuration must load");
assert.ok(adminRuntime.includes("moduleSets.clans=[]"), "Clan admin view must be registered without duplicate loaders");
assert.ok(admin.includes("window.BaliAdminViews"), "Admin must support integrated extension views");
assert.ok(clans.includes("window.BaliAdminViews.clans"), "Clan management must register as a native admin view");
assert.ok(clans.includes("/api/v1/admin/clans/"), "Clan administration must use the secured backend API");
assert.ok(clans.includes("clanAdminCreateForm"), "Admin must create user and corporate clans");
assert.ok(clans.includes("leaderUserKey"), "Admin must appoint the senior while creating a clan");
assert.ok(clans.includes('value="corporate"'), "Admin must expose the corporate clan category");
assert.ok(preview.includes('params.get("show")'), "Published preview must support direct user-section links");
assert.ok(preview.includes('params.get("view")'), "Published preview must support direct admin-section links");
assert.ok(preview.includes("data-people-mode=") && preview.includes('mode = userTarget === "my-clans" ? "clan" : "ranking"'), "Published preview must open clan rankings directly");
assert.ok(preview.includes('data-match3-tab="ranking"'), "Published preview must open the weekly game ranking directly");

console.log("Latest admin, rewards, gifts, visual controls and integrated clan smoke test passed");
