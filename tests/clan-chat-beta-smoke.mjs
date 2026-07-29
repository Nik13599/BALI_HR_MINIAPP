import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const memory = new Map();
const localStorage = {
  getItem:key => memory.has(key) ? memory.get(key) : null,
  setItem:(key, value) => memory.set(key, String(value)),
  removeItem:key => memory.delete(key)
};
const context = {
  console,
  URL,
  Date,
  Math,
  JSON,
  Promise,
  CustomEvent:class {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  },
  localStorage,
  BALI_DEMO_ONLY:true,
  BaliDemo:{
    activeUser:() => ({ name:"Николай", username:"@nikolay_bali", telegramId:910001 })
  },
  location:{ origin:"https://beta.bali.test" },
  dispatchEvent:() => true
};
context.window = context;
vm.createContext(context);

const source = await readFile("site/bali-clans-demo-core-beta4.js", "utf8");
vm.runInContext(source, context, { filename:"site/bali-clans-demo-core-beta4.js" });

const api = context.BaliClans.api;
assert.equal(typeof api, "function");
assert.equal(typeof context.BaliClans.reset, "function");
assert.equal(context.BaliClans.currentUser().name, "Николай");

const clans = await api("/api/v1/clans");
assert.equal(clans.clans.length, 2);
assert.equal(clans.clans[0].role, "leader");

const initial = await api("/api/v1/clans/clan-night/chat");
assert.ok(initial.permissions.includes("poll.create"));
assert.equal(initial.messages.length, 4);
assert.equal(initial.polls.length, 1);
assert.equal(initial.events.length, 1);

await api("/api/v1/clans/clan-night/messages", {
  method:"POST",
  body:JSON.stringify({ body:"Beta smoke message" })
});
const withMessage = await api("/api/v1/clans/clan-night/chat");
assert.equal(withMessage.messages.at(-1).body, "Beta smoke message");

await api("/api/v1/clans/clan-night/polls", {
  method:"POST",
  body:JSON.stringify({ question:"Beta poll?", options:["Да", "Нет"], allowMultiple:false })
});
const withPoll = await api("/api/v1/clans/clan-night/chat");
assert.equal(withPoll.polls.length, 2);

const adminSession = await api("/api/v1/auth/admin/session");
assert.equal(adminSession.admin.email, "beta@bali.test");
const adminChats = await api("/api/v1/admin/chats?search=night");
assert.equal(adminChats.chats.length, 1);

await api("/api/v1/admin/clans/clan-night/chat", {
  method:"PATCH",
  body:JSON.stringify({
    enabled:true,
    readOnly:true,
    ownDeleteWindowSeconds:120,
    reason:"Smoke test"
  })
});
const updatedDetail = await api("/api/v1/admin/clans/clan-night/chat");
assert.equal(updatedDetail.chat.read_only, true);
assert.equal(updatedDetail.chat.own_delete_window_seconds, 120);

const audit = await api("/api/v1/admin/audit?limit=500");
assert.equal(audit.audit[0].action, "chat.settings.update");

context.BaliClans.reset();
const resetBundle = await api("/api/v1/clans/clan-night/chat");
assert.equal(resetBundle.messages.length, 4);
assert.equal(resetBundle.chat.readOnly, false);

const [loader, userModule, adminHtml, adminModule, adminRuntime] = await Promise.all([
  readFile("site/beta4-square-loader.js", "utf8"),
  readFile("site/bali-people-clans-beta4.js", "utf8"),
  readFile("site/admin-beta4.html", "utf8"),
  readFile("site/admin-clans-beta4.js", "utf8"),
  readFile("site/admin-mobile-runtime.js", "utf8")
]);
assert.match(loader, /bali-clans-demo-core-beta4\.js/);
assert.match(loader, /bali-people-clans-beta4\.js/);
assert.match(userModule, /data-people-mode="clan"/);
assert.match(userModule, /baliPeopleClanPane/);
assert.match(adminHtml, /data-view="clans"/);
assert.match(adminHtml, /admin-clans-beta4\.js/);
assert.match(adminModule, /BaliAdminViews\.clans/);
assert.match(adminRuntime, /view!=="clans"/);

console.log("BALI People integrated clans user/admin smoke test passed");
