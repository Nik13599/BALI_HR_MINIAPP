import assert from "node:assert/strict";
import fs from "node:fs";

const loader = fs.readFileSync("site/beta4-square-loader.js", "utf8");
const publicCards = fs.readFileSync("site/bali-people-public-cards-beta4.js", "utf8");
const crownWins = fs.readFileSync("site/crown-win-cards-beta4.js", "utf8");
const adminHtml = fs.readFileSync("site/admin-beta4.html", "utf8");
const adminRuntime = fs.readFileSync("site/admin-mobile-runtime.js", "utf8");
const bonuses = fs.readFileSync("site/admin-bonuses-final-beta4.js", "utf8");
const dossier = fs.readFileSync("site/admin-customer-dossier-beta4.js", "utf8");
const userLinks = fs.readFileSync("site/admin-user-card-links-beta4.js", "utf8");

assert.ok(loader.includes("beta4-reward-icons-core.js"), "The reward icon module must use the real filename");
assert.ok(!loader.includes("beta4-reward-icons-core-beta4.js"), "The invalid reward icon filename must not return");
assert.ok(loader.includes("bali-people-public-cards-beta4.js"), "Public BALI People cards must be loaded");
assert.ok(loader.includes("crown-win-cards-beta4.js"), "Miss and Mister win counts must be loaded");

assert.ok(publicCards.includes("social.visiblePeople = publicPeople"), "All BALI users must be visible in BALI PEOPLE");
assert.ok(publicCards.includes('username: ""'), "Telegram username must be hidden publicly");
assert.ok(publicCards.includes('phone: ""'), "Phone numbers must be hidden publicly");
assert.ok(publicCards.includes("Награды пользователя"), "Public cards must show rewards");
assert.ok(publicCards.includes("Текущий уровень"), "Public cards must show ranking level information");
assert.ok(crownWins.includes("МИСС BALI"), "Miss BALI win counts must be shown");
assert.ok(crownWins.includes("МИСТЕР BALI"), "Mister BALI win counts must be shown");

assert.ok(adminHtml.includes("CONTENT 1"), "The event content admin build must be opened");
assert.ok(adminHtml.includes("admin-customer-dossier-beta4.js"), "The full user dossier must be globally loaded");
assert.ok(adminHtml.includes("admin-user-card-links-beta4.js"), "User names must open the dossier across admin sections");
assert.ok(adminHtml.includes("crown-win-cards-beta4.js"), "Admin dossiers must show crown wins");
assert.ok(adminHtml.includes("admin-venue-reviews-beta4.js"), "Venue settings and reviews must be globally loaded");
assert.ok(adminRuntime.includes("admin-bonuses-final-beta4.js"), "The compact points and VIP workflow must be loaded");
assert.ok(bonuses.includes("Новые заявки на фишки"), "Pending chip requests must appear immediately at the top");
assert.ok(bonuses.includes("Открыть историю вручения фишек"), "Chip handover history must open only on request");
assert.ok(bonuses.includes("Начислить или списать баллы"), "Manual point adjustment must have a dedicated block");
assert.ok(dossier.includes("История баллов и бонусов"), "The dossier must include points history");
assert.ok(dossier.includes("Полученные награды"), "The dossier must include rewards");
assert.ok(userLinks.includes("Открыть полную карточку пользователя"), "Names across the admin must be actionable");

console.log("Final admin blocks, content tools, global dossiers and BALI People cards smoke test passed");