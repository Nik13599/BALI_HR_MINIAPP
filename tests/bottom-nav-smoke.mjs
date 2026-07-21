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

assert.ok(html.includes("beta4-square-loader.js"), "Previous modular application must be restored");
assert.ok(!html.includes("bali-user-clean.js"), "The replacement clean application must not be loaded");
assert.ok(loader.includes("legacy-nav-final-beta4.css"), "Stable legacy navigation CSS must be loaded");
assert.ok(loader.includes("legacy-nav-final-beta4.js"), "Final navigation composer must be loaded");
assert.ok(loader.includes("legacy-event-attendance-beta4.js"), "Unified event attendance must be loaded");
assert.ok(loader.includes("profile-full-restore-beta4.js"), "Full profile restore layer must be loaded");
assert.ok(loader.includes("beta4-loyalty-core.js"), "Points economy core must be loaded");
assert.ok(loader.includes("beta4-loyalty-ui-stable.js"), "Points shop UI must be loaded");
assert.ok(loader.includes("chip-requests-core-beta4.js"), "Chip request core must be loaded");
assert.ok(loader.includes("chip-requests-user-beta4.js"), "Chip purchase UI must be loaded");
assert.ok(loader.includes("beta4-profile-v2.js"), "Extended profile settings must be loaded");
assert.ok(loader.includes("profile-demographics-beta4.js"), "Birth date and gender settings must be loaded");
assert.ok(loader.includes("beta4-reward-icons-core.js"), "Reward icon core must be loaded with the correct filename");
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

assert.ok(profileV2.includes("Магазин VIP"), "Extended points dialog must include the VIP shop");
assert.ok(profileV2.includes("Обмен баллов на фишки"), "Extended points dialog must include chip exchange");
assert.ok(profileV2.includes("История баллов"), "Extended points dialog must include points history");
assert.ok(loyaltyUi.includes("Купить за баллы"), "Inline BALI shop must be rendered");
assert.ok(loyaltyUi.includes("data-buy-vip-points"), "VIP purchases with points must be supported");
assert.ok(chipUi.includes("Приобрести фишки"), "Physical chip purchase requests must be supported");
assert.ok(profileRestore.includes("classList.remove(\"profile-v2-hidden\")"), "Previously hidden profile cards must be revealed");
assert.ok(profileRestore.includes("#pointsShopCard"), "The points shop must stay visible in profile");
assert.ok(profileRestore.includes("#profileForm"), "The original profile settings must stay visible");
assert.ok(profileRestore.includes("Магазин BALI — покупки за баллы"), "The restored shop must have an explicit title");

assert.ok(attendance.includes("ХОТЯТ ПОЙТИ"), "Event detail must show one unified counter");
assert.ok(attendance.includes("sum + row.guests"), "A booking must add the full guest count");
assert.ok(attendance.includes("Вы уже идёте · бронь"), "A booking owner must automatically be marked as attending");
assert.ok(attendance.includes("#eventGoing{display:none!important}"), "The separate no-booking action must be removed");
assert.ok(attendance.includes("legacyAttendanceDialog"), "The attendance list must open in a separate dialog");
assert.ok(attendance.includes("data-open-attendance-list"), "The total counter must be clickable");
assert.ok(attendance.includes("Посмотреть, кто собирается"), "The event must show an explicit list action");
assert.ok(attendance.includes("Забронировали столик"), "Booked parties must have their own section");
assert.ok(attendance.includes("Хотят пойти без бронирования"), "Interested guests must have their own section");
assert.match(attendance, /root\.innerHTML = `<button class="legacy-attendance-total"/, "The event page must render only the compact attendance button, not the full people list");

console.log("BALI restored navigation, dialog attendance and full profile smoke test passed");
