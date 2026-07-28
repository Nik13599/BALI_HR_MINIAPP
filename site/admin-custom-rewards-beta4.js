(() => {
  if (window.__BALI_ADMIN_CUSTOM_REWARDS__) return;
  window.__BALI_ADMIN_CUSTOM_REWARDS__ = true;

  const loyalty = window.BaliBeta4Loyalty;
  const points = window.BaliPoints;
  if (!loyalty || !points) return;

  let pendingImage = "";
  const ADMIN_ID = "demo-admin";
  const ADMIN_PERMISSIONS = loyalty.REWARD_POINT_PERMISSIONS || [];
  const digits = (value = "") => String(value).replace(/\D/g, "");
  const number = value => Number(value || 0).toLocaleString("ru-RU");
  const date = value => value ? new Date(value).toLocaleString("ru-RU", { dateStyle:"short", timeStyle:"short" }) : "—";
  const pointsLabel = reward => reward.awardPointsEnabled && Number(reward.pointsRewardAmount || 0) > 0 && reward.awardPointsMode !== "none"
    ? `${number(reward.pointsRewardAmount)} баллов`
    : "Не начисляются";
  const grantStatus = grant => ({
    credited:"Начислено",
    pending:"Ожидает начисления",
    retry_required:"Нужен повтор",
    skipped_repeat:"Только за первое получение",
    not_applicable:"Без баллов"
  }[grant.pointsStatus] || "Без баллов");
  const conditionLabel = reward => {
    if (reward.conditionType === "event") return `Мероприятие: ${reward.eventTitle || reward.eventId || "не выбрано"}`;
    if (reward.conditionType === "visits") return `${Number(reward.threshold || 1)} посещений`;
    if (reward.conditionType === "anniversary") return `${Number(reward.threshold || 1)} г. с клубом`;
    if (reward.conditionType === "ranking") return `TOP ${Number(reward.threshold || 10)} недельного рейтинга`;
    if (reward.conditionType === "referrals") return `${Number(reward.threshold || 1)} приглашённых друзей`;
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
    form.repeatable.checked = false;
    form.awardPointsEnabled.checked = false;
    form.pointsRewardAmount.value = 0;
    form.awardPointsMode.value = "first";
    form.deductPointsOnRevoke.checked = false;
    form.pointsHistoryComment.value = "";
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
    const activeGrants = loyalty.grants().filter(grant => !grant.revokedAt).slice(0, 25);
    const auditRows = loyalty.audit().slice(0, 30);

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
                 <option value="ranking">За место в недельном рейтинге</option>
                 <option value="referrals">За приглашённых друзей</option>
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
            <label class="check-row">
              <input name="repeatable" type="checkbox">
              <span>Награда может выдаваться повторно</span>
            </label>
            <fieldset class="reward-points-config">
              <legend>Баллы за получение награды</legend>
              <label class="check-row">
                <input name="awardPointsEnabled" type="checkbox">
                <span>Автоматически начислять баллы</span>
              </label>
              <div class="loyalty-two">
                <label>
                  <span>Количество баллов</span>
                  <input name="pointsRewardAmount" type="number" min="0" max="${loyalty.MAX_REWARD_POINTS || 1000000000}" step="1" value="0" inputmode="numeric">
                </label>
                <label>
                  <span>Начислять при</span>
                  <select name="awardPointsMode">
                    <option value="first">Первом получении</option>
                    <option value="each">Каждом повторном получении</option>
                    <option value="none">Не начислять</option>
                  </select>
                </label>
              </div>
              <small>Баллы будут автоматически начислены пользователю после успешного получения этой награды. Используется основной баланс BALI.</small>
              <label>
                <span>Комментарий для истории операций</span>
                <input name="pointsHistoryComment" placeholder="Награда: название">
              </label>
              <label class="check-row reward-points-warning">
                <input name="deductPointsOnRevoke" type="checkbox">
                <span>Списывать связанные баллы при отзыве награды</span>
              </label>
            </fieldset>
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
                <small>Настройки, начисления и статистика по каждой награде</small>
              </div>
              <span class="count">${rewards.length}</span>
            </div>
            <div class="reward-filterbar" id="rewardPointsFilters">
              <label><span>Начисление</span><select name="enabled"><option value="all">Все</option><option value="yes">С баллами</option><option value="no">Без баллов</option></select></label>
              <label><span>От</span><input name="min" type="number" min="0" placeholder="0"></label>
              <label><span>До</span><input name="max" type="number" min="0" placeholder="∞"></label>
            </div>
            <div class="reward-list">
              ${rewards.length ? rewards.map(reward => {
                const stats = loyalty.rewardStats(reward.id);
                const enabled = reward.awardPointsEnabled && reward.pointsRewardAmount > 0 && reward.awardPointsMode !== "none";
                return `
                <article class="reward-row" data-reward-row data-points-enabled="${enabled ? "yes" : "no"}" data-points-amount="${Number(reward.pointsRewardAmount || 0)}">
                  ${reward.image ? `<img src="${esc(reward.image)}" alt="${esc(reward.title)}">` : '<div class="reward-placeholder">🏆</div>'}
                  <div>
                    <strong>${esc(reward.title)}</strong>
                    <small>${esc(conditionLabel(reward))} · +${Number(reward.xp || 0)} XP · ${reward.active !== false ? "активна" : "скрыта"}</small>
                    <span class="reward-points-badge ${enabled ? "enabled" : ""}">${esc(pointsLabel(reward))}</span>
                    <small>${reward.repeatable ? `Повторяемая · ${reward.awardPointsMode === "each" ? "баллы каждый раз" : reward.awardPointsMode === "first" ? "баллы один раз" : "без баллов"}` : "Одноразовая"} · отзыв: ${reward.deductPointsOnRevoke ? "со списанием" : "без списания"}</small>
                    <small>Начислено: ${number(stats.totalPoints)} · пользователей: ${stats.users} · операций: ${stats.operations}</small>
                    <small>${esc(reward.description || "Описание не указано")}</small>
                  </div>
                  <div class="reward-actions">
                    <button class="secondary" type="button" data-edit-reward="${esc(reward.id)}">Изменить</button>
                    <button class="danger" type="button" data-delete-reward="${esc(reward.id)}">Удалить</button>
                  </div>
                </article>
              `}).join("") : '<div class="empty">Созданных наград пока нет</div>'}
            </div>

            <form class="loyalty-form reward-operation-card" id="manualRewardGrant">
              <h4>Выдать награду пользователю</h4>
              <label>
                <span>Пользователь</span>
                <select name="userKey">${users.map(user => `<option value="${esc(user.key)}">${esc(user.name || "Гость")} · ${esc(user.phone || user.telegram || user.key)}</option>`).join("")}</select>
              </label>
              <label>
                <span>Награда</span>
                <select name="rewardId">${rewards.map(reward => `<option value="${esc(reward.id)}">${esc(reward.title)} · ${esc(pointsLabel(reward))}</option>`).join("")}</select>
              </label>
              <label class="check-row">
                <input name="overrideEnabled" type="checkbox">
                <span>Изменить сумму только для этой выдачи</span>
              </label>
              <div class="reward-override-fields" hidden>
                <label><span>Сумма с правом rewards.award.override_points</span><input name="overridePoints" type="number" min="0" step="1" value="0"></label>
                <label><span>Причина изменения</span><input name="overrideReason" placeholder="Обязательный комментарий для аудита"></label>
              </div>
              <div class="reward-operation-preview" id="manualRewardPreview">Выберите пользователя и награду</div>
              <button class="primary" type="submit" ${rewards.length ? "" : "disabled"}>Проверить и выдать</button>
            </form>

            <form class="loyalty-form reward-operation-card" id="bulkRewardGrant">
              <h4>Массовая выдача</h4>
              <label><span>Награда</span><select name="rewardId">${rewards.map(reward => `<option value="${esc(reward.id)}">${esc(reward.title)} · ${esc(pointsLabel(reward))}</option>`).join("")}</select></label>
              <label><span>Получатели</span><select name="userKeys" multiple size="7">${users.map(user => `<option value="${esc(user.key)}">${esc(user.name || "Гость")} · ${esc(user.phone || user.key)}</option>`).join("")}</select></label>
              <div class="reward-bulk-actions"><button class="ghost compact" type="button" data-select-all-recipients>Выбрать всех</button><button class="ghost compact" type="button" data-clear-recipients>Очистить</button></div>
              <div class="reward-operation-preview" id="bulkRewardPreview">Выберите получателей</div>
              <button class="primary" type="submit" ${rewards.length ? "" : "disabled"}>Проверить и выдать пакетом</button>
            </form>

            <section class="reward-operation-card">
              <div class="panel-head" style="padding:0 0 8px"><div><h4>Выданные награды</h4><small>Отзыв по умолчанию не списывает баллы</small></div><span class="count">${activeGrants.length}</span></div>
              <div class="reward-grant-list">${activeGrants.length ? activeGrants.map(grant => {
                const reward = rewards.find(item => item.id === grant.rewardId);
                const account = points.accounts()[grant.userKey] || {};
                return `<article><div><strong>${esc(grant.userName)} · ${esc(reward?.title || grant.rewardTitle || grant.rewardId)}</strong><small>${date(grant.earnedAt)} · ${esc(grantStatus(grant))}${grant.pointsAwarded ? ` ${number(grant.pointsAwarded)} баллов` : ""} · баланс ${number(account.balance)}</small></div><button class="danger compact" type="button" data-revoke-reward="${esc(grant.id)}">Отозвать</button></article>`;
              }).join("") : '<div class="empty">Активных выдач пока нет</div>'}</div>
            </section>

            <section class="reward-operation-card">
              <div class="panel-head" style="padding:0 0 8px"><div><h4>Аудит начислений</h4><small>Структурированная связь с наградой и операцией баланса</small></div><span class="count">${auditRows.length}</span></div>
              <div class="reward-audit-list">${auditRows.length ? auditRows.map(row => `<article><strong>${esc(row.action)}</strong><span>${number(row.amount)} баллов · ${date(row.createdAt)}</span><small>reward: ${esc(row.rewardId || "—")} · user_reward: ${esc(row.userRewardId || "—")} · transaction: ${esc(row.transactionId || "—")}</small></article>`).join("") : '<div class="empty">Операций пока нет</div>'}</div>
            </section>
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
      const pointsAmount = Number(data.pointsRewardAmount || 0);
      if (!Number.isInteger(pointsAmount) || pointsAmount < 0 || pointsAmount > (loyalty.MAX_REWARD_POINTS || 1000000000)) {
        toast("Количество баллов должно быть целым неотрицательным числом");
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
        active: form.active.checked,
        repeatable: form.repeatable.checked,
        awardPointsEnabled: form.awardPointsEnabled.checked,
        pointsRewardAmount: pointsAmount,
        pointsRewardType: "points",
        awardPointsMode: form.awardPointsMode.value,
        deductPointsOnRevoke: form.deductPointsOnRevoke.checked,
        pointsHistoryComment: data.pointsHistoryComment.trim() || `Награда: ${data.title.trim()}`
      }, { adminId:ADMIN_ID, permissions:ADMIN_PERMISSIONS });

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
      form.repeatable.checked = reward.repeatable === true;
      form.awardPointsEnabled.checked = reward.awardPointsEnabled === true;
      form.pointsRewardAmount.value = reward.pointsRewardAmount || 0;
      form.awardPointsMode.value = reward.awardPointsMode || "first";
      form.deductPointsOnRevoke.checked = reward.deductPointsOnRevoke === true;
      form.pointsHistoryComment.value = reward.pointsHistoryComment || `Награда: ${reward.title}`;
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

    const filters = root.querySelector("#rewardPointsFilters");
    const applyFilters = () => {
      const enabled = filters?.enabled.value || "all";
      const min = filters?.min.value === "" ? 0 : Number(filters.min.value);
      const max = filters?.max.value === "" ? Infinity : Number(filters.max.value);
      root.querySelectorAll("[data-reward-row]").forEach(row => {
        const amount = Number(row.dataset.pointsAmount || 0);
        row.hidden = (enabled !== "all" && row.dataset.pointsEnabled !== enabled) || amount < min || amount > max;
      });
    };
    filters?.addEventListener("input", applyFilters);

    form.title.addEventListener("input", () => {
      if (!form.pointsHistoryComment.value.trim() || form.pointsHistoryComment.dataset.auto === "true") {
        form.pointsHistoryComment.value = `Награда: ${form.title.value.trim()}`;
        form.pointsHistoryComment.dataset.auto = "true";
      }
    });
    form.pointsHistoryComment.addEventListener("input", () => { form.pointsHistoryComment.dataset.auto = "false"; });

    const manualForm = root.querySelector("#manualRewardGrant");
    const manualPreview = root.querySelector("#manualRewardPreview");
    const updateManualPreview = () => {
      if (!manualForm || !manualPreview) return;
      const user = users.find(item => item.key === manualForm.userKey.value);
      const reward = loyalty.rewards().find(item => item.id === manualForm.rewardId.value);
      const override = manualForm.overrideEnabled.checked;
      manualForm.querySelector(".reward-override-fields").hidden = !override;
      if (!user || !reward) {
        manualPreview.textContent = "Выберите пользователя и награду";
        return;
      }
      if (override && !manualForm.overridePoints.dataset.touched) manualForm.overridePoints.value = reward.pointsRewardAmount || 0;
      const previewResult = loyalty.previewGrant(user, reward, {
        permissions:ADMIN_PERMISSIONS,
        overridePoints:override ? manualForm.overridePoints.value : undefined
      });
      manualPreview.classList.toggle("warning", previewResult.alreadyHas === true);
      manualPreview.innerHTML = previewResult.ok
        ? `<strong>${esc(previewResult.effect)}</strong><small>${previewResult.alreadyHas ? "Одноразовая награда уже есть — повторная выдача будет пропущена." : `Баланс до операции: ${number(previewResult.balance)} баллов`}</small>`
        : esc(previewResult.message);
    };
    ["change", "input"].forEach(name => manualForm?.addEventListener(name, updateManualPreview));
    manualForm?.overridePoints.addEventListener("input", () => { manualForm.overridePoints.dataset.touched = "true"; });
    updateManualPreview();

    manualForm?.addEventListener("submit", event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const user = users.find(item => item.key === data.userKey);
      const reward = loyalty.rewards().find(item => item.id === data.rewardId);
      if (!user || !reward) return toast("Выберите пользователя и награду");
      const override = event.currentTarget.overrideEnabled.checked;
      const previewResult = loyalty.previewGrant(user, reward, {
        permissions:ADMIN_PERMISSIONS,
        overridePoints:override ? event.currentTarget.overridePoints.value : undefined
      });
      if (!previewResult.ok) return toast(previewResult.message);
      if (previewResult.alreadyHas) return toast("Одноразовая награда уже выдана этому пользователю");
      if (!confirm(`${previewResult.effect}.\n\nПодтвердить выдачу?`)) return;
      const result = loyalty.grantReward(user, reward, "admin_manual", {
        adminId:ADMIN_ID,
        permissions:ADMIN_PERMISSIONS,
        overridePoints:override ? event.currentTarget.overridePoints.value : undefined,
        overrideReason:override ? event.currentTarget.overrideReason.value : ""
      });
      toast(result.ok ? `Награда выдана · ${result.grant.pointsAwarded ? `+${number(result.grant.pointsAwarded)} баллов · ` : ""}+${reward.xp} XP` : result.message);
      render();
    });

    const bulkForm = root.querySelector("#bulkRewardGrant");
    const bulkPreview = root.querySelector("#bulkRewardPreview");
    if (bulkForm) bulkForm.dataset.batchId = `admin-${crypto.randomUUID?.() || Date.now()}`;
    const selectedBulkUsers = () => bulkForm ? [...bulkForm.userKeys.selectedOptions].map(option => users.find(user => user.key === option.value)).filter(Boolean) : [];
    const updateBulkPreview = () => {
      if (!bulkForm || !bulkPreview) return;
      const reward = loyalty.rewards().find(item => item.id === bulkForm.rewardId.value);
      const previewResult = loyalty.previewBulk(selectedBulkUsers(), reward);
      bulkPreview.classList.toggle("warning", Number(previewResult.skipped || 0) > 0);
      bulkPreview.innerHTML = previewResult.ok
        ? `<strong>Получателей: ${previewResult.recipients} · баллов каждому: ${number(previewResult.pointsEach)} · максимум: ${number(previewResult.maxTotal)} баллов</strong><small>${previewResult.skipped ? `Будет пропущено: ${previewResult.skipped} — одноразовая награда уже получена.` : "Повторный запуск того же пакета не начислит баллы дважды."}</small>`
        : esc(previewResult.message);
    };
    bulkForm?.addEventListener("change", updateBulkPreview);
    root.querySelector("[data-select-all-recipients]")?.addEventListener("click", () => {
      [...bulkForm.userKeys.options].forEach(option => { option.selected = true; });
      updateBulkPreview();
    });
    root.querySelector("[data-clear-recipients]")?.addEventListener("click", () => {
      [...bulkForm.userKeys.options].forEach(option => { option.selected = false; });
      updateBulkPreview();
    });
    updateBulkPreview();
    bulkForm?.addEventListener("submit", event => {
      event.preventDefault();
      const reward = loyalty.rewards().find(item => item.id === event.currentTarget.rewardId.value);
      const recipients = selectedBulkUsers();
      const previewResult = loyalty.previewBulk(recipients, reward);
      if (!recipients.length) return toast("Выберите хотя бы одного получателя");
      if (!previewResult.ok) return toast(previewResult.message);
      if (!confirm(`Получателей: ${previewResult.recipients}\nБаллов каждому: до ${number(previewResult.pointsEach)}\nМаксимальное начисление: ${number(previewResult.maxTotal)} баллов\nПропустить уже имеющих награду: ${previewResult.skipped}\n\nПодтвердить пакетную выдачу?`)) return;
      const result = loyalty.bulkGrant(recipients, reward, {
        batchId:event.currentTarget.dataset.batchId,
        adminId:ADMIN_ID,
        permissions:ADMIN_PERMISSIONS
      });
      const granted = result.results?.filter(item => item.ok && !item.duplicate).length || 0;
      const credited = result.results?.reduce((sum, item) => sum + Number(item.grant?.pointsAwarded || 0), 0) || 0;
      toast(result.ok ? `Пакет завершён: ${granted} наград · ${number(credited)} баллов` : result.message);
      render();
    });

    root.querySelectorAll("[data-revoke-reward]").forEach(button => button.addEventListener("click", () => {
      const grant = loyalty.grants().find(item => item.id === button.dataset.revokeReward);
      const reward = loyalty.rewards().find(item => item.id === grant?.rewardId);
      if (!grant || !reward) return;
      const account = points.accounts()[grant.userKey] || {};
      const deduction = reward.deductPointsOnRevoke && grant.pointsAwarded > 0
        ? `Будет списано до ${number(grant.pointsAwarded)} баллов. Доступно: ${number(account.balance)}.`
        : "Ранее начисленные баллы останутся у пользователя.";
      if (!confirm(`Отозвать награду «${reward.title}» у ${grant.userName}?\n\n${deduction}`)) return;
      const result = loyalty.revokeReward(grant.id, { adminId:ADMIN_ID, permissions:ADMIN_PERMISSIONS });
      toast(result.ok ? `Награда отозвана${result.deduction ? ` · списано ${number(Math.abs(result.deduction.delta || 0))}` : ""}` : result.message);
      if (result.ok) render();
    }));
  }

  const baseRender = render;
  render = async function(...args) {
    const result = await baseRender.apply(this, args);
    await append();
    return result;
  };

  if (state.view === "bonuses") append();
})();
