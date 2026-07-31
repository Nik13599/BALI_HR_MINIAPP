import { createHash } from "node:crypto";

export type Match3Cell = {
  tile: string;
  special: "" | "line-h" | "line-v" | "bomb" | "rainbow";
  obstacle: number;
  blocked: boolean;
};

export type Match3Goal = {
  type: "score" | "collect" | "obstacles" | "createSpecial" | "activateSpecial";
  target: number;
  tileIndex?: number;
  special?: "line" | "bomb" | "rainbow" | "any";
};

export type Match3Level = {
  level: number;
  seed: string;
  difficulty: number;
  rows: number;
  columns: number;
  tileTypes: number;
  moves: number;
  targetScore: number;
  goals: Match3Goal[];
  checkpoint: boolean;
  multistage: boolean;
  obstacleChance: number;
  blockedChance: number;
  scoring: Record<string, number>;
  rating: Record<string, number>;
};

export type Match3Progress = {
  score: number;
  collected: Record<string, number>;
  obstaclesDestroyed: number;
  specialsCreated: Record<string, number>;
  specialsActivated: Record<string, number>;
};

const DEFAULT_LEVEL = {
  rows: 6,
  columns: 6,
  minTileTypes: 5,
  maxTileTypes: 8,
  baseMoves: 25,
  minMoves: 12,
  baseTargetScore: 10_000,
  sqrtDifficulty: 0.06,
  linearDifficulty: 0.004,
  maxGoals: 3,
  checkpointEvery: 10,
  milestoneEvery: 25,
  specialStartLevel: 4,
  obstacleStartLevel: 8,
  blockedChanceMax: 0.12,
  obstacleChanceMax: 0.28
};

const DEFAULT_SCORING: Record<string, number> = {
  baseTile: 100,
  combo3: 1,
  combo4: 1.25,
  combo5: 1.6,
  combo6: 2,
  comboTL: 1.75,
  cascadeStep: 0.35,
  maxCascade: 3,
  lineCreate: 250,
  bombCreate: 400,
  rainbowCreate: 650,
  lineActivate: 350,
  bombActivate: 550,
  rainbowActivate: 900,
  obstacleLayer: 150,
  goalComplete: 1000,
  allGoalsBase: 2500,
  remainingMove: 200,
  cleanMultiplier: 0.1,
  star2: 1.2,
  star3: 1.5
};

const DEFAULT_RATING: Record<string, number> = {
  base: 1000,
  levelLog: 0.1,
  star1: 1,
  star2: 1.15,
  star3: 1.35,
  continue0: 1,
  continue1: 0.85,
  continue2: 0.65
};

function object(value: unknown): Record<string, any> {
  return value && !Array.isArray(value) && typeof value === "object"
    ? value as Record<string, any>
    : {};
}

function integer(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(minimum, Math.min(maximum, Math.round(parsed)))
    : fallback;
}

function numeric(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(minimum, Math.min(maximum, parsed))
    : fallback;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)])
    );
  }
  return value;
}

export function hashValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function seedNumber(value: string): number {
  return Number.parseInt(hashValue(value).slice(0, 8), 16) >>> 0;
}

