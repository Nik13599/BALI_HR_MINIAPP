(() => {
  const SETTINGS_KEY = "bali_bonus_settings_v1";
  const PROFILE_KEY = "bali_bonus_profile_v1";
  const LEDGER_KEY = "bali_bonus_ledger_v1";
  const ACTIONS_KEY = "bali_bonus_actions_v1";
  const DEFAULTS = { referral: 50, story: 30, eventShare: 10 };

  const readJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const writeJson = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("bali:bonus-changed"));
  };
  const settings = () => ({ ...DEFAULTS, ...readJson(SETTINGS_KEY, {}) });
  const icon = (type) => ({ referral: "👥", story: "📸", event: "↗" })[type] || "★";
  const when = (value) => new Date(value).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  titles.bonuses = "BALI-Бонусы";

  function renderBonusAdmin(root) {
    const rules = settings();
    const profile = readJson(PROFILE_KEY, { balance: 0 });
    const ledger = readJson(LEDGER_KEY, []);
    const total = ledger.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    root.innerHTML = `
      <div class="bonus-admin-grid">
        <section class="panel">
          <div class="panel-head"><div><h3>Правила начисления</h3><small>Количество бонусов меняется без правки кода</small></div></div>
          <div class="panel-body">
            <form class="bonus-settings" id="bonusSettingsForm">
              <label><span>За приглашение друга</span><input name="referral" type="number" min="0" value="${Number(rules.referral)}" /></label>
              <label><span>За публикацию в Stories</span><input name="story" type="number" min="0" value="${Number(rules.story)}" /></label>
              <label><span>За распространение одной афиши</span><input name="eventShare" type="number" min="0" value="${Number(rules.eventShare)}" /></label>
              <button class="primary" type="submit">Сохранить правила</button>
              <div class="beta-note">В Beta3 действия подтверждаются автоматически. В официальной версии приглашения будет проверять бот, а Stories — администратор.</div>
            </form>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><div><h3>Тестовая активность</h3><small>Начисления из гостевой части этого браузера</small></div><button class="danger" id="resetBonusDemo" type="button">Сбросить</button></div>
          <div class="panel-body">
            <div class="bonus-admin-stats">
              <div class="bonus-admin-stat"><span>БАЛАНС</span><strong>${Number(profile.balance || 0)}</strong></div>
              <div class="bonus-admin-stat"><span>НАЧИСЛЕНО</span><strong>${total}</strong></div>
              <div class="bonus-admin-stat"><span>ОПЕРАЦИЙ</span><strong>${ledger.length}</strong></div>
            </div>
            <div class="bonus-ledger">${ledger.length ? ledger.slice(0, 12).map((item) => `<div class="bonus-ledger-row"><i>${icon(item.type)}</i><div><strong>${esc(item.title)}</strong><small>${when(item.createdAt)}</small></div><b>+${Number(item.amount || 0)}</b></div>`).join("") : '<div class="empty">Тестовых начислений пока нет</div>'}</div>
          </div>
        </section>
      </div>`;

    $("#bonusSettingsForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      writeJson(SETTINGS_KEY, {
        referral: Math.max(0, Number(data.referral || 0)),
        story: Math.max(0, Number(data.story || 0)),
        eventShare: Math.max(0, Number(data.eventShare || 0))
      });
      toast("Правила BALI-Бонусов сохранены");
      render();
    });

    $("#resetBonusDemo").addEventListener("click", () => {
      if (!confirm("Сбросить тестовый баланс и историю начислений?")) return;
      const current = readJson(PROFILE_KEY, {});
      writeJson(PROFILE_KEY, { ...current, balance: 0 });
      localStorage.removeItem(LEDGER_KEY);
      localStorage.removeItem(ACTIONS_KEY);
      window.dispatchEvent(new CustomEvent("bali:bonus-changed"));
      toast("Тестовые бонусы сброшены");
      render();
    });
  }

  const baseRender = render;
  render = async function() {
    if (state.view !== "bonuses") return baseRender();
    $("#pageTitle").textContent = titles.bonuses;
    $("#primaryAction").style.display = "none";
    renderBonusAdmin($("#content"));
  };

  window.addEventListener("storage", (event) => {
    if ([SETTINGS_KEY, PROFILE_KEY, LEDGER_KEY, ACTIONS_KEY].includes(event.key) && state.view === "bonuses") render();
  });
})();