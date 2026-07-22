import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("site/beta4-stable.html", "utf8");
const loader = fs.readFileSync("site/beta4-square-loader.js", "utf8");
const css = fs.readFileSync("site/legacy-nav-final-beta4.css", "utf8");
const nav = fs.readFileSync("site/legacy-nav-final-beta4.js", "utf8");
const attendance = fs.readFileSync("site/legacy-event-attendance-beta4.js", "utf8");
const profileRestore = fs.readFileSync("site/profile-full-restore-beta4.js", "utf8");
const profileV2 = fs.readFileSync("site/beta4-profile-v2.js", "utf8");
const loyaltyUi = fs.readFileSync("site/beta4-loyalty-ui-stable.js", "utf8");
const chipUi = fs.readFileSync("site/chip-requests-user-beta4.js", "utf8");
const home = fs.readFileSync("site/home-final-layout-beta4.js", "utf8");
const people = fs.readFileSync("site/bali-people-discovery-fast-beta4.js", "utf8");

assert.ok(html.includes("beta4-square-loader.js"), "The modular application must be loaded");
assert.ok(html.includes("bali-performance-fix-1"), "Published HTML must use the performance fix build");
assert.ok(!html.includes("bali-user-clean.js"), "The replacement clean application must not be loaded");
assert.ok(loader.includes("legacy-nav-final-beta4.css"), "Stable legacy navigation CSS must be loaded");
assert.ok(loader.includes("legacy-nav-final-beta4.js"), "Final navigation composer must be loaded");
assert.ok(loader.includes("'beta4-app.js','legacy-nav-final-beta4.js'"), "Bottom navigation must load immediately after the base application");
assert.ok(loader.indexOf("legacy-nav-final-beta4.js") < loader.indexOf("beta4-social-page.js"), "Navigation must appear before social modules");
assert.ok(loader.indexOf("legacy-nav-final-beta4.js") < loader.indexOf("night-crown-beta4.js"), "Navigation must appear before crown modules");
assert.ok(loader.includes("bali-people-discovery-fast-beta4.js"), "The lightweight BALI PEOPLE module must be loaded");
assert.ok(loader.includes("home-final-layout-beta4.js"), "The lightweight home layout must be loaded");
assert.ok(!loader.includes("home-layout-final-beta4.js"), "The lagging home observer must not be loaded");
assert.ok(!loader.includes("bali-people-search-ranking-beta4.js"), "The lagging people observer must not be loaded");
assert.ok(!loader.includes("bali-people-crown-frame-beta4.js"), "The separate crown observer must not be loaded");
assert.ok(!home.includes("MutationObserver"), "Home layout must not observe and rewrite the full DOM");
assert.ok(!people.includes("MutationObserver"), "BALI PEOPLE must not observe and rewrite the full DOM");
assert.ok(home.includes("overflow-y:auto!important"), "Pages must retain vertical touch scrolling");
assert.ok(home.includes("Мы в соцсетях"), "The social media contact group must be present");
assert.ok(home.includes("Как нас найти"), "The map contact group must be present");
assert.ok(home.includes("Связь с BALI"), "The direct contact group must be present");
assert.ok(home.includes("TikTok"), "TikTok must be available in the social media group");

assert.ok(loader.includes("legacy-event-attendance-beta4.js"), "Unified event attendance must be loaded");
assert.ok(loader.includes("profile-full-restore-beta4.js"), "Full profile restore layer must be loaded");
assert.ok(loader.includes("beta4-loyalty-core.js"), "Points economy core must be loaded");
assert.ok(loader.includes("beta4-loyalty-ui-stable.js"), "Points shop UI must be loaded");
assert.ok(loader.includes("chip-requests-core-beta4.js"), "Chip request core must be loaded");
assert.ok(loader.includes("chip-requests-user-beta4.js"), "Chip purchase UI must be loaded");
assert.ok(loader.includes("beta4-profile-v2.js"), "Extended profile settings must be loaded");
assert.ok(loader.includes("profile-demographics-beta4.js"), "Birth date and gender settings must be loaded");
assert.ok(loader.includes("beta4-reward-icons-core.js"), "Reward icon core must use the correct filename");
assert.ok(!loader.includes("night-crown-nav-fix-beta4.js"), "The old navigation observer must not be loaded");
assert.ok(!loader.includes("bottom-nav-controller-beta4.js"), "The conflicting navigation interceptor must not be loaded");
assert.ok(!loader.includes("bottom-nav-dedupe-beta4.js"), "The old navigation deduper must not be loaded");

assert.match(css, /nav\.nav:not\(\[data-navigation-ready="true"\]\)\{visibility:hidden/, "Only the tiny pre-mount navigation state may stay hidden");
assert.match(css, /display:flex!important/, "Final navigation must use one stable flex row");
assert.match(css, /flex:1 1 0!important/, "Every button must own an equal physical hit area");
assert.ok(css.includes("navigation-loading"), "Late sections must have a visible loading state");
assert.ok(!nav.includes("MutationObserver"), "Final navigation must not be rebuilt by an observer");
assert.equal((nav.match(/\["(?:home|events|menu|dating|crown|profile)"/g) || []).length, 6, "Final navigation must contain exactly six sections");
assert.ok(nav.includes("replaceChildren"), "Navigation must be finalized atomically");
assert.ok(nav.includes("nav.dataset.navigationReady = 'true'"), "Navigation must become visible immediately after mounting");
assert.ok(nav.includes("button.disabled = !available"), "Late screen buttons must remain safe until ready");
assert.ok(!nav.includes("function ready()"), "Navigation must not wait for every feature screen before appearing");

assert.ok(profileV2.includes("Магазин VIP"), "Extended points dialog must include the VIP shop");
assert.ok(profileV2.includes("Обмен баллов на фишки"), "Extended points dialog must include chip exchange");
assert.ok(profileV2.includes("История баллов"), "Extended points dialog must include points history");
assert.ok(loyaltyUi.includes("Купить за баллы"), "Inline BALI shop must be rendered");
assert.ok(loyaltyUi.includes("data-buy-vip-points"), "VIP purchases with points must be supported");
assert.ok(chipUi.includes("Приобрести фишки"), "Physical chip purchase requests must be supported");
assert.ok(profileRestore.includes("classList.remove(\"profile-v2-hidden\")"), "Previously hidden profile cards must be revealed");
assert.ok(profileRestore.includes("#pointsShopCard"), "The points shop must stay visible in profile");
assert.ok(profileRestore.includes("#profileForm"), "The original profile settings must stay visible");

assert.ok(attendance.includes("ХОТЯТ ПОЙТИ"), "Event detail must show one unified counter");
assert.ok(attendance.includes("sum + row.guests"), "A booking must add the full guest count");
assert.ok(attendance.includes("legacyAttendanceDialog"), "The attendance list must open in a separate dialog");
assert.ok(attendance.includes("Забронировали столик"), "Booked parties must have their own section");
assert.ok(attendance.includes("Хотят пойти без бронирования"), "Interested guests must have their own section");

console.log("BALI performance, scrolling, contacts and navigation smoke test passed");