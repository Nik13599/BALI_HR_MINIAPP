(() => {
  if (window.__BALI_ADMIN_MATCH3__ || !window.BaliMatch3) return;
  window.__BALI_ADMIN_MATCH3__ = true;

  const api = window.BaliMatch3;
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[char]));
  const number = (value) => Number(value || 0).toLocaleString("ru-RU");
  const navButton = document.querySelector('#adminNav [data-view="crown"]');
  if (navButton) navButton.innerHTML = '◆ <span>Игра 3 в ряд</span>';

  function configForm(config) {
    return `<form id="match3AdminConfig">
      <div class="match3-admin-form">
        <label class="match3-admin-switch"><span>Игра включена</span><input name="enabled" type="checkbox" ${config.enabled !== false ? "checked" : ""}></label>
        <label class="wide"><span>Название сезона</span><input name="seasonName" value="${esc(config.season.name)}"></label>
        <label class="wide"><span>Описание сезона</span><input name="seasonDescription" value="${esc(config.season.description)}"></label>
        <label><span>Размер поля</span><select name="boardSize">${[6, 7, 8].map((size) => `<option value="${size}" ${size === config.boardSize ? "selected" : ""}>${size} × ${size}</option>`).join("")}</select></label>
        <label><span>Ходов в раунде</span><input name="startingMoves" type="number" min="5" max="99" value="${config.startingMoves}"></label>
        <label><span>Цель раунда</span><input name="targetScore" type="number" min="1000" step="500" value="${config.targetScore}"></label>
        <label class="wide"><span>Название</span><input name="title" value="${esc(config.title)}"></label>
        <label class="wide"><span>Подзаголовок</span><input name="subtitle" value="${esc(config.subtitle)}"></label>
        <label class="wide"><span>Фоновое изображение</span><input name="backgroundImage" value="${esc(config.backgroundImage)}"></label>
        <label class="wide"><span>Изображение награды</span><input name="rewardImage" value="${esc(config.rewardImage)}"></label>
        <label><span>День обновления недели</span><select name="resetDay">${["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"].map((day, index) => `<option value="${index}" ${index === config.resetDay ? "selected" : ""}>${day}</option>`).join("")}</select></label>
        <label><span>Бомбы на раунд</span><input name="bomb" type="number" min="0" max="20" value="${Number(config.boosters.bomb || 0)}"></label>
        <label><span>Перемешивания</span><input name="shuffle" type="number" min="0" max="20" value="${Number(config.boosters.shuffle || 0)}"></label>
        <label><span>Подсказки</span><input name="hint" type="number" min="0" max="20" value="${Number(config.boosters.hint || 0)}"></label>
        <label><span>Удаления одной фишки</span><input name="remove" type="number" min="0" max="20" value="${Number(config.boosters.remove || 0)}"></label>
        <label><span>Удаления типа фишек</span><input name="removeType" type="number" min="0" max="20" value="${Number(config.boosters.removeType || 0)}"></label>
      </div>
      <details class="match3-admin-details" open><summary>Генератор бесконечных уровней</summary><div class="match3-admin-form">
        <label><span>Строк поля (5–10)</span><input name="rows" type="number" min="5" max="10" value="${config.levelRules.rows}"></label>
        <label><span>Колонок поля (5–10)</span><input name="columns" type="number" min="5" max="10" value="${config.levelRules.columns}"></label>
        <label><span>Минимум типов фишек</span><input name="minTileTypes" type="number" min="5" max="8" value="${config.levelRules.minTileTypes}"></label>
        <label><span>Максимум типов фишек</span><input name="maxTileTypes" type="number" min="5" max="8" value="${config.levelRules.maxTileTypes}"></label>
        <label><span>Базовые ходы</span><input name="baseMoves" type="number" min="5" max="99" value="${config.levelRules.baseMoves}"></label>
        <label><span>Минимум ходов</span><input name="minMoves" type="number" min="5" max="99" value="${config.levelRules.minMoves}"></label>
        <label><span>Базовая цель очков</span><input name="baseTargetScore" type="number" min="500" step="100" value="${config.levelRules.baseTargetScore}"></label>
        <label><span>Коэффициент √ уровня</span><input name="sqrtDifficulty" type="number" min="0" max="1" step="0.001" value="${config.levelRules.sqrtDifficulty}"></label>
        <label><span>Линейный коэффициент</span><input name="linearDifficulty" type="number" min="0" max="1" step="0.001" value="${config.levelRules.linearDifficulty}"></label>
        <label><span>Максимум целей</span><input name="maxGoals" type="number" min="1" max="5" value="${config.levelRules.maxGoals}"></label>
        <label><span>Контрольная точка каждые</span><input name="checkpointEvery" type="number" min="1" max="100" value="${config.levelRules.checkpointEvery}"></label>
        <label><span>Многоэтапный уровень каждые</span><input name="milestoneEvery" type="number" min="1" max="100" value="${config.levelRules.milestoneEvery}"></label>
        <label><span>Спецфишки с уровня</span><input name="specialStartLevel" type="number" min="1" value="${config.levelRules.specialStartLevel}"></label>
        <label><span>Препятствия с уровня</span><input name="obstacleStartLevel" type="number" min="1" value="${config.levelRules.obstacleStartLevel}"></label>
        <label><span>Макс. доля блоков</span><input name="blockedChanceMax" type="number" min="0" max=".5" step=".01" value="${config.levelRules.blockedChanceMax}"></label>
        <label><span>Макс. доля препятствий</span><input name="obstacleChanceMax" type="number" min="0" max=".8" step=".01" value="${config.levelRules.obstacleChanceMax}"></label>
      </div></details>
      <details class="match3-admin-details"><summary>Очки, звёзды и сезонный рейтинг</summary><div class="match3-admin-form">
        ${[
          ["baseTile", "Очков за фишку"], ["combo3", "Коэффициент 3"], ["combo4", "Коэффициент 4"],
          ["combo5", "Коэффициент 5"], ["combo6", "Коэффициент 6+"], ["comboTL", "Коэффициент T/L"],
          ["cascadeStep", "Шаг каскада"], ["maxCascade", "Макс. множитель каскада"],
          ["lineCreate", "Создание линии"], ["bombCreate", "Создание бомбы"], ["rainbowCreate", "Создание радуги"],
          ["lineActivate", "Активация линии"], ["bombActivate", "Активация бомбы"], ["rainbowActivate", "Активация радуги"],
          ["obstacleLayer", "Слой препятствия"], ["goalComplete", "Завершение цели"], ["allGoalsBase", "Все цели"],
          ["remainingMove", "Оставшийся ход"], ["cleanMultiplier", "Чистое прохождение"], ["star2", "Порог 2★"], ["star3", "Порог 3★"],
        ].map(([key, label]) => `<label><span>${label}</span><input name="scoring_${key}" type="number" min="0" step=".01" value="${config.scoringRules[key]}"></label>`).join("")}
        ${[
          ["base", "База рейтинга"], ["levelLog", "Логарифм уровня"], ["star1", "Коэфф. 1★"], ["star2", "Коэфф. 2★"],
          ["star3", "Коэфф. 3★"], ["continue0", "Без продолжения"], ["continue1", "1 продолжение"], ["continue2", "2 продолжения"],
        ].map(([key, label]) => `<label><span>${label}</span><input name="rating_${key}" type="number" min="0" step=".01" value="${config.ratingRules[key]}"></label>`).join("")}
      </div></details>
      <details class="match3-admin-details"><summary>Bally, бустеры, продолжения и жизни</summary><div class="match3-admin-form">
        <label><span>Первое прохождение</span><input name="firstCompletion" type="number" min="0" value="${config.economy.firstCompletion}"></label>
        <label><span>Чистое прохождение</span><input name="cleanCompletion" type="number" min="0" value="${config.economy.cleanCompletion}"></label>
        <label><span>Bally за 1★</span><input name="starReward1" type="number" min="0" value="${config.economy.starRewards[1]}"></label>
        <label><span>Bally за 2★</span><input name="starReward2" type="number" min="0" value="${config.economy.starRewards[2]}"></label>
        <label><span>Bally за 3★</span><input name="starReward3" type="number" min="0" value="${config.economy.starRewards[3]}"></label>
        <label><span>Ходов за продолжение</span><input name="continueMoves" type="number" min="1" value="${config.economy.continueMoves}"></label>
        <label><span>Цена 1-го продолжения</span><input name="continueCost1" type="number" min="0" value="${config.economy.continueCosts[0]}"></label>
        <label><span>Цена 2-го продолжения</span><input name="continueCost2" type="number" min="0" value="${config.economy.continueCosts[1]}"></label>
        ${["shuffle", "hint", "bomb", "remove", "removeType"].map(key => `<label><span>Цена бустера ${key}</span><input name="booster_${key}" type="number" min="0" value="${config.economy.boosterCosts[key]}"></label>`).join("")}
        <label><span>Максимум жизней</span><input name="maximumLives" type="number" min="1" max="20" value="${config.lives.maximum}"></label>
        <label><span>Восстановление, минут</span><input name="restoreMinutes" type="number" min="1" value="${config.lives.restoreMinutes}"></label>
        <label><span>Цена одной жизни</span><input name="lifeCost" type="number" min="0" value="${config.economy.lifeCost}"></label>
        <label><span>Цена полного запаса</span><input name="fullLivesCost" type="number" min="0" value="${config.economy.fullLivesCost}"></label>
      </div></details>
      <details class="match3-admin-details"><summary>Честное клановое соревнование</summary><div class="match3-admin-form">
        <label><span>Минимум участников</span><input name="minimumMembers" type="number" min="2" value="${config.clanRules.minimumMembers}"></label>
        <label><span>Максимум участников</span><input name="maximumMembers" type="number" min="2" value="${config.clanRules.maximumMembers}"></label>
        <label><span>Блокировка перехода, часов</span><input name="transitionLockHours" type="number" min="0" value="${config.clanRules.transitionLockHours}"></label>
        <label><span>Лимит бонуса задач</span><input name="taskRatingBonusLimit" type="number" min="0" max=".5" step=".01" value="${config.clanRules.taskRatingBonusLimit}"></label>
        <label><span>Уровней для сундука</span><input name="minimumLevelsForChest" type="number" min="1" value="${config.clanRules.minimumLevelsForChest}"></label>
        <label><span>Лучших раундов в сезон</span><input name="bestClanRounds" type="number" min="1" value="${config.season.bestClanRounds}"></label>
        <label class="match3-admin-switch"><span>Заморозить сезон</span><input name="seasonFrozen" type="checkbox" ${config.season.frozen ? "checked" : ""}></label>
      </div></details>
      <div class="match3-admin-actions" style="margin-top:12px"><button class="primary" type="submit">Сохранить настройки игры</button><button class="ghost pink" type="button" data-match3-reset-config>Вернуть исходные настройки</button></div>
    </form>`;
  }

  function tileCards(config) {
    return `<form id="match3AdminTiles"><div class="match3-tile-grid">${config.tiles.map((tile) => `
      <article class="match3-tile-card" data-match3-tile="${esc(tile.id)}">
        <img src="${esc(tile.activeAsset || tile.image)}" alt="" data-match3-tile-preview>
        <h4>${esc(tile.name)}</h4>
        <p class="match3-image-size">Исходный размер: 512 × 512 px · WebP/PNG/JPG · квадрат</p>
        <label><span>Название предмета</span><input data-tile-field="name" value="${esc(tile.name)}"></label>
        <label><span>Оригинал</span><input data-tile-field="originalAsset" value="${esc(tile.originalAsset || tile.image)}" readonly></label>
        <label><span>Активное изображение</span><input data-tile-field="activeAsset" value="${esc(tile.activeAsset || tile.image)}"></label>
        <label><span>Последнее пользовательское</span><input data-tile-field="customAsset" value="${esc(tile.customAsset || "")}" readonly></label>
        <label class="match3-upload">Загрузить изображение<input type="file" accept="image/*" data-match3-tile-upload></label>
        <details><summary>История изображений (${tile.versions?.length || 0})</summary><div class="match3-tile-versions">${(tile.versions || []).slice(0, 5).map((version, index) => `<button type="button" class="ghost compact" data-match3-tile-version="${index}" data-version-src="${esc(version.image || version)}">${new Date(version.createdAt || Date.now()).toLocaleDateString("ru-RU")}</button>`).join("") || "<small>Пока нет сохранённых версий</small>"}</div></details>
        <div class="match3-tile-controls"><label><input data-tile-field="active" type="checkbox" ${tile.active !== false ? "checked" : ""}> Активен</label><button class="ghost compact" type="button" data-match3-reset-tile="${esc(tile.id)}">Вернуть</button></div>
      </article>`).join("")}</div>
      <div class="match3-admin-actions" style="margin-top:12px"><button class="primary" type="submit">Сохранить предметы</button><button class="ghost pink" type="button" data-match3-reset-tiles>Вернуть все исходные предметы</button></div>
    </form>`;
  }

  function rewardsTable(config) {
    const plans = [
      ["", "Без VIP"],
      ["vip", "BALI VIP"],
      ["black", "BALI BLACK"],
      ["legend", "BALI LEGEND"],
    ];
    return `<form id="match3AdminRewards"><div class="match3-reward-scroll"><table class="match3-reward-table"><thead><tr><th>Место</th><th>Баллы</th><th>XP</th><th>Название награды</th><th>VIP-статус</th><th>Дней VIP</th></tr></thead><tbody>${config.rewards.map((reward) => `<tr data-match3-reward="${reward.position}">
      <td>${reward.position}</td>
      <td><input class="short" data-reward-field="points" type="number" min="0" value="${reward.points}"></td>
      <td><input class="short" data-reward-field="xp" type="number" min="0" value="${reward.xp}"></td>
      <td><input data-reward-field="reward" value="${esc(reward.reward)}"></td>
      <td><select data-reward-field="vipPlan">${plans.map(([value, label]) => `<option value="${value}" ${value === reward.vipPlan ? "selected" : ""}>${label}</option>`).join("")}</select></td>
      <td><input class="short" data-reward-field="vipDays" type="number" min="0" max="365" value="${reward.vipDays}"></td>
    </tr>`).join("")}</tbody></table></div>
      <div class="match3-admin-actions" style="margin-top:12px"><button class="primary" type="submit">Сохранить награды TOP 10</button><button class="ghost pink" type="button" data-match3-reset-rewards>Вернуть исходные награды</button></div>
    </form>`;
  }

  function rankingRows() {
    return api.leaderboard().slice(0, 20).map((row) => `<article class="match3-admin-rank ${row.isMe ? "me" : ""}">
      <strong>${row.position}</strong>
      <div><h4>${esc(row.name)}${row.isMe ? " · текущий профиль" : ""}</h4><p>${row.attempts} игр · лучший комбо ×${row.bestCombo || 1}</p></div>
      <b>${number(row.score)}</b>
      <small>${new Date(row.updatedAt).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</small>
    </article>`).join("");
  }

  function renderMatch3(root) {
    const config = api.config();
    const week = api.weekInfo();
    const rows = api.leaderboard();
    const grants = api.grants().filter((item) => item.weekId === week.id);
    document.getElementById("pageTitle").textContent = "Игра 3 в ряд";
    document.getElementById("primaryAction").style.display = "none";
    root.innerHTML = `<div class="admin-match3">
      <div class="match3-admin-summary">
        <article><span>НЕДЕЛЯ</span><strong>${esc(week.label)}</strong></article>
        <article><span>ИГРОКОВ</span><strong>${rows.length}</strong></article>
        <article><span>ЛУЧШИЙ СЧЁТ</span><strong>${number(rows[0]?.score || 0)}</strong></article>
        <article><span>ВЫДАНО ПРИЗОВ</span><strong>${grants.length}</strong></article>
      </div>
      <section class="panel"><div class="panel-head"><div><h3>Основные настройки</h3><small>Поле, количество ходов, цель, усилители и оформление</small></div></div><div class="panel-body">${configForm(config)}</div></section>
      <section class="panel"><div class="panel-head"><div><h3>Игровые предметы</h3><small>Предметы с референса установлены по умолчанию. Можно заменить каждый URL или загрузить свою картинку.</small></div></div><div class="panel-body">${tileCards(config)}</div></section>
      <section class="panel"><div class="panel-head"><div><h3>Награды недельного TOP 10</h3><small>Для каждого места отдельно настраиваются BALI-Баллы, XP, награда и VIP-статус.</small></div></div><div class="panel-body">${rewardsTable(config)}</div></section>
      <section class="panel"><div class="panel-head"><div><h3>Текущий недельный рейтинг</h3><small>${esc(week.label)} · лучший результат каждого пользователя</small></div><div class="match3-admin-actions"><button class="primary compact" data-match3-finalize-week>Завершить неделю и выдать призы</button><button class="danger compact" data-match3-reset-week>Сбросить рейтинг недели</button></div></div><div class="panel-body"><div class="match3-admin-note">При завершении недели призы выдаются первым десяти участникам. Повторное нажатие безопасно: уже выданные призы не дублируются.</div><div class="match3-admin-ranking" style="margin-top:10px">${rankingRows()}</div></div></section>
    </div>`;
  }

  const baseRender = window.render;
  window.render = async function match3AdminRender() {
    if (typeof state !== "undefined" && state.view === "crown") {
      renderMatch3(document.getElementById("content"));
      return;
    }
    return baseRender.apply(this, arguments);
  };

  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        const size = 512;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const context = canvas.getContext("2d");
        const scale = Math.max(size / image.width, size / image.height);
        const width = image.width * scale, height = image.height * scale;
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/webp", .84));
      };
      image.onerror = reject;
      image.src = url;
    });
  }

  document.addEventListener("submit", (event) => {
    if (event.target.id === "match3AdminConfig") {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.target).entries());
      const numeric = name => Number(data[name]);
      const scoringRules = Object.fromEntries([...event.target.elements]
        .filter(input => input.name?.startsWith("scoring_"))
        .map(input => [input.name.replace("scoring_", ""), Number(input.value)]));
      const ratingRules = Object.fromEntries([...event.target.elements]
        .filter(input => input.name?.startsWith("rating_"))
        .map(input => [input.name.replace("rating_", ""), Number(input.value)]));
      api.saveConfig({
        enabled: event.target.enabled.checked,
        title: data.title.trim(),
        subtitle: data.subtitle.trim(),
        boardSize: numeric("rows"),
        startingMoves: numeric("baseMoves"),
        targetScore: numeric("baseTargetScore"),
        resetDay: numeric("resetDay"),
        backgroundImage: data.backgroundImage.trim(),
        rewardImage: data.rewardImage.trim(),
        levelRules: {
          rows: numeric("rows"), columns: numeric("columns"),
          minTileTypes: numeric("minTileTypes"), maxTileTypes: numeric("maxTileTypes"),
          baseMoves: numeric("baseMoves"), minMoves: numeric("minMoves"),
          baseTargetScore: numeric("baseTargetScore"),
          sqrtDifficulty: numeric("sqrtDifficulty"), linearDifficulty: numeric("linearDifficulty"),
          maxGoals: numeric("maxGoals"), checkpointEvery: numeric("checkpointEvery"),
          milestoneEvery: numeric("milestoneEvery"), specialStartLevel: numeric("specialStartLevel"),
          obstacleStartLevel: numeric("obstacleStartLevel"),
          blockedChanceMax: numeric("blockedChanceMax"), obstacleChanceMax: numeric("obstacleChanceMax"),
        },
        scoringRules,
        ratingRules,
        economy: {
          firstCompletion: numeric("firstCompletion"), cleanCompletion: numeric("cleanCompletion"),
          starRewards: [0, numeric("starReward1"), numeric("starReward2"), numeric("starReward3")],
          continueMoves: numeric("continueMoves"),
          continueCosts: [numeric("continueCost1"), numeric("continueCost2")],
          boosterCosts: {
            shuffle: numeric("booster_shuffle"), hint: numeric("booster_hint"), bomb: numeric("booster_bomb"),
            remove: numeric("booster_remove"), removeType: numeric("booster_removeType"),
          },
          lifeCost: numeric("lifeCost"), fullLivesCost: numeric("fullLivesCost"),
        },
        lives: { maximum: numeric("maximumLives"), restoreMinutes: numeric("restoreMinutes") },
        season: {
          name: data.seasonName.trim(), description: data.seasonDescription.trim(),
          frozen: event.target.seasonFrozen.checked, bestClanRounds: numeric("bestClanRounds"),
        },
        clanRules: {
          minimumMembers: numeric("minimumMembers"), maximumMembers: numeric("maximumMembers"),
          transitionLockHours: numeric("transitionLockHours"),
          taskRatingBonusLimit: numeric("taskRatingBonusLimit"),
          minimumLevelsForChest: numeric("minimumLevelsForChest"),
        },
        boosters: {
          bomb: numeric("bomb"), shuffle: numeric("shuffle"), hint: numeric("hint"),
          remove: numeric("remove"), removeType: numeric("removeType"),
        },
      });
      toast("Настройки игры сохранены");
    }
    if (event.target.id === "match3AdminTiles") {
      event.preventDefault();
      const current = api.config();
      const tiles = [...event.target.querySelectorAll("[data-match3-tile]")].map((card) => {
        const previous = current.tiles.find(tile => tile.id === card.dataset.match3Tile) || {};
        const activeAsset = card.querySelector('[data-tile-field="activeAsset"]').value.trim();
        const versions = [...(previous.versions || [])];
        if (activeAsset && activeAsset !== previous.activeAsset) {
          versions.unshift({ image: activeAsset, createdAt: new Date().toISOString() });
        }
        return {
          id: card.dataset.match3Tile,
          name: card.querySelector('[data-tile-field="name"]').value.trim(),
          image: activeAsset,
          originalAsset: card.querySelector('[data-tile-field="originalAsset"]').value.trim(),
          activeAsset,
          customAsset: card.querySelector('[data-tile-field="customAsset"]').value.trim(),
          versions: versions.slice(0, 20),
          active: card.querySelector('[data-tile-field="active"]').checked,
        };
      });
      if (tiles.filter((tile) => tile.active && tile.image).length < 5) {
        toast("Оставьте активными минимум 5 предметов");
        return;
      }
      api.saveConfig({ tiles });
      toast("Игровые предметы сохранены");
    }
    if (event.target.id === "match3AdminRewards") {
      event.preventDefault();
      const rewards = [...event.target.querySelectorAll("[data-match3-reward]")].map((row) => ({
        position: Number(row.dataset.match3Reward),
        points: Number(row.querySelector('[data-reward-field="points"]').value),
        xp: Number(row.querySelector('[data-reward-field="xp"]').value),
        reward: row.querySelector('[data-reward-field="reward"]').value.trim(),
        vipPlan: row.querySelector('[data-reward-field="vipPlan"]').value,
        vipDays: Number(row.querySelector('[data-reward-field="vipDays"]').value),
      }));
      api.saveConfig({ rewards });
      toast("Награды TOP 10 сохранены");
    }
  }, true);

  document.addEventListener("change", async (event) => {
    const upload = event.target.closest("[data-match3-tile-upload]");
    if (upload && upload.files?.[0]) {
      try {
        const image = await resizeImage(upload.files[0]);
        const card = upload.closest("[data-match3-tile]");
        card.querySelector('[data-tile-field="activeAsset"]').value = image;
        card.querySelector('[data-tile-field="customAsset"]').value = image;
        card.querySelector("[data-match3-tile-preview]").src = image;
        toast("Изображение подготовлено. Нажмите «Сохранить предметы».");
      } catch {
        toast("Не удалось обработать изображение");
      }
      upload.value = "";
      return;
    }
    const imageInput = event.target.closest('[data-tile-field="activeAsset"]');
    if (imageInput) imageInput.closest("[data-match3-tile]").querySelector("[data-match3-tile-preview]").src = imageInput.value.trim();
  }, true);

  document.addEventListener("click", (event) => {
    const resetTile = event.target.closest("[data-match3-reset-tile]");
    if (resetTile) {
      const original = api.DEFAULT_TILES.find((tile) => tile.id === resetTile.dataset.match3ResetTile);
      const card = resetTile.closest("[data-match3-tile]");
      if (original && card) {
        card.querySelector('[data-tile-field="name"]').value = original.name;
        card.querySelector('[data-tile-field="originalAsset"]').value = original.originalAsset || original.image;
        card.querySelector('[data-tile-field="activeAsset"]').value = original.originalAsset || original.image;
        card.querySelector('[data-tile-field="customAsset"]').value = "";
        card.querySelector('[data-tile-field="active"]').checked = true;
        card.querySelector("[data-match3-tile-preview]").src = original.image;
        card.querySelector("h4").textContent = original.name;
      }
      return;
    }
    const versionButton = event.target.closest("[data-match3-tile-version]");
    if (versionButton) {
      const card = versionButton.closest("[data-match3-tile]");
      const source = versionButton.dataset.versionSrc;
      card.querySelector('[data-tile-field="activeAsset"]').value = source;
      card.querySelector('[data-tile-field="customAsset"]').value = source;
      card.querySelector("[data-match3-tile-preview]").src = source;
      toast("Выбрана сохранённая версия. Нажмите «Сохранить предметы».");
      return;
    }
    if (event.target.closest("[data-match3-reset-tiles]")) {
      api.resetTiles();
      toast("Исходные предметы восстановлены");
      return;
    }
    if (event.target.closest("[data-match3-reset-rewards]")) {
      api.resetRewards();
      toast("Исходные награды восстановлены");
      return;
    }
    if (event.target.closest("[data-match3-reset-config]")) {
      api.write(api.KEYS.config, {});
      toast("Исходные настройки игры восстановлены");
      return;
    }
    if (event.target.closest("[data-match3-finalize-week]")) {
      if (!confirm("Завершить текущую неделю и выдать настроенные призы участникам TOP 10?")) return;
      const rows = api.finalizeWeek();
      toast(rows.length ? `Выдано призов: ${rows.length}` : "Все призы этой недели уже выданы");
      return;
    }
    if (event.target.closest("[data-match3-reset-week]")) {
      if (!confirm("Сбросить результаты текущей недели и восстановить демонстрационный рейтинг?")) return;
      api.resetCurrentWeek();
      toast("Рейтинг текущей недели сброшен");
    }
  }, true);

  window.addEventListener("bali:match3-changed", () => {
    if (typeof state !== "undefined" && state.view === "crown") render();
  });
  window.addEventListener("storage", (event) => {
    if (Object.values(api.KEYS).includes(event.key) && typeof state !== "undefined" && state.view === "crown") render();
  });

  window.BaliAdminMatch3 = { render: renderMatch3, resizeImage };
})();