function seededRandom(seed: string): () => number {
  let state = seedNumber(seed) || 1;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function match3Difficulty(level: number, rawRules: unknown = {}): number {
  const rules = { ...DEFAULT_LEVEL, ...object(rawRules) };
  const normalized = Math.max(1, Math.floor(level));
  return 1
    + numeric(rules.sqrtDifficulty, DEFAULT_LEVEL.sqrtDifficulty, 0, 10) * Math.sqrt(normalized - 1)
    + numeric(rules.linearDifficulty, DEFAULT_LEVEL.linearDifficulty, 0, 10) * (normalized - 1);
}

function levelGoals(level: number, difficulty: number, targetScore: number, rules: Record<string, any>): Match3Goal[] {
  const count = Math.min(integer(rules.maxGoals, 3, 1, 5), 1 + Math.floor(level / 12));
  const cycle = level % 7;
  const goals: Match3Goal[] = [{ type: "score", target: targetScore }];
  if (count > 1) {
    if (cycle === 0 || cycle === 3) {
      goals.push({ type: "collect", tileIndex: level % 5, target: Math.round(12 + difficulty * 5) });
    } else if (level >= integer(rules.obstacleStartLevel, 8, 1, 1_000_000)) {
      goals.push({ type: "obstacles", target: Math.round(4 + difficulty * 2) });
    } else {
      goals.push({ type: "createSpecial", special: "line", target: Math.max(1, Math.round(difficulty)) });
    }
  }
  if (count > 2) {
    goals.push(level % 2
      ? { type: "activateSpecial", special: "any", target: Math.max(1, Math.round(difficulty)) }
      : { type: "collect", tileIndex: (level + 2) % 5, target: Math.round(10 + difficulty * 4) });
  }
  return goals;
}

export function generateMatch3Level(
  level: number,
  settings: Record<string, any>,
  seasonId: string
): Match3Level {
  const raw = { ...DEFAULT_LEVEL, ...object(settings.level_rules ?? settings.levelRules) };
  const scoring = { ...DEFAULT_SCORING, ...object(settings.scoring_rules ?? settings.scoringRules) };
  const rating = { ...DEFAULT_RATING, ...object(settings.rating_rules ?? settings.ratingRules) };
  const normalized = Math.max(1, Math.floor(level));
  const difficulty = match3Difficulty(normalized, raw);
  const rows = integer(raw.rows, 6, 5, 10);
  const columns = integer(raw.columns, 6, 5, 10);
  const minimumTiles = integer(raw.minTileTypes, 5, 5, 8);
  const maximumTiles = integer(raw.maxTileTypes, 8, minimumTiles, 8);
  const tileTypes = Math.min(maximumTiles, minimumTiles + Math.floor((normalized - 1) / 18));
  const targetScore = Math.max(500, Math.round(
    numeric(raw.baseTargetScore, 10_000, 500, 1_000_000_000) * difficulty / 100
  ) * 100);
  const moves = Math.max(
    integer(raw.minMoves, 12, 5, 99),
    integer(raw.baseMoves, 25, 5, 99) - Math.floor(Math.log2(normalized + 1))
  );
  const obstacleProgress = Math.max(0, normalized - integer(raw.obstacleStartLevel, 8, 1, 1_000_000));
  const checkpointEvery = integer(raw.checkpointEvery, 10, 1, 10_000);
  const milestoneEvery = integer(raw.milestoneEvery, 25, 1, 10_000);
  return {
    level: normalized,
    seed: `${seasonId}:${normalized}`,
    difficulty: Number(difficulty.toFixed(5)),
    rows,
    columns,
    tileTypes,
    moves,
    targetScore,
    goals: levelGoals(normalized, difficulty, targetScore, raw),
    checkpoint: normalized % checkpointEvery === 0,
    multistage: normalized % milestoneEvery === 0,
    obstacleChance: normalized < integer(raw.obstacleStartLevel, 8, 1, 1_000_000)
      ? 0
      : Math.min(numeric(raw.obstacleChanceMax, 0.28, 0, 0.8), 0.04 + obstacleProgress * 0.006),
    blockedChance: normalized < milestoneEvery
      ? 0
      : Math.min(numeric(raw.blockedChanceMax, 0.12, 0, 0.5), 0.02 + normalized * 0.0005),
    scoring,
    rating
  };
}

function tileValue(cell: Match3Cell | undefined): string {
  return cell && !cell.blocked ? cell.tile : "";
}

function matches(board: Match3Cell[], rows: number, columns: number): number[][] {
  const groups: number[][] = [];
  for (let row = 0; row < rows; row += 1) {
    let start = 0;
    for (let column = 1; column <= columns; column += 1) {
      const first = tileValue(board[row * columns + start]);
      const current = column < columns ? tileValue(board[row * columns + column]) : "";
      if (!first || current !== first) {
        if (first && column - start >= 3) groups.push(
          Array.from({ length: column - start }, (_, offset) => row * columns + start + offset)
        );
        start = column;
      }
    }
  }
  for (let column = 0; column < columns; column += 1) {
    let start = 0;
    for (let row = 1; row <= rows; row += 1) {
      const first = tileValue(board[start * columns + column]);
      const current = row < rows ? tileValue(board[row * columns + column]) : "";
      if (!first || current !== first) {
        if (first && row - start >= 3) groups.push(
          Array.from({ length: row - start }, (_, offset) => (start + offset) * columns + column)
        );
        start = row;
      }
    }
  }
  return groups;
}

function adjacent(first: number, second: number, columns: number): boolean {
  const firstRow = Math.floor(first / columns);
  const secondRow = Math.floor(second / columns);
  return Math.abs(firstRow - secondRow) + Math.abs(first % columns - second % columns) === 1;
}

function swap(board: Match3Cell[], first: number, second: number): void {
  [board[first], board[second]] = [board[second]!, board[first]!];
}

function hintPair(board: Match3Cell[], rows: number, columns: number): [number, number] | null {
  for (let index = 0; index < board.length; index += 1) {
    for (const other of [index + 1, index + columns]) {
      if (other >= board.length || !adjacent(index, other, columns)) continue;
      if (board[index]?.blocked || board[other]?.blocked) continue;
      swap(board, index, other);
      const valid = matches(board, rows, columns).length > 0;
      swap(board, index, other);
      if (valid) return [index, other];
    }
  }
  return null;
}

function hasHint(board: Match3Cell[], rows: number, columns: number): boolean {
  return Boolean(hintPair(board, rows, columns));
}

export function createMatch3Board(level: Match3Level, tileIds: string[]): Match3Cell[] {
  const available = tileIds.slice(0, level.tileTypes);
  if (available.length < 5) throw new Error("At least five active Match-3 symbols are required");
  for (let boardAttempt = 0; boardAttempt < 80; boardAttempt += 1) {
    const random = seededRandom(`${level.seed}:board:${boardAttempt}`);
    const board: Match3Cell[] = [];
    for (let index = 0; index < level.rows * level.columns; index += 1) {
      const row = Math.floor(index / level.columns);
      const column = index % level.columns;
      const blockedTiles = new Set<string>();
      if (column >= 2 && board[index - 1]?.tile === board[index - 2]?.tile) blockedTiles.add(board[index - 1]!.tile);
      if (row >= 2 && board[index - level.columns]?.tile === board[index - level.columns * 2]?.tile) {
        blockedTiles.add(board[index - level.columns]!.tile);
      }
      const choices = available.filter(tile => !blockedTiles.has(tile));
      const blocked = level.blockedChance > 0 && random() < level.blockedChance;
      const obstacle = !blocked && level.obstacleChance > 0 && random() < level.obstacleChance
        ? (random() < 0.2 ? 2 : 1)
        : 0;
      board.push({
        tile: choices[Math.floor(random() * choices.length)] || available[0]!,
        special: "",
        obstacle,
        blocked
      });
    }
    if (hasHint(board, level.rows, level.columns)) return board;
  }
  throw new Error("Unable to generate a playable Match-3 board");
}

function collapse(
  board: Match3Cell[],
  cleared: Set<number>,
  level: Match3Level,
  tileIds: string[],
  moveNumber: number,
  cascade: number
): Match3Cell[] {
  const random = seededRandom(`${level.seed}:move:${moveNumber}:cascade:${cascade}:${hashValue(board)}`);
  const next = board.map(cell => ({ ...cell }));
  for (let column = 0; column < level.columns; column += 1) {
    const kept: Match3Cell[] = [];
    for (let row = level.rows - 1; row >= 0; row -= 1) {
      const index = row * level.columns + column;
      if (next[index]?.blocked) continue;
      if (!cleared.has(index)) kept.push(next[index]!);
    }
    let cursor = 0;
    for (let row = level.rows - 1; row >= 0; row -= 1) {
      const index = row * level.columns + column;
      if (next[index]?.blocked) continue;
      next[index] = kept[cursor++] || {
        tile: tileIds[Math.floor(random() * Math.min(tileIds.length, level.tileTypes))]!,
        special: "",
        obstacle: 0,
        blocked: false
      };
    }
  }
  return next;
}

function specialCells(
  board: Match3Cell[],
  index: number,
  pairedIndex: number,
  rows: number,
  columns: number
): number[] {
  const cell = board[index];
  if (!cell?.special) return [];
  const row = Math.floor(index / columns);
  const column = index % columns;
  if (cell.special === "line-h") return Array.from({ length: columns }, (_, offset) => row * columns + offset);
  if (cell.special === "line-v") return Array.from({ length: rows }, (_, offset) => offset * columns + column);
  if (cell.special === "bomb") {
    const indices: number[] = [];
    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
        const targetRow = row + rowOffset;
        const targetColumn = column + columnOffset;
        if (targetRow >= 0 && targetRow < rows && targetColumn >= 0 && targetColumn < columns) {
          indices.push(targetRow * columns + targetColumn);
        }
      }
    }
    return indices;
  }
  const pairedTile = board[pairedIndex]?.tile;
  return board.flatMap((item, itemIndex) =>
    !item.blocked && (!pairedTile || item.tile === pairedTile) ? [itemIndex] : []
  );
}

