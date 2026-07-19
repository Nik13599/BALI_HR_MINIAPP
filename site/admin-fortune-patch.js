(() => {
  const fortune = window.BaliFortune;
  if (!fortune) return;

  titles.fortune = "Колесо фортуны";

  const bookingsButton = document.querySelector('#adminNav button[data-view="bookings"]');
  if (bookingsButton && !document.querySelector('#adminNav button[data-view="fortune"]')) {
    bookingsButton.insertAdjacentHTML("afterend", '<button data-view="fortune">◉ <span>Колесо фортуны</span></button>');
  }

  const baseRender = render;
  render = async function() {
    if (state.view !== "fortune") return baseRender();
    $("#pageTitle").textContent = titles.fortune;
    const action = $("#primaryAction");
    action.style.display = "inline-flex";
    action.textContent = "Создать коды";
    const content = $("#content");
    content.innerHTML = '<div class="empty">Загрузка…</div>';
    try {
      await renderFortune(content);
    } catch (error) {
      content.innerHTML = `<div class="panel"><div class="empty">Ошибка загрузки: ${esc(error.message)}</div></div>`;
    }
  };

  $("#primaryAction").addEventListener("click", () => {
    if (state.view !== "fortune") return;
    document.getElementById("fortuneCodeCount")?.focus();
    document.getElementById("fortuneGenerator")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  function codeStatus(row) {
    if (row.status === "active" && row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return "expired";
    return row.status || "active";
  }

  function codeStatusLabel(status) {
    return ({
      active: "Активен",
      used: "Использован",
      revoked: "Отменён",
      expired: "Истёк"
    })[status] || status;
  }

  function dateTime(value) {
    if (!value) return "без срока";
    return new Date(value).toLocaleString("ru-RU", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
  }

  function codeLine(row) {
    const status = codeStatus(row);
    return `
      <div class="fortune-code-line" data-code-row="${row.id}">
        <div class="fortune-code-value">${esc(row.code)}</div>
        <div>
          <span class="status ${status === "active" ? "confirmed" : status === "used" ? "seated" : "cancelled"}">${codeStatusLabel(status)}</span>
          <div class="fortune-line-meta">${status === "used" ? `Приз: ${esc(row.prize_name || "—")} · ${dateTime(row.used_at)}` : `Действует: ${dateTime(row.expires_at)}`}</div>
        </div>
        <button class="icon-btn" type="button" data-copy-fortune="${esc(row.code)}" title="Скопировать">⧉</button>
        ${status === "active" ? `<button class="icon-btn" type="button" data-revoke-fortune="${row.id}" title="Отменить код">×</button>` : "<span></span>"}
      </div>`;
  }

  function prizeLine(row) {
    return `
      <div class="fortune-prize-line" data-prize-row="${row.id}">
        <input data-prize-name value="${esc(row.name)}" aria-label="Название приза"/>
        <input data-prize-weight type="number" min="0.01" step="0.01" value="${Number(row.weight || 1)}" aria-label="Вес шанса"/>
        <label class="fortune-inline-check"><input data-prize-active type="checkbox" ${row.active !== false ? "checked" : ""}/>Активен</label>
        <div class="fortune-row-actions">
          <button class="icon-btn" type="button" data-save-prize="${row.id}" title="Сохранить">✓</button>
          <button class="icon-btn" type="button" data-delete-prize="${row.id}" title="Удалить">×</button>
        </div>
      </div>`;
  }

  function spinLine(row) {
    return `
      <div class="fortune-spin-line">
        <div class="fortune-code-value">${esc(row.code || "—")}</div>
        <div><strong>${esc(row.prize_name || "—")}</strong><div class="fortune-line-meta">Выпавший приз</div></div>
        <div class="fortune-line-meta">${row.telegram_id ? `Telegram ID: ${esc(row.telegram_id)}` : "Без Telegram ID"}</div>
        <div class="fortune-line-meta">${dateTime(row.spun_at)}</div>
      </div>`;
  }

  async function renderFortune(root) {
    const [prizes, codes, spins] = await Promise.all([
      fortune.listPrizes(true),
      fortune.listCodes(),
      fortune.listSpins()
    ]);
    const activeCodes = codes.filter((row) => codeStatus(row) === "active").length;
    const usedCodes = codes.filter((row) => codeStatus(row) === "used").length;

    root.innerHTML = `
      <div class="stats">
        <article class="stat-card"><span>АКТИВНЫХ КОДОВ</span><strong>${activeCodes}</strong><em>готовы к выдаче</em></article>
        <article class="stat-card"><span>ИСПОЛЬЗОВАНО</span><strong>${usedCodes}</strong><em>одноразовые коды</em></article>
        <article class="stat-card"><span>ВРАЩЕНИЙ</span><strong>${spins.length}</strong><em>журнал результатов</em></article>
        <article class="stat-card"><span>ПРИЗОВ</span><strong>${prizes.filter((row) => row.active !== false).length}</strong><em>активные сектора</em></article>
      </div>

      <div class="fortune-admin-grid">
        <section class="panel" id="fortuneGenerator">
          <div class="panel-head"><div><h3>Коды после оплаты</h3><small>Бармен создаёт код и передаёт его гостю. Каждый код работает один раз.</small></div></div>
          <div class="panel-body">
            <form id="fortuneGenerateForm" class="fortune-form-row">
              <label><span>Количество</span><select id="fortuneCodeCount" name="count"><option>1</option><option>5</option><option>10</option><option>25</option></select></label>
              <label><span>Срок действия</span><input name="expires_at" type="datetime-local"/></label>
              <button class="primary compact" type="submit">Создать коды</button>
            </form>
            <p class="hall-plan-note">Код можно скопировать кнопкой ⧉ и показать или отправить гостю после оплаты.</p>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><div><h3>Добавить приз</h3><small>Вес определяет относительную вероятность выпадения.</small></div></div>
          <div class="panel-body">
            <form id="fortunePrizeCreateForm" class="fortune-form-row">
              <label><span>Название</span><input name="name" placeholder="Например, коктейль" required/></label>
              <label><span>Вес шанса</span><input name="weight" type="number" min="0.01" step="0.01" value="1" required/></label>
              <button class="primary compact" type="submit">Добавить</button>
            </form>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><div><h3>Выданные коды</h3><small>${codes.length} всего</small></div></div>
          <div class="panel-body fortune-code-list">${codes.length ? codes.slice(0, 100).map(codeLine).join("") : '<div class="empty">Коды ещё не создавались</div>'}</div>
        </section>

        <section class="panel">
          <div class="panel-head"><div><h3>Сектора колеса</h3><small>Название, вес вероятности и статус</small></div></div>
          <div class="panel-body fortune-prize-list">${prizes.length ? prizes.map(prizeLine).join("") : '<div class="empty">Добавьте первый приз</div>'}</div>
        </section>

        <section class="panel full">
          <div class="panel-head"><div><h3>Журнал вращений</h3><small>Код, выпавший приз и время</small></div></div>
          <div class="panel-body fortune-spin-list">${spins.length ? spins.slice(0, 200).map(spinLine).join("") : '<div class="empty">Вращений пока нет</div>'}</div>
        </section>
      </div>`;
  }

  $("#content").addEventListener("submit", async (event) => {
    if (event.target.id === "fortuneGenerateForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const expiresValue = form.get("expires_at");
      try {
        const created = await fortune.generateCodes(
          Number(form.get("count") || 1),
          expiresValue ? new Date(expiresValue).toISOString() : null
        );
        await navigator.clipboard?.writeText(created.map((row) => row.code).join("\n"));
        toast(`Создано кодов: ${created.length}`);
        render();
      } catch (error) {
        toast(error.message || "Не удалось создать коды");
      }
    }

    if (event.target.id === "fortunePrizeCreateForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      try {
        const prizes = await fortune.listPrizes(true);
        await fortune.savePrize({
          name: String(form.get("name") || "").trim(),
          weight: Number(form.get("weight") || 1),
          active: true,
          sort_order: prizes.length + 1
        });
        toast("Приз добавлен");
        render();
      } catch (error) {
        toast(error.message || "Не удалось добавить приз");
      }
    }
  });

  $("#content").addEventListener("click", async (event) => {
    const copyButton = event.target.closest("[data-copy-fortune]");
    const revokeButton = event.target.closest("[data-revoke-fortune]");
    const saveButton = event.target.closest("[data-save-prize]");
    const deleteButton = event.target.closest("[data-delete-prize]");

    try {
      if (copyButton) {
        await navigator.clipboard.writeText(copyButton.dataset.copyFortune);
        toast("Код скопирован");
      }
      if (revokeButton) {
        await fortune.revokeCode(revokeButton.dataset.revokeFortune);
        toast("Код отменён");
        render();
      }
      if (saveButton) {
        const row = saveButton.closest("[data-prize-row]");
        const prizes = await fortune.listPrizes(true);
        const existing = prizes.find((item) => item.id === saveButton.dataset.savePrize);
        await fortune.savePrize({
          ...existing,
          name: row.querySelector("[data-prize-name]").value.trim(),
          weight: Number(row.querySelector("[data-prize-weight]").value || 1),
          active: row.querySelector("[data-prize-active]").checked
        });
        toast("Приз сохранён");
        render();
      }
      if (deleteButton && confirm("Удалить приз? Он исчезнет из будущих вращений.")) {
        await fortune.removePrize(deleteButton.dataset.deletePrize);
        toast("Приз удалён");
        render();
      }
    } catch (error) {
      toast(error.message || "Операция не выполнена");
    }
  });
})();