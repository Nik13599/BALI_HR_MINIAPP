(() => {
  "use strict";
  if (window.__BALI_MATCH3_UI__ || !window.BaliMatch3 || !window.BaliMatch3InfiniteEngine) return;
  window.__BALI_MATCH3_UI__ = true;

  const api = window.BaliMatch3;
  const engine = window.BaliMatch3InfiniteEngine;
  const state = {
    config: api.config(),
    attempt: null,
    selected: -1,
    highlighted: new Set(),
    boosterMode: "",
    busy: false,
    message: "Соединяйте предметы по три и выполняйте цели уровня.",
    mobileTab: "game",
  };

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[char]));
  const number = value => Number(value || 0).toLocaleString("ru-RU");
  const initials = name => String(name || "B").trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const root = () => document.querySelector('[data-screen="crown"]');
  const tileIds = () => state.attempt?.tiles?.map(tile => tile.id) || [];
  const tileById = id => state.attempt?.tiles?.find(tile => tile.id === id)
    || state.config.tiles.find(tile => tile.id === id)
    || state.config.tiles[0];
  const safeDialog = (id, open = true) => {
    const dialog = document.getElementById(id);
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  };

  function addMap(target, patch) {
    Object.entries(patch || {}).forEach(([key, value]) => {
      target[key] = Number(target[key] || 0) + Number(value || 0);
    });
  }

  function addMoveResult(result) {
    const attempt = state.attempt;
    attempt.board = result.board;
    attempt.movesRemaining = Math.max(0, Number(attempt.movesRemaining || 0) - 1);
    attempt.score = Number(attempt.score || 0) + Number(result.score || 0);
    attempt.progress.score = attempt.score;
    addMap(attempt.progress.collected, result.collected);
    addMap(attempt.progress.specialsCreated, result.specialsCreated);
    addMap(attempt.progress.specialsActivated, result.specialsActivated);
    attempt.progress.obstaclesDestroyed = Number(attempt.progress.obstaclesDestroyed || 0) + Number(result.obstaclesDestroyed || 0);
    Object.entries(result.breakdown || {}).forEach(([key, value]) => {
      attempt.breakdown[key] = Number(attempt.breakdown[key] || 0) + Number(value || 0);
    });
    attempt.bestCascade = Math.max(Number(attempt.bestCascade || 1), Number(result.bestCascade || 1));
    attempt.events = [...(result.events || []), ...(attempt.events || [])].slice(0, 12);
    api.updateAttempt?.(attempt);
  }

  function goalLabel(goal) {
    if (goal.type === "score") return `Набрать ${number(goal.target)} очков`;
    if (goal.type === "collect") return `Собрать «${tileById(tileIds()[goal.tileIndex] || goal.tileId)?.name || "предмет"}»`;
    if (goal.type === "obstacles") return "Разрушить препятствия";
    if (goal.type === "createSpecial") return `Создать спецфишки: ${goal.special || "любые"}`;
    if (goal.type === "activateSpecial") return `Активировать спецфишки: ${goal.special || "любые"}`;
    return "Выполнить цель";
  }

  function goalStates() {
    return state.attempt ? engine.goalsStatus(state.attempt.config, state.attempt.progress, tileIds()) : [];
  }

  function renderBoard() {
    const board = document.getElementById("match3Board");
    if (!board || !state.attempt) return;
    const level = state.attempt.config;
    board.style.setProperty("--board-columns", level.columns);
    board.style.setProperty("--board-rows", level.rows);
    board.innerHTML = state.attempt.board.map((cell, index) => {
      const tile = tileById(cell.tile);
      const special = cell.special ? `<i class="match3-special-mark" aria-label="${esc(cell.special)}"></i>` : "";
      const obstacle = cell.obstacle ? `<b class="match3-obstacle-mark">${number(cell.obstacle)}</b>` : "";
      const classes = [
        "match3-cell",
        state.selected === index ? "selected" : "",
        state.highlighted.has(index) ? "hint" : "",
        cell.blocked ? "blocked" : "",
        cell.obstacle ? "obstacle" : "",
        cell.special ? `special special-${cell.special}` : "",
      ].filter(Boolean).join(" ");
      return `<button class="${classes}" type="button" data-match3-cell="${index}" ${cell.blocked ? "disabled" : ""}
        aria-label="${esc(tile?.name || "Игровая фишка")}">
        ${cell.blocked ? "<span class=\"match3-blocked-mark\">◆</span>" : `<img src="${esc(tile?.image || tile?.activeAsset || "")}" alt="" draggable="false">${special}${obstacle}`}
      </button>`;
    }).join("");
  }

  function renderAccount() {
    const profile = api.progress();
    const account = document.getElementById("match3Account");
    if (account) account.innerHTML = `
      <span>Уровень <b>${number(profile.seasonLevel)}</b></span>
      <span>Рейтинг <b>${number(profile.seasonRating)}</b></span>
      <span>Bally <b>${number(profile.ballyBalance)}</b></span>
      <span>Жизни <b>${number(profile.lives)}/${number(profile.maximumLives)}</b></span>`;
  }

  function renderGoals() {
    const goals = document.getElementById("match3Goals");
    if (!goals || !state.attempt) return;
    goals.innerHTML = goalStates().map(goal => `
      <article class="${goal.complete ? "complete" : ""}">
        <i>${goal.complete ? "✓" : "◎"}</i>
        <div><strong>${esc(goalLabel(goal))}</strong><span>${number(goal.value)} / ${number(goal.target)}</span></div>
      </article>`).join("");
  }

  function renderEvents() {
    const node = document.getElementById("match3Events");
    if (!node || !state.attempt) return;
    const rows = state.attempt.events || [];
    node.innerHTML = rows.length ? rows.slice(0, 4).map(event => `
      <span>Каскад ×${event.cascade}: +${number(event.points)} · удалено ${number(event.removed)}${event.created ? ` · ${esc(event.created)}` : ""}</span>
    `).join("") : "<span>Здесь появится разбор последних комбинаций.</span>";
  }

  function renderMetrics() {
    const attempt = state.attempt;
    const profile = api.progress();
    const values = {
      match3Score: attempt?.score || 0,
      match3Moves: attempt?.movesRemaining || 0,
      match3Level: attempt?.level || profile.seasonLevel || 1,
      match3Rating: profile.seasonRating || 0,
    };
    Object.entries(values).forEach(([id, value]) => {
      const node = document.getElementById(id);
      if (node) node.textContent = number(value);
    });
    const goals = goalStates();
    const percent = goals.length
      ? goals.reduce((total, goal) => total + Math.min(1, Number(goal.value || 0) / Math.max(1, Number(goal.target || 1))), 0) / goals.length * 100
      : 0;
    const bar = document.getElementById("match3Progress");
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    const message = document.getElementById("match3Message");
    if (message) message.innerHTML = `${esc(state.message)}${state.boosterMode ? " <b>Выберите фишку на поле.</b>" : ""}`;
    document.querySelectorAll("[data-match3-booster]").forEach(button => {
      const type = button.dataset.match3Booster;
      const amount = Number(profile.boosterInventory?.[type] || 0);
      const cost = Number(api.boosterCost?.(type) || 0);
      button.classList.toggle("active", state.boosterMode === type);
      button.disabled = state.busy || !attempt || attempt.status !== "active";
      const count = button.querySelector("strong");
      if (count) count.textContent = amount > 0 ? `×${amount}` : `${number(cost)} Bally`;
    });
    renderAccount();
    renderGoals();
    renderEvents();
  }

  function renderLeaderboard() {
    const list = document.getElementById("match3Ranking");
    if (list) list.innerHTML = api.leaderboard().slice(0, 10).map(row => `
      <article class="match3-rank-row ${row.isMe ? "me" : ""}">
        <strong>${row.position}</strong>
        <span class="match3-rank-avatar">${row.avatar ? `<img src="${esc(row.avatar)}" alt="">` : esc(initials(row.name))}</span>
        <div><h4>${esc(row.name)}</h4><p>Уровень ${number(row.level)} · 3★: ${number(row.threeStars)}${row.isMe ? " · ВЫ" : ""}</p></div>
        <b>${number(row.score)}</b>
      </article>`).join("");
    const clans = document.getElementById("match3ClanRanking");
    if (clans) clans.innerHTML = api.clanLeaderboard().slice(0, 10).map(row => `
      <article class="match3-clan-row ${row.provisional ? "provisional" : ""}">
        <b>${row.position}</b><div><strong>${esc(row.name)}</strong><span>${number(row.active)}/${number(row.members)} активных${row.provisional ? " · вне зачёта" : ""}</span></div>
        <em>${number(row.average)}</em>
      </article>`).join("");
    const task = api.clanTask();
    const taskNode = document.getElementById("match3ClanTask");
    if (taskNode) taskNode.innerHTML = `
      <strong>${esc(task.title)}</strong><span>${number(task.value)} / ${number(task.target)} · лично ${number(task.personal)}</span>
      <div><i style="width:${Math.min(100, task.percent)}%"></i></div>
      <small>${task.eligible ? "Вклад засчитан — награда клана доступна." : "Пройдите минимум уровней для права на сундук."}</small>`;
  }

  function renderRewards() {
    const node = document.getElementById("match3Rewards");
    if (node) node.innerHTML = state.config.rewards.map(reward => `
      <article class="match3-reward-card">
        <img src="${esc(state.config.rewardImage)}" alt="">
        <div><strong>${reward.position} место · ${number(reward.points)} бонусных баллов</strong>
        <p>${esc(reward.reward)} · ${number(reward.xp)} XP${reward.vipPlan ? ` · ${reward.vipPlan.toUpperCase()} ${number(reward.vipDays)} дн.` : ""}</p></div>
      </article>`).join("");
    const history = document.getElementById("match3History");
    if (history) {
      const rows = api.progress().history.filter(row => row.level).slice(0, 8);
      history.innerHTML = rows.length ? rows.map(row => `
        <article class="match3-history-row">
          <div><strong>Уровень ${number(row.level)} · ${"★".repeat(row.stars || 0)}${"☆".repeat(3 - (row.stars || 0))}</strong>
          <span>${row.status === "completed" ? "Пройден" : "Не пройден"} · продолжений ${number(row.continues)}</span></div>
          <b>${number(row.score)}</b><em>+${number(row.seasonalPoints)} рейтинг · +${number(row.ballyAwarded)} Bally</em>
        </article>`).join("") : '<div class="match3-empty">История появится после первого завершённого уровня.</div>';
    }
  }

  function renderAll() {
    renderBoard();
    renderMetrics();
    renderLeaderboard();
    renderRewards();
    const week = api.weekInfo();
    const range = document.getElementById("match3WeekRange");
    if (range) range.textContent = week.label;
    updateCountdown();
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

  async function finishLevel(forcedStatus = "") {
    if (!state.attempt || state.attempt.status !== "active") return;
    let result;
    try {
      result = await Promise.resolve(api.finishLevel(state.attempt, {
        score: state.attempt.score,
        movesRemaining: state.attempt.movesRemaining,
        progress: state.attempt.progress,
        breakdown: state.attempt.breakdown,
        bestCascade: state.attempt.bestCascade,
      }, forcedStatus));
    } catch (error) {
      state.message = error?.message || "Не удалось завершить уровень. Повторите попытку.";
      renderAll();
      return;
    }
    if (!result.ok) return;
    safeDialog("match3Continue", false);
    const record = result.record;
    document.getElementById("match3FinishKicker").textContent = result.success ? "УРОВЕНЬ ПРОЙДЕН" : "ХОДЫ ЗАКОНЧИЛИСЬ";
    document.getElementById("match3FinishTitle").textContent = result.success
      ? `Уровень ${number(record.level)} · ${"★".repeat(record.stars)}${"☆".repeat(3 - record.stars)}`
      : `Уровень ${number(record.level)} не пройден`;
    document.getElementById("match3FinishScore").textContent = number(record.score);
    document.getElementById("match3FinishCopy").innerHTML = result.success
      ? `Рейтинг сезона: <b>+${number(record.seasonalPoints)}</b> · Bally: <b>+${number(record.ballyAwarded)}</b><br>
        Комбинации ${number(record.breakdown.combinations)}, каскады ${number(record.breakdown.cascades)}, спецфишки ${number(record.breakdown.specials)}, цели ${number(record.breakdown.goals)}, остаток ходов ${number(record.breakdown.remainingMoves)}, чистое прохождение ${number(record.breakdown.clean)}.`
      : "Жизнь списана только после неудачного завершения. Можно повторить уровень.";
    const next = document.querySelector("[data-match3-next-level]");
    if (next) next.textContent = result.success ? "Следующий уровень" : "Повторить уровень";
    document.querySelector("[data-match3-restore-one]")?.setAttribute("hidden", "");
    document.querySelector("[data-match3-restore-all]")?.setAttribute("hidden", "");
    renderAll();
    safeDialog("match3Finish");
  }

  function requestContinue() {
    const costs = state.config.economy.continueCosts || [40, 80];
    const cost = Number(costs[state.attempt.continues] || 0);
    if (state.attempt.continues >= costs.length) return finishLevel("failed");
    document.getElementById("match3ContinueCopy").textContent =
      `Добавить ${number(state.config.economy.continueMoves)} ходов за ${number(cost)} Bally? Доступно продолжений: ${number(costs.length - state.attempt.continues)}.`;
    safeDialog("match3Continue");
  }

  async function startLevel() {
    state.config = api.config();
    state.message = "Создаём проверяемый уровень…";
    renderMetrics();
    let started;
    try {
      started = await Promise.resolve(api.startLevel());
    } catch (error) {
      state.attempt = null;
      state.message = error?.message || "Не удалось загрузить уровень.";
      renderAll();
      return;
    }
    safeDialog("match3Finish", false);
    safeDialog("match3Continue", false);
    if (!started.ok) {
      state.attempt = null;
      state.message = "Жизни закончились. Восстановите одну жизнь или весь запас за Bally.";
      renderAll();
      document.getElementById("match3FinishKicker").textContent = "НЕТ ЖИЗНЕЙ";
      document.getElementById("match3FinishTitle").textContent = "Восстановление жизней";
      document.getElementById("match3FinishScore").textContent = number(started.profile?.ballyBalance);
      document.getElementById("match3FinishCopy").textContent = `1 жизнь — ${number(state.config.economy.lifeCost)} Bally, полный запас — ${number(state.config.economy.fullLivesCost)} Bally.`;
      document.querySelector("[data-match3-restore-one]")?.removeAttribute("hidden");
      document.querySelector("[data-match3-restore-all]")?.removeAttribute("hidden");
      document.querySelector("[data-match3-next-level]")?.setAttribute("hidden", "");
      safeDialog("match3Finish");
      return;
    }
    state.attempt = started.attempt;
    document.querySelector("[data-match3-next-level]")?.removeAttribute("hidden");
    state.selected = -1;
    state.highlighted.clear();
    state.boosterMode = "";
    state.busy = false;
    state.message = `Уровень ${number(state.attempt.level)} · сложность ×${Number(state.attempt.config.difficulty).toFixed(2)}.`;
    renderAll();
  }

  async function playSwap(first, second) {
    state.busy = true;
    state.highlighted.clear();
    let result;
    try {
      result = api.playMove
        ? await Promise.resolve(api.playMove(state.attempt, first, second))
        : engine.playMove(state.attempt.board, first, second, state.attempt.config, tileIds());
    } catch (error) {
      state.message = error?.message || "Сервер не подтвердил ход.";
      state.busy = false;
      renderAll();
      return;
    }
    if (!result.valid) {
      state.message = result.reason === "not_adjacent" ? "Менять можно только соседние фишки." : "Этот ход не создаёт комбинацию.";
      state.busy = false;
      return renderAll();
    }
    addMoveResult(result);
    state.message = result.bestCascade > 1
      ? `Каскад ×${number(result.bestCascade)} · +${number(result.score)} очков.`
      : `Комбинация · +${number(result.score)} очков.`;
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.(result.bestCascade > 2 ? "heavy" : "medium");
    } catch {
      // Haptic feedback is optional in browsers and older Telegram clients.
    }
    state.busy = false;
    renderAll();
    if (engine.goalsComplete(state.attempt.config, state.attempt.progress, tileIds())) finishLevel("success");
    else if (state.attempt.movesRemaining <= 0) requestContinue();
  }

  async function useCellBooster(index) {
    const type = state.boosterMode;
    let purchase;
    try {
      purchase = await Promise.resolve(api.useBooster(type, { attempt: state.attempt, index }));
    } catch (error) {
      state.message = error?.message || "Не удалось применить бустер.";
      state.boosterMode = "";
      renderAll();
      return;
    }
    if (!purchase.ok) {
      state.message = "Недостаточно Bally для этого бустера.";
      state.boosterMode = "";
      return renderAll();
    }
    const result = purchase.serverResult
      || engine.applyBooster(state.attempt.board, type, index, state.attempt.config, tileIds());
    state.boosterMode = "";
    if (!result.valid) return;
    state.attempt.board = result.board;
    state.attempt.score += Number(result.score || 0);
    state.attempt.progress.score = state.attempt.score;
    addMap(state.attempt.progress.collected, result.collected);
    state.attempt.progress.obstaclesDestroyed += Number(result.obstaclesDestroyed || 0);
    state.attempt.breakdown.specials += Number(result.score || 0);
    api.updateAttempt(state.attempt);
    state.message = `Бустер удалил ${number(result.cleared)} фишек · +${number(result.score)} очков.`;
    renderAll();
    if (engine.goalsComplete(state.attempt.config, state.attempt.progress, tileIds())) finishLevel("success");
  }

  function handleCell(index) {
    if (state.busy || !state.attempt || state.attempt.status !== "active") return;
    if (state.boosterMode) return useCellBooster(index);
    state.highlighted.clear();
    if (state.selected < 0) {
      state.selected = index;
      state.message = "Выберите соседнюю фишку.";
      return renderAll();
    }
    if (state.selected === index) {
      state.selected = -1;
      state.message = "Выбор отменён.";
      return renderAll();
    }
    const first = state.selected;
    state.selected = -1;
    return playSwap(first, index);
  }

  async function buyBooster(type) {
    try {
      return await Promise.resolve(api.useBooster(type, { attempt: state.attempt }));
    } catch (error) {
      state.message = error?.message || "Не удалось применить бустер.";
      renderAll();
      return { ok: false };
    }
  }

  async function handleBooster(type) {
    if (!state.attempt || state.busy) return;
    if (type === "hint") {
      const purchase = await buyBooster(type);
      if (!purchase.ok) state.message = "Недостаточно Bally для подсказки.";
      else {
        state.highlighted = new Set(
          purchase.serverResult?.hint
          || engine.findHint(state.attempt.board, state.attempt.config.rows, state.attempt.config.columns)
          || []
        );
        state.message = state.highlighted.size ? "Возможный ход подсвечен." : "Доступных ходов нет — используйте перемешивание.";
      }
      return renderAll();
    }
    if (type === "shuffle") {
      const purchase = await buyBooster(type);
      if (!purchase.ok) state.message = "Недостаточно Bally для перемешивания.";
      else {
        state.attempt.shuffleCount = Number(state.attempt.shuffleCount || 0) + 1;
        state.attempt.board = purchase.serverResult?.board || engine.createBoard({
          ...state.attempt.config,
          seed: `${state.attempt.config.seed}:manual:${state.attempt.shuffleCount}`,
        }, tileIds());
        api.updateAttempt(state.attempt);
        state.message = "Поле перемешано, ход не потрачен.";
      }
      return renderAll();
    }
    state.boosterMode = state.boosterMode === type ? "" : type;
    state.message = state.boosterMode ? "Бустер готов." : "Бустер отменён.";
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
      <div class="match3-scene"><div class="match3-shell">
        <header class="match3-topbar">
          <div class="match3-brand"><small>${esc(state.config.subtitle)}</small><h2>BALI <em>Match</em></h2></div>
          <div class="match3-week"><span id="match3WeekRange"></span><strong>${esc(state.config.season.name)}</strong><b id="match3Countdown"></b></div>
        </header>
        <div class="match3-account" id="match3Account"></div>
        <div class="match3-metrics">
          <article class="match3-metric accent"><span>ОЧКИ УРОВНЯ</span><strong id="match3Score">0</strong></article>
          <article class="match3-metric"><span>ХОДЫ</span><strong id="match3Moves">0</strong></article>
          <article class="match3-metric"><span>УРОВЕНЬ</span><strong id="match3Level">1</strong></article>
          <article class="match3-metric"><span>РЕЙТИНГ СЕЗОНА</span><strong id="match3Rating">0</strong></article>
        </div>
        <div class="match3-tabs" role="tablist"><button class="active" data-match3-tab="game" type="button">Игра</button><button data-match3-tab="ranking" type="button">Рейтинги и история</button></div>
        <div class="match3-layout" id="match3Layout" data-mobile-tab="game">
          <div class="match3-game-column">
            <section class="match3-panel neon">
              <div class="match3-panel-head"><div><h3>Бесконечный уровень</h3><span>Каждый уровень создаётся по правилам CRM</span></div><b>LIVE</b></div>
              <div class="match3-goals" id="match3Goals"></div>
              <div class="match3-progress"><i id="match3Progress"></i></div>
              <div class="match3-board" id="match3Board" role="grid" aria-label="Игровое поле BALI Match"></div>
              <div class="match3-booster-grid">
                <button class="match3-booster" data-match3-booster="bomb" type="button"><span>Бомба 3×3</span><strong>0</strong></button>
                <button class="match3-booster" data-match3-booster="shuffle" type="button"><span>Перемешать</span><strong>0</strong></button>
                <button class="match3-booster" data-match3-booster="hint" type="button"><span>Подсказка</span><strong>0</strong></button>
                <button class="match3-booster" data-match3-booster="remove" type="button"><span>Убрать фишку</span><strong>0</strong></button>
                <button class="match3-booster" data-match3-booster="removeType" type="button"><span>Убрать тип</span><strong>0</strong></button>
              </div>
              <div class="match3-message" id="match3Message" aria-live="polite"></div>
              <div class="match3-events" id="match3Events"></div>
            </section>
          </div>
          <aside class="match3-side-column">
            <section class="match3-panel"><div class="match3-panel-head"><div><h3>Личный TOP 10</h3><span>Сумма лучших результатов уровней</span></div><b>СЕЗОН</b></div><div class="match3-rank-list" id="match3Ranking"></div></section>
            <section class="match3-panel"><div class="match3-panel-head"><div><h3>Кланы</h3><span>Средний результат фиксированного состава</span></div></div><div class="match3-clan-list" id="match3ClanRanking"></div><div class="match3-clan-task" id="match3ClanTask"></div></section>
            <section class="match3-panel"><div class="match3-panel-head"><div><h3>История уровней</h3><span>Полный прозрачный расчёт результата</span></div></div><div class="match3-history" id="match3History"></div></section>
            <section class="match3-panel"><div class="match3-panel-head"><div><h3>Награды TOP 10</h3><span>Выдаются после фиксации недели</span></div></div><div class="match3-rewards" id="match3Rewards"></div></section>
          </aside>
        </div>
      </div></div>
      <dialog class="match3-finish" id="match3Continue"><div><span>ПРОДОЛЖИТЬ УРОВЕНЬ</span><h2>Нужно ещё немного?</h2><p id="match3ContinueCopy"></p><button type="button" data-match3-continue>Продолжить за Bally</button><button type="button" data-match3-decline>Завершить уровень</button></div></dialog>
      <dialog class="match3-finish" id="match3Finish"><div><span id="match3FinishKicker">РЕЗУЛЬТАТ</span><h2 id="match3FinishTitle">Уровень завершён</h2><strong id="match3FinishScore">0</strong><p id="match3FinishCopy"></p><button type="button" data-match3-next-level>Следующий уровень</button><button type="button" data-match3-restore-one hidden>Восстановить 1 жизнь</button><button type="button" data-match3-restore-all hidden>Восстановить все жизни</button><button type="button" data-match3-show-ranking>Смотреть рейтинги</button></div></dialog>`;
    pages.appendChild(screen);

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.page = "crown";
    button.innerHTML = '<i aria-hidden="true"></i><span>Игра</span>';
    window.BaliNavIcons?.applyButton?.(button);
    nav.insertBefore(button, nav.querySelector('[data-page="profile"]'));
    screen.querySelector(".match3-scene").style.setProperty("--match3-bg", `url("${String(state.config.backgroundImage).replace(/"/g, "%22")}")`);
    bind();
    startLevel();
    return true;
  }

  function bind() {
    root().addEventListener("click", async event => {
      const cell = event.target.closest("[data-match3-cell]");
      if (cell) return handleCell(Number(cell.dataset.match3Cell));
      const booster = event.target.closest("[data-match3-booster]");
      if (booster) return handleBooster(booster.dataset.match3Booster);
      const tab = event.target.closest("[data-match3-tab]");
      if (tab) {
        state.mobileTab = tab.dataset.match3Tab;
        document.getElementById("match3Layout").dataset.mobileTab = state.mobileTab;
        root().querySelectorAll("[data-match3-tab]").forEach(item => item.classList.toggle("active", item === tab));
      }
      if (event.target.closest("[data-match3-continue]")) {
        const result = await Promise.resolve(api.continueLevel(state.attempt));
        if (result.ok) {
          safeDialog("match3Continue", false);
          state.message = `Добавлено ${number(result.moves)} ходов. Продолжение снижает рейтинг уровня.`;
          renderAll();
        } else state.message = "Недостаточно Bally для продолжения.";
      }
      if (event.target.closest("[data-match3-decline]")) finishLevel("failed");
      if (event.target.closest("[data-match3-next-level]")) startLevel();
      if (event.target.closest("[data-match3-restore-one]")) {
        const result = await Promise.resolve(api.restoreLife(false));
        state.message = result.ok ? "Жизнь восстановлена." : "Недостаточно Bally.";
        startLevel();
      }
      if (event.target.closest("[data-match3-restore-all]")) {
        const result = await Promise.resolve(api.restoreLife(true));
        state.message = result.ok ? "Запас жизней восстановлен." : "Недостаточно Bally.";
        startLevel();
      }
      if (event.target.closest("[data-match3-show-ranking]")) {
        safeDialog("match3Finish", false);
        state.mobileTab = "ranking";
        document.getElementById("match3Layout").dataset.mobileTab = "ranking";
        root().querySelectorAll("[data-match3-tab]").forEach(item => item.classList.toggle("active", item.dataset.match3Tab === "ranking"));
      }
    });
  }

  function syncConfig(event) {
    if (event?.detail?.key && event.detail.key !== api.KEYS.config) return renderAll();
    state.config = api.config();
    if (!root()) return mount();
    root().querySelector(".match3-scene")?.style.setProperty("--match3-bg", `url("${String(state.config.backgroundImage).replace(/"/g, "%22")}")`);
    renderAll();
  }

  if (!mount()) window.addEventListener("bali:full-demo-ready", () => mount(), { once: true });
  window.addEventListener("bali:match3-changed", syncConfig);
  window.addEventListener("storage", event => {
    if (Object.values(api.KEYS || {}).includes(event.key)) syncConfig({ detail: { key: event.key } });
  });
  setInterval(updateCountdown, 30000);
  window.BaliMatch3UI = {
    startLevel,
    renderAll,
    findMatches: board => engine.findMatchGroups(board || state.attempt?.board || [], state.attempt?.config.rows || 6, state.attempt?.config.columns || 6),
    findHint: board => engine.findHint(board || state.attempt?.board || [], state.attempt?.config.rows || 6, state.attempt?.config.columns || 6),
    createBoard: () => state.attempt?.board || [],
  };
})();
