import assert from "node:assert/strict";
import fs from "node:fs";

const loader = fs.readFileSync("site/beta4-square-loader.js", "utf8");
const html = fs.readFileSync("site/beta4-stable.html", "utf8");
const admin = fs.readFileSync("site/admin-beta4.html", "utf8");
const adminRuntime = fs.readFileSync("site/admin-mobile-runtime.js", "utf8");
const socialCore = fs.readFileSync("site/beta4-social-core.js", "utf8");
const likes = fs.readFileSync("site/bali-people-open-likes-beta4.js", "utf8");
const invites = fs.readFileSync("site/profile-invitations-split-beta4.js", "utf8");
const eventStability = fs.readFileSync("site/event-stability-final-beta4.js", "utf8");

assert.ok(html.includes("bali-reviews-likes-invites-4-final"), "Published user HTML must use the stable invitations build");
assert.ok(loader.includes("bali-people-open-likes-beta4.js"), "Open photo and like count module must load");
assert.ok(loader.includes("profile-invitations-split-beta4.js"), "Split invitation module must load");
assert.ok(loader.includes("event-stability-final-beta4.js"), "Final event stability module must load");
assert.ok(loader.indexOf("profile-invitations-split-beta4.js") > loader.indexOf("beta4-profile-v2.js"), "Invitation split must override the base profile UI");
assert.ok(loader.indexOf("event-stability-final-beta4.js") > loader.indexOf("event-details-lineup-beta4.js"), "Event stability must run after event details");

assert.ok(admin.includes("beta4-admin-content-2"), "Admin must use the fixed content build");
assert.ok(adminRuntime.includes("reviews:[]"), "Reviews must be a registered admin route");
assert.ok(adminRuntime.includes('reviews:"Отзывы и предложения"'), "Reviews route must have its own title");
assert.ok(!adminRuntime.includes('view="dashboard";const id'), "Valid reviews navigation must not fall back to dashboard");

assert.ok(socialCore.includes("activeOutgoingRequests"), "Social core must expose active outgoing invitations");
assert.ok(invites.includes("Кого пригласил я"), "Profile must show outgoing invitations");
assert.ok(invites.includes("Кто пригласил меня"), "Profile must show incoming invitations");
assert.ok(invites.includes("Принято"), "Outgoing invitation status must show accepted responses");
assert.ok(invites.includes("Отклонено"), "Outgoing invitation status must show declined responses");
assert.ok(invites.includes("data-profile-invite-response"), "Incoming invitation response controls must remain available");

assert.ok(likes.includes("social.isConnection = () => true"), "Photos must no longer require a mutual like");
assert.ok(likes.includes("social.likeCount"), "Every public profile must have a received-like counter");
assert.ok(likes.includes("if (scheduled) return"), "Like rendering must coalesce repeated DOM updates");
assert.ok(likes.includes("const relevant = records.some"), "Like observer must ignore unrelated DOM changes");

assert.ok(eventStability.includes("buttons.slice(1).forEach"), "Duplicate event detail buttons must be removed");
assert.ok(eventStability.includes("data-event-details-booking"), "Booking navigation must be intercepted safely");
assert.ok(eventStability.includes("scrollIntoView"), "Booking action must scroll to the booking form");
assert.ok(eventStability.includes('event.key === "Escape"'), "Event details must close reliably with Escape");
assert.ok(eventStability.includes("booking-data-overlay"), "Event close must clear stale booking overlays");

console.log("BALI runtime routes, invitations, likes and event stability smoke test passed");
