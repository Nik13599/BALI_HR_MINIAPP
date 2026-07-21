(() => {
  if (window.__BALI_ADMIN_CUSTOM_REWARDS__) return;
  window.__BALI_ADMIN_CUSTOM_REWARDS__ = true;

  const loyalty = window.BaliBeta4Loyalty;
  const points = window.BaliPoints;
  if (!loyalty || !points) return;

  let pendingImage = "";
  const digits = (value = "") => String(value).replace(/\D/g, "");
  const conditionLabel = reward => {
    if (reward.conditionType === "event") return `Мероприятие: ${reward.eventTitle || reward.eventId || "не выбрано"}`;
    if (reward.conditionType === "visits") return `${Number(reward.threshold || 1)} посещений`;
    if (reward.conditionType === "anniversary") return `${Number(reward.threshold || 1)} г. с клубом`;
    return "Выдаётся вручную";
  };

  function usersFrom(customers) {
    const map = new Map();
    Object.values(points.accounts()).forEach(account => {
      const key = account.userKey || account.code;
      if (key) map.set(String(key), { ...account, key: String(key) });
    });
    customers.forEach(customer => {
      const key = customer.telegram_id
        ? `tg:${customer.telegram_id}`
        : digits(customer.phone)
          ? `phone:${digits(customer.phone)}`
          : String(customer.id);
      const previous = map.get(key) || {};
      map.set(key, {
        ...previous,
        ...customer,
        key,
        userKey: key,
        name: customer.name || previous.name || "Гость BALI"
      });
    });
    const profile = points.profile();
    const key = profile.userKey || profile.code;
    if (key) map.set(String(key), { ...profile, key: String(key) });
    return [...map.values()].sort((a, b) => String(a.name || a.key).localeCompare(String(b.name || b.key), "ru"));
  }

  function resetForm(form, preview) {
    form.reset();
    form.id.value = "";
    form.xp.value = 100;
    form.threshold.value = 1;
    form.sort_order.value = loyalty.rewards().length + 1;
    form.active.checked = true;
    pendingImage = "";
    preview.innerHTML = `<span>Загрузите квадратный PNG 1:1<br>с прозрачным фоном</span>`;
    form.querySelector("[data-reward-submit]").textContent = "Добавить награду";
  }

  async function append() {
    if (state.view !== "bonuses") return;
    const root = document.getElementById("content");
    if (!root || root.querySelector("#rewardBuilderForm")) return;

    const [customers, events] = await Promise.all([
      store.list("customers"),
      store.list("events")
    ]);
    const users = usersFrom(customers);
    const rewards = loyalty.rewards();

    root.insertAdjacentHTML("beforeend", `
      <section class="panel loyalty-admin" id="newRewardPanel">
        <div class="panel-head">
          <div>
            <h3>Добавить новую награду</h3>
            <small>Создайте награду, укажите, за что она выдаётся, и загрузите собственный значок</small>
          </div>
          <span class="count">NEW</span>
        </div>
        <div class="panel-body loyalty-grid">
          <form class="loyalty-form" id="rewardBuilderForm">
            <input name="id" type="hidden">
            <label>
              <span>Название награды</span>
              <input name="title" placeholder="Например: 1 год с BALI" required>
            </label>
            <label>
              <span>За что выдаётся награда</span>
              <textarea name="description" placeholder="Например: пользователь посещает BALI уже один год" required></textarea>
            </label>
            <div class="loyalty-two">
              <label>
                <span>Количество XP</span>
                <input name="xp" type="number" min="0" value="100" required>
              </label>
              <label>
                <span>Порядок отображения</span>
                <input name="sort_order" type="number" min="1" value="${rewards.length + 1}">
              </label>
            </div>
            <label>
              <span>Условие получения</span>
              <select name="conditionType">
                <option value="manual">Выдать вручную</option>
                <option value="event">За посещение мероприятия</option>
                <option value="visits">За количество посещений</option>
                <option value="anniversary">За количество лет с клубом</option>
              </select>
            </label>
            <label>
              <span>Привязать к мероприятию</span>
              <select name="eventId">
                <option value="">Не выбрано</option>
                ${events.sort((a, b) => String(a.event_date).localeCompare(String(b.event_date))).map(event => `<option value="${esc(event.id)}" data-title="${esc(event.title)}">${esc(event.title)} · ${formatDate(event.event_date)}</option>`).join("")}
              </select>
            </label>
            <label>
              <span>Необходимое количество посещений или лет</span>
              <input name="threshold" type="number" min="1" value="1">
            </label>
            <label>
              <span>Картинка награды</span>
              <input id="rewardImageInput" type="file" accept="image/png">
              <small>Только PNG, квадрат 1:1, прозрачный фон, сторона 64–2048 px.</small>
            </label>
            <div class="reward-preview reward-preview-transparent" id="rewardImagePreview">
              <span>Загрузите квадратный PNG 1:1<br>с прозрачным фоном</span>
            </div>
            <label class="check-row">
              <input name="active" type="checkbox" checked>
              <span>Сразу показывать награду пользователям</span>
            </label>
            <button class="primary" type="submit" data-reward-submit>Добавить награду</button>
            <button class="ghost" id="rewardReset" type="button">Очистить форму</button>
          </form>

          <div>
            <div class="panel-head" style="padding:0 0 10px">
              <div>
                <h3 style="font-size:15px">Созданные награды</h3>
                <small>Их можно изменять или удалять</small>
              </div>
              <span class="count">${rewards.length}</span>
            </div>
            <div class="reward-list">
              ${rewards.length ? rewards.map(reward => `
                <article class="reward-row">
                  ${reward.image ? `<img src="${esc(reward.image)}" alt="${esc(reward.title)}">` : '<div class="reward-placeholder">🏆</div>'}
                  <div>
                    <strong>${esc(reward.title)}</strong>
                    <small>${esc(conditionLabel(reward))} · +${Number(reward.xp || 0)} XP · ${reward.active !== false ? "активна" : "скрыта"}</small>
                    <small>${esc(reward.description || "Описание не указано")}</small>
                  </div>
                  <div class="reward-actions">
                    <button class="secondary" type="button" data-edit-reward="${esc(reward.id)}">Изменить</button>
                    <button class="danger" type="button" data-delete-reward="${esc(reward.id)}">Удалить</button>
                  </div>
                </article>
              `).join("") : '<div class="empty">Созданных наград пока нет</div>'}
            </div>

            <form class="loyalty-form" id="manualRewardGrant" style="margin-top:14px">
              <h4>Выдать награду пользователю</h4>
              <label>
                <span>Пользователь</span>
                <select name="userKey">${users.map(user => `<option value="${esc(user.key)}">${esc(user.name || "Гость")} · ${esc(user.phone || user.telegram || user.key)}</option>`).join("")}</select>
              </label>
              <label>
                <span>Награда</span>
                <select name="rewardId">${rewards.map(reward => `<option value="${esc(reward.id)}">${esc(reward.title)} · +${Number(reward.xp || 0)} XP</option>`).join("")}</select>
              </label>
              <button class="primary" type="submit" ${rewards.length ? "" : "disabled"}>Выдать награду</button>
            </form>
          </div>
        </div>
      </section>
    `);

    const form = root.querySelector("#rewardBuilderForm");
    const preview = root.querySelector("#rewardImagePreview");

    root.querySelector("#rewardImageInput")?.addEventListener("change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        if (!window.BaliRewardPng?.validate) throw new Error("Модуль проверки PNG не загрузился");
        pendingImage = await window.BaliRewardPng.validate(file);
        preview.innerHTML = `<img src="${pendingImage}" alt="Предпросмотр награды">`;
        toast("PNG принят");
      } catch (error) {
        pendingImage = "";
        event.target.value = "";
        preview.innerHTML = `<span>Файл не принят.<br>Нужен PNG 1:1 с прозрачным фоном.</span>`;
        toast(error.message || "PNG не соответствует требованиям");
      }
    });

    root.querySelector("#rewardReset")?.addEventListener("click", () => resetForm(form, preview));

    form.addEventListener("submit", event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const existing = loyalty.rewards().find(reward => reward.id === data.id);
      const eventOption = form.eventId.selectedOptions[0];

      if (!existing && !pendingImage) {
        toast("Загрузите картинку награды в PNG");
        return;
      }

      loyalty.upsertReward({
        ...existing,
        id: data.id || undefined,
        title: data.title.trim(),
        description: data.description.trim(),
        xp: Number(data.xp || 0),
        sort_order: Number(data.sort_order || 1),
        conditionType: data.conditionType,
        eventId: data.eventId || "",
        eventTitle: eventOption?.dataset.title || "",
        threshold: Number(data.threshold || 1),
        image: pendingImage || existing?.image || "",
        active: form.active.checked
      });

      toast(existing ? "Награда изменена" : "Новая награда добавлена");
      pendingImage = "";
      render();
    });

    root.querySelectorAll("[data-edit-reward]").forEach(button => button.addEventListener("click", () => {
      const reward = loyalty.rewards().find(item => item.id === button.dataset.editReward);
      if (!reward) return;
      form.id.value = reward.id;
      form.title.value = reward.title;
      form.description.value = reward.description || "";
      form.xp.value = reward.xp || 0;
      form.sort_order.value = reward.sort_order || 1;
      form.conditionType.value = reward.conditionType || "manual";
      form.eventId.value = reward.eventId || "";
      form.threshold.value = reward.threshold || 1;
      form.active.checked = reward.active !== false;
      pendingImage = reward.image || "";
      preview.innerHTML = reward.image
        ? `<img src="${esc(reward.image)}" alt="${esc(reward.title)}">`
        : `<span>Загрузите квадратный PNG 1:1<br>с прозрачным фоном</span>`;
      form.querySelector("[data-reward-submit]").textContent = "Сохранить изменения";
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    }));

    root.querySelectorAll("[data-delete-reward]").forEach(button => button.addEventListener("click", () => {
      const reward = loyalty.rewards().find(item => item.id === button.dataset.deleteReward);
      if (reward && confirm(`Удалить награду «${reward.title}»?`)) {
        loyalty.removeReward(reward.id);
        toast("Награда удалена");
        render();
      }
    }));

    root.querySelector("#manualRewardGrant")?.addEventListener("submit", event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const user = users.find(item => item.key === data.userKey);
      const reward = loyalty.rewards().find(item => item.id === data.rewardId);
      if (!user || !reward) return toast("Выберите пользователя и награду");
      const result = loyalty.grantReward(user, reward, "admin_manual");
      toast(result.ok ? `Награда выдана · +${reward.xp} XP` : result.message);
      render();
    });
  }

  const baseRender = render;
  render = async function(...args) {
    const result = await baseRender.apply(this, args);
    await append();
    return result;
  };

  if (state.view === "bonuses") append();
})();