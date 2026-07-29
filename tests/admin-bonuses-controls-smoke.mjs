import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

class StorageMock {
  #values = new Map();
  getItem(key) { return this.#values.has(String(key)) ? this.#values.get(String(key)) : null; }
  setItem(key, value) { this.#values.set(String(key), String(value)); }
  removeItem(key) { this.#values.delete(String(key)); }
}

const localStorage = new StorageMock();
const listeners = new Map();
const context = {
  console,
  Date,
  JSON,
  Math,
  Number,
  String,
  Boolean,
  Object,
  Array,
  Map,
  Set,
  localStorage,
  crypto:webcrypto,
  CustomEvent:class CustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
  },
  dispatchEvent(event) {
    (listeners.get(event.type) || []).forEach(listener => listener(event));
  },
  addEventListener(type, listener) {
    const rows = listeners.get(type) || [];
    rows.push(listener);
    listeners.set(type, rows);
  }
};
context.window = context;
context.BaliBeta4Game = {
  profile:() => ({
    id:"qa-user",
    userKey:"qa-user",
    code:"QA",
    name:"QA Пользователь",
    username:"qa",
    avatar:""
  })
};

vm.createContext(context);
vm.runInContext(
  fs.readFileSync("site/beta4-social-core.js", "utf8"),
  context,
  { filename:"site/beta4-social-core.js" }
);

const social = context.BaliBeta4Social;
assert.ok(social, "social and gift core must initialize");
assert.equal(social.GIFT_CATALOG.length, 4, "four original gifts must be available");
assert.deepEqual(
  Array.from(social.GIFT_CATALOG, gift => gift.stars),
  [25, 50, 100, 250],
  "original gift prices must use BALI points"
);

social.saveGiftCatalog([
  { id:"rose", icon:"🌺", name:"Цветок", stars:31, active:true },
  { id:"hidden", icon:"🎁", name:"Скрытый подарок", stars:60, active:false }
]);
assert.equal(social.GIFT_CATALOG[0].name, "Цветок", "catalog edits must be applied immediately");
assert.equal(social.GIFT_CATALOG[0].stars, 31, "configured price must persist");
assert.equal(
  JSON.parse(localStorage.getItem(social.KEYS.giftCatalog))[1].active,
  false,
  "gift availability must persist"
);

const issued = social.adminGift("qa-user", "rose", "QA");
assert.equal(issued.ok, true, "admin must be able to issue a gift");
assert.equal(issued.item.pointsCost, 0, "admin-issued gifts must be free for the recipient");
assert.equal(social.gifts().length, 1, "issued gift must appear in history");
assert.equal(social.removeGift(issued.item.id).ok, true, "admin must be able to remove a history entry");
assert.equal(social.gifts().length, 0);

social.saveGiftCatalog(social.DEFAULT_GIFT_CATALOG);
assert.equal(social.GIFT_CATALOG.length, 4, "original catalog must be restorable");
assert.equal(social.GIFT_CATALOG[0].name, "Роза");

const hubSource = fs.readFileSync("site/admin-bonuses-hub-beta4.js", "utf8");
assert.ok(
  hubSource.includes('document.querySelectorAll(".bonus-section-dialog").forEach(dialog => dialog.remove())')
    && hubSource.includes('delete root.dataset.bonusHubReady'),
  "every admin render must replace stale dialogs instead of duplicating controls"
);
assert.ok(hubSource.includes('id: "gifts"'), "bonus hub must expose gift management");

const structureSource = fs.readFileSync("site/admin-bonuses-structure-v11.js", "utf8");
assert.ok(
  structureSource.includes('"vip-gift"') && structureSource.includes('"gifts"'),
  "VIP gifts and user gifts must remain visible in the bonus hub"
);

const runtimeSource = fs.readFileSync("site/admin-mobile-runtime.js", "utf8");
assert.ok(
  runtimeSource.includes('"beta4-social-core.js"') && runtimeSource.includes('"admin-gifts-beta4.js"'),
  "admin router must load gift data and gift controls"
);

const economySource = fs.readFileSync("site/full-demo-social-economy-beta4.js", "utf8");
assert.ok(
  economySource.includes("gift?.stars || gift?.points"),
  "gift purchases must use the price configured in the admin panel"
);
const socialPageSource = fs.readFileSync("site/beta4-social-page.js", "utf8");
assert.ok(
  socialPageSource.includes("function renderGiftCatalog()")
    && socialPageSource.includes("root.dataset.catalogSignature"),
  "the user gift dialog must refresh without showing stale catalog data"
);

console.log("Admin bonus controls smoke test passed: catalog, grant, reset, visibility, and price wiring");
