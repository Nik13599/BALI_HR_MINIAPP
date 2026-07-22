import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("site/beta4-stable.html", "utf8");
const loader = fs.readFileSync("site/beta4-square-loader.js", "utf8");
const social = fs.readFileSync("site/beta4-social-page.js", "utf8");
const people = fs.readFileSync("site/bali-people-search-ranking-beta4.js", "utf8");
const publicCards = fs.readFileSync("site/bali-people-public-cards-beta4.js", "utf8");
const home = fs.readFileSync("site/home-layout-final-beta4.js", "utf8");
const homeLinks = fs.readFileSync("site/beta4-home-links.js", "utf8");
const venue = fs.readFileSync("site/venue-reviews-user-beta4.js", "utf8");

assert.ok(html.includes("bali-event-venue-reviews-2-final"), "Published HTML must use the final content build");
assert.ok(loader.includes("home-layout-final-beta4.js"), "Final home layout must load");
assert.ok(loader.includes("bali-people-search-ranking-beta4.js"), "BALI PEOPLE filters must load");
assert.ok(loader.includes("venue-reviews-user-beta4.js"), "Venue and feedback UI must load");
assert.ok(!loader.includes("home-final-layout-beta4.js"), "Duplicate home layout must stay disabled");

assert.ok(social.includes("Пришёл на мероприятие"), "Active attendance tab must remain");
assert.ok(social.includes('row.left_at || row.presence_status === "left"'), "Guests who left must disappear from active attendance");
assert.ok(people.includes("baliPeopleAgeMin") && people.includes("baliPeopleAgeMax"), "Age filters must remain");
assert.ok(people.includes("baliPeopleGender"), "Gender filter must remain");
assert.ok(publicCards.includes('phone: ""') && publicCards.includes('telegram: ""'), "Private contacts must stay hidden");

assert.ok(home.includes("topProfileButton"), "Profile avatar must stay in the header");
assert.ok(home.includes("repeat(3,minmax(0,1fr))"), "Three upcoming events must remain in one row");
assert.ok(home.includes("home-social-links"), "Social links must remain compact");
assert.ok(home.includes("home-map-links"), "Yandex Maps must remain highlighted");
assert.ok(home.includes("home-contact-links"), "Phone and manager must remain in one row");
assert.ok(venue.includes("Узнать подробнее о площадке"), "Home must expose venue details");
assert.ok(venue.includes("Оставить отзыв"), "Home must expose feedback");

const socialIndex = homeLinks.indexOf("home-social-section");
const mapIndex = homeLinks.indexOf("home-map-section");
const contactIndex = homeLinks.indexOf("home-contact-section");
assert.ok(socialIndex >= 0 && socialIndex < mapIndex && mapIndex < contactIndex, "Home order must remain social, map, contacts");

console.log("BALI final home, venue, feedback and BALI PEOPLE smoke test passed");