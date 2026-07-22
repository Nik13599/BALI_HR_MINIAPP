import assert from "node:assert/strict";
import fs from "node:fs";

const attendance = fs.readFileSync("site/event-qr-attendance-beta4.js", "utf8");
const qr = fs.readFileSync("site/beta4-qr-checkin.js", "utf8");
const live = fs.readFileSync("site/bali-people-live-event-beta4.js", "utf8");
const loader = fs.readFileSync("site/beta4-square-loader.js", "utf8");

assert.ok(attendance.includes("async function leave"), "A user must be able to leave an event");
assert.ok(attendance.includes('presence_status: "left"'), "Leaving must mark attendance inactive");
assert.ok(qr.includes("Уйти с мероприятия"), "The active event card must include a leave button");
assert.ok(live.includes("start.getTime()<=now&&now<end.getTime()"), "BALI People live tab must exist only while an event is active");
assert.ok(live.includes("attendance.listCheckins(event.id)"), "Live attendees must come from QR check-ins");
assert.ok(live.includes("Пришёл на:"), "Each attendee card must show the event title");
assert.ok(live.includes("button.hidden=!events.length"), "The live event tab must disappear outside event time");
assert.ok(live.includes("setInterval"), "Active event state must refresh while the app stays open");
assert.ok(loader.includes("bali-people-live-event-beta4.js"), "The live event people module must be loaded");
assert.ok(!loader.includes("night-crown"), "Removed contest modules must not be loaded");

console.log("Live event QR attendees and removed contest smoke test passed");