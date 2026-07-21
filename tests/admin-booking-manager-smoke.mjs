import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("site/admin-beta4.html", "utf8");
const manager = fs.readFileSync("site/admin-booking-manager-beta4.js", "utf8");

assert.ok(html.includes("admin-booking-manager-beta4.js"), "Admin must load the booking manager module");
assert.ok(html.includes("app-users-core-beta4.js"), "Admin must load application user profiles");
assert.ok(html.includes("event-qr-attendance-beta4.js"), "Admin must load attendance data for manual confirmation");

assert.ok(manager.includes("Ближайшие бронирования"), "The dashboard booking panel must be enhanced");
assert.ok(manager.includes("manager-party-head"), "Bookings must be divided by party headers");
assert.ok(manager.includes("event_end_date"), "Events must support an end date");
assert.ok(manager.includes("event_end_time"), "Events must support an end time");
assert.ok(manager.includes("arrival_to"), "Bookings must support an expected arrival interval");
assert.ok(manager.includes("Ручное подтверждение прихода"), "Manual check-in must be available without QR");
assert.ok(manager.includes('source: "admin_manual"'), "Manual attendance must record its source");
assert.ok(manager.includes("points.adjustAccount"), "Manual check-in must award attendance points");
assert.ok(manager.includes("managerGuestDialog"), "Managers must be able to open a guest contact profile");
assert.ok(manager.includes("Подтвердить бронь"), "Managers must be able to confirm a booking");
assert.ok(manager.includes("Отменить бронь"), "Managers must be able to cancel a booking");

console.log("BALI admin grouped booking manager smoke test passed");
