(() => {
  if (window.__BALI_BONUSES_STRUCTURE_V11__) return;
  window.__BALI_BONUSES_STRUCTURE_V11__ = true;

  const labels = {
    "chip-requests": {
      title: "Заявки на фишки",
      description: "Новые заявки гостей и полная история фактической выдачи фишек.",
      icon: "◉"
    },
    points: {
      title: "Управление баллами",
      description: "Правила начисления, ручное начисление и списание, коды посещений и история операций.",
      icon: "B"
    },
    "vip-plans": {
      title: "VIP — управление",
      description: "Тарифы, сроки, привилегии мероприятий, подарки и активные VIP-статусы.",
      icon: "VIP"
    },
    economy: {
      title: "Цены, фишки и обмен",
      description: "Цены VIP в BALI-Баллах, курс обмена и параметры получения фишек.",
      icon: "⇄"
    },
    rewards: {
      title: "Управление наградами",
      description: "Создание, редактирование, выдача наград и загрузка их значков.",
      icon: "🏆"
    }
  };
  const order = ["chip-requests", "points", "vip-plans", "economy", "rewards"];

  function styles() {
    if (document.getElementById("bonusesStructureV11Style")) return;
    const style = document.createElement("style");
    style.id = "bonusesStructureV11Style";
    style.textContent = `.bonus-hub-head{display:none!important}.bonus-hub-summary{gap:0!important}.bonus-hub-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.bonus-hub-card{min-height:158px!important}.bonus-hub-card[data-open-bonus-section="chip-requests"]{grid-column:1/-1;border-color:rgba(255,204,91,.3);background:linear-gradient(145deg,rgba(255,204,91,.08),rgba(255,255,255,.018))}.bonus-hub-card[data-open-bonus-section="chip-requests"] i{background:rgba(255,204,91,.12);color:#ffcc5b}.bonus-section-rewards-tabs{display:flex;gap:7px;flex-wrap:wrap;padding:0 14px 12px}.bonus-section-rewards-tabs button{min-height:38px}.reward-icon-panel-merged{border-top:1px solid var(--line)}@media(max-width:620px){.bonus-hub-grid{grid-template-columns:1fr!important}.bonus-hub-card[data-open-bonus-section="chip-requests"]{grid-column:auto}.bonus-hub-card{min-height:132px!important}}`;
    document.head.appendChild(style);
  }

  function updateCard(card, id) {
    const data = labels[id];
    if (!card || !data) return;
    card.dataset.openBonusSection = id;
    const icon = card.querySelector("i");
    const title = card.querySelector("h3");
    const description = card.querySelector("p");
    const action = card.querySelector("span");
    if (icon && icon.textContent !== data.icon) icon.textContent = data.icon;
    if (title && title.textContent !== data.title) title.textContent = data.title;
    if (description && description.textContent !== data.description) description.textContent = data.description;
    if (action && action.textContent !== "Открыть") action.textContent = "Открыть";
    card.classList.remove("vip-mobile-panel-hidden");
  }

  function mergeRewards() {
    const rewardsDialog = document.getElementById("bonusSection-rewards");
    const iconsDialog = document.getElementById("bonusSection-reward-icons");
    const rewardsBody = rewardsDialog?.querySelector(".bonus-section-body");
    const iconsBody = iconsDialog?.querySelector(".bonus-section-body");
    if (!rewardsDialog || !rewardsBody) return;
    if (iconsBody) {
      [...iconsBody.children].forEach(panel => {
        panel.classList.add("reward-icon-panel-merged");
        rewardsBody.appendChild(panel);
      });
      iconsDialog.remove();
    }
    const title = rewardsDialog.querySelector(".bonus-section-head h2");
    if (title) title.textContent = "Управление наградами";
  }

  function organize() {
    if (typeof state === "undefined" || state.view !== "bonuses") return;
    const grid = document.querySelector(".bonus-hub-grid");
    if (!grid) return;

    document.querySelector(".bonus-hub-head")?.remove();
    mergeRewards();

    grid.querySelector('[data-open-bonus-section="vip-gift"]')?.remove();
    grid.querySelector('[data-open-bonus-section="reward-icons"]')?.remove();

    const cards = new Map();
    order.forEach(id => {
      const card = grid.querySelector(`[data-open-bonus-section="${id}"]`);
      if (card) cards.set(id, card);
    });

    for (const id of order) {
      const card = cards.get(id);
      if (!card) continue;
      updateCard(card, id);
      grid.appendChild(card);
    }

    [...grid.querySelectorAll(".bonus-hub-card")].forEach(card => {
      const id = card.dataset.openBonusSection;
      if (!order.includes(id)) card.remove();
    });
  }

  styles();
  let scheduled = false;
  const refresh = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; organize(); });
  };
  new MutationObserver(records => {
    if (records.some(record => record.addedNodes.length || record.removedNodes.length)) refresh();
  }).observe(document.body, {childList:true, subtree:true});
  ["bali:chip-requests-changed", "bali:beta4-changed", "bali:loyalty-changed"].forEach(name => window.addEventListener(name, refresh));
  setTimeout(refresh, 250);
})();