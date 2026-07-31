(() => {
  "use strict";
  if (window.BaliMatch3InfiniteEngine) return;

  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value || 0)));
  const round = (value, step = 1) => Math.max(step, Math.round(Number(value || 0) / step) * step);

  const DEFAULT_RULES = Object.freeze({
    level: {
      rows: 6,
      columns: 6,
      minTileTypes: 5,
      maxTileTypes: 8,
      baseMoves: 25,
      minMoves: 14,
      baseTargetScore: 10000,
      baseCollectTarget: 12,
      maxGoals: 4,
      checkpointEvery: 5,
      hardCheckpointEvery: 10,
      milestoneEvery: 10,
      specialStartLevel: 4,
      obstacleStartLevel: 8,
      obstacleChance: 0.08,
      obstacleChanceMax: 0.28,
      blockedChance: 0.02,
      blockedChanceMax: 0.12,
      obstacleMaxLayers: 3,
      specialSpawnChance: 0,
      sqrtDifficulty: 0.06,
      linearDifficulty: 0.004,
      objectiveOrder: ["score", "collect", "combined", "obstacles", "createSpecial", "activateSpecial", "multiStage"],
    },
    scoring: {
      baseTile: 100,
      combo3: 1,
      combo4: 1.25,
      combo5: 1.6,
      comboTL: 1.75,
      combo6: 2,
      cascadeStep: 0.35,
      maxCascade: 3,
      lineCreate: 250,
      lineActivate: 500,
      bombCreate: 400,
      bombActivate: 800,
      rainbowCreate: 700,
      rainbowActivate: 1200,
      obstacleLayer: 150,
      goalComplete: 1000,
      allGoalsBase: 2500,
      remainingMove: 200,
      cleanMultiplier: 0.1,
      star2: 1.2,
      star3: 1.5,
    },
    rating: {
      base: 1000,
      levelLog: 0.1,
      star1: 1,
      star2: 1.15,
      star3: 1.35,
      continue0: 1,
      continue1: 0.85,
      continue2: 0.65,
    },
  });

  function deepMerge(base, patch) {
    const output = clone(base);
    const visit = (target, source) => Object.entries(source || {}).forEach(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value) && target[key] && typeof target[key] === "object" && !Array.isArray(target[key])) {
        visit(target[key], value);
      } else {
        target[key] = clone(value);
      }
    });
    visit(output, patch || {});
    return output;
  }

  function hashSeed(value) {
    let hash = 2166136261;
    for (const char of String(value || "")) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededRandom(seed) {
    let state = hashSeed(seed) || 0x9e3779b9;
    return () => {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }

  function difficulty(level, rules = DEFAULT_RULES.level) {
    const number = Math.max(1, Math.floor(Number(level || 1)));
    return 1
      + Number(rules.sqrtDifficulty || 0.06) * Math.sqrt(number - 1)
      + Number(rules.linearDifficulty || 0.004) * (number - 1);
  }

  function objectiveType(level, rules) {
    const order = Array.isArray(rules.objectiveOrder) && rules.objectiveOrder.length
      ? rules.objectiveOrder
      : DEFAULT_RULES.level.objectiveOrder;
    const hardCheckpointEvery = Number(rules.milestoneEvery || rules.hardCheckpointEvery || 10);
    if (hardCheckpointEvery > 0 && level % hardCheckpointEvery === 0) return "multiStage";
    if (Number(rules.checkpointEvery || 5) > 0 && level % Number(rules.checkpointEvery || 5) === 0) return "combined";
    const selected = order[(level - 1) % order.length];
    if (selected === "obstacles" && level < Number(rules.obstacleStartLevel || 8)) return "combined";
    if (["createSpecial", "activateSpecial"].includes(selected) && level < Number(rules.specialStartLevel || 4)) return "collect";
    return selected;
  }

  function generateLevel(levelNumber, configuration = {}, seasonKey = "weekly") {
    const rules = deepMerge(DEFAULT_RULES, {
      level: configuration.levelRules || configuration.level || {},
      scoring: configuration.scoringRules || configuration.scoring || {},
      rating: configuration.ratingRules || configuration.rating || {},
    });
    const level = Math.max(1, Math.floor(Number(levelNumber || 1)));
    const D = difficulty(level, rules.level);
    const rows = clamp(rules.level.rows, 5, 10);
    const columns = clamp(rules.level.columns, 5, 10);
    const tileTypes = Math.floor(clamp(
      Number(rules.level.minTileTypes || 5) + Math.floor((level - 1) / 20),
      Number(rules.level.minTileTypes || 5),
      Number(rules.level.maxTileTypes || 8)
    ));
    const moves = Math.max(
      Number(rules.level.minMoves || 14),
      Number(rules.level.baseMoves || 25) - Math.floor((level - 1) / 25)
        - (level % Number(rules.level.milestoneEvery || rules.level.hardCheckpointEvery || 10) === 0 ? 2 : 0)
    );
    const targetScore = round(Number(rules.level.baseTargetScore || 10000) * D, 500);
    const collectTarget = Math.max(3, Math.round(Number(rules.level.baseCollectTarget || 12) * D ** 0.75));
    const type = objectiveType(level, rules.level);
    const goals = [];
    if (["score", "combined", "multiStage"].includes(type)) goals.push({ id: "score", type: "score", target: targetScore, phase: type === "multiStage" ? 3 : 1 });
    if (["collect", "combined", "multiStage"].includes(type)) {
      const count = Math.min(type === "collect" ? 3 : 2, Number(rules.level.maxGoals || 4) - goals.length);
      for (let index = 0; index < count; index += 1) {
        goals.push({ id: `collect-${index}`, type: "collect", tileIndex: index, target: collectTarget + index * 2, phase: 1 });
      }
    }
    if (type === "obstacles" || type === "multiStage") {
      goals.push({
        id: "obstacles",
        type: "obstacles",
        target: Math.max(4, Math.round(rows * columns * Number(rules.level.obstacleChance || 0.08) * D)),
        phase: type === "multiStage" ? 2 : 1,
      });
    }
    if (type === "createSpecial") {
      goals.push({ id: "create-line", type: "createSpecial", special: "line", target: Math.max(1, Math.ceil(D)) });
      goals.push({ id: "create-bomb", type: "createSpecial", special: "bomb", target: Math.max(1, Math.floor(D)) });
    }
    if (type === "activateSpecial") {
      goals.push({ id: "activate-special", type: "activateSpecial", special: "any", target: Math.max(2, Math.ceil(2 * D ** 0.55)) });
    }
    if (!goals.length) goals.push({ id: "score", type: "score", target: targetScore });
    const seed = `${seasonKey}:${level}:${rows}x${columns}:${tileTypes}`;
    return {
      level,
      seasonKey,
      seed,
      difficulty: Number(D.toFixed(4)),
      rows,
      columns,
      tileTypes,
      moves,
      targetScore,
      type,
      checkpoint: level % Number(rules.level.checkpointEvery || 5) === 0,
      hardCheckpoint: level % Number(rules.level.milestoneEvery || rules.level.hardCheckpointEvery || 10) === 0,
      goals: goals.slice(0, Number(rules.level.maxGoals || 4)),
      obstacleChance: level < Number(rules.level.obstacleStartLevel || 8)
        ? 0
        : clamp(
          Number(rules.level.obstacleChance || 0) * Math.min(1.75, D),
          0,
          Number(rules.level.obstacleChanceMax || 0.28)
        ),
      blockedChance: level < Number(rules.level.milestoneEvery || rules.level.hardCheckpointEvery || 10)
        ? 0
        : clamp(
          Number(rules.level.blockedChance || 0) * Math.min(1.5, D),
          0,
          Number(rules.level.blockedChanceMax || 0.12)
        ),
      obstacleMaxLayers: clamp(Math.ceil(Math.min(Number(rules.level.obstacleMaxLayers || 3), D)), 1, 5),
      specialSpawnChance: clamp(rules.level.specialSpawnChance, 0, 0.1),
      scoring: rules.scoring,
      rating: rules.rating,
    };
  }

  function cell(tile = "", special = "", obstacle = 0, blocked = false) {
    return { tile, special, obstacle: Math.max(0, Number(obstacle || 0)), blocked: Boolean(blocked) };
  }

  function tileValue(item) {
    return item && !item.blocked && item.special !== "rainbow" ? item.tile : "";
  }

  function findMatchGroups(board, rows, columns) {
    const groups = [];
    for (let row = 0; row < rows; row += 1) {
      let start = 0;
      for (let column = 1; column <= columns; column += 1) {
        const current = column < columns ? tileValue(board[row * columns + column]) : "";
        const first = tileValue(board[row * columns + start]);
        if (!first || current !== first) {
          if (first && column - start >= 3) groups.push({
            orientation: "horizontal",
            tile: first,
            indices: Array.from({ length: column - start }, (_, offset) => row * columns + start + offset),
          });
          start = column;
        }
      }
    }
    for (let column = 0; column < columns; column += 1) {
      let start = 0;
      for (let row = 1; row <= rows; row += 1) {
        const current = row < rows ? tileValue(board[row * columns + column]) : "";
        const first = tileValue(board[start * columns + column]);
        if (!first || current !== first) {
          if (first && row - start >= 3) groups.push({
            orientation: "vertical",
            tile: first,
            indices: Array.from({ length: row - start }, (_, offset) => (start + offset) * columns + column),
          });
          start = row;
        }
      }
    }
    return groups;
  }

  function connectedClusters(groups) {
    const remaining = groups.map(group => ({ ...group, indices: [...group.indices] }));
    const clusters = [];
    while (remaining.length) {
      const source = remaining.shift();
      const indices = new Set(source.indices);
      const orientations = new Set([source.orientation]);
      let changed = true;
      while (changed) {
        changed = false;
        for (let index = remaining.length - 1; index >= 0; index -= 1) {
          const group = remaining[index];
          if (group.tile !== source.tile || !group.indices.some(item => indices.has(item))) continue;
          group.indices.forEach(item => indices.add(item));
          orientations.add(group.orientation);
          remaining.splice(index, 1);
          changed = true;
        }
      }
      clusters.push({ tile: source.tile, indices: [...indices], orientations: [...orientations] });
    }
    return clusters;
  }

  function hasMatch(board, rows, columns) {
    return findMatchGroups(board, rows, columns).length > 0;
  }

  function isAdjacent(first, second, columns) {
    const ar = Math.floor(first / columns);
    const ac = first % columns;
    const br = Math.floor(second / columns);
    const bc = second % columns;
    return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
  }

  function swap(board, first, second) {
    [board[first], board[second]] = [board[second], board[first]];
  }

  function findHint(board, rows, columns) {
    for (let index = 0; index < board.length; index += 1) {
      if (board[index]?.blocked) continue;
      const candidates = [];
      if (index % columns < columns - 1) candidates.push(index + 1);
      if (index + columns < board.length) candidates.push(index + columns);
      for (const other of candidates) {
        if (board[other]?.blocked) continue;
        if (board[index]?.special || board[other]?.special) return [index, other];
        swap(board, index, other);
        const valid = hasMatch(board, rows, columns);
        swap(board, index, other);
        if (valid) return [index, other];
      }
    }
    return null;
  }

  function createBoard(level, tileIds) {
    const ids = tileIds.slice(0, level.tileTypes);
    const random = seededRandom(level.seed);
    let board = [];
    for (let attempt = 0; attempt < 60; attempt += 1) {
      board = [];
      for (let index = 0; index < level.rows * level.columns; index += 1) {
        const row = Math.floor(index / level.columns);
        const column = index % level.columns;
        const edge = row === 0 || column === 0 || row === level.rows - 1 || column === level.columns - 1;
        const blocked = edge && random() < level.blockedChance;
        if (blocked) {
          board.push(cell("", "", 0, true));
          continue;
        }
        const excluded = new Set();
        if (column >= 2 && tileValue(board[index - 1]) === tileValue(board[index - 2])) excluded.add(tileValue(board[index - 1]));
        if (row >= 2 && tileValue(board[index - level.columns]) === tileValue(board[index - level.columns * 2])) excluded.add(tileValue(board[index - level.columns]));
        const choices = ids.filter(id => !excluded.has(id));
        const tile = (choices.length ? choices : ids)[Math.floor(random() * (choices.length || ids.length))] || ids[0];
        const obstacle = random() < level.obstacleChance ? 1 + Math.floor(random() * level.obstacleMaxLayers) : 0;
        const special = random() < level.specialSpawnChance ? (random() > 0.5 ? "line-h" : "line-v") : "";
        board.push(cell(tile, special, obstacle, false));
      }
      if (!hasMatch(board, level.rows, level.columns) && findHint(board, level.rows, level.columns)) return board;
    }
    return board;
  }

  function specialIndices(board, index, pairedIndex, rows, columns) {
    const item = board[index];
    const paired = board[pairedIndex];
    const result = new Set([index]);
    const row = Math.floor(index / columns);
    const column = index % columns;
    const addRow = value => {
      const r = Math.floor(value / columns);
      for (let c = 0; c < columns; c += 1) if (!board[r * columns + c]?.blocked) result.add(r * columns + c);
    };
    const addColumn = value => {
      const c = value % columns;
      for (let r = 0; r < rows; r += 1) if (!board[r * columns + c]?.blocked) result.add(r * columns + c);
    };
    if (item?.special === "line-h") addRow(index);
    if (item?.special === "line-v") addColumn(index);
    if (item?.special === "bomb") {
      for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) {
        const rr = row + dr;
        const cc = column + dc;
        if (rr >= 0 && rr < rows && cc >= 0 && cc < columns && !board[rr * columns + cc]?.blocked) result.add(rr * columns + cc);
      }
    }
    if (item?.special === "rainbow") {
      const target = paired?.tile || "";
      board.forEach((candidate, candidateIndex) => {
        if (!candidate.blocked && (!target || candidate.tile === target)) result.add(candidateIndex);
      });
    }
    return result;
  }

  function specialCombination(board, first, second, rows, columns) {
    const left = board[first];
    const right = board[second];
    if (!left?.special || !right?.special) return null;
    const cleared = new Set();
    const addAll = set => set.forEach(index => cleared.add(index));
    if (left.special === "rainbow" && right.special === "rainbow") {
      board.forEach((candidate, index) => { if (!candidate.blocked) cleared.add(index); });
    } else if (left.special === "rainbow" || right.special === "rainbow") {
      const rainbowIndex = left.special === "rainbow" ? first : second;
      const otherIndex = rainbowIndex === first ? second : first;
      addAll(specialIndices(board, rainbowIndex, otherIndex, rows, columns));
      if (board[otherIndex].special === "line-h" || board[otherIndex].special === "line-v") {
        [...cleared].forEach(index => addAll(specialIndices(board, index, otherIndex, rows, columns)));
      }
    } else if (left.special === "bomb" && right.special === "bomb") {
      const centerRow = Math.floor(second / columns);
      const centerColumn = second % columns;
      for (let dr = -2; dr <= 2; dr += 1) for (let dc = -2; dc <= 2; dc += 1) {
        const row = centerRow + dr;
        const column = centerColumn + dc;
        if (row >= 0 && row < rows && column >= 0 && column < columns && !board[row * columns + column]?.blocked) cleared.add(row * columns + column);
      }
    } else {
      addAll(specialIndices(board, first, second, rows, columns));
      addAll(specialIndices(board, second, first, rows, columns));
      if ((left.special === "bomb" && right.special.startsWith("line")) || (right.special === "bomb" && left.special.startsWith("line"))) {
        const center = left.special === "bomb" ? first : second;
        const centerRow = Math.floor(center / columns);
        const centerColumn = center % columns;
        for (let delta = -1; delta <= 1; delta += 1) {
          if (centerRow + delta >= 0 && centerRow + delta < rows) addAll(specialIndices(board.map((item, index) => index === (centerRow + delta) * columns + centerColumn ? { ...item, special: "line-h" } : item), (centerRow + delta) * columns + centerColumn, center, rows, columns));
          if (centerColumn + delta >= 0 && centerColumn + delta < columns) addAll(specialIndices(board.map((item, index) => index === centerRow * columns + centerColumn + delta ? { ...item, special: "line-v" } : item), centerRow * columns + centerColumn + delta, center, rows, columns));
        }
      }
    }
    return { cleared, activations: 2, label: `${left.special} + ${right.special}` };
  }

  function collapse(board, cleared, level, tileIds, random) {
    const next = board.map(item => ({ ...item }));
    cleared.forEach(index => {
      if (!next[index]?.blocked) next[index] = cell("", "", next[index].obstacle, false);
    });
    for (let column = 0; column < level.columns; column += 1) {
      const positions = [];
      const kept = [];
      for (let row = level.rows - 1; row >= 0; row -= 1) {
        const index = row * level.columns + column;
        if (next[index].blocked) continue;
        positions.push(index);
        if (next[index].tile) kept.push(next[index]);
      }
      positions.forEach((index, cursor) => {
        next[index] = kept[cursor] || cell(tileIds[Math.floor(random() * tileIds.length)] || tileIds[0], "", next[index].obstacle, false);
      });
    }
    return next;
  }

  function cascadeMultiplier(cascade, scoring) {
    return Math.min(Number(scoring.maxCascade || 3), 1 + Number(scoring.cascadeStep || 0.35) * Math.max(0, cascade - 1));
  }

  function clusterCoefficient(cluster, scoring) {
    if (cluster.orientations.length > 1) return Number(scoring.comboTL || 1.75);
    if (cluster.indices.length >= 6) return Number(scoring.combo6 || 2);
    if (cluster.indices.length === 5) return Number(scoring.combo5 || 1.6);
    if (cluster.indices.length === 4) return Number(scoring.combo4 || 1.25);
    return Number(scoring.combo3 || 1);
  }

  function playMove(inputBoard, first, second, level, tileIds) {
    const board = clone(inputBoard);
    if (!Number.isInteger(first) || !Number.isInteger(second) || !isAdjacent(first, second, level.columns)) return { valid: false, reason: "not_adjacent", board };
    if (board[first]?.blocked || board[second]?.blocked) return { valid: false, reason: "blocked", board };
    const random = seededRandom(`${level.seed}:move:${first}:${second}:${JSON.stringify(board).length}`);
    const scoring = deepMerge(DEFAULT_RULES.scoring, level.scoring || {});
    const summary = {
      score: 0,
      breakdown: { combinations: 0, cascades: 0, specials: 0, obstacles: 0 },
      collected: {},
      obstaclesDestroyed: 0,
      specialsCreated: { line: 0, bomb: 0, rainbow: 0 },
      specialsActivated: { line: 0, bomb: 0, rainbow: 0, any: 0 },
      bestCascade: 1,
      events: [],
    };
    const combo = specialCombination(board, first, second, level.rows, level.columns);
    swap(board, first, second);
    if (!combo && !hasMatch(board, level.rows, level.columns)) {
      swap(board, first, second);
      return { valid: false, reason: "no_match", board };
    }

    let current = board;
    let forced = combo?.cleared || null;
    for (let cascade = 1; cascade <= 12; cascade += 1) {
      const groups = findMatchGroups(current, level.rows, level.columns);
      if (!forced && !groups.length) break;
      const clusters = connectedClusters(groups);
      const cleared = new Set(forced || clusters.flatMap(cluster => cluster.indices));
      const activationQueue = [...cleared];
      const activated = new Set();
      while (activationQueue.length) {
        const index = activationQueue.shift();
        const special = current[index]?.special;
        if (!special || activated.has(index)) continue;
        activated.add(index);
        const extra = specialIndices(current, index, index === first ? second : first, level.rows, level.columns);
        extra.forEach(extraIndex => {
          if (!cleared.has(extraIndex)) activationQueue.push(extraIndex);
          cleared.add(extraIndex);
        });
        const type = special.startsWith("line") ? "line" : special;
        summary.specialsActivated[type] = Number(summary.specialsActivated[type] || 0) + 1;
        summary.specialsActivated.any += 1;
        summary.breakdown.specials += Number(scoring[`${type}Activate`] || 0);
      }

      let created = null;
      let anchor = second;
      if (!forced && clusters.length) {
        const preferred = clusters.find(cluster => cluster.indices.includes(second)) || clusters[0];
        anchor = preferred.indices.includes(second) ? second : preferred.indices[0];
        if (preferred.orientations.length > 1) created = "bomb";
        else if (preferred.indices.length >= 5) created = "rainbow";
        else if (preferred.indices.length === 4) created = preferred.orientations[0] === "horizontal" ? "line-h" : "line-v";
        if (created) cleared.delete(anchor);
      }

      const multiplier = cascadeMultiplier(cascade, scoring);
      const matchedIndices = new Set(clusters.flatMap(cluster => cluster.indices));
      let combinationScore = 0;
      clusters.forEach(cluster => {
        combinationScore += Math.round(cluster.indices.length * Number(scoring.baseTile || 100) * clusterCoefficient(cluster, scoring) * multiplier);
      });
      const extraRemoved = [...cleared].filter(index => !matchedIndices.has(index)).length;
      combinationScore += Math.round(extraRemoved * Number(scoring.baseTile || 100) * multiplier);
      summary.score += combinationScore;
      if (cascade === 1) summary.breakdown.combinations += combinationScore;
      else summary.breakdown.cascades += combinationScore;
      summary.bestCascade = Math.max(summary.bestCascade, cascade);

      cleared.forEach(index => {
        const item = current[index];
        if (!item || item.blocked) return;
        if (item.tile) summary.collected[item.tile] = Number(summary.collected[item.tile] || 0) + 1;
        if (item.obstacle > 0) {
          item.obstacle -= 1;
          summary.obstaclesDestroyed += 1;
          summary.breakdown.obstacles += Number(scoring.obstacleLayer || 150);
        }
      });
      if (created) {
        const type = created.startsWith("line") ? "line" : created;
        summary.specialsCreated[type] = Number(summary.specialsCreated[type] || 0) + 1;
        const bonus = Number(scoring[`${type}Create`] || 0);
        summary.breakdown.specials += bonus;
      }
      if (combo && cascade === 1) {
        summary.breakdown.specials += combo.activations * 250;
      }
      summary.events.push({
        cascade,
        removed: cleared.size,
        points: combinationScore,
        multiplier: Number(multiplier.toFixed(2)),
        created,
      });
      current = collapse(current, cleared, level, tileIds, random);
      if (created && current[anchor] && !current[anchor].blocked) current[anchor].special = created;
      forced = null;
    }
    summary.score += summary.breakdown.specials + summary.breakdown.obstacles;
    if (!findHint(current, level.rows, level.columns)) {
      current = createBoard({ ...level, seed: `${level.seed}:reshuffle:${hashSeed(JSON.stringify(current))}` }, tileIds);
    }
    return { valid: true, board: current, ...summary };
  }

  function applyBooster(inputBoard, type, index, level, tileIds) {
    const board = clone(inputBoard);
    if (!Number.isInteger(index) || index < 0 || index >= board.length || board[index]?.blocked) {
      return { valid: false, reason: "invalid_cell", board };
    }
    const cleared = new Set();
    if (type === "remove") cleared.add(index);
    if (type === "bomb") {
      const row = Math.floor(index / level.columns);
      const column = index % level.columns;
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          const rr = row + dr;
          const cc = column + dc;
          if (rr >= 0 && rr < level.rows && cc >= 0 && cc < level.columns) cleared.add(rr * level.columns + cc);
        }
      }
    }
    if (type === "removeType") {
      const target = board[index]?.tile;
      board.forEach((item, itemIndex) => {
        if (!item.blocked && item.tile === target) cleared.add(itemIndex);
      });
    }
    if (!cleared.size) return { valid: false, reason: "unsupported_booster", board };
    const collected = {};
    let obstaclesDestroyed = 0;
    cleared.forEach(itemIndex => {
      const item = board[itemIndex];
      if (item?.tile) collected[item.tile] = Number(collected[item.tile] || 0) + 1;
      if (item?.obstacle > 0) obstaclesDestroyed += 1;
    });
    const random = seededRandom(`${level.seed}:booster:${type}:${index}:${hashSeed(JSON.stringify(board))}`);
    const next = collapse(board, cleared, level, tileIds, random);
    const scoring = deepMerge(DEFAULT_RULES.scoring, level.scoring || {});
    return {
      valid: true,
      board: next,
      cleared: cleared.size,
      score: Math.round(cleared.size * Number(scoring.baseTile || 100)),
      collected,
      obstaclesDestroyed,
    };
  }

  function goalValue(goal, progress, tileIds = []) {
    if (goal.type === "score") return Number(progress.score || 0);
    if (goal.type === "collect") return Number(progress.collected?.[tileIds[goal.tileIndex] || goal.tileId] || 0);
    if (goal.type === "obstacles") return Number(progress.obstaclesDestroyed || 0);
    if (goal.type === "createSpecial") return Number(progress.specialsCreated?.[goal.special] || 0);
    if (goal.type === "activateSpecial") return Number(progress.specialsActivated?.[goal.special || "any"] || 0);
    return 0;
  }

  function goalsStatus(level, progress, tileIds = []) {
    return level.goals.map(goal => {
      const value = goalValue(goal, progress, tileIds);
      return { ...goal, value, complete: value >= Number(goal.target || 0) };
    });
  }

  function goalsComplete(level, progress, tileIds = []) {
    return goalsStatus(level, progress, tileIds).every(goal => goal.complete);
  }

  function starsFor(score, target, success, scoring = DEFAULT_RULES.scoring) {
    if (!success) return 0;
    if (Number(score || 0) >= Number(target || 0) * Number(scoring.star3 || 1.5)) return 3;
    if (Number(score || 0) >= Number(target || 0) * Number(scoring.star2 || 1.2)) return 2;
    return 1;
  }

  function seasonalRating(level, stars, continues, rating = DEFAULT_RULES.rating) {
    if (stars < 1) return 0;
    const levelCoefficient = 1 + Number(rating.levelLog || 0.1) * Math.log(Math.max(1, Number(level || 1)));
    const starCoefficient = Number(rating[`star${stars}`] || 1);
    const continueCoefficient = Number(rating[`continue${Math.min(2, continues)}`] || 0.65);
    return Math.round(Number(rating.base || 1000) * levelCoefficient * starCoefficient * continueCoefficient);
  }

  window.BaliMatch3InfiniteEngine = Object.freeze({
    DEFAULT_RULES,
    clone,
    deepMerge,
    hashSeed,
    seededRandom,
    difficulty,
    generateLevel,
    createBoard,
    findMatchGroups,
    findHint,
    playMove,
    applyBooster,
    goalsStatus,
    goalsComplete,
    starsFor,
    seasonalRating,
  });
})();