export function playMatch3Move(
  input: Match3Cell[],
  first: number,
  second: number,
  level: Match3Level,
  tileIds: string[],
  moveNumber: number
): {
  valid: boolean;
  reason?: string;
  board: Match3Cell[];
  scoreDelta: number;
  progressDelta: Partial<Match3Progress>;
  breakdown: Record<string, number>;
  cascades: number;
} {
  const board = input.map(cell => ({ ...cell }));
  if (!Number.isInteger(first) || !Number.isInteger(second) || !adjacent(first, second, level.columns)) {
    return { valid: false, reason: "not_adjacent", board, scoreDelta: 0, progressDelta: {}, breakdown: {}, cascades: 0 };
  }
  if (!board[first] || !board[second] || board[first].blocked || board[second].blocked) {
    return { valid: false, reason: "blocked", board, scoreDelta: 0, progressDelta: {}, breakdown: {}, cascades: 0 };
  }
  swap(board, first, second);
  const firstSpecial = board[first]?.special;
  const secondSpecial = board[second]?.special;
  let forced = new Set<number>();
  if (firstSpecial && secondSpecial) {
    if (firstSpecial === "rainbow" || secondSpecial === "rainbow") {
      board.forEach((cell, index) => {
        if (!cell.blocked) forced.add(index);
      });
    } else {
      specialCells(board, first, second, level.rows, level.columns).forEach(index => forced.add(index));
      specialCells(board, second, first, level.rows, level.columns).forEach(index => forced.add(index));
    }
  } else if (firstSpecial || secondSpecial) {
    const specialIndex = firstSpecial ? first : second;
    const pairedIndex = firstSpecial ? second : first;
    specialCells(board, specialIndex, pairedIndex, level.rows, level.columns).forEach(index => forced.add(index));
  }
  if (!forced.size && !matches(board, level.rows, level.columns).length) {
    swap(board, first, second);
    return { valid: false, reason: "no_match", board, scoreDelta: 0, progressDelta: {}, breakdown: {}, cascades: 0 };
  }

  let current = board;
  let scoreDelta = 0;
  let obstaclesDestroyed = 0;
  const collected: Record<string, number> = {};
  const specialsCreated: Record<string, number> = { line: 0, bomb: 0, rainbow: 0 };
  const specialsActivated: Record<string, number> = { line: 0, bomb: 0, rainbow: 0, any: 0 };
  const breakdown = { combinations: 0, cascades: 0, specials: 0, obstacles: 0 };
  let cascadeCount = 0;
  for (let cascade = 1; cascade <= 12; cascade += 1) {
    const groups = matches(current, level.rows, level.columns);
    if (!groups.length && !forced.size) break;
    cascadeCount = cascade;
    const cleared = new Set<number>(forced.size ? forced : groups.flat());
    const activationQueue = [...cleared];
    const activated = new Set<number>();
    while (activationQueue.length) {
      const index = activationQueue.shift()!;
      const special = current[index]?.special;
      if (!special || activated.has(index)) continue;
      activated.add(index);
      const pairedIndex = index === first ? second : first;
      for (const extraIndex of specialCells(current, index, pairedIndex, level.rows, level.columns)) {
        if (!cleared.has(extraIndex)) activationQueue.push(extraIndex);
        cleared.add(extraIndex);
      }
      const type = special.startsWith("line") ? "line" : special;
      specialsActivated[type] = Number(specialsActivated[type] || 0) + 1;
      specialsActivated.any += 1;
      const activationBonus = Number(level.scoring[`${type}Activate`] || 0);
      breakdown.specials += activationBonus;
      scoreDelta += activationBonus;
    }
    let created: Match3Cell["special"] = "";
    const intersections = groups.flatMap((group, groupIndex) =>
      groups.slice(groupIndex + 1).flatMap(other => group.filter(index => other.includes(index)))
    );
    const preferred = groups.find(group => group.includes(second)) || groups[0] || [...cleared];
    if (!forced.size && intersections.length) created = "bomb";
    else if (!forced.size && preferred.length >= 5) created = "rainbow";
    else if (!forced.size && preferred.length === 4) {
      const sameRow = preferred.every(index => Math.floor(index / level.columns) === Math.floor(preferred[0]! / level.columns));
      created = sameRow ? "line-h" : "line-v";
    }
    const anchor = intersections[0] ?? (preferred.includes(second) ? second : preferred[0]!);
    if (created) {
      cleared.delete(anchor);
      const createdType = created === "rainbow" ? "rainbow" : created === "bomb" ? "bomb" : "line";
      specialsCreated[createdType] += 1;
      const bonus = Number(level.scoring[`${createdType}Create`] || 0);
      breakdown.specials += bonus;
      scoreDelta += bonus;
    }
    let removed = 0;
    let obstacleBonus = 0;
    for (const index of cleared) {
      const cell = current[index];
      if (!cell || cell.blocked) continue;
      collected[cell.tile] = Number(collected[cell.tile] || 0) + 1;
      if (cell.obstacle > 0) {
        obstaclesDestroyed += 1;
        obstacleBonus += level.scoring.obstacleLayer;
      }
      removed += 1;
    }
    const multiplier = Math.min(level.scoring.maxCascade, 1 + level.scoring.cascadeStep * (cascade - 1));
    const groupCoefficient = groups.length ? Math.max(...groups.map(group => {
      if (group.length >= 6) return level.scoring.combo6;
      if (group.length === 5) return level.scoring.combo5;
      if (group.length === 4) return level.scoring.combo4;
      return level.scoring.combo3;
    })) : 1;
    const points = Math.round(removed * level.scoring.baseTile * groupCoefficient * multiplier);
    breakdown.obstacles += obstacleBonus;
    scoreDelta += points + obstacleBonus;
    if (cascade === 1) breakdown.combinations += points;
    else breakdown.cascades += points;
    current = collapse(current, cleared, level, tileIds, moveNumber, cascade);
    if (created && current[anchor] && !current[anchor].blocked) current[anchor].special = created;
    forced = new Set<number>();
  }
  if (!hasHint(current, level.rows, level.columns)) {
    current = createMatch3Board({ ...level, seed: `${level.seed}:reshuffle:${moveNumber}` }, tileIds);
  }
  return {
    valid: true,
    board: current,
    scoreDelta,
    progressDelta: { collected, obstaclesDestroyed, specialsCreated, specialsActivated },
    breakdown,
    cascades: cascadeCount
  };
}

