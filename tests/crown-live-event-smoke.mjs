import assert from "node:assert/strict";
import fs from "node:fs";

const core = fs.readFileSync("site/night-crown-core-beta4.js", "utf8");
const cloud = fs.readFileSync("site/night-crown-cloud-beta4.js", "utf8");
const qr = fs.readFileSync("site/beta4-qr-checkin.js", "utf8");
const loader = fs.readFileSync("site/beta4-square-loader.js", "utf8");

assert.ok(core.includes("candidate_gender"), "Votes must retain their King or Queen sector");
assert.ok(core.includes("sectorVotes"), "Local voting must inspect previous votes in the same sector");
assert.ok(core.includes("for(const vote of sectorVotes)"), "All previous local votes in the sector must be removed");
assert.ok(core.includes("latest=new Map"), "Legacy duplicate votes must be normalized to one vote per sector");
assert.ok(core.includes("event_end_time"), "The crown event must use the configured ending time");
assert.ok(core.includes("isActiveEvent"), "Crown access must expire when the event ends");

assert.ok(cloud.includes('.eq("candidate_gender",candidate.gender)'), "Cloud voting must query only the matching sector");
assert.ok(cloud.includes("candidateKeys"), "Cloud voting must remove all previous candidates in the same sector");
assert.ok(cloud.includes("targetWasActive"), "Voting for the selected candidate again must remove the vote");

assert.ok(qr.includes("ВЫ НА МЕРОПРИЯТИИ"), "The home card must show active attendance status");
assert.ok(qr.includes("event_end_time"), "The home card must use the event ending time");
assert.ok(qr.includes("active.end.getTime() - Date.now()"), "The active card must schedule automatic expiry");
assert.ok(qr.includes("scannerCardHtml"), "The QR scanning card must return after the event ends");
assert.ok(qr.includes("setInterval(refreshHomeCard, 60000)"), "The active status must be rechecked while the app remains open");
assert.ok(loader.includes("bali-live-event-vote-1"), "The published user loader must use the new build version");

console.log("Crown vote limits and active event status smoke test passed");
