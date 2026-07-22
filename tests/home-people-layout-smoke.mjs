import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("site/beta4-stable.html", "utf8");
const loader = fs.readFileSync("site/beta4-square-loader.js", "utf8");
const social = fs.readFileSync("site/beta4-social-page.js", "utf8");
const people = fs.readFileSync("site/bali-people-search-ranking-beta4.js", "utf8");
const publicCards = fs.readFileSync("site/bali-people-public-cards-beta4.js", "utf8");
const crownFrame = fs.readFileSync("site/bali-people-crown-frame-beta4.js", "utf8");
const home = fs.readFileSync("site/home-layout-final-beta4.js", "utf8");
const homeLinks = fs.readFileSync("site/beta4-home-links.js", "utf8");

assert.ok(html.includes("bali-home-people-3"), "Published HTML must use the unified home and people build");
assert.ok(loader.includes("home-layout-final-beta4.js"), "The final user home layout must be loaded");
assert.ok(loader.indexOf("home-layout-final-beta4.js") < loader.indexOf("beta4-social-page.js"), "The top profile must mount before delayed social modules");
assert.ok(!loader.includes("home-final-layout-beta4.js"), "The duplicate home layout must not be loaded");
assert.ok(!loader.includes("bali-people-present-beta4.js"), "The conflicting presence interceptor must not be loaded");
assert.ok(loader.includes("bali-people-crown-frame-beta4.js"), "Crown winner frames must be loaded");

assert.ok(social.includes("Пришёл на мероприятие"), "The active QR attendance tab must have the requested name");
assert.ok(social.includes('row.left_at || row.presence_status === "left"'), "Guests who left must be removed from the active event list");
assert.ok(social.includes("end.getTime() > Date.now()"), "Presence must expire when the event ends");
assert.ok(people.includes("baliPeopleAgeMin"), "BALI PEOPLE must filter by minimum age");
assert.ok(people.includes("baliPeopleAgeMax"), "BALI PEOPLE must filter by maximum age");
assert.ok(people.includes("baliPeopleGender"), "BALI PEOPLE must filter by gender");
assert.ok(people.includes('placeholder="Поиск по имени"'), "Public search must use the Instagram-style name search");
assert.ok(people.includes("width:62px"), "Initial BALI PEOPLE avatars must be compact");
assert.ok(people.includes("people-status-vip"), "VIP users must have a status frame");
assert.ok(people.includes("people-status-black"), "BALI BLACK users must have a distinct frame");
assert.ok(people.includes("people-status-legend"), "BALI LEGEND users must have a distinct frame");
assert.ok(crownFrame.includes("people-status-crown"), "Crown winners must have the highest-priority frame");
assert.ok(publicCards.includes('phone: ""'), "Phone numbers must remain hidden publicly");
assert.ok(publicCards.includes('telegram: ""'), "Telegram usernames must remain hidden publicly");

assert.ok(home.includes("topProfileButton"), "The profile avatar must be in the top-right header");
assert.ok(home.includes("game.vip()"), "The header ring must reflect purchased or gifted VIP status");
assert.ok(home.includes("repeat(3,minmax(0,1fr))"), "Three upcoming events must appear in one row");
assert.ok(home.includes('article.dataset.event = button.dataset.event'), "Each upcoming event card must be clickable");
assert.ok(home.includes("Остальные афиши"), "The home page must link to all other posters");
assert.ok(home.includes("Мы в социальных сетях"), "Social links must have their own lower group");
assert.ok(homeLinks.indexOf('data-contact-key="manager"') < homeLinks.indexOf('data-contact-key="instagram"'), "Manager, phone and map must appear before social networks");

console.log("BALI home layout, discovery filters, presence and status frames smoke test passed");