import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

class ClassListMock {
  constructor(values = []) { this.values = new Set(values); }
  toggle(name, force) {
    if (force === undefined) force = !this.values.has(name);
    if (force) this.values.add(name); else this.values.delete(name);
    return force;
  }
  contains(name) { return this.values.has(name); }
}

class StyleMock {
  setProperty(name, value) { this[name] = value; }
}

class ElementMock {
  constructor({ page = "", screen = "", classes = [] } = {}) {
    this.dataset = {};
    if (page) this.dataset.page = page;
    if (screen) this.dataset.screen = screen;
    this.classList = new ClassListMock(classes);
    this.style = new StyleMock();
    this.attributes = {};
    this.disabled = false;
    this.type = "";
    this.scrollTop = 50;
    this.parent = null;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  scrollTo() { this.scrollTop = 0; }
  closest(selector) { return selector === "button[data-page]" && this.dataset.page ? this : null; }
  contains(node) { return node === this || node?.parent === this; }
  addEventListener() {}
  querySelectorAll(selector) { return selector === "button[data-page]" ? buttons : []; }
}

const pages = ["home", "events", "menu", "dating", "crown", "profile"].map((screen, index) =>
  new ElementMock({ screen, classes: index === 0 ? ["page", "active"] : ["page"] })
);
const buttons = pages.map((page, index) => new ElementMock({ page: page.dataset.screen, classes: index === 0 ? ["active"] : [] }));
const nav = new ElementMock({ classes: ["nav"] });
buttons.forEach(button => { button.parent = nav; });

const document = {
  head: { appendChild() {} },
  body: {},
  createElement() { return new ElementMock(); },
  querySelectorAll(selector) {
    if (selector === ".page[data-screen]") return pages;
    if (selector === ".nav button[data-page]") return buttons;
    if (selector === "nav.nav") return [nav];
    return [];
  }
};

const context = {
  console,
  document,
  Element: ElementMock,
  MutationObserver: class { observe() {} },
  CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
  requestAnimationFrame(callback) { callback(); },
  setTimeout(callback) { callback(); },
  Date,
  Set,
  WeakSet,
  String,
  window: null
};
context.window = context;
context.dispatchEvent = () => {};
vm.createContext(context);
vm.runInContext(fs.readFileSync("site/bottom-nav-controller-beta4.js", "utf8"), context, { filename: "site/bottom-nav-controller-beta4.js" });

assert.ok(context.BaliBottomNavigation, "Navigation controller must be available");
assert.equal(context.BaliBottomNavigation.activate("events"), true);
assert.equal(pages.find(page => page.dataset.screen === "events").classList.contains("active"), true);
assert.equal(pages.find(page => page.dataset.screen === "home").classList.contains("active"), false);
assert.equal(buttons.find(button => button.dataset.page === "events").classList.contains("active"), true);
assert.equal(buttons.find(button => button.dataset.page === "home").classList.contains("active"), false);
assert.equal(context.BaliBottomNavigation.activate("missing"), false);

console.log("BALI bottom navigation smoke test passed");
