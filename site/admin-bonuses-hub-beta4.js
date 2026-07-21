(() => {
  if (window.__BALI_BONUSES_HUB__) return;
  window.__BALI_BONUSES_HUB__ = true;

  const groups = [
    {
      id: "points",
      icon: "B",
      title: "BALI-Баллы",
      description: "Правила начисления, ручное начисление и списание, коды посещений и история операций.",
      match: ["Правила начисления баллов", "Коды посещения", "Тестовая активность", "Начислить или списать баллы"]
    },
    {
      id: "vip-plans",
      icon: "VIP",
      title: "VIP-тарифы и привилегии",
      description: "Стоимость в Telegram Stars, скидки, множители баллов и условия для отдельных мероприятий.",
      match: ["Тарифы VIP", "VIP-привилегии мероприятия"]
    },
    {
      id: "vip-gift",
      icon: "★",
      title: "Подарить VIP-статус",
      description: "Выдача VIP конкретному гостю, выбор срока действия и отзыв подаренного статуса.",
      match: ["Подарить VIP-статус"]
    },
    {
      id: "economy",
      icon: "⇄",
      title: "Цены, фишки и обмен",
      description: "Цена VIP в баллах, курс обмена баллов на фишки и корректировка баланса фишек.",
      match: ["Баллы → VIP и фишки"]
    },
    {
      id: "rewards",
      icon: "🏆",
      title: "Награды",
      description: "Создание, изменение, удаление и ручная выдача наград пользователям.",
      match: ["Добавить новую награду"]
    },
    {
      id: "reward-icons",
      icon: "PNG",
      title: "Значки наград",
      description: "Замена изображений стандартных и созданных наград.",
      match: ["Все награды"]
    }
  ];

  const esc = value => String(value || "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));

  function injectStyles() {
    if (document.getElementById("bonusesHubStyle")) return;
    const style = document.createElement("style");
    style.id = "bonusesHubStyle";
    style.textContent = `
      .bonus-hub-summary{display:grid;gap:14px}
      .bonus-hub-head{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
      .bonus-hub-stat{padding:14px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.025)}
      .bonus-hub-stat small{display:block;color:var(--muted);font-size:8px;letter-spacing:.09em}
      .bonus-hub-stat strong{display:block;margin-top:6px;color:var(--lime);font:600 22px Unbounded}
      .bonus-hub-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      .bonus-hub-card{display:grid;grid-template-rows:auto auto 1fr auto;gap:8px;min-height:190px;padding:16px;border:1px solid var(--line);border-radius:19px;background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.018));color:var(--text);text-align:left}
      .bonus-hub-card i{width:48px;height:48px;display:grid;place-items:center;border-radius:14px;background:rgba(200,255,61,.09);color:var(--lime);font:700 12px Unbounded;font-style:normal}
      .bonus-hub-card h3{margin:0;font-size:15px}
      .bonus-hub-card p{margin:0;color:var(--muted);font-size:9px;line-height:1.55}
      .bonus-hub-card span{color:var(--lime);font-size:9px;font-weight:900}
      .bonus-section-dialog{width:min(980px,calc(100% - 18px));max-height:95dvh;padding:0;border:1px solid var(--line);border-radius:22px;background:#090c0b;color:var(--text);overflow:hidden}
      .bonus-section-dialog::backdrop{background:rgba(0,0,0,.88);backdrop-filter:blur(6px)}
      .bonus-section-shell{max-height:95dvh;overflow:auto}
      .bonus-section-head{position:sticky;top:0;z-index:20;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:15px 17px;border-bottom:1px solid var(--line);background:rgba(9,12,11,.96);backdrop-filter:blur(12px)}
      .bonus-section-head h2{margin:3px 0 0;font-size:18px}
      .bonus-section-close{width:42px;height:42px;border:1px solid var(--line);border-radius:50%;background:rgba(255,255,255,.05);color:#fff;font-size:24px}
      .bonus-section-body{display:grid;gap:14px;padding:14px}
      .bonus-section-body>.panel{margin:0!important}
      @media(max-width:900px){.bonus-hub-grid{grid-template-columns:1fr 1fr}.bonus-hub-head{grid-template-columns:1fr 1fr}}
      @media(max-width:560px){.bonus-hub-grid,.bonus-hub-head{grid-template-columns:1fr}.bonus-hub-card{min-height:150px}.bonus-section-dialog{width:calc(100% - 8px);max-height:98dvh;border-radius:18px}.bonus-section-shell{max-height:98dvh}}
    `;
    document.head.appendChild(style);
  }

  function panelTitle(panel) {
    return panel.querySelector(".panel-head h3")?.textContent?.trim() || "";
  }

  function stats() {
    const points = window.BaliPoints;
    const game = window.BaliBeta4Game;
    const loyalty = window.BaliBeta4Loyalty;
    const rewards = loyalty?.rewards?.() || [];
    const activeVip = game?.vipGifts?.()?.filter(item => !item.revokedAt && new Date(item.expiresAt).getTime() > Date.now()) || [];
    return {
      balance: Number(points?.profile?.()?.balance || 0),
      operations: Number(points?.ledger?.()?.length || 0),
      rewards: rewards.length,
      vip: activeVip.length
    };
  }

  function makeDialog(group, panels) {
    const dialog = document.createElement("dialog");
    dialog.className = "bonus-section-dialog";
    dialog.id = `bonusSection-${group.id}`;
    dialog.innerHTML = `<div class="bonus-section-shell"><header class="bonus-section-head"><div><span class="eyebrow">БАЛЛЫ + VIP</span><h2>${esc(group.title)}</h2></div><button class="bonus-section-close" type="button" data-close-bonus-section>×</button></header><div class="bonus-section-body"></div></div>`;
    const body = dialog.querySelector(".bonus-section-body");
    panels.forEach(panel => body.appendChild(panel));
    document.body.appendChild(dialog);
    return dialog;
  }

  function buildHub() {
    if (typeof state === "undefined" || state.view !== "bonuses") return;
    const root = document.getElementById("content");
    if (!root || root.dataset.bonusHubReady === "1") return;

    document.querySelectorAll(".bonus-section-dialog").forEach(dialog => dialog.remove());
    const panels = [...root.querySelectorAll(":scope > .panel, :scope > .bonus-admin-grid > .panel")];
    const matched = new Set();
    const readyGroups = groups.map(group => {
      const selected = panels.filter(panel => group.match.includes(panelTitle(panel)));
      selected.forEach(panel => matched.add(panel));
      return { group, selected };
    });

    const leftovers = panels.filter(panel => !matched.has(panel));
    if (leftovers.length) {
      const rewardsGroup = readyGroups.find(item => item.group.id === "rewards");
      leftovers.forEach(panel => rewardsGroup?.selected.push(panel));
    }

    const values = stats();
    root.innerHTML = `<section class="bonus-hub-summary"><div class="bonus-hub-head"><article class="bonus-hub-stat"><small>ТЕСТОВЫЙ БАЛАНС</small><strong>${values.balance}</strong></article><article class="bonus-hub-stat"><small>ОПЕРАЦИЙ</small><strong>${values.operations}</strong></article><article class="bonus-hub-stat"><small>НАГРАД</small><strong>${values.rewards}</strong></article><article class="bonus-hub-stat"><small>ПОДАРЕННЫХ VIP</small><strong>${values.vip}</strong></article></div><div class="bonus-hub-grid">${readyGroups.map(({group,selected}) => `<button class="bonus-hub-card" type="button" data-open-bonus-section="${group.id}" ${selected.length ? "" : "disabled"}><i>${esc(group.icon)}</i><h3>${esc(group.title)}</h3><p>${esc(group.description)}</p><span>${selected.length ? `Открыть · ${selected.length} блок${selected.length === 1 ? "" : "а"}` : "Модуль не загружен"}</span></button>`).join("")}</div></section>`;

    readyGroups.forEach(({group,selected}) => { if (selected.length) makeDialog(group, selected); });
    root.dataset.bonusHubReady = "1";
    const title = document.getElementById("pageTitle");
    if (title) title.textContent = "Баллы + VIP";
  }

  document.addEventListener("click", event => {
    const open = event.target.closest("[data-open-bonus-section]");
    if (open) {
      event.preventDefault();
      const dialog = document.getElementById(`bonusSection-${open.dataset.openBonusSection}`);
      if (dialog && !dialog.open) dialog.showModal();
      return;
    }
    if (event.target.closest("[data-close-bonus-section]")) {
      event.preventDefault();
      event.target.closest("dialog")?.close();
    }
  }, true);

  injectStyles();
  const baseRender = window.render;
  if (typeof baseRender === "function") {
    window.render = async function(...args) {
      const result = await baseRender.apply(this, args);
      if (typeof state !== "undefined" && state.view === "bonuses") {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        buildHub();
      }
      return result;
    };
  }
  if (typeof state !== "undefined" && state.view === "bonuses") setTimeout(buildHub, 100);
})();