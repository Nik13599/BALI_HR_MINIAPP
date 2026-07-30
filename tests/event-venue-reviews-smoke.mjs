import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("site/index.html", "utf8");
const loader = fs.readFileSync("site/beta4-square-loader.js", "utf8");
const store = fs.readFileSync("site/store.js", "utf8");
const adminHtml = fs.readFileSync("site/admin-beta4.html", "utf8");
const posters = fs.readFileSync("site/admin-posters.js", "utf8");
const venueUser = fs.readFileSync("site/venue-reviews-user-beta4.js", "utf8");
const venueAdmin = fs.readFileSync("site/admin-venue-reviews-beta4.js", "utf8");
const demoSeed = fs.readFileSync("site/demo-event-content-seed-beta4.js", "utf8");
const migration = fs.readFileSync("site/supabase-event-content-reviews.sql", "utf8");

assert.ok(html.includes("bali-full-demo-8-stable30"), "Published page must use the latest build");
assert.ok(loader.includes("demo-event-content-seed-beta4.js"), "Demo event content must load");
assert.ok(loader.includes("event-performer-cards-beta4.js"), "Event performer cards must load");
assert.ok(loader.includes("venue-reviews-user-beta4.js"), "Venue details and feedback must load");
assert.ok(store.includes('venue_content: "bali_venue_content_v1"'), "Venue content must be persisted");
assert.ok(store.includes('reviews: "bali_reviews_v1"'), "Guest reviews must be persisted");
assert.ok(store.includes("performers"), "Events must support performers");

assert.ok(posters.includes("data-add-event-artist"), "Event editor must add performers");
assert.ok(posters.includes("data-remove-event-artist"), "Event editor must remove performers");
assert.ok(posters.includes("payload.performers = await collectPerformers()"), "Event performers must be saved");
assert.ok(!adminHtml.includes('data-view="artists"'), "Performers must stay inside event editing");

assert.ok(venueUser.includes("data-open-venue-details"), "Users must be able to open venue details");
assert.ok(venueUser.includes("data-open-venue-review"), "Users must be able to leave feedback");
assert.ok(venueUser.includes("venue-gallery"), "Venue details must support a media gallery");
assert.ok(venueUser.includes("<video"), "Venue details must support video");
assert.ok(venueUser.includes('store.save("reviews"'), "Feedback must save to the shared store");

assert.ok(adminHtml.includes("admin-venue-reviews-beta4.js"), "Admin must load venue and review controls");
assert.ok(venueAdmin.includes('store.save("venue_content"'), "Admin must save venue content");
assert.ok(venueAdmin.includes('store.list("reviews"'), "Admin must read guest feedback");
assert.ok(venueAdmin.includes("12 * 1024 * 1024"), "Browser video uploads must have a safe size limit");
assert.ok(demoSeed.includes("bali_venue_content_v1"), "Demo mode must seed venue content");
assert.ok(demoSeed.includes("bali_reviews_v1"), "Demo mode must seed guest reviews");

assert.ok(migration.includes("performers jsonb"), "Supabase events must store performer arrays");
assert.ok(migration.includes("create table if not exists public.venue_content"), "Supabase must store venue content");
assert.ok(migration.includes("create table if not exists public.reviews"), "Supabase must store reviews");

console.log("Latest BALI event, venue media and review smoke test passed");
