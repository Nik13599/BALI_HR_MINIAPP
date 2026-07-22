import assert from "node:assert/strict";
import fs from "node:fs";

const core = fs.readFileSync("site/night-crown-core-beta4.js", "utf8");
const lock = fs.readFileSync("site/night-crown-vote-lock-beta4.js", "utf8");
const presence = fs.readFileSync("site/night-crown-presence-fix-beta4.js", "utf8");
const attendance = fs.readFileSync("site/event-qr-attendance-beta4.js", "utf8");
const qr = fs.readFileSync("site/beta4-qr-checkin.js", "utf8");
const loader = fs.readFileSync("site/beta4-square-loader.js", "utf8");

assert.ok(core.includes("candidate_gender"), "Votes must retain their King or Queen sector");
assert.ok(core.includes("event_end_time"), "The crown event must use the configured ending time");
assert.ok(core.includes("isActiveEvent"), "Crown access must expire when the event ends");

assert.ok(lock.includes("existing"), "A previous vote in the same sector must be detected");
assert.ok(lock.includes("изменить его нельзя"), "A submitted vote must be permanent");
assert.ok(lock.includes("button.disabled = true"), "All candidate buttons in the completed sector must be disabled");
assert.ok(lock.includes("Ваш голос зафиксирован"), "The UI must explain that the vote is final");
assert.ok(loader.includes("night-crown-vote-lock-beta4.js"), "The permanent vote lock must be loaded");

assert.ok(attendance.includes("async function leave"), "A user must be able to leave an event");
assert.ok(attendance.includes('presence_status: "left"'), "Leaving must mark the attendance as inactive");
assert.ok(attendance.includes("reactivate"), "The same QR may reactivate attendance without a second reward");
assert.ok(qr.includes("Уйти с мероприятия"), "The active event card must include a leave button");
assert.ok(qr.includes("!row.left_at"), "A left attendance must not be shown as active");
assert.ok(presence.includes('row.presence_status !== "left"'), "Crown access must stop after leaving");
assert.ok(qr.includes("setInterval(refreshHomeCard, 60000)"), "The active status must be rechecked while the app remains open");
assert.ok(loader.includes("bali-final-fixes-2"), "The published user loader must use the final build version");

console.log("Permanent crown voting and active event leave smoke test passed");
