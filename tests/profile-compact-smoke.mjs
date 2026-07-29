import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("site/index.html", "utf8");
const loader = fs.readFileSync("site/beta4-square-loader.js", "utf8");
const profile = fs.readFileSync("site/beta4-profile-v2.js", "utf8");
const controls = fs.readFileSync("site/profile-controls-final-beta4.js", "utf8");
const socialCore = fs.readFileSync("site/beta4-social-core.js", "utf8");
const guard = fs.readFileSync("site/profile-full-restore-beta4.js", "utf8");
const vip = fs.readFileSync("site/vip-duration-options-beta4.js", "utf8");
const demographics = fs.readFileSync("site/profile-demographics-beta4.js", "utf8");
const chips = fs.readFileSync("site/chip-requests-user-beta4.js", "utf8");

assert.ok(html.includes("bali-full-demo-8-stable27"), "Published page must use the latest build");
assert.ok(loader.includes("beta4-profile-v2.js"), "Compact profile controller must load");
assert.ok(loader.includes("profile-controls-final-beta4.js"), "Final profile controls must load");
assert.ok(loader.indexOf("profile-full-restore-beta4.js") < loader.indexOf("profile-controls-final-beta4.js"), "Final controls must run after the legacy profile guard");
assert.ok(loader.includes("vip-duration-options-beta4.js"), "VIP variants must load");

assert.ok(profile.includes("BALI Shop"), "The BALI Shop entry must exist");
assert.ok(profile.includes("data-open-profile-invitations"), "Invitations must open from the profile");
assert.ok(profile.includes("data-open-profile-gifts"), "Gifts must open from the profile");
assert.ok(profile.includes("data-profile-invite-response"), "Invitation response controls must exist");
assert.ok(profile.includes("profileVipBody"), "VIP variants must render inside BALI Shop");
assert.ok(profile.includes("stats.hidden = true"), "Legacy profile counters must stay hidden");
assert.ok(profile.includes('<input name="socialStatus" maxlength="80"'), "Users must enter their own BALI People status");
assert.ok(!profile.includes('<select name="socialStatus"'), "BALI People status must not use a predefined selector");
assert.ok(controls.includes("[data-open-profile-settings],[data-open-profile-history]"), "Only settings and history controls may remain");

assert.ok(socialCore.includes("eventEndAt"), "Invitations must retain their event expiry");
assert.ok(socialCore.includes("incomingGifts"), "Incoming gifts must be available");
assert.ok(socialCore.includes("statusText"), "Custom status text must be normalized and preserved");
assert.ok(!socialCore.includes('x.status!==\"closed\"'), "Profile visibility must not depend on a legacy status value");
assert.ok(vip.includes('document.getElementById("profileVipBody")'), "VIP variants must attach to BALI Shop");
assert.ok(chips.includes("Приобрести фишки"), "Chip requests must integrate into BALI Shop");
assert.ok(demographics.includes("profileV2SettingsForm"), "Age and gender must attach to profile settings");
assert.ok(guard.includes('card.classList.add("profile-v2-hidden")'), "Legacy long profile sections must remain collapsed");
assert.ok(guard.includes('quick.classList.remove("profile-v2-hidden")'), "The compact profile actions must remain available");

console.log("Latest compact BALI profile, invitations, gifts and VIP smoke test passed");
