import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("site/beta4-stable.html", "utf8");
const loader = fs.readFileSync("site/beta4-square-loader.js", "utf8");
const profile = fs.readFileSync("site/beta4-profile-v2.js", "utf8");
const controls = fs.readFileSync("site/profile-controls-final-beta4.js", "utf8");
const socialCore = fs.readFileSync("site/beta4-social-core.js", "utf8");
const socialPage = fs.readFileSync("site/beta4-social-page.js", "utf8");
const splitInvites = fs.readFileSync("site/profile-invitations-split-beta4.js", "utf8");
const guard = fs.readFileSync("site/profile-full-restore-beta4.js", "utf8");
const vip = fs.readFileSync("site/vip-duration-options-beta4.js", "utf8");
const rewards = fs.readFileSync("site/profile-recent-rewards-beta4.js", "utf8");
const demographics = fs.readFileSync("site/profile-demographics-beta4.js", "utf8");
const chips = fs.readFileSync("site/chip-requests-user-beta4.js", "utf8");

assert.ok(html.includes("bali-reviews-likes-invites-4-final"), "Published page must use the final stable cache version");
assert.ok(loader.includes("beta4-profile-v2.js"), "Compact profile controller must be loaded");
assert.ok(loader.includes("profile-controls-final-beta4.js"), "Final profile controls must be loaded");
assert.ok(loader.includes("profile-invitations-split-beta4.js"), "Split invitation controller must be loaded");
assert.ok(loader.indexOf("profile-full-restore-beta4.js") < loader.indexOf("profile-controls-final-beta4.js"), "Final controls must run after legacy profile guards");
assert.ok(loader.includes("vip-duration-options-beta4.js"), "VIP variants must be loaded");

assert.ok(profile.includes("BALI Shop"), "The BALI Shop button must exist");
assert.ok(profile.includes("Мои награды"), "The rewards button must exist");
assert.ok(profile.includes("Мои подарки"), "The incoming gifts dialog must exist");
assert.ok(profile.includes("data-open-profile-invitations"), "Invitations must open from a separate profile button");
assert.ok(profile.includes("data-open-profile-gifts"), "Gifts must open from a separate profile button");
assert.ok(profile.includes("От кого:"), "Every gift must show its sender");
assert.ok(profile.includes("data-profile-invite-response"), "Invitation response controls must exist");
assert.ok(profile.includes('social?.respond?.(id, decision)'), "Users must be able to change invitation responses");
assert.ok(splitInvites.includes("Кого пригласил я"), "Outgoing invitations must have a separate tab");
assert.ok(splitInvites.includes("Кто пригласил меня"), "Incoming invitations must have a separate tab");
assert.ok(socialCore.includes("activeOutgoingRequests"), "Outgoing invitation status must be available");
assert.ok(profile.includes('stats.innerHTML = ""'), "Legacy profile counters must be cleared");
assert.ok(profile.includes("stats.hidden = true"), "Legacy profile counters must stay hidden");
assert.ok(profile.includes('data-open-profile-settings'), "Settings must remain in the profile hero");
assert.ok(profile.includes('data-open-profile-history'), "Visit history must remain in the profile hero");
assert.ok(controls.includes('profile-rank-button'), "Final controls must remove the ranking button");
assert.ok(controls.includes('[data-open-profile-settings],[data-open-profile-history]'), "Only settings and history controls may remain");

assert.ok(socialPage.includes("Пригласить на мероприятие"), "Only event invitations must remain");
assert.ok(!socialPage.includes("Пригласить за столик"), "Table invitations must be removed");
assert.ok(!socialPage.includes("Пригласить потанцевать"), "Dance invitations must be removed");
assert.ok(socialPage.includes("Нет доступных мероприятий"), "The invitation picker must handle no active events");
assert.ok(socialCore.includes("eventEndAt"), "Invitations must store an event expiry time");
assert.ok(socialCore.includes("activeIncomingRequests"), "Only active incoming invitations must be returned");
assert.ok(socialCore.includes('new Date(end).getTime()>Date.now()'), "Expired invitations must disappear automatically");
assert.ok(socialCore.includes("incomingGifts"), "Incoming gifts must be filtered for the current user");
assert.ok(socialCore.includes("fromName"), "Gift and invitation sender names must be stored");

assert.ok(profile.includes("VIP-статусы"), "VIP statuses must remain inside BALI Shop");
assert.ok(profile.includes("profileVipBody"), "BALI Shop must contain VIP variants");
assert.ok(profile.includes("Обмен баллов на фишки"), "BALI Shop must contain chip exchange");
assert.ok(!profile.includes("profileVipDialog"), "VIP must not use a separate dialog");
assert.ok(vip.includes('document.getElementById("profileVipBody")'), "VIP variants must render inside BALI Shop");
assert.ok(chips.includes("Приобрести фишки"), "Chip requests must integrate into BALI Shop");
assert.ok(demographics.includes("profileV2SettingsForm"), "Age and gender must attach to settings");
assert.ok(guard.includes('card.classList.add("profile-v2-hidden")'), "Legacy long profile sections must stay hidden");
assert.ok(!guard.includes('classList.remove("profile-v2-hidden")'), "The old long profile must never be restored");
assert.ok(rewards.includes('stats.hidden = true'), "Recent rewards must not restore profile counters");

console.log("BALI profile invitations, gifts, controls and compact menu smoke test passed");
