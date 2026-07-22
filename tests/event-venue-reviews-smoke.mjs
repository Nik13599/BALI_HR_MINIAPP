import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("site/beta4-stable.html", "utf8");
const loader = fs.readFileSync("site/beta4-square-loader.js", "utf8");
const store = fs.readFileSync("site/store.js", "utf8");
const adminHtml = fs.readFileSync("site/admin-beta4.html", "utf8");
const adminWrapper = fs.readFileSync("site/admin-beta4-categories.html", "utf8");
const posters = fs.readFileSync("site/admin-posters.js", "utf8");
const details = fs.readFileSync("site/event-details-lineup-beta4.js", "utf8");
const venueUser = fs.readFileSync("site/venue-reviews-user-beta4.js", "utf8");
const venueAdmin = fs.readFileSync("site/admin-venue-reviews-beta4.js", "utf8");
const reviewBridge = fs.readFileSync("site/reviews-public-save-beta4.js", "utf8");
const demoSeed = fs.readFileSync("site/demo-event-content-seed-beta4.js", "utf8");
const migration = fs.readFileSync("site/supabase-event-content-reviews.sql", "utf8");

assert.ok(html.includes("bali-event-venue-reviews-1-final"), "Published HTML must use the final event content version");
assert.ok(loader.includes("reviews-public-save-beta4.js"), "Private public review submission bridge must load");
assert.ok(loader.includes("demo-event-content-seed-beta4.js"), "Demo event content must load");
assert.ok(loader.includes("event-details-lineup-beta4.js"), "Detailed event lineup must load");
assert.ok(loader.includes("venue-reviews-user-beta4.js"), "Venue details and feedback must load");
assert.ok(loader.indexOf("legacy-event-attendance-beta4.js") < loader.indexOf("event-details-lineup-beta4.js"), "Detailed event controls must load after legacy event controls");

assert.ok(store.includes('venue_content: "bali_venue_content_v1"'), "Shared store must persist venue content");
assert.ok(store.includes('reviews: "bali_reviews_v1"'), "Shared store must persist reviews");
assert.ok(store.includes("details_description"), "Seed events must support detailed descriptions");
assert.ok(store.includes("performers"), "Seed events must support performers");

assert.ok(posters.includes("Участники и артисты"), "Event editor must contain an inline lineup section");
assert.ok(posters.includes("data-add-event-artist"), "Event editor must add unlimited participants");
assert.ok(posters.includes("data-remove-event-artist"), "Event editor must remove participants");
assert.ok(posters.includes("data-event-artist-role"), "Each participant must have a role");
assert.ok(posters.includes("data-event-artist-name"), "Each participant must have a name");
assert.ok(posters.includes("data-event-artist-photo"), "Each participant must accept a photo upload");
assert.ok(posters.includes("data-event-artist-link"), "Each participant must accept an Instagram or Telegram URL");
assert.ok(posters.includes("payload.performers = await collectPerformers()"), "All participants must save into the event");
assert.ok(posters.includes("details_description"), "The event editor must save a detailed description");
assert.ok(!adminHtml.includes('data-view="artists"'), "Artists must not become a separate admin section");

assert.ok(details.includes("Подробнее о событии"), "The event screen must open detailed information");
assert.ok(details.includes("Кто будет выступать"), "Detailed event information must show the lineup");
assert.ok(details.includes("data-performer-link"), "Artist cards must open their social pages");
assert.ok(details.includes("Вернуться назад"), "Detailed event screen must have a back button");
assert.ok(details.includes("Перейти к бронированию"), "Detailed event screen must jump to booking");
assert.ok((details.match(/Я хочу пойти/g) || []).length >= 3, "The want-to-go action must appear and synchronize in both event screens");
assert.ok(details.includes('document.getElementById("eventInterested")?.click()'), "Detailed event RSVP must reuse the existing event response");
assert.ok(details.includes('document.getElementById("bookingForm")?.scrollIntoView'), "Booking action must scroll to the booking block");

assert.ok(venueUser.includes("Узнать подробнее о площадке"), "The home page must expose venue details");
assert.ok(venueUser.includes("Оставить отзыв"), "The home page must expose feedback");
assert.ok(venueUser.includes("venue-gallery"), "Venue details must display a media gallery");
assert.ok(venueUser.includes("<video"), "Venue details must support playable video");
assert.ok(venueUser.includes("Для каких мероприятий подходит BALI"), "Venue details must explain suitable event formats");
assert.ok(venueUser.includes("Идея или нежелательная тематика вечеринки"), "Feedback must cover desired and undesired party concepts");
assert.ok(venueUser.includes("Артист, DJ, MC или шоу-программа"), "Feedback must cover artist and show preferences");
assert.ok(venueUser.includes('store.save("reviews"'), "Feedback must save into the shared reviews table");

assert.ok(adminHtml.includes("admin-venue-reviews-beta4.js"), "Admin must load venue and reviews tools");
assert.ok(adminHtml.includes("admin-posters.js?v=beta4-admin-content-1"), "Admin must bust the poster editor cache");
assert.ok(adminWrapper.includes("beta4-admin-content-1"), "Admin wrapper must open the content build");
assert.ok(venueAdmin.includes('button.dataset.view = "reviews"'), "Admin must add a dedicated reviews tab");
assert.ok(venueAdmin.includes("Страница площадки BALI"), "Admin settings must edit the venue page");
assert.ok(venueAdmin.includes("data-add-venue-media"), "Admin must add multiple venue photos and videos");
assert.ok(venueAdmin.includes('store.save("venue_content"'), "Venue content must save to the shared store");
assert.ok(venueAdmin.includes('store.list("reviews"'), "Reviews tab must read guest feedback");
assert.ok(venueAdmin.includes("Принято в работу"), "Admin must control review processing status");
assert.ok(venueAdmin.includes("12 * 1024 * 1024"), "Uploaded venue videos must have a safe browser limit");

assert.ok(reviewBridge.includes('.from("reviews").insert(payload)'), "Anonymous review submission must insert without reading the private table");
assert.ok(!reviewBridge.includes('.select()'), "Anonymous review submission must not request private review data");
assert.ok(demoSeed.includes("DJ ANI"), "Demo events must show an example DJ");
assert.ok(demoSeed.includes("Шоу-балет"), "Demo events must show an example show ballet");
assert.ok(demoSeed.includes("bali_venue_content_v1"), "Demo must seed venue media");
assert.ok(demoSeed.includes("bali_reviews_v1"), "Demo must seed reviews");

assert.ok(migration.includes("performers jsonb"), "Supabase events must store a performer array");
assert.ok(migration.includes("details_description"), "Supabase events must store detailed descriptions");
assert.ok(migration.includes("create table if not exists public.venue_content"), "Supabase must store venue content");
assert.ok(migration.includes("create table if not exists public.reviews"), "Supabase must store reviews");
assert.ok(migration.includes('create policy "public submit reviews"'), "Guests must be able to submit reviews");
assert.ok(migration.includes('create policy "staff manage reviews"'), "Only staff must manage reviews");

console.log("BALI event lineup, venue media and reviews smoke test passed");