(() => {
  if (window.__BALI_MATCH3_UI__ || !window.BaliMatch3) return;
  window.__BALI_MATCH3_UI__ = true;

  const api = window.BaliMatch3;
  const state = {
    config: api.config(),
    board: [],
    selected: -1,
    matched: new Set(),
    hint: new Set(),
    score: 0,
    moves: 0,
    combo: 1,
    bestCombo: 1,
    boosters: {},
    boosterMode: "",
    busy: false,
    completed: false,
    roundStartBest: 0,
    mobileTab: "game",
    message: "Соединяйте три одинаковых предмета в ряд.",
  };

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[char]));
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const number = (value) => Number(value || 0).toLocaleString("ru-RU");
  const initials = (name) => String(name || "B").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const root = () => document.querySelector('[data-screen="crown"]');
  const activeTiles = () => state.config.tiles.filter((tile) => tile.active !== false && tile.image);
  const randomTile = () => activeTiles()[Math.floor(Math.random() * activeTiles().length)]?.id || state.config.tiles[0].id;
  const tileById = (id) => state.config.tiles.find((tile) => tile.id === id) || state.config.tiles[0];
  const isAdjacent = (a, b) => {
    const size = state.config.boardSize;
    const ar = Math.floor(a / size), ac = a % size, br = Math.floor(b / size), bc = b % size;
    return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
  };

  function toast(message) {
    const node = document.getElementById("toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2300);
  }

  function swap(board, a, b) {
    [board[a], board[b]] = [board[b], board[a]];
  }

  function findMatches(board = state.board) {
    const size = state.config.boardSize;
    const found = new Set();
    for (let row = 0; row < size; row += 1) {
      let start = 0;
      for (let col = 1; col <= size; col += 1) {
        const current = col < size ? board[row * size + col] : null;
        const first = board[row * size + start];
        if (current !== first) {
          if (first && col - start >= 3) {
            for (let index = start; index < col; index += 1) found.add(row * size + index);
          }
          start = col;
        }
      }
    }
    for (let col = 0; col < size; col += 1) {
      let start = 0;
      for (let row = 1; row <= size; row += 1) {
        const current = row < size ? board[row * size + col] : null;
        const first = board[start * size + col];
        if (current !== first) {
          if (first && row - start >= 3) {
            for (let index = start; index < row; index += 1) found.add(index * size + col);
          }
          start = row;
        }
      }
    }
    return found;
  }

  function findHint(board = state.board) {
    const size = state.config.boardSize;
    for (let index = 0; index < board.length; index += 1) {
      const candidates = [];
      if (index % size < size - 1) candidates.push(index + 1);
      if (index + size < board.length) candidates.push(index + size);
      for (const other of candidates) {
        swap(board, index, other);
        const valid = findMatches(board).size > 0;
        swap(board, index, other);
        if (valid) return [index, other];
      }
    }
    return null;
  }

  function createBoard() {
    const size = state.config.boardSize;
    let board = [];
    for (let attempt = 0; attempt < 80; attempt += 1) {
      board = [];
      for (let index = 0; index < size * size; index += 1) {
        const row = Math.floor(index / size), col = index % size;
        const blocked = new Set();
        if (col >= 2 && board[index - 1] === board[index - 2]) blocked.add(board[index - 1]);
        if (row >= 2 && board[index - size] === board[index - size * 2]) blocked.add(board[index - size]);
        const choices = activeTiles().filter((tile) => !blocked.has(tile.id));
        board.push((choices[Math.floor(Math.random() * choices.length)] || activeTiles()[0]).id);
      }
      if (findMatches(board).size === 0 && findHint(board)) return board;
    }
    return board;
  }

  function collapseBoard(indices) {
    const size = state.config.boardSize;
    const cleared = new Set(indices);
    for (let col = 0; col < size; col += 1) {
      const kept = [];
      for (let row = size - 1; row >= 0; row -= 1) {
        const index = row * size + col;
        if (!cleared.has(index)) kept.push(state.board[index]);
      }
      for (let row = size - 1, cursor = 0; row >= 0; row -= 1, cursor += 1) {
        state.board[row * size + col] = kept[cursor] || randomTile();
      }
    }
  }

  function renderBoard() {
    const board = document.getElementById("match3Board");
    if (!board) return;
    board.style.setProperty("--board-size", state.config.boardSize);
    board.innerHTML = state.board.map((tileId, index) => {
      const tile = tileById(tileId);
      const classes = [
        "match3-cell",
        state.selected === index ? "selected" : "",
        state.hint.has(index) ? "hint" : "",
        state.matched.has(index) ? "matched" : "",
      ].filter(Boolean).join(" ");
      return `<button class="${classes}" type="button" data-match3-cell="${index}" aria-label="${esc(tile.name)}"><img src="${esc(tile.image)}" alt="" draggable="false"></button>`;
    }).join("");
  }

  function renderMetrics() {
    const score = document.getElementById("match3Score");
    const moves = document.getElementById("match3Moves");
    const combo = document.getElementById("match3Combo");
    const target = document.getElementById("match3Target");
    const progress = document.getElementById("match3Progress");
    const message = document.getElementById("match3Message");
    if (score) score.textContent = number(state.score);
    if (moves) moves.textContent = number(state.moves);
    if (combo) combo.textContent = `×${Math.max(1, state.combo)}`;
    if (target) target.textContent = number(state.config.targetScore);
    if (progress) progress.style.width = `${Math.min(100, state.score / state.config.targetScore * 100)}%`;
    if (message) message.innerHTML = `${esc(state.message)} <b>${state.boosterMode ? "Выберите клетку" : ""}</b>`;
    document.querySelectorAll("[data-match3-booster]").forEach((button) => {
      const type = button.dataset.match3Booster;
      button.classList.toggle("active", state.boosterMode === type);
      button.disabled = state.busy || state.completed || Number(state.boosters[type] || 0) <= 0;
      const count = button.querySelector("strong");
      if (count) count.textContent = number(state.boosters[type] || 0);
    });
  }

  function renderLeaderboard() {
    const list = document.getElementById("match3Ranking");
    if (!list) return;
    list.innerHTML = api.leaderboard().slice(0, 10).map((row) => `
      <article class="match3-rank-row ${row.isMe ? "me" : ""}">
        <strong>${row.position}</strong>
        <span class="match3-rank-avatar">${row.avatar ? `<img src="${esc(row.avatar)}" alt="">` : esc(initials(row.name))}</span>
        <div><h4>${esc(row.name)}</h4><p>${row.attempts} игр${row.isMe ? " · ВЫ" : ""}</p></div>
        <b>${number(row.score)}</b>
      </article>`).join("");
  }

  function renderRewards() {
    const rootNode = document.getElementById("match3Rewards");
    if (!rootNode) return;
    const me = api.leaderboard().find((row) => row.isMe);
    rootNode.innerHTML = state.config.rewards.map((reward) => {
      const vip = reward.vipPlan ? ` · ${reward.vipPlan.toUpperCase()} ${reward.vipDays} дн.` : "";
      return `<article class="match3-reward-card ${me?.position === reward.position ? "me" : ""}">
        <img src="${esc(state.config.rewardImage)}" alt="">
        <div><strong>${reward.position} место · ${number(reward.points)} баллов</strong><p>${esc(reward.reward)} · ${number(reward.xp)} XP${esc(vip)}</p></div>
      </article>`;
    }).join("");
    const earned = document.getElementById("match3MyRewards");
    if (earned) {
      const rows = api.myRewards().slice(0, 6);
      earned.innerHTML = rows.length ? rows.map((reward) => `<article class="match3-earned"><strong>${reward.position} место · ${esc(reward.reward)}</strong><p>${number(reward.points)} баллов · ${reward.vipPlan ? `${reward.vipPlan.toUpperCase()} ${reward.vipDays} дн. · ` : ""}${new Date(reward.awardedAt).toLocaleDateString("ru-RU")}</p></article>`).join("") : '<div class="match3-empty">Награды появятся здесь после завершения недельного соревнования.</div>';
    }
  }

  function renderSide() {
    renderLeaderboard();
    renderRewards();
    const week = api.weekInfo();
    const range = document.getElementById("match3WeekRange");
    if (range) range.textContent = week.label;
    updateCountdown();
  }

  function renderAll() {
    renderBoard();
    renderMetrics();
    renderSide();
  }

  function updateCountdown() {
    const node = document.getElementById("match3Countdown");
    if (!node) return;
    const remaining = Math.max(0, api.weekInfo().endsAt - Date.now());
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor(remaining % 86400000 / 3600000);
    const minutes = Math.floor(remaining % 3600000 / 60000);
    node.textContent = `${days}д ${hours}ч ${minutes}м`;
  }

  async function resolveBoard(startCombo = 1) {
    let combo = startCombo;
    for (let cascade = 0; cascade < 12; cascade += 1) {
      const matches = findMatches();
      if (!matches.size) break;
      state.combo = combo;
      state.bestCombo = Math.max(state.bestCombo, combo);
      state.score += matches.size * 120 * combo;
      state.matched = matches;
      state.message = combo > 1 ? `Каскад ×${combo}!` : `Комбинация: ${matches.size} предмета`;
      renderBoard();
      renderMetrics();
      try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.(combo > 2 ? "heavy" : "medium"); } catch {}
      await delay(210);
      collapseBoard(matches);
      state.matched = new Set();
      renderBoard();
      await delay(120);
      combo += 1;
    }
    state.combo = Math.max(1, combo - 1);
    api.submitScore(state.score, { bestCombo: state.bestCombo, completed: false });
    if (!findHint()) {
      state.board = createBoard();
      state.message = "Поле автоматически перемешано: доступных ходов не осталось.";
    }
    renderAll();
  }

  async function playSwap(first, second) {
    state.busy = true;
    state.hint = new Set();
    swap(state.board, first, second);
    renderBoard();
    await delay(120);
    if (!findMatches().size) {
      swap(state.board, first, second);
      state.message = "Эта перестановка не создаёт комбинацию.";
      state.busy = false;
      renderAll();
      return;
    }
    state.moves = Math.max(0, state.moves - 1);
    await resolveBoard(1);
    state.busy = false;
    renderMetrics();
    if (state.moves <= 0) finishRound();
  }

  async function useBomb(index) {
    state.busy = true;
    state.boosters.bomb -= 1;
    state.boosterMode = "";
    const size = state.config.boardSize;
    const row = Math.floor(index / size), col = index % size;
    const cleared = new Set();
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        const rr = row + dr, cc = col + dc;
        if (rr >= 0 && rr < size && cc >= 0 && cc < size) cleared.add(rr * size + cc);
      }
    }
    state.score += cleared.size * 90;
    state.matched = cleared;
    state.message = `Бомба очистила ${cleared.size} клеток.`;
    renderAll();
    await delay(230);
    collapseBoard(cleared);
    state.matched = new Set();
    await resolveBoard(2);
    state.busy = false;
    renderAll();
  }

  function finishRound() {
    if (state.completed) return;
    state.completed = true;
    const result = api.submitScore(state.score, { bestCombo: state.bestCombo, completed: true });
    renderAll();
    const dialog = document.getElementById("match3Finish");
    if (!dialog) return;
    document.getElementById("match3FinishScore").textContent = number(state.score);
    document.getElementById("match3FinishCopy").textContent = state.score > state.roundStartBest
      ? `Новый недельный рекорд. Вы поднялись на ${result.row?.position || "—"} место.`
      : `Лучший результат недели: ${number(result.row?.score || state.roundStartBest)}. Ваше место: ${result.row?.position || "—"}.`;
    dialog.showModal();
  }

  function startRound() {
    state.config = api.config();
    state.board = createBoard();
    state.selected = -1;
    state.matched = new Set();
    state.hint = new Set();
    state.score = 0;
    state.moves = state.config.startingMoves;
    state.combo = 1;
    state.bestCombo = 1;
    state.boosters = { ...state.config.boosters };
    state.boosterMode = "";
    state.busy = false;
    state.completed = false;
    state.roundStartBest = Number(api.leaderboard().find((row) => row.isMe)?.score || 0);
    state.message = "Соединяйте три одинаковых предмета в ряд.";
    document.getElementById("match3Finish")?.close();
    renderAll();
  }

  async function handleCell(index) {
    if (state.busy || state.completed) return;
    if (state.boosterMode === "bomb") {
      await useBomb(index);
      return;
    }
    state.hint = new Set();
    if (state.selected < 0) {
      state.selected = index;
      state.message = "Теперь выберите соседнюю клетку.";
      renderAll();
      return;
    }
    if (state.selected === index) {
      state.selected = -1;
      state.message = "Выбор отменён.";
      renderAll();
      return;
    }
    if (!isAdjacent(state.selected, index)) {
      state.selected = index;
      state.message = "Можно менять местами только соседние предметы.";
      renderAll();
      return;
    }
    const first = state.selected;
    state.selected = -1;
    await playSwap(first, index);
  }

  function handleBooster(type) {
    if (state.busy || state.completed || Number(state.boosters[type] || 0) <= 0) return;
    if (type === "bomb") {
      state.boosterMode = state.boosterMode === "bomb" ? "" : "bomb";
      state.message = state.boosterMode ? "Бомба готова: выберите центральную клетку." : "Бомба отменена.";
    }
    if (type === "shuffle") {
      state.boosters.shuffle -= 1;
      state.board = createBoard();
      state.selected = -1;
      state.hint = new Set();
      state.message = "Все предметы перемешаны.";
    }
    if (type === "hint") {
      state.boosters.hint -= 1;
      state.hint = new Set(findHint() || []);
      state.message = state.hint.size ? "Подсказка подсветила возможный ход." : "Ходов нет — поле перемешано.";
      if (!state.hint.size) state.board = createBoard();
    }
    if (type === "extraMoves") {
      state.boosters.extraMoves -= 1;
      state.moves += 5;
      state.message = "Добавлено 5 ходов.";
    }
    renderAll();
  }

  function mount() {
    const pages = document.querySelector(".pages");
    const nav = document.querySelector(".nav");
    if (!pages || !nav) return false;
    document.querySelector('[data-screen="crown"]')?.remove();
    nav.querySelector('[data-page="crown"]')?.remove();
    if (state.config.enabled === false) return true;

    const screen = document.createElement("section");
    screen.className = "page match3-page";
    screen.dataset.screen = "crown";
    screen.innerHTML = `
      <div class="match3-scene">
        <div class="match3-shell">
          <header class="match3-topbar">
            <div class="match3-brand"><small id="match3Subtitle"></small><h2>BALI <em>Match</em></h2></div>
            <div class="match3-week"><span id="match3WeekRange"></span><strong>Рейтинг недели</strong><b id="match3Countdown"></b></div>
          </header>
          <div class="match3-metrics">
            <article class="match3-metric accent"><span>ОЧКИ</span><strong id="match3Score">0</strong></article>
            <article class="match3-metric"><span>ХОДЫ</span><strong id="match3Moves">0</strong></article>
            <article class="match3-metric"><span>КОМБО</span><strong id="match3Combo">×1</strong></article>
            <article class="match3-metric"><span>ЦЕЛЬ</span><strong id="match3Target">0</strong></article>
          </div>
          <div class="match3-tabs" role="tablist" aria-label="Разделы игры">
            <button class="active" type="button" data-match3-tab="game">Игра</button>
            <button type="button" data-match3-tab="ranking">Рейтинг и награды</button>
          </div>
          <div class="match3-layout" id="match3Layout" data-mobile-tab="game">
            <div class="match3-game-column">
              <section class="match3-panel neon">
                <div class="match3-panel-head"><div><h3>Ночной раунд</h3><span>Соберите три одинаковых предмета</span></div><b>LIVE</b></div>
                <div class="match3-progress"><i id="match3Progress"></i></div>
                <div class="match3-board" id="match3Board" role="grid" aria-label="Игровое поле BALI Match"></div>
                <div class="match3-booster-grid">
                  <button class="match3-booster" type="button" data-match3-booster="bomb"><span>Бомба 3×3</span><strong>0</strong></button>
                  <button class="match3-booster" type="button" data-match3-booster="shuffle"><span>Перемешать</span><strong>0</strong></button>
                  <button class="match3-booster" type="button" data-match3-booster="hint"><span>Подсказка</span><strong>0</strong></button>
                  <button class="match3-booster" type="button" data-match3-booster="extraMoves"><span>+5 ходов</span><strong>0</strong></button>
                </div>
                <div class="match3-message" id="match3Message" aria-live="polite"></div>
              </section>
            </div>
            <aside class="match3-side-column">
              <section class="match3-panel">
                <div class="match3-panel-head"><div><h3>TOP 10 недели</h3><span>Лучший результат каждого игрока</span></div><b>LIVE</b></div>
                <div class="match3-rank-list" id="match3Ranking"></div>
              </section>
              <section class="match3-panel">
                <div class="match3-panel-head"><div><h3>Награды TOP 10</h3><span>Баллы, награды и VIP-статусы</span></div></div>
                <div class="match3-rewards" id="match3Rewards"></div>
              </section>
              <section class="match3-panel">
                <div class="match3-panel-head"><div><h3>Мои награды</h3><span>Выданные призы прошлых недель</span></div></div>
                <div class="match3-my-rewards" id="match3MyRewards"></div>
              </section>
            </aside>
          </div>
        </div>
      </div>
      <dialog class="match3-finish" id="match3Finish">
        <div><span>РАУНД ЗАВЕРШЁН</span><h2>Ваш результат</h2><strong id="match3FinishScore">0</strong><p id="match3FinishCopy"></p><button type="button" data-match3-new-round>Играть ещё раз</button><button type="button" data-match3-show-ranking>Смотреть рейтинг</button></div>
      </dialog>`;
    pages.appendChild(screen);

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.page = "crown";
    button.innerHTML = "<i aria-hidden=\"true\"></i><span>Игра</span>";
    nav.insertBefore(button, nav.querySelector('[data-page="profile"]'));

    screen.querySelector(".match3-scene").style.setProperty("--match3-bg", `url("${state.config.backgroundImage.replace(/"/g, "%22")}")`);
    document.getElementById("match3Subtitle").textContent = state.config.subtitle;
    bind();
    startRound();
    return true;
  }

  function bind() {
    const screen = root();
    screen.addEventListener("click", async (event) => {
      const cell = event.target.closest("[data-match3-cell]");
      if (cell) return handleCell(Number(cell.dataset.match3Cell));
      const booster = event.target.closest("[data-match3-booster]");
      if (booster) return handleBooster(booster.dataset.match3Booster);
      const tab = event.target.closest("[data-match3-tab]");
      if (tab) {
        state.mobileTab = tab.dataset.match3Tab;
        document.getElementById("match3Layout").dataset.mobileTab = state.mobileTab;
        screen.querySelectorAll("[data-match3-tab]").forEach((item) => item.classList.toggle("active", item === tab));
        return;
      }
      if (event.target.closest("[data-match3-new-round]")) return startRound();
      if (event.target.closest("[data-match3-show-ranking]")) {
        document.getElementById("match3Finish")?.close();
        state.mobileTab = "ranking";
        document.getElementById("match3Layout").dataset.mobileTab = "ranking";
        screen.querySelectorAll("[data-match3-tab]").forEach((item) => item.classList.toggle("active", item.dataset.match3Tab === "ranking"));
      }
    });
  }

  function syncConfig(event) {
    if (event?.detail?.key && event.detail.key !== api.KEYS.config) {
      if (event.detail.key === api.KEYS.scores && state.busy) return;
      renderSide();
      return;
    }
    const previous = state.config;
    state.config = api.config();
    if (state.config.enabled === false) {
      const wasActive = root()?.classList.contains("active");
      root()?.remove();
      document.querySelector('.nav [data-page="crown"]')?.remove();
      if (wasActive) document.querySelector('.nav [data-page="home"]')?.click();
      return;
    }
    if (!root()) {
      mount();
      return;
    }
    const scene = root()?.querySelector(".match3-scene");
    if (scene) scene.style.setProperty("--match3-bg", `url("${state.config.backgroundImage.replace(/"/g, "%22")}")`);
    const subtitle = document.getElementById("match3Subtitle");
    if (subtitle) subtitle.textContent = state.config.subtitle;
    const tilesChanged = JSON.stringify(previous.tiles) !== JSON.stringify(state.config.tiles) || previous.boardSize !== state.config.boardSize;
    if (tilesChanged) startRound();
    else renderAll();
  }

  if (!mount()) {
    window.addEventListener("bali:full-demo-ready", () => mount(), { once: true });
  }
  window.addEventListener("bali:match3-changed", syncConfig);
  window.addEventListener("storage", (event) => {
    if (Object.values(api.KEYS).includes(event.key)) syncConfig({ detail: { key: event.key } });
  });
  const countdownTimer = () => {
    updateCountdown();
    if (document.documentElement.contains(root())) setTimeout(countdownTimer, 30000);
  };
  setTimeout(countdownTimer, 30000);
  window.BaliMatch3UI = { startRound, renderAll, findMatches, findHint, createBoard };
})();
