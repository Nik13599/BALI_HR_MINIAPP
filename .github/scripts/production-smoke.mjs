import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function installBrowserPolyfills(window) {
  window.requestAnimationFrame ||= callback => window.setTimeout(() => callback(Date.now()), 0);
  window.cancelAnimationFrame ||= id => window.clearTimeout(id);
  window.confirm = () => true;
  window.alert = () => {};
  window.HTMLElement.prototype.scrollTo ||= () => {};
  window.HTMLElement.prototype.scrollIntoView ||= () => {};
  if (window.HTMLDialogElement) {
    window.HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute("open", "");
    };
    window.HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute("open");
      this.dispatchEvent(new window.Event("close"));
    };
  }
}

async function testUserRuntime() {
  const dom = new JSDOM("<!doctype html><html><body><div id=\"app\"></div><div id=\"toast\"></div></body></html>", {
    url:"https://example.test/site/?v=bali-production-29",
    runScripts:"outside-only",
    pretendToBeVisual:true
  });
  const { window } = dom;
  installBrowserPolyfills(window);

  const profile = {
    id:"tg:100",
    telegramId:100,
    name:"Николай",
    username:"@nik",
    phone:"+375291111111",
    avatar:"",
    xp:120,
    visits:2,
    bookings:1,
    streak:1,
    publicRanking:true
  };
  const achievements = [
    { id:"first_open", icon:"✨", title:"Добро пожаловать", description:"Открыть BALI", xp:50, earnedAt:new Date().toISOString() },
    { id:"first_visit", icon:"🎟", title:"Первая ночь", description:"Посетить BALI", xp:250, earnedAt:null }
  ];
  const accounts = {
    "tg:100": { userKey:"tg:100", name:"Николай", balance:150, xp:120, visits:2 },
    "tg:200": { userKey:"tg:200", name:"Анна", balance:80, xp:80, visits:1 }
  };

  window.Telegram = {
    WebApp:{
      ready() {}, expand() {}, setHeaderColor() {}, setBackgroundColor() {},
      HapticFeedback:{ selectionChanged() {} },
      initDataUnsafe:{ user:{ id:100, first_name:"Николай", username:"nik" } },
      openTelegramLink() {}, openLink() {}
    }
  };
  window.BALI_CONFIG = {
    telegramUsername:"BaliMinskAppBot",
    miniAppUrl:"https://example.test/site/",
    venuePhone:"+375296700300",
    venueAddress:"Минск, ул. Кирова, 13"
  };
  window.BaliStore = {
    async list(table) {
      if (table === "events") return [{ id:"event-1", title:"BALI PARTY", event_date:"2026-07-25", event_time:"23:00", active:true, description:"Тестовое событие" }];
      if (table === "menu_items") return [{ id:"menu-1", category:"Бар", name:"Коктейль", description:"Тест", price:20, active:true, sort_order:1 }];
      return [];
    },
    async getAvailability() { return []; },
    async createBooking(data) { return { id:"booking-1", ...data }; },
    async save(_table, row) { return row; }
  };
  window.BaliPoints = {
    keys:{ profile:"points-profile" },
    profile:() => ({ userKey:"tg:100", telegramId:100, name:"Николай", balance:150 }),
    accounts:() => accounts,
    ledger:() => [],
    settings:() => ({ attendance:100 }),
    add() {}, write() {}, linkIdentity() {}
  };
  window.BaliBeta4Game = {
    profile:() => ({ ...profile }),
    saveProfile(patch) { Object.assign(profile, patch); return { ...profile }; },
    identityKeys:subject => [subject.id || "tg:100", subject.telegramId ? `tg:${subject.telegramId}` : ""].filter(Boolean),
    levelFor:xp => ({ current:{ name:xp >= 100 ? "Party Starter" : "New Guest" }, next:{ minXp:500 }, progress:24 }),
    vip:() => null,
    achievements:() => achievements,
    config:() => ({ plans:[{ id:"vip", name:"BALI VIP", stars:299, discount:10, freeEntry:false, pointsMultiplier:1.25, earlyBookingHours:24, active:true }] }),
    ranking:rows => rows.map((row, index) => ({ id:row.userKey, name:row.name, username:"", xp:Number(row.xp || row.balance || 0), visits:Number(row.visits || 0), position:index + 1 })),
    eventPrivilege:() => null,
    recordShare() {}, recordBooking() {}, activateVip() {}
  };
  window.BaliBeta4Loyalty = {
    evaluateRewards() {}, rewards:() => [], earnedRewardIds:() => new Set(), chipBalance:() => 0
  };
  window.BaliBeta4Social = {
    STATUSES:[["chat", "Открыт(а) к общению"]],
    profile:() => ({ id:"tg:100", active:true, status:"chat", bio:"" }),
    saveProfile() {}, incomingGifts:() => []
  };
  window.BaliEventQrAttendance = { async listCheckins() { return []; } };

  window.eval(read("site/bali-error-boundary-production.js"));
  window.eval(read("site/bali-app-stable-production.js"));
  await wait(50);

  assert.equal(window.document.querySelectorAll("#rankingPodium").length, 1, "ranking podium must be unique");
  assert.equal(window.document.querySelectorAll("#profileV2Quick").length, 1, "profile quick block must be unique");
  assert.deepEqual(
    [...window.document.querySelectorAll(".nav > button")].map(button => button.dataset.page),
    ["home", "events", "menu", "dating", "profile"],
    "navigation order must be stable"
  );
  assert.equal(window.document.querySelector("#homeEventsCard h3")?.textContent, "Ближайшие события");
  assert.equal(window.document.querySelector("#homeAboutCard h3")?.textContent, "О клубе");
  assert.deepEqual(
    [...window.document.querySelector("#homeInner").children].map(node => node.id),
    ["homeHero", "homeActions", "homeEventsCard", "homeAboutCard", "baliReferralCard", "clubLinks"],
    "home blocks must keep canonical order"
  );

  window.eval(read("site/bali-profile-runtime-production.js"));
  window.dispatchEvent(new window.CustomEvent("bali:app-mounted"));
  await wait(30);
  window.BaliCompactProfile.mount();

  const profileTiles = [...window.document.querySelectorAll("#profileV2Quick > button")];
  assert.equal(profileTiles.length, 3, "profile must contain exactly three stable tiles");
  assert.deepEqual(profileTiles.map(tile => tile.querySelector("strong")?.textContent), ["BALI Shop", "Мои награды", "Мои подарки"]);

  for (let index = 0; index < 5; index += 1) {
    window.BaliAppStable.renderAll();
    window.BaliCompactProfile.mount();
  }
  assert.equal(window.document.querySelectorAll("#rankingPodium").length, 1);
  assert.equal(window.document.querySelectorAll("#profileV2Quick").length, 1);
  assert.equal(window.document.querySelectorAll("#clubLinks").length, 1);
  assert.equal(window.BaliErrorBoundary.list().length, 0, "user runtime should mount without captured errors");

  dom.window.close();
}

