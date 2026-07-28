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
        <label><span>Бонусы +5 ходов</span><input name="extraMoves" type="number" min="0" max="20" value="${Number(config.boosters.extraMoves || 0)}"></label>
      </div>
      <div class="match3-admin-actions" style="margin-top:12px"><button class="primary" type="submit">Сохранить настройки игры</button><button class="ghost pink" type="button" data-match3-reset-config>Вернуть исходные настройки</button></div>
    </form>`;
  }

  function tileCards(config) {
    return `<form id="match3AdminTiles"><div class="match3-tile-grid">${config.tiles.map((tile) => `
      <article class="match3-tile-card" data-match3-tile="${esc(tile.id)}">
        <img src="${esc(tile.image)}" alt="" data-match3-tile-preview>
        <h4>${esc(tile.name)}</h4>
        <label><span>Название предмета</span><input data-tile-field="name" value="${esc(tile.name)}"></label>
        <label><span>URL или загруженное изображение</span><input data-tile-field="image" value="${esc(tile.image)}"></label>
        <label class="match3-upload">Загрузить изображение<input type="file" accept="image/*" data-match3-tile-upload></label>
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
        const size = 384;
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
      api.saveConfig({
        enabled: event.target.enabled.checked,
        title: data.title.trim(),
        subtitle: data.subtitle.trim(),
        boardSize: Number(data.boardSize),
        startingMoves: Number(data.startingMoves),
        targetScore: Number(data.targetScore),
        resetDay: Number(data.resetDay),
        backgroundImage: data.backgroundImage.trim(),
        rewardImage: data.rewardImage.trim(),
        boosters: {
          bomb: Number(data.bomb),
          shuffle: Number(data.shuffle),
          hint: Number(data.hint),
          extraMoves: Number(data.extraMoves),
        },
      });
      toast("Настройки игры сохранены");
    }
    if (event.target.id === "match3AdminTiles") {
      event.preventDefault();
      const tiles = [...event.target.querySelectorAll("[data-match3-tile]")].map((card) => ({
        id: card.dataset.match3Tile,
        name: card.querySelector('[data-tile-field="name"]').value.trim(),
        image: card.querySelector('[data-tile-field="image"]').value.trim(),
        active: card.querySelector('[data-tile-field="active"]').checked,
      }));
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
        card.querySelector('[data-tile-field="image"]').value = image;
        card.querySelector("[data-match3-tile-preview]").src = image;
        toast("Изображение подготовлено. Нажмите «Сохранить предметы».");
      } catch {
        toast("Не удалось обработать изображение");
      }
      upload.value = "";
      return;
    }
    const imageInput = event.target.closest('[data-tile-field="image"]');
    if (imageInput) imageInput.closest("[data-match3-tile]").querySelector("[data-match3-tile-preview]").src = imageInput.value.trim();
  }, true);

  document.addEventListener("click", (event) => {
    const resetTile = event.target.closest("[data-match3-reset-tile]");
    if (resetTile) {
      const original = api.DEFAULT_TILES.find((tile) => tile.id === resetTile.dataset.match3ResetTile);
      const card = resetTile.closest("[data-match3-tile]");
      if (original && card) {
        card.querySelector('[data-tile-field="name"]').value = original.name;
        card.querySelector('[data-tile-field="image"]').value = original.image;
        card.querySelector('[data-tile-field="active"]').checked = true;
        card.querySelector("[data-match3-tile-preview]").src = original.image;
        card.querySelector("h4").textContent = original.name;
      }
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
