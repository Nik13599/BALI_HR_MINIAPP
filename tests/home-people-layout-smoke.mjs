import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("site/index.html", "utf8");
const loader = fs.readFileSync("site/beta4-square-loader.js", "utf8");
const people = fs.readFileSync("site/bali-people-search-ranking-beta4.js", "utf8");
const publicCards = fs.readFileSync("site/bali-people-public-cards-beta4.js", "utf8");
const vipSync = fs.readFileSync("site/bali-people-status-sync-beta4.js", "utf8");
const vipFrame = fs.readFileSync("site/bali-people-vip-frame-beta4.js", "utf8");
const home = fs.readFileSync("site/home-layout-final-beta4.js", "utf8");
const venue = fs.readFileSync("site/venue-reviews-user-beta4.js", "utf8");
const clans = fs.readFileSync("site/bali-people-clans-beta4.js", "utf8");

assert.ok(html.includes("bali-full-demo-8-stable25"), "Published page must use the latest build");
assert.ok(loader.includes("home-layout-final-beta4.js"), "The current home layout must load");
assert.ok(loader.includes("bali-people-search-ranking-beta4.js"), "BALI People search must load");
assert.ok(loader.includes("bali-people-status-sync-beta4.js"), "Purchased VIP must sync to public profiles");
assert.ok(loader.includes("bali-people-vip-frame-beta4.js"), "VIP frames must load");
assert.ok(loader.includes("bali-people-clans-beta4.js"), "Clan mode must extend BALI People");
assert.ok(!loader.includes("bali-people-crown-frame-beta4.js"), "The retired crown contest frame must stay removed");

assert.ok(people.includes("baliPeopleAgeMin"), "BALI People must filter by minimum age");
assert.ok(people.includes("baliPeopleAgeMax"), "BALI People must filter by maximum age");
assert.ok(people.includes("baliPeopleGender"), "BALI People must filter by gender");
assert.ok(people.includes("people-status-vip"), "VIP users must have a status frame");
assert.ok(people.includes("people-status-black"), "BALI BLACK users must have a distinct frame");
assert.ok(people.includes("people-status-legend"), "BALI LEGEND users must have a distinct frame");
assert.ok(vipSync.includes("vipPlanId"), "Purchased VIP plan must be stored in the public profile");
assert.ok(vipFrame.includes("people-status-vip"), "Purchased VIP data must produce a public frame");
assert.ok(publicCards.includes('phone: ""'), "Phone numbers must remain hidden publicly");

assert.ok(home.includes("topProfileButton"), "The profile avatar must remain in the home header");
assert.ok(home.includes("repeat(3,minmax(0,1fr))"), "Three upcoming events must remain in one row where space allows");
assert.ok(home.includes("home-social-links"), "Social links must remain compact");
assert.ok(home.includes("home-contact-links"), "Contact links must remain compact");
assert.ok(venue.includes("Узнать подробнее о площадке"), "Home must open venue details");
assert.ok(venue.includes("Оставить отзыв"), "Home must expose feedback");
assert.ok(clans.includes("data-people-mode=\"people\""), "BALI People must retain its people directory mode");
assert.ok(clans.includes("data-people-mode=\"clan\""), "BALI People must add an integrated clan mode");

console.log("Latest BALI home, people directory, VIP and clan layout smoke test passed");
