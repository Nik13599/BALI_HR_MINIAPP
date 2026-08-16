(() => {
  if (window.__BALI_ADMIN_VIP_MOBILE_SECTIONS__) return;
  window.__BALI_ADMIN_VIP_MOBILE_SECTIONS__ = true;

  const game = window.BaliBeta4Game;
  const panelTitle = panel => panel?.querySelector(".panel-head h3")?.textContent?.trim() || "";
  const findPanel = (dialog, title) => [...(dialog?.querySelectorAll(".panel") || [])].find(panel => panelTitle(panel) === title);
  const setText = (node, value) => { if (node && node.textContent !== value) node.textContent = value; };

  function styles() {
    if (document.getElementById("adminVipMobileSectionsStyle")) return;
    const style = document.createElement("style");
    style.id = "adminVipMobileSectionsStyle";
    style.textContent = `
      .vip-mobile-menu{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .vip-mobile-card{display:grid;grid-template-columns:46px minmax(0,1fr) auto;gap:11px;align-items:center;min-height:94px;padding:13px;border:1px solid var(--line);border-radius:17px;background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.018));color:var(--text);text-align:left}
      .vip-mobile-card>i{width:46px;height:46px;display:grid;place-items:center;border-radius:14px;background:rgba(228,200,110,.12);color:#e4c86e;font:700 10px Unbounded;font-style:normal}
      .vip-mobile-card strong{display:block;font-size:12px}.vip-mobile-card small{display:block;margin-top:5px;color:var(--muted);font-size:8px;line-height:1.45}.vip-mobile-card>b{color:var(--lime);font-size:16px}
      .vip-mobile-back{display:none;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid rgba(200,255,61,.18);border-radius:14px;background:rgba(200,255,61,.05)}
      .vip-mobile-back.show{display:flex}.vip-mobile-back span{color:var(--muted);font-size:9px}.vip-mobile-back button{min-height:38px}
      .vip-mobile-panel-hidden{display:none!important}.vip-mobile-menu-hidden{display:none!important}
      .vip-mobile-gift-panel .vip-admin-grid{grid-template-columns:1fr!important}.vip-mobile-gift-panel .vip-admin-grid>form,.vip-mobile-gift-panel .vip-admin-grid>.vip-gift-list{display:none}.vip-mobile-gift-panel[data-vip-mode="gift"] .vip-admin-grid>form{display:grid}.vip-mobile-gift-panel[data-vip-mode="active"] .vip-admin-grid>.vip-gift-list{display:grid}
      .vip-price-focus .bonus-section-body>.panel{display:none!important}.vip-price-focus .bonus-section-body>.panel.vip-price-panel-active{display:block!important}
      #bonusSection-vip-gift .bonus-section-body>.panel{margin:0!important}
      @media(max-width:620px){.vip-mobile-menu{grid-template-columns:1fr}.vip-mobile-card{min-height:84px}.vip-mobile-card>i{width:42px;height:42px}.vip-mobile-back{position:sticky;top:68px;z-index:15;background:#101510f2;backdrop-filter:blur(12px)}}
    `;
    document.head.appendChild(style);
  }

  function values() {
    const cfg = game?.config?.() || { plans: [], eventPrivileges: {} };
    const activePlans = (cfg.plans || []).filter(plan => plan.active !== false).length;
    const privileges = Object.values(cfg.eventPrivileges || {}).reduce((sum, plans) => sum + Object.keys(plans || {}).length, 0);
    const activeVip = (game?.vipGifts?.() || []).filter(gift => !gift.revokedAt && new Date(gift.expiresAt).getTime() > Date.now()).length;
    return { activePlans, privileges, activeVip };
  }

  function mainMenu() {
    const count = values();
    return `<div class="vip-mobile-menu" id="vipMobileMainMenu">
      <button class="vip-mobile-card" type="button" data-vip-mobile-open="plans"><i>VIP</i><span><strong>VIP-тарифы</strong><small>Скидки, множители баллов, ранняя бронь и доступность тарифов</small></span><b>${count.activePlans}</b></button>
      <button class="vip-mobile-card" type="button" data-vip-mobile-open="privileges"><i>AF</i><span><strong>Привилегии мероприятий</strong><small>Особые условия VIP для выбранной афиши</small></span><b>${count.privileges}</b></button>
      <button class="vip-mobile-card" type="button" data-vip-mobile-open="prices"><i>BYN</i><span><strong>Цены по срокам</strong><small>1 день, 1 мероприятие, 2 мероприятия и 1 месяц</small></span><b>12</b></button>
      <button class="vip-mobile-card" type="button" data-vip-mobile-open="gift"><i>＋</i><span><strong>Подарить VIP</strong><small>Выбрать гостя, статус, срок и комментарий</small></span><b>›</b></button>
      <button class="vip-mobile-card" type="button" data-vip-mobile-open="active"><i>★</i><span><strong>Активные VIP</strong><small>Просмотр подаренных статусов и досрочный отзыв</small></span><b>${count.activeVip}</b></button>
    </div>`;
  }

  function prepareMainDialog() {
    const dialog = document.getElementById("bonusSection-vip-plans");
    const body = dialog?.querySelector(".bonus-section-body");
    const plans = findPanel(dialog, "Тарифы VIP");
    const privileges = findPanel(dialog, "VIP-привилегии мероприятия");
    if (!dialog || !body || (!plans && !privileges)) return false;

    if (!body.querySelector("#vipMobileMainMenu")) {
      body.insertAdjacentHTML("afterbegin", `${mainMenu()}<div class="vip-mobile-back" id="vipMobileMainBack"><button class="ghost compact" type="button" data-vip-mobile-back>← Назад к VIP</button><span>Открыт только выбранный раздел</span></div>`);
      plans?.classList.add("vip-mobile-panel-hidden");
      privileges?.classList.add("vip-mobile-panel-hidden");
      setText(dialog.querySelector(".bonus-section-head h2"), "VIP — управление");
    }

    const mainCard = document.querySelector('[data-open-bonus-section="vip-plans"]');
    setText(mainCard?.querySelector("h3"), "VIP — управление");
    setText(mainCard?.querySelector("p"), "Тарифы, цены, привилегии мероприятий, подарки и активные VIP — отдельными кнопками.");
    document.querySelector('[data-open-bonus-section="vip-gift"]')?.classList.add("vip-mobile-panel-hidden");
    return true;
  }

  function showMainMenu() {
    const dialog = document.getElementById("bonusSection-vip-plans");
    if (!dialog) return;
    dialog.querySelector("#vipMobileMainMenu")?.classList.remove("vip-mobile-menu-hidden");
    dialog.querySelector("#vipMobileMainBack")?.classList.remove("show");
    dialog.querySelectorAll(".panel").forEach(panel => panel.classList.add("vip-mobile-panel-hidden"));
    setText(dialog.querySelector(".bonus-section-head h2"), "VIP — управление");
  }

  function showMainPanel(mode) {
    const dialog = document.getElementById("bonusSection-vip-plans");
    const title = mode === "plans" ? "Тарифы VIP" : "VIP-привилегии мероприятия";
    const panel = findPanel(dialog, title);
    if (!dialog || !panel) return;
    dialog.querySelector("#vipMobileMainMenu")?.classList.add("vip-mobile-menu-hidden");
    dialog.querySelector("#vipMobileMainBack")?.classList.add("show");
    dialog.querySelectorAll(".panel").forEach(item => item.classList.toggle("vip-mobile-panel-hidden", item !== panel));
    setText(dialog.querySelector(".bonus-section-head h2"), mode === "plans" ? "VIP-тарифы" : "Привилегии мероприятий");
  }

  function prepareGiftDialog() {
    const dialog = document.getElementById("bonusSection-vip-gift");
    const body = dialog?.querySelector(".bonus-section-body");
    const panel = findPanel(dialog, "Подарить VIP-статус") || dialog?.querySelector(".vip-mobile-gift-panel");
    if (!dialog || !body || !panel) return false;
    if (!body.querySelector("#vipMobileGiftMenu")) {
      const active = values().activeVip;
      body.insertAdjacentHTML("afterbegin", `<div class="vip-mobile-menu" id="vipMobileGiftMenu"><button class="vip-mobile-card" type="button" data-vip-gift-mode="gift"><i>＋</i><span><strong>Подарить VIP</strong><small>Выбрать пользователя, тариф и срок действия</small></span><b>›</b></button><button class="vip-mobile-card" type="button" data-vip-gift-mode="active"><i>★</i><span><strong>Активные VIP</strong><small>Просмотреть выданные статусы и отозвать при необходимости</small></span><b>${active}</b></button></div><div class="vip-mobile-back" id="vipMobileGiftBack"><button class="ghost compact" type="button" data-vip-gift-back>← Назад</button><span>VIP-подарки</span></div>`);
      panel.classList.add("vip-mobile-gift-panel", "vip-mobile-panel-hidden");
      setText(dialog.querySelector(".bonus-section-head h2"), "VIP-подарки");
    }
    return true;
  }

  function showGiftMenu() {
    const dialog = document.getElementById("bonusSection-vip-gift");
    const panel = dialog?.querySelector(".vip-mobile-gift-panel");
    if (!dialog || !panel) return;
    dialog.querySelector("#vipMobileGiftMenu")?.classList.remove("vip-mobile-menu-hidden");
    dialog.querySelector("#vipMobileGiftBack")?.classList.remove("show");
    panel.classList.add("vip-mobile-panel-hidden");
    panel.removeAttribute("data-vip-mode");
    setText(dialog.querySelector(".bonus-section-head h2"), "VIP-подарки");
  }

  function showGiftMode(mode) {
    const dialog = document.getElementById("bonusSection-vip-gift");
    const panel = dialog?.querySelector(".vip-mobile-gift-panel");
    if (!dialog || !panel) return;
    dialog.querySelector("#vipMobileGiftMenu")?.classList.add("vip-mobile-menu-hidden");
    dialog.querySelector("#vipMobileGiftBack")?.classList.add("show");
    panel.classList.remove("vip-mobile-panel-hidden");
    panel.dataset.vipMode = mode;
    setText(panel.querySelector(".panel-head h3"), mode === "gift" ? "Подарить VIP" : "Активные VIP-статусы");
    setText(dialog.querySelector(".bonus-section-head h2"), mode === "gift" ? "Подарить VIP" : "Активные VIP");
  }

  function openGift(mode) {
    const dialog = document.getElementById("bonusSection-vip-gift");
    if (!dialog) return;
    prepareGiftDialog();
    if (!dialog.open) dialog.showModal();
    showGiftMode(mode);
  }

  function resetPriceDialog() {
    const economy = document.getElementById("bonusSection-economy");
    if (!economy) return;
    economy.classList.remove("vip-price-focus");
    economy.querySelector(".vip-price-panel-active")?.classList.remove("vip-price-panel-active");
    economy.querySelector("#vipPriceBack")?.remove();
  }

  function openPrices() {
    const main = document.getElementById("bonusSection-vip-plans");
    const economy = document.getElementById("bonusSection-economy");
    const panel = findPanel(economy, "Цены вариантов VIP");
    if (!economy || !panel) return window.toast?.("Блок цен VIP ещё загружается");
    if (!economy.dataset.vipPriceCloseBound) {
      economy.dataset.vipPriceCloseBound = "1";
      economy.addEventListener("close", resetPriceDialog);
    }
    main?.close();
    economy.classList.add("vip-price-focus");
    panel.classList.add("vip-price-panel-active");
    if (!economy.querySelector("#vipPriceBack")) {
      const back = document.createElement("div");
      back.id = "vipPriceBack";
      back.className = "vip-mobile-back show";
      back.innerHTML = '<button class="ghost compact" type="button" data-vip-price-back>← Назад к VIP</button><span>Стоимость вариантов VIP в BALI-Баллах</span>';
      economy.querySelector(".bonus-section-body")?.insertAdjacentElement("afterbegin", back);
    }
    setText(economy.querySelector(".bonus-section-head h2"), "Цены вариантов VIP");
    if (!economy.open) economy.showModal();
  }

  function backFromPrices() {
    const economy = document.getElementById("bonusSection-economy");
    economy?.close();
    const main = document.getElementById("bonusSection-vip-plans");
    if (main && !main.open) main.showModal();
    showMainMenu();
  }

  function apply() {
    if (typeof state === "undefined" || state.view !== "bonuses") return;
    prepareMainDialog();
    prepareGiftDialog();
  }

  document.addEventListener("click", event => {
    if (event.target.closest('[data-open-bonus-section="vip-plans"]')) setTimeout(showMainMenu, 0);
    const section = event.target.closest("[data-vip-mobile-open]");
    if (section) {
      event.preventDefault();
      const mode = section.dataset.vipMobileOpen;
      if (mode === "plans" || mode === "privileges") return showMainPanel(mode);
      if (mode === "prices") return openPrices();
      if (mode === "gift" || mode === "active") return openGift(mode);
    }
    if (event.target.closest("[data-vip-mobile-back]")) return showMainMenu();
    if (event.target.closest("[data-vip-gift-back]")) return showGiftMenu();
    const giftMode = event.target.closest("[data-vip-gift-mode]");
    if (giftMode) return showGiftMode(giftMode.dataset.vipGiftMode);
    if (event.target.closest("[data-vip-price-back]")) return backFromPrices();

    const revoke = event.target.closest("[data-revoke-vip]");
    if (revoke && !event.target.closest("#content")) {
      event.preventDefault();
      if (!confirm("Отозвать подаренный VIP-статус?")) return;
      game?.revokeGift?.(revoke.dataset.revokeVip);
      window.toast?.("VIP-статус отозван");
      window.render?.();
    }
  }, true);

  styles();
  let scheduled = false;
  const refresh = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; apply(); });
  };
  new MutationObserver(records => {
    if (records.some(record => record.addedNodes.length || record.removedNodes.length)) refresh();
  }).observe(document.body, { childList:true, subtree:true });
  ["bali:beta4-changed", "bali:vip-variants-changed"].forEach(name => window.addEventListener(name, refresh));
  setTimeout(refresh, 250);
})();