export function applyMatch3Booster(
  input: Match3Cell[],
  type: "shuffle" | "hint" | "bomb" | "remove" | "removeType",
  targetIndex: number | null,
  level: Match3Level,
  tileIds: string[],
  useNumber: number
): {
  valid: boolean;
  reason?: string;
  board: Match3Cell[];
  scoreDelta: number;
  progressDelta: Partial<Match3Progress>;
  hint?: number[];
  cleared?: number;
} {
  const board = input.map(cell => ({ ...cell }));
  if (type === "hint") {
    const hint = hintPair(board, level.rows, level.columns);
    return {
      valid: Boolean(hint),
      reason: hint ? undefined : "no_hint",
      board,
      scoreDelta: 0,
      progressDelta: {},
      hint: hint || []
    };
  }
  if (type === "shuffle") {
    return {
      valid: true,
      board: createMatch3Board({ ...level, seed: `${level.seed}:booster:shuffle:${useNumber}` }, tileIds),
      scoreDelta: 0,
      progressDelta: {}
    };
  }
  if (!Number.isInteger(targetIndex) || targetIndex === null || targetIndex < 0 || targetIndex >= board.length) {
    return { valid: false, reason: "invalid_target", board, scoreDelta: 0, progressDelta: {} };
  }
  if (board[targetIndex]?.blocked) {
    return { valid: false, reason: "blocked", board, scoreDelta: 0, progressDelta: {} };
  }
  const cleared = new Set<number>();
  if (type === "remove") cleared.add(targetIndex);
  if (type === "removeType") {
    const tile = board[targetIndex]?.tile;
    board.forEach((cell, index) => {
      if (!cell.blocked && cell.tile === tile) cleared.add(index);
    });
  }
  if (type === "bomb") {
    const targetRow = Math.floor(targetIndex / level.columns);
    const targetColumn = targetIndex % level.columns;
    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
        const row = targetRow + rowOffset;
        const column = targetColumn + columnOffset;
        if (row >= 0 && row < level.rows && column >= 0 && column < level.columns) {
          const index = row * level.columns + column;
          if (!board[index]?.blocked) cleared.add(index);
        }
      }
    }
  }
  const collected: Record<string, number> = {};
  let obstaclesDestroyed = 0;
  for (const index of cleared) {
    const cell = board[index];
    if (!cell) continue;
    collected[cell.tile] = Number(collected[cell.tile] || 0) + 1;
    if (cell.obstacle > 0) obstaclesDestroyed += 1;
  }
  const scoreDelta = Math.round(cleared.size * Number(level.scoring.baseTile || 100));
  return {
    valid: true,
    board: collapse(board, cleared, level, tileIds, 100_000 + useNumber, 1),
    scoreDelta,
    progressDelta: { collected, obstaclesDestroyed },
    cleared: cleared.size
  };
}