async function testAdminRuntime() {
  const html = read("site/admin-production.html");
  const dom = new JSDOM(html, {
    url:"https://example.test/site/admin-production.html?v=production-21",
    runScripts:"outside-only",
    pretendToBeVisual:true
  });
  const { window } = dom;
  installBrowserPolyfills(window);

  const customerRows = [
    { id:"a", name:"Анна", phone:"+375291111111", telegram:"@anna", visits:1, total_spent:0, updated_at:"2026-07-24T10:00:00Z" },
    { id:"b", name:"Анна копия", phone:"+375 29 111-11-11", telegram:"@anna", visits:2, total_spent:0, updated_at:"2026-07-24T11:00:00Z" },
    { id:"c", name:"Иван", phone:"+375292222222", telegram:"@ivan", visits:1, total_spent:0, updated_at:"2026-07-24T12:00:00Z" }
  ];
  const tables = {
    customers:customerRows,
    app_users:[{ id:"u1", user_key:"tg:100", name:"Николай" }, { id:"u2", user_key:"tg:200", name:"Анна" }],
    loyalty_rules:[], loyalty_rewards:[], loyalty_gifts:[], reward_grants:[], gift_grants:[],
    reviews:[], app_settings:[{ id:"main" }], events:[], menu_items:[], hall_tables:[], bookings:[], venue_content:[], event_checkins:[]
  };

  window.BALI_CONFIG = { supabaseUrl:"", supabaseAnonKey:"", telegramUsername:"BaliMinskAppBot" };
  window.BaliStore = {
    cloudEnabled:false,
    client:null,
    async list(table) { return [...(tables[table] || [])]; },
    async save(table, row) {
      tables[table] ||= [];
      const saved = { id:row.id || `${table}-1`, ...row };
      const index = tables[table].findIndex(item => String(item.id) === String(saved.id));
      if (index >= 0) tables[table][index] = saved; else tables[table].unshift(saved);
      return saved;
    },
    async remove(table, id) { tables[table] = (tables[table] || []).filter(item => String(item.id) !== String(id)); },
    async getAvailability() { return []; },
    async createBooking(row) { return { id:"booking-1", ...row }; },
    async signIn() { return { user:{ id:"admin" } }; },
    async signOut() {}, async getSession() { return null; }, resetDemo() {}
  };
  window.BaliPoints = {
    settings:() => ({ review:100 }),
    read:() => ({}),
    write() {},
    keys:{ settings:"settings" }
  };
  window.BaliEventQrAttendance = {
    async listCheckins() { return []; },
    async checkIn() { return { ok:true }; }
  };

  window.eval(read("site/admin-error-boundary-production.js"));
  const scripts = [
    "site/admin.js",
    "site/admin-venue-reviews-beta4.js",
    "site/admin-production-complete-runtime.js",
    "site/admin-loyalty-issuance-production.js",
    "site/admin-stable-orchestrator-production.js"
  ].map(read).join("\n\n");
  window.eval(scripts);

  window.document.getElementById("demoLogin").click();
  await wait(50);

  assert.deepEqual(
    [...window.document.querySelectorAll("#adminNav > button")].map(button => button.dataset.view),
    ["dashboard", "messages", "bookings", "events", "customers", "bonuses", "menu", "hall", "reviews", "settings"],
    "admin navigation order must be stable"
  );
  assert.equal(window.document.querySelector("#content .stats .stat-card:nth-child(2) strong")?.textContent, "2", "dashboard must count unique customer cards");

  window.document.querySelector('#adminNav [data-view="bonuses"]').click();
  await wait(50);
  assert.match(window.document.getElementById("content").textContent, /Управление программой лояльности/);

  window.document.querySelector('#adminNav [data-view="reviews"]').click();
  await wait(50);
  assert.match(window.document.getElementById("content").textContent, /Отзывы и предложения гостей/);

  window.document.querySelector('#adminNav [data-view="settings"]').click();
  await wait(50);
  assert.match(window.document.getElementById("content").textContent, /Состояние базы данных/);
  assert.equal(window.BaliAdminErrorBoundary.list().length, 0, "admin runtime should mount without captured errors");

  dom.window.close();
}

await testUserRuntime();
await testAdminRuntime();
console.log("Production DOM smoke tests passed");
