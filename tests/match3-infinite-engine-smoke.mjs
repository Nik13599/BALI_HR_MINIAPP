import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("site/match3-infinite-engine-beta4.js", "utf8");
const context = vm.createContext({ window: {} });
vm.runInContext(source, context);
const engine = context.window.BaliMatch3InfiniteEngine;

assert.ok(engine, "The infinite Match-3 engine must be exposed");
assert.equal(engine.difficulty(1), 1, "The first level must use base difficulty");
const level100 = engine.difficulty(100);
const expected100 = 1 + 0.06 * Math.sqrt(99) + 0.004 * 99;
assert.ok(Math.abs(level100 - expected100) < 0.000001, "Difficulty must follow the configured square-root and linear formula");

const level = engine.generateLevel(10_000, {}, "test-season");
assert.equal(level.rows, 6);
assert.equal(level.columns, 6);
assert.ok(level.moves >= 12);
assert.ok(level.goals.length >= 1 && level.goals.length <= 4);
assert.ok(Number.isFinite(level.targetScore) && level.targetScore > 0, "Very high levels must remain finite");

const tileIds = ["a", "b", "c", "d", "e", "f", "g", "h"];
const board = engine.createBoard(level, tileIds);
assert.equal(board.length, level.rows * level.columns);
assert.equal(engine.findMatchGroups(board, level.rows, level.columns).length, 0, "A generated board must start without automatic matches");
const hint = engine.findHint(board, level.rows, level.columns);
assert.ok(Array.isArray(hint) && hint.length === 2, "A generated board must have at least one valid move");
const move = engine.playMove(board, hint[0], hint[1], level, tileIds);
assert.equal(move.valid, true);
assert.ok(move.score > 0);
assert.equal(move.board.length, board.length);

assert.equal(engine.starsFor(999, 1000, false), 0);
assert.equal(engine.starsFor(1000, 1000, true), 1);
assert.equal(engine.starsFor(1200, 1000, true), 2);
assert.equal(engine.starsFor(1500, 1000, true), 3);
assert.equal(engine.seasonalRating(1, 1, 0), 1000);
assert.equal(engine.seasonalRating(1, 3, 2), Math.round(1000 * 1.35 * 0.65));

const core = fs.readFileSync("site/match3-game-core-beta4.js", "utf8");
const admin = fs.readFileSync("site/admin-match3-game-beta4.js", "utf8");
const route = fs.readFileSync("server/routes/game.ts", "utf8");
const migration = fs.readFileSync("migrations/017_infinite_match3_levels.up.sql", "utf8");
assert.match(core, /ratingDelta = Math\.max\(0/);
assert.match(core, /continueCosts: \[40, 80\]/);
assert.doesNotMatch(core, /if \(legacyBoard\)/, "Old boardSize must not override infinite-level CRM rules");
assert.match(admin, /512 × 512/);
assert.match(admin, /scoringRules/);
assert.match(admin, /clanRules/);
assert.match(route, /router\.post\("\/sessions\/:sessionId\/moves"/);
assert.match(route, /router\.post\("\/sessions\/:sessionId\/boosters"/);
assert.match(route, /router\.get\("\/clans\/leaderboard"/);
assert.match(migration, /game_level_results/);
assert.match(migration, /game_clan_round_roster/);
assert.match(migration, /game_symbol_versions/);
assert.match(migration, /bally_balance/);
assert.match(migration, /bally_cost/);

console.log("Infinite Match-3 levels, scoring, ranking, Bally, CRM and server authority smoke test passed");