export function initialMatch3Progress(): Match3Progress {
  return {
    score: 0,
    collected: {},
    obstaclesDestroyed: 0,
    specialsCreated: { line: 0, bomb: 0, rainbow: 0 },
    specialsActivated: { line: 0, bomb: 0, rainbow: 0, any: 0 }
  };
}

function goalValue(goal: Match3Goal, progress: Match3Progress, tileIds: string[]): number {
  if (goal.type === "score") return Number(progress.score || 0);
  if (goal.type === "collect") return Number(progress.collected[tileIds[goal.tileIndex || 0]!] || 0);
  if (goal.type === "obstacles") return Number(progress.obstaclesDestroyed || 0);
  if (goal.type === "createSpecial") return Number(progress.specialsCreated[goal.special || "line"] || 0);
  return Number(progress.specialsActivated[goal.special || "any"] || 0);
}

export function match3GoalsComplete(level: Match3Level, progress: Match3Progress, tileIds: string[]): boolean {
  return level.goals.every(goal => goalValue(goal, progress, tileIds) >= goal.target);
}

export function match3Stars(score: number, target: number, success: boolean, scoring: Record<string, number>): number {
  if (!success) return 0;
  if (score >= target * scoring.star3) return 3;
  if (score >= target * scoring.star2) return 2;
  return 1;
}

export function match3SeasonRating(
  level: number,
  stars: number,
  continues: number,
  rating: Record<string, number>
): number {
  if (stars < 1) return 0;
  return Math.round(
    rating.base
    * (1 + rating.levelLog * Math.log(Math.max(1, level)))
    * rating[`star${stars}`]
    * rating[`continue${Math.min(2, continues)}`]
  );
}
