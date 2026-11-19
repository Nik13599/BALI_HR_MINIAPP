import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const engineSource = fs.readFileSync("site/match3-infinite-engine-beta4.js", "utf8");
const gameSource = fs.readFileSync("site/match3-game-core-beta4.js", "utf8");
const storage = new Map();
const localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
};
let nextId = 0;

function loadGame() {
  const window = { dispatchEvent() {} };
  const context = vm.createContext({
    window,
    localStorage,
    crypto: { randomUUID: () => `test-id-${++nextId}` },
    CustomEvent: class CustomEvent { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
  });
  vm.runInContext(engineSource, context, { filename: "match3-infinite-engine-beta4.js" });
  vm.runInContext(gameSource, context, { filename: "match3-game-core-beta4.js" });
  return window.BaliMatch3;
}

const firstGame = loadGame();
const started = firstGame.startLevel();
assert.equal(started.ok, true);
assert.equal(started.resumed, undefined);
const attempt = started.attempt;
const initialId = attempt.id;
const initialBoard = JSON.stringify(attempt.board);
attempt.score = 5840;
attempt.progress.score = 5840;
attempt.progress.collected = { headphones: 12 };
attempt.movesRemaining -= 4;
attempt.continues = 1;
attempt.breakdown.combinations = 5840;
firstGame.updateAttempt(attempt);
const ratingBefore = firstGame.progress().seasonRating;

const reopened = loadGame();
const restored = reopened.startLevel();
assert.equal(restored.ok, true);
assert.equal(restored.resumed, true, "Opening the game should continue, not reset, a saved level");
assert.equal(restored.attempt.id, initialId, "A resumed attempt keeps its original identity");
assert.equal(restored.attempt.score, 5840, "Accumulated points must survive a reload");
assert.equal(restored.attempt.progress.score, 5840);
assert.equal(restored.attempt.movesRemaining, attempt.movesRemaining);
assert.equal(restored.attempt.continues, 1);
assert.equal(restored.attempt.breakdown.combinations, 5840);
assert.equal(restored.attempt.progress.collected.headphones, 12);
assert.equal(JSON.stringify(restored.attempt.board), initialBoard);
assert.equal(reopened.progress().seasonRating, ratingBefore, "Season rating must not change on reentry");

const zeroLives = reopened.progress();
zeroLives.lives = 0;
reopened.saveProgress(zeroLives);
assert.equal(loadGame().startLevel().attempt.id, initialId, "Resume must not consume or require another life");

const finished = reopened.progress();
finished.lives = 5;
finished.activeAttempt = null;
reopened.saveProgress(finished);
const newAttempt = loadGame().startLevel();
assert.equal(newAttempt.ok, true);
assert.notEqual(newAttempt.attempt.id, initialId, "A completed/cleared level may start fresh");
assert.equal(newAttempt.attempt.score, 0);

// The production API and adapter must use the persisted active game session.
const apiSource = fs.readFileSync("server/routes/game.ts", "utf8");
const adapterSource = fs.readFileSync("site/production-match3-infinite.js", "utf8");
const uiSource = fs.readFileSync("site/match3-game-ui-beta4.js", "utf8");
assert.match(apiSource, /resumed = true;\s*return active;/);
assert.match(apiSource, /res\.status\(resumed \? 200 : 201\)/);
assert.match(adapterSource, /resumed = Boolean\(response\.resumed \|\| response\.replayed\)/);
assert.match(uiSource, /started\.resumed/);
console.log("BALI Match pause/reopen/score persistence smoke test passed");
