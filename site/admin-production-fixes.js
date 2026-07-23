(() => {
  if (window.__BALI_ADMIN_PRODUCTION_FIXES__) return;
  window.__BALI_ADMIN_PRODUCTION_FIXES__ = true;
  const store = window.BaliStore;
  const $ = (selector, root = document) => root.querySelector(selector);
  let channel = null;
  let refreshTimer = 0;

  function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3000);
  }

  function cleanWording() {
    const replacements = new Map([
      ["Демонстрационные данные отключены", "Используется только рабочая база"],
      ["Демонстрационный режим удалён", "Production-режим"],
      ["ДЕМО", "PRODUCTION"]
    ]);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      let value = node.nodeValue || "";
      replacements.forEach((next, previous) => { value = value.replaceAll(previous, next); });
      if (value !== node.nodeValue) node.nodeValue = value;
    });
  }

  function decorateSettings() {
    if (!$('#adminNav [data-view="settings"].active')) return;
    const steps = document.querySelector("#content .steps");
    if (!steps) return;
    if (!steps.querySelector("[data-runtime-migration]")) {
      steps.insertAdjacentHTML("beforeend", '<div class="step" data-runtime-migration><b>4</b><div><strong>QR и BALI People</strong><p>После основной схемы выполните <a href="/bali-production-runtime-migration.sql" target="_blank">production runtime migration</a>.</p></div></div>');
    }
    if (!steps.querySelector("[data-telegram-setup]")) {
      steps.insertAdjacentHTML("beforeend", '<div class="step" data-telegram-setup><b>5</b><div><strong>Telegram webhook</strong><p>После размещения Edge Functions и Secrets нажмите кнопку ниже.</p><button class="primary" type="button" id="setupTelegramWebhook">Подключить Telegram webhook</button><small id="telegramWebhookResult"></small></div></div>');
    }
  }

  function ensureMessageBadge() {
    const button = $('#adminNav [data-view="messages"]');
    if (!button) return null;
    let badge = button.querySelector(".admin-unread");
    if (!badge) {
      badge = document.createElement("b");
      badge.className = "admin-unread";
      badge.style.marginLeft = "auto";
      badge.style.display = "none";
      button.appendChild(badge);
    }
    return badge;
  }

  async function updateMessageBadge() {
    const badge = ensureMessageBadge();
    if (!badge || !store?.cloudEnabled || !store.client) {
      if (badge) badge.style.display = "none";
      return;
    }
    try {
      const { data, error } = await store.client.from("telegram_conversations").select("unread_admin");
      if (error) throw error;
      const total = (data || []).reduce((sum, row) => sum + Number(row.unread_admin || 0), 0);
      badge.textContent = total > 99 ? "99+" : String(total);
      badge.style.display = total ? "grid" : "none";
    } catch {
      badge.style.display = "none";
    }
  }

  function refreshMessagesIfOpen() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      updateMessageBadge();
      const button = $('#adminNav [data-view="messages"].active');
      if (button) button.click();
    }, 250);
  }

  function subscribe() {
    if (!store?.cloudEnabled || !store.client || channel) return;
    channel = store.client.channel("bali-production-admin-messages")
      .on("postgres_changes", { event:"*", schema:"public", table:"telegram_conversations" }, refreshMessagesIfOpen)
      .on("postgres_changes", { event:"*", schema:"public", table:"telegram_messages" }, refreshMessagesIfOpen)
      .subscribe();
  }

  document.addEventListener("click", async event => {
    const setup = event.target.closest("#setupTelegramWebhook");
    if (setup) {
      event.preventDefault();
      if (!store?.cloudEnabled || !store.client) return showToast("Сначала подключите Supabase");
      setup.disabled = true;
      setup.textContent = "Подключение…";
      try {
        const { data, error } = await store.client.functions.invoke("telegram-setup-webhook", { body:{} });
        if (error || data?.error) throw error || new Error(data.error);
        const result = document.getElementById("telegramWebhookResult");
        if (result) result.textContent = ` Подключено: ${data.info?.url || data.url || "Telegram webhook активен"}`;
        showToast("Telegram webhook подключён");
      } catch (error) {
        showToast(error?.message || "Не удалось подключить webhook");
      } finally {
        setup.disabled = false;
        setup.textContent = "Подключить Telegram webhook";
      }
      return;
    }

    const reject = event.target.closest("[data-chip-reject]");
    if (!reject || !store?.cloudEnabled || !store.client) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (!confirm("Отклонить заявку и вернуть списанные BALI-Баллы пользователю?")) return;
    try {
      const { data: row, error } = await store.client.from("chip_requests").select("*").eq("id", reject.dataset.chipReject).single();
      if (error || !row) throw error || new Error("Заявка не найдена");
      if (row.status === "fulfilled") throw new Error("Уже выданные фишки отменить нельзя");
      if (!row.refund_at) {
        const { error: refundError } = await store.client.rpc("admin_adjust_points", {
          p_user_key: row.user_key,
          p_delta: Number(row.points_cost || 0),
          p_note: `Возврат за отклонённую заявку на ${Number(row.quantity || 0)} фиш.`
        });
        if (refundError) throw refundError;
      }
      const now = new Date().toISOString();
      const { error: updateError } = await store.client.from("chip_requests").update({
        status:"cancelled",
        cancelled_at:now,
        cancelled_by:"BALI Admin",
        refund_at:row.refund_at || now
      }).eq("id", row.id);
      if (updateError) throw updateError;
      $('#adminNav [data-view="dashboard"]')?.click();
    } catch (error) {
      showToast(error?.message || "Не удалось отклонить заявку");
    }
  }, true);

  new MutationObserver(() => { cleanWording(); decorateSettings(); }).observe(document.body, { childList:true, subtree:true });
  [0,300,1000].forEach(delay => setTimeout(() => { cleanWording(); decorateSettings(); updateMessageBadge(); subscribe(); }, delay));
})();