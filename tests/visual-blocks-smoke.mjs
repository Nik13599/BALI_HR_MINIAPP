import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const memory = new Map();

globalThis.window = globalThis;
globalThis.localStorage = {
  getItem: (key) => memory.has(key) ? memory.get(key) : null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
};
globalThis.document = {
  querySelectorAll: () => [],
  addEventListener: () => {},
  documentElement: { dataset: {} },
};
globalThis.CustomEvent = class {
  constructor(type, init) {
    this.type = type;
    this.detail = init?.detail;
  }
};
globalThis.dispatchEvent = () => {};
globalThis.addEventListener = () => {};
globalThis.requestAnimationFrame = (callback) => callback();
globalThis.setInterval = () => 0;
globalThis.clearInterval = () => {};

require("../site/bali-visual-blocks-core-beta4.js");

const api = globalThis.BaliVisualBlocks;
assert.ok(api, "visual block API must initialize");
assert.equal(api.BLOCKS.length, 30, "all 30 major visual blocks must be registered");
assert.ok(api.BLOCKS.every((block) => block.width && block.height), "every block must declare exact image dimensions");
assert.ok(api.BLOCKS.every((block) => block.defaultTitle), "every block must declare an original title");

api.updateBlock("events.header", {
  title: "Новая афиша",
  image: "custom.webp",
  overlay: 35,
  position: "top",
});
assert.deepEqual(api.read()["events.header"], {
  title: "Новая афиша",
  image: "custom.webp",
  overlay: 35,
  position: "top",
});

api.resetBlock("events.header");
assert.equal(api.read()["events.header"].title, "", "per-block reset must restore the original title");
assert.equal(api.read()["events.header"].image, "", "per-block reset must restore the original image");

api.updateBlock("menu.header", { title: "Бар BALI" });
api.reset();
assert.equal(memory.has(api.KEY), false, "global reset must remove saved visual overrides");

console.log("Validated 30 configurable visual blocks, dimensions, persistence, and resets");
