import assert from "node:assert/strict";
import fs from "node:fs";

const loader = fs.readFileSync("site/beta4-square-loader.js", "utf8");
const page = fs.readFileSync("site/home-reference-page-beta4.js", "utf8");
const styles = fs.readFileSync("site/home-reference-page-beta4.css", "utf8");
const homeDesign = fs.readFileSync("site/home-design-core-beta4.js", "utf8");
const visualBlocks = fs.readFileSync("site/bali-visual-blocks-core-beta4.js", "utf8");

assert.ok(loader.includes("home-reference-page-beta4.css"), "The reference home stylesheet must load");
assert.ok(loader.includes("home-reference-page-beta4.js"), "The reference home controller must load");
assert.ok(page.includes('data-home-list="participants"'), "The participant count must open its list");
assert.ok(page.includes('data-home-list="friends"'), "The friends count must open its list");
assert.ok(page.includes('data-home-list="clans"'), "The clan count must open its list");
assert.ok(page.includes("BaliFastEventDialog"), "The featured event must reuse the existing event and booking flow");
assert.ok(page.includes("BaliHomeDesign?.read"), "The new home must preserve admin-controlled home content");
assert.ok(page.includes("BaliVisualBlocks?.applyAll"), "The new home must preserve configurable visual blocks");
assert.ok(page.includes("BaliClans"), "Clan counters must use the integrated clan data");
assert.ok(page.includes("BaliMatch3"), "The game rating must use the live Match 3 leaderboard");
assert.ok(styles.includes("@media(max-width:760px)"), "The reference home must adapt to tablets and phones");
assert.ok(styles.includes("overflow-x:auto"), "Mobile metric cards must stay usable without squeezing");
assert.ok(styles.includes("grid-template-columns:1fr"), "The featured event must collapse to one mobile column");
assert.ok(styles.includes("min-height:clamp(210px,60vw,420px)!important"), "The event poster must remain visible on mobile");
assert.ok(styles.includes(".inner.bali-home-reference-active>#clubLinks"), "Legacy home links must not duplicate the new social and contact blocks");
assert.ok(page.includes("assets/home-icons/"), "Reference cards must use the dedicated outline icon set");
assert.ok(page.includes("qr-code.svg"), "The check-in panel must show a real QR icon");
assert.ok(homeDesign.includes("ЕДИНОЕ ПРИЛОЖЕНИЕ БАЛИ"), "The reset state must match the selected visual target");
assert.ok(visualBlocks.includes('selector: ".bali-home-reference-hero"'), "Admin hero controls must target the new home");
assert.ok(visualBlocks.includes('selector: ".bali-home-reference-event"'), "Admin event controls must target the new home");

console.log("Reference home page, mobile adaptation and interactive lists smoke test passed");
