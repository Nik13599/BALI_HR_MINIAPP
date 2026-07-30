(() => {
  "use strict";
  if (window.__BALI_PRODUCTION_PROFILE_ECONOMY__) return;
  window.__BALI_PRODUCTION_PROFILE_ECONOMY__ = true;

  const production = window.BaliProduction;
  if (!production) return;

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[char]));
  const toast = message => {
    const node = document.getElementById("toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2300);
  };

  function ensureDialog() {
    let dialog = document.getElementById("productionEconomyDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "productionEconomyDialog";
    dialog.className = "social-v2-dialog production-economy-dialog";
    dialog.innerHTML = `<div class="social-v2-sheet"><div class="social-v2-head"><strong id="productionEconomyTitle">BALI</strong><button class="social-v2-close" type="button" data-close-production-economy>×</button></div><div class="production-economy-body" id="productionEconomyBody"></div></div>`;
    document.body.appendChild(dialog);
    return dialog;
  }

  function decorate() {
    const stats = document.getElementById("profileStats");
    if (!stats) return;
    let section = document.getElementById("productionProfileEconomy");
    if (!section) {
      section = document.createElement("section");
      section.id = "productionProfileEconomy";
      section.className = "card production-profile-economy";
      stats.insertAdjacentElement("afterend", section);
    }
    const unread = production.state.notifications.unread || 0;
    const signature = JSON.stringify({
      balance: Number(production.state.points?.account?.balance || 0),
      shop: production.state.shop.items.length,
      rewards: production.state.rewards.rewards.length,
      gifts: production.state.gifts.received.length,
      vip: production.state.vip.subscriptions.length,
      unread,
    });
    if (section.dataset.signature === signature) return;
    section.dataset.signature = signature;
    section.innerHTML = `
      <div class="card-head"><h3>BALI Club</h3><span class="count">${Number(production.state.points?.account?.balance || 0)} баллов</span></div>
      <div class="production-economy-grid">
        <button type="button" data-production-economy="shop"><i>🛍</i><strong>BALI Shop</strong><small>${production.state.shop.items.length} товаров</small></button>
        <button type="button" data-production-economy="rewards"><i>🏆</i><strong>Награды</strong><small>${production.state.rewards.rewards.length} получено</small></button>
        <button type="button" data-production-economy="gifts"><i>🎁</i><strong>Подарки</strong><small>${production.state.gifts.received.length} входящих</small></button>
        <button type="button" data-production-economy="vip"><i>◆</i><strong>VIP</strong><small>${production.state.vip.subscriptions.length} статусов</small></button>
        <button type="button" data-production-economy="notifications"><i>🔔</i><strong>Уведомления</strong><small>${unread} новых</small></button>
        <button type="button" data-production-economy="data"><i>⚙</i><strong>Мои данные</strong><small>Экспорт и удаление</small></button>
      </div>`;
  }

  function open(kind) {
    const dialog = ensureDialog();
    const title = document.getElementById("productionEconomyTitle");
    const root = document.getElementById("productionEconomyBody");
    if (kind === "shop") {
      title.textContent = "BALI Shop";
      const products = production.state.shop.items.map(item => `<article class="production-product"><div>${item.image_url ? `<img src="${esc(item.image_url)}" alt="${esc(item.name)}">` : "B"}</div><section><strong>${esc(item.name)}</strong><p>${esc(item.description || item.category || "")}</p><small>${Number(item.points_cost)} BALI Points · остаток ${item.stock ?? "∞"}</small></section><button type="button" data-buy-shop-item="${esc(item.id)}">Купить</button></article>`).join("") || '<div class="empty">Товары пока не опубликованы</div>';
      const orders = production.state.shop.orders.map(order => {
        const redemption = (order.items || []).some(item => item.requires_redemption);
        return `<article class="production-economy-row"><i>🛍</i><div><strong>Заказ ${esc(String(order.id).slice(0, 8))}</strong><small>${Number(order.total_points)} BALI Points · ${esc(order.status)}</small></div>${redemption && order.status === "paid" ? `<button type="button" data-shop-order-qr="${esc(order.id)}">QR</button>` : ""}</article>`;
      }).join("");
      root.innerHTML = `${products}${orders ? `<h3 class="production-economy-subtitle">Мои заказы</h3>${orders}` : ""}`;
    } else if (kind === "rewards") {
      title.textContent = "Мои награды";
      root.innerHTML = production.state.rewards.rewards.map(item => `<article class="production-economy-row"><i>${item.icon_url ? `<img src="${esc(item.icon_url)}" alt="">` : "🏆"}</i><div><strong>${esc(item.name)}</strong><small>${esc(item.description || item.rarity || "")}</small></div><span>${new Date(item.granted_at).toLocaleDateString("ru-RU")}</span></article>`).join("") || '<div class="empty">Наград пока нет</div>';
    } else if (kind === "gifts") {
      title.textContent = "Мои подарки";
      root.innerHTML = production.state.gifts.received.map(item => `<article class="production-economy-row"><i>${item.image_url ? `<img src="${esc(item.image_url)}" alt="">` : "🎁"}</i><div><strong>${esc(item.name)}</strong><small>От ${esc(item.sender_name || "BALI")} · ${esc(item.status)}</small></div>${item.gift_type === "physical" && item.status === "delivered" ? `<button type="button" data-gift-qr="${esc(item.id)}">QR</button>` : ""}</article>`).join("") || '<div class="empty">Подарков пока нет</div>';
    } else if (kind === "vip") {
      title.textContent = "VIP-статусы";
      root.innerHTML = production.state.vip.plans.map(plan => `<article class="production-product"><div>◆</div><section><strong>${esc(plan.name)}</strong><p>${esc((plan.benefits || []).join(" · "))}</p><small>${Number(plan.points_cost)} BALI Points · ${Number(plan.duration_days)} дней</small></section><button type="button" data-buy-vip-production="${esc(plan.id)}">Активировать</button></article>`).join("") || '<div class="empty">VIP-планы пока не опубликованы</div>';
    } else if (kind === "notifications") {
      title.textContent = "Уведомления";
      root.innerHTML = `<button type="button" class="secondary full" data-read-all-notifications>Отметить все прочитанными</button>${production.state.notifications.notifications.map(item => `<article class="production-notification ${item.read_at ? "" : "unread"}"><strong>${esc(item.title)}</strong><p>${esc(item.body)}</p><small>${new Date(item.created_at).toLocaleString("ru-RU")}</small></article>`).join("") || '<div class="empty">Уведомлений пока нет</div>'}`;
    } else {
      title.textContent = "Мои данные";
      root.innerHTML = `
        <a class="secondary full production-data-action" href="/api/v1/people/me/export" download>Скачать мои данные JSON</a>
        <button type="button" class="danger full" data-delete-production-account>Удалить аккаунт</button>
        <p class="detail-copy">Удаление отключает вход, обезличивает профиль и отзывает все активные сессии. История финансовых и операционных записей сохраняется без публичных персональных данных.</p>`;
    }
    if (!dialog.open) dialog.showModal();
  }

  function showQr(title, dataUrl, details) {
    const dialog = ensureDialog();
    document.getElementById("productionEconomyTitle").textContent = title;
    const root = document.getElementById("productionEconomyBody");
    const image = document.createElement("img");
    image.className = "production-redemption-qr";
    image.src = dataUrl;
    image.alt = title;
    const copy = document.createElement("p");
    copy.className = "detail-copy";
    copy.textContent = details;
    root.replaceChildren(image, copy);
    if (!dialog.open) dialog.showModal();
  }

  document.addEventListener("click", async event => {
    try {
    const openButton = event.target.closest("[data-production-economy]");
    if (openButton) return open(openButton.dataset.productionEconomy);
    const shop = event.target.closest("[data-buy-shop-item]");
    if (shop) {
      const item = production.state.shop.items.find(row => row.id === shop.dataset.buyShopItem);
      if (!item || !confirm(`Купить «${item.name}» за ${item.points_cost} BALI Points?`)) return;
      shop.disabled = true;
      const result = await production.post("/api/v1/economy/shop/orders", {
        items: [{ itemId: item.id, quantity: 1 }],
      });
      await production.refresh();
      decorate();
      if (item.requires_redemption) showQr("QR выдачи BALI Shop", result.qrDataUrl, "Покажите сотруднику BALI. Код погашается один раз.");
      else {
        toast("Покупка оформлена");
        open("shop");
      }
      return;
    }
    const gift = event.target.closest("[data-gift-qr]");
    if (gift) {
      const result = await production.api(`/api/v1/economy/gifts/${encodeURIComponent(gift.dataset.giftQr)}/qr`, {
        method: "POST",
        body: "{}",
      });
      return showQr("QR получения подарка", result.qrDataUrl, "Покажите сотруднику BALI. Код погашается один раз.");
    }
    const order = event.target.closest("[data-shop-order-qr]");
    if (order) {
      const result = await production.api(`/api/v1/economy/shop/orders/${encodeURIComponent(order.dataset.shopOrderQr)}/qr`, {
        method: "POST",
        body: "{}",
      });
      return showQr("QR выдачи BALI Shop", result.qrDataUrl, "Покажите сотруднику BALI. Код погашается один раз.");
    }
    const vip = event.target.closest("[data-buy-vip-production]");
    if (vip) {
      const plan = production.state.vip.plans.find(row => row.id === vip.dataset.buyVipProduction);
      if (!plan || !confirm(`Активировать ${plan.name} за ${plan.points_cost} BALI Points?`)) return;
      vip.disabled = true;
      await production.post("/api/v1/economy/vip/purchase", { planId: plan.id });
      await production.refresh();
      decorate();
      toast("VIP активирован");
      return open("vip");
    }
    if (event.target.closest("[data-read-all-notifications]")) {
      await production.api("/api/v1/notifications/read-all", { method: "POST", body: "{}" });
      await production.refreshSecondary();
      decorate();
      return open("notifications");
    }
    if (event.target.closest("[data-delete-production-account]")) {
      const confirmation = prompt("Для необратимого удаления введите DELETE");
      if (confirmation !== "DELETE") return;
      const reason = prompt("Причина удаления (необязательно)") || "";
      await production.api("/api/v1/people/me", {
        method: "DELETE",
        body: JSON.stringify({ confirmation, reason }),
      });
      location.reload();
      return;
    }
    if (event.target.closest("[data-close-production-economy]")) {
      document.getElementById("productionEconomyDialog")?.close();
    }
    } catch (error) {
      console.error(error);
      toast(error?.message || "Не удалось выполнить операцию");
    }
  });

  window.addEventListener("bali:production-refreshed", () => requestAnimationFrame(decorate));
  new MutationObserver(decorate).observe(document.body, { childList: true, subtree: true });
  ensureDialog();
  decorate();
})();
