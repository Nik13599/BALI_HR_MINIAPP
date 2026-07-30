import assert from "node:assert/strict";
import test from "node:test";
import {
  createMatch3Board,
  generateMatch3Level,
  hashValue,
  match3Difficulty,
  match3SeasonRating,
  match3Stars,
  playMatch3Move
} from "../../server/match3-engine.js";

const tileIds = ["headphones", "martini", "palm", "turntable", "disco", "mask", "lotus", "triangle"];

test("server Match-3 generator is deterministic and uses the configured difficulty curve", () => {
  const settings = {
    level_rules: {
      rows: 6,
      columns: 6,
      sqrtDifficulty: 0.06,
      linearDifficulty: 0.004
    }
  };
  const level = generateMatch3Level(100, settings, "season-test");
  const expected = 1 + 0.06 * Math.sqrt(99) + 0.004 * 99;
  assert.ok(Math.abs(match3Difficulty(100, settings.level_rules) - expected) < 1e-9);
  assert.equal(level.rows, 6);
  assert.equal(level.columns, 6);
  assert.deepEqual(createMatch3Board(level, tileIds), createMatch3Board(level, tileIds));
});

test("server Match-3 accepts a real adjacent match and rejects an invalid client move", () => {
  const level = generateMatch3Level(1, {}, "season-authority");
  const board = createMatch3Board(level, tileIds);
  assert.equal(playMatch3Move(board, 0, 2, level, tileIds, 1).reason, "not_adjacent");

  let validMove;
  for (let index = 0; index < board.length && !validMove; index += 1) {
    const candidates = [index + 1, index + level.columns]
      .filter(candidate => candidate < board.length)
      .filter(candidate => candidate !== index + 1 || Math.floor(candidate / level.columns) === Math.floor(index / level.columns));
    for (const candidate of candidates) {
      const result = playMatch3Move(board, index, candidate, level, tileIds, 1);
      if (result.valid) {
        validMove = result;
        break;
      }
    }
  }
  assert.ok(validMove, "the server-generated board must contain a valid move");
  assert.ok(validMove.scoreDelta > 0);
  assert.equal(validMove.board.length, 36);
});

test("server result formulas and signatures are stable", () => {
  assert.equal(hashValue({ b: 2, a: 1 }), hashValue({ a: 1, b: 2 }));
  const level = generateMatch3Level(1, {}, "season-score");
  assert.equal(match3Stars(9999, 10_000, false, level.scoring), 0);
  assert.equal(match3Stars(10_000, 10_000, true, level.scoring), 1);
  assert.equal(match3SeasonRating(1, 3, 2, level.rating), Math.round(1000 * 1.35 * 0.65));
});
