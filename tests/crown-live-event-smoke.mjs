import assert from "node:assert/strict";
import fs from "node:fs";

const core = fs.readFileSync("site/match3-game-core-beta4.js", "utf8");
const ui = fs.readFileSync("site/match3-game-ui-beta4.js", "utf8");
const fullscreen = fs.readFileSync("site/telegram-fullscreen-beta4.js", "utf8");
const loader = fs.readFileSync("site/beta4-square-loader.js", "utf8");

assert.ok(loader.includes('const version = "bali-full-demo-8-stable31"'), "Published user build must use the latest cache version");
assert.ok(loader.includes("match3-game-core-beta4.js"), "Match 3 core must replace the retired crown contest");
assert.ok(loader.includes("match3-game-ui-beta4.js"), "Match 3 interface must load");
assert.ok(!loader.includes("night-crown-beta4.js"), "The retired King and Queen contest must not return");

assert.ok(core.includes("bali_match3_weekly_scores_v1"), "Weekly scores must be persisted");
assert.ok(core.includes("leaderboard(weekId).slice(0, 10)"), "Weekly rewards must be limited to the top 10");
assert.ok(core.includes("function finalizeWeek"), "The weekly competition must be finalized");
assert.ok(core.includes("points.adjustAccount"), "Weekly prizes must grant bonus points");
assert.ok(core.includes("activateVip"), "Configured weekly prizes must grant VIP status");
assert.ok(core.includes("function resetTiles"), "Default game items must be restorable");
assert.ok(core.includes("function resetRewards"), "Default rewards must be restorable");
assert.ok(ui.includes("Рейтинг недели"), "The mobile game UI must expose the weekly ranking");
assert.ok(ui.includes("Награды TOP 10"), "The game UI must show the top-10 reward table");

assert.ok(fullscreen.includes("tg.ready()"), "Telegram Mini App must signal readiness");
assert.ok(fullscreen.includes("tg.expand"), "Telegram Mini App must expand");
assert.ok(fullscreen.includes("tg.requestFullscreen"), "Supported Telegram clients must request fullscreen");

console.log("Match 3 weekly competition and Telegram fullscreen smoke test passed");
