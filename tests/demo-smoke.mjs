import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

class StorageMock {
  #values = new Map();
  getItem(key) { return this.#values.has(String(key)) ? this.#values.get(String(key)) : null; }
  setItem(key, value) { this.#values.set(String(key), String(value)); }
  removeItem(key) { this.#values.delete(String(key)); }
  clear() { this.#values.clear(); }
}

const localStorage = new StorageMock();
const sessionStorage = new StorageMock();
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
  encodeURIComponent,
  decodeURIComponent,
  localStorage,
  sessionStorage,
  crypto: webcrypto,
  CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
  dispatchEvent() {},
  addEventListener() {},
  location: { reload() {} }
};
context.window = context;
vm.createContext(context);

for (const file of ["site/demo-seed.js", "site/demo-live-sync.js"]) {
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}

const read = (key, fallback) => {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : fallback;
};

assert.ok(context.BaliDemo, "BaliDemo must be available");
assert.equal(context.BaliDemo.users.length, 6, "Demo must contain six users");
assert.equal(read("bali_events_v2", []).length, 4, "Demo must contain four events");
assert.equal(read("bali_menu_v2", []).length, 10, "Demo must contain ten menu items");
assert.equal(read("bali_tables_v2", []).length, 8, "Demo must contain eight tables");
assert.equal(read("bali_customers_v2", []).length, 6, "Demo must contain six customers");
assert.equal(read("bali_bookings_v2", []).length, 7, "Demo must contain seven bookings");
assert.equal(read("bali_night_crown_entries_v1", []).length, 6, "Demo must contain contest entries");
assert.equal(Object.keys(read("bali_points_accounts_v1", {})).length, 6, "Demo must contain six point accounts");

assert.equal(context.BaliDemo.activeUser().key, "bali-user-nikolay");
assert.equal(read("bali_bonus_profile_v1", {}).balance, 4200);

const accounts = read("bali_points_accounts_v1", {});
accounts["bali-user-nikolay"].balance = 9999;
localStorage.setItem("bali_points_accounts_v1", JSON.stringify(accounts));
context.BaliDemo.selectUser("bali-user-nikolay");
assert.equal(read("bali_bonus_profile_v1", {}).balance, 9999, "Admin balance change must survive user reload");
assert.equal(context.BaliDemo.activeUser().balance, 9999);

context.BaliDemo.selectUser("bali-user-anna");
assert.equal(context.BaliDemo.activeUser().key, "bali-user-anna");
assert.equal(read("bali_beta4_profile_v1", {}).name, "Анна Мороз");

context.BaliDemo.reset();
assert.equal(context.BaliDemo.activeUser().key, "bali-user-nikolay");
assert.equal(read("bali_bookings_v2", []).length, 7);
assert.equal(read("bali_bonus_profile_v1", {}).balance, 4200);

console.log("BALI full demo smoke test passed");
