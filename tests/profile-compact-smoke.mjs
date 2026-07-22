import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("site/beta4-stable.html", "utf8");
const loader = fs.readFileSync("site/beta4-square-loader.js", "utf8");
const profile = fs.readFileSync("site/beta4-profile-v2.js", "utf8");
const guard = fs.readFileSync("site/profile-full-restore-beta4.js", "utf8");
const vip = fs.readFileSync("site/vip-duration-options-beta4.js", "utf8");
const rewards = fs.readFileSync("site/profile-recent-rewards-beta4.js", "utf8");
const demographics = fs.readFileSync("site/profile-demographics-beta4.js", "utf8");
const chips = fs.readFileSync("site/chip-requests-user-beta4.js", "utf8");

assert.ok(html.includes("bali-compact-profile-1"), "Published page must use the compact profile cache version");
assert.ok(loader.includes("beta4-profile-v2.js"), "Compact profile controller must be loaded");
assert.ok(loader.includes("vip-duration-options-beta4.js"), "VIP variants must be loaded");
assert.ok(loader.indexOf("beta4-profile-v2.js") < loader.indexOf("vip-duration-options-beta4.js"), "BALI Shop must exist before VIP variants attach");
assert.ok(loader.indexOf("vip-duration-options-beta4.js") < loader.indexOf("profile-full-restore-beta4.js"), "Compact guard must run after the shop modules");

assert.equal((profile.match(/data-open-profile-points/g) || []).length >= 2, true, "BALI Shop must have an opening action and handler");
assert.ok(profile.includes("BALI Shop"), "The main shop button and dialog must be named BALI Shop");
assert.ok(profile.includes("VIP-статусы"), "VIP statuses must be inside BALI Shop");
assert.ok(profile.includes("profileVipBody"), "BALI Shop must contain the VIP variants target");
assert.ok(profile.includes("Обмен баллов на фишки"), "BALI Shop must contain chip exchange");
assert.ok(profile.includes("Мои награды"), "The combined rewards button must exist");
assert.ok(profile.includes("Награды BALI"), "Standard and custom BALI rewards must be shown together");
assert.ok(profile.includes("data-open-profile-settings"), "Settings must open through the gear action");
assert.ok(profile.includes("profileV2SettingsForm"), "All primary settings must stay in the settings dialog");
assert.ok(profile.includes("data-open-profile-history"), "Visit history must remain available by a button");
assert.ok(!profile.includes("profileVipDialog"), "VIP must not use a separate profile dialog");

assert.ok(vip.includes('document.getElementById("profileVipBody")'), "VIP variants must render inside BALI Shop");
assert.ok(vip.includes("1 мероприятие"), "One-event VIP must be available");
assert.ok(vip.includes("2 мероприятия"), "Two-event VIP must be available");
assert.ok(vip.includes("1 день"), "One-day VIP must be available");
assert.ok(vip.includes("1 месяц"), "Monthly VIP must be available");
assert.ok(chips.includes("Приобрести фишки"), "Chip requests must integrate into BALI Shop");
assert.ok(demographics.includes('form.id !== "profileV2SettingsForm"') || demographics.includes('id!=="profileV2SettingsForm"'), "Age and gender must attach to the settings form");
assert.ok(guard.includes('card.classList.add("profile-v2-hidden")'), "Legacy long profile sections must stay hidden");
assert.ok(!guard.includes('classList.remove("profile-v2-hidden")'), "The old long profile must never be restored");
assert.ok(rewards.includes('stats?.classList.remove("profile-stats-hidden")'), "Compact statistics must remain visible");

console.log("BALI compact profile menu, shop, rewards, VIP and settings smoke test passed");