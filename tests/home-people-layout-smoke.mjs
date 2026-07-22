import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("site/beta4-stable.html", "utf8");
const loader = fs.readFileSync("site/beta4-square-loader.js", "utf8");
const social = fs.readFileSync("site/beta4-social-page.js", "utf8");
const people = fs.readFileSync("site/bali-people-discovery-fast-beta4.js", "utf8");
const publicCards = fs.readFileSync("site/bali-people-public-cards-beta4.js", "utf8");
const home = fs.readFileSync("site/home-final-layout-beta4.js", "utf8");
const config = fs.readFileSync("site/config.js", "utf8");

assert.ok(html.includes("bali-performance-fix-1"), "Published HTML must use the performance fix build");
assert.ok(loader.includes("home-final-layout-beta4.js"), "The lightweight final home layout must be loaded");
assert.ok(loader.includes("bali-people-discovery-fast-beta4.js"), "The lightweight discovery module must be loaded");
assert.ok(!loader.includes("home-layout-final-beta4.js"), "The lagging home observer must not be loaded");
assert.ok(!loader.includes("bali-people-search-ranking-beta4.js"), "The lagging people observer must not be loaded");
assert.ok(!loader.includes("bali-people-crown-frame-beta4.js"), "The extra crown observer must not be loaded");
assert.ok(!home.includes("MutationObserver"), "The home layout must not continuously rewrite the DOM");
assert.ok(!people.includes("MutationObserver"), "BALI PEOPLE must not continuously rewrite the DOM");

assert.ok(social.includes("Пришёл на мероприятие"), "The active QR attendance tab must have the requested name");
assert.ok(social.includes('row.left_at || row.presence_status === "left"'), "Guests who left must be removed from the active event list");
assert.ok(social.includes("end.getTime() > Date.now()"), "Presence must expire when the event ends");
assert.ok(people.includes("minAge = 18"), "BALI PEOPLE must filter by minimum age");
assert.ok(people.includes("maxAge = 99"), "BALI PEOPLE must filter by maximum age");
assert.ok(people.includes('gender = "all"'), "BALI PEOPLE must filter by gender");
assert.ok(people.includes('placeholder="Поиск по имени"'), "Public search must use the Instagram-style name search");
assert.ok(people.includes("width:60px"), "Initial BALI PEOPLE avatars must be compact");
assert.ok(people.includes("people-status-vip"), "VIP users must have a status frame");
assert.ok(people.includes("people-status-black"), "BALI BLACK users must have a distinct frame");
assert.ok(people.includes("people-status-legend"), "BALI LEGEND users must have a distinct frame");
assert.ok(people.includes("people-status-crown"), "Contest winners must have a crown frame");
assert.ok(publicCards.includes('phone: ""'), "Phone numbers must remain hidden publicly");
assert.ok(publicCards.includes('telegram: ""'), "Telegram usernames must remain hidden publicly");

assert.ok(home.includes("top-profile-button"), "The profile avatar must be in the top-right header");
assert.ok(home.includes("activeVip(profile)"), "The header ring must reflect purchased or gifted VIP status");
assert.ok(home.includes("repeat(3,minmax(0,1fr))"), "Three upcoming events must appear in one row");
assert.ok(home.includes("Остальные афиши"), "The home page must link to all other posters");
assert.ok(home.includes("Мы в соцсетях"), "Social networks must have a separate block");
assert.ok(home.includes("Как нас найти"), "Yandex Maps must have a separate block");
assert.ok(home.includes("Связь с BALI"), "Manager and phone must have a separate block");
assert.ok(home.includes("TikTok"), "TikTok must be present in social links");
assert.ok(home.includes("overflow-y:auto!important"), "Vertical page scrolling must be explicitly preserved");
assert.ok(config.includes("tiktokUrl"), "TikTok URL must be configurable");

console.log("BALI performance, home contacts, discovery filters, presence and status frames smoke test passed");