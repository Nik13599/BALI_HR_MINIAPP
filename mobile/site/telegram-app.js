(() => {
  "use strict";
  const gate = document.getElementById("telegramGate");
  const appRoot = document.getElementById("baliApp");
  const gateMessage = document.getElementById("gateMessage");
  const telegramButton = document.getElementById("openTelegramButton");
  const tg = window.Telegram?.WebApp;

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    });
    if (response.status === 204) return null;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.error?.message || "Ошибка запроса");
      error.status = response.status;
      error.code = payload?.error?.code;
      throw error;
    }
    return payload;
  }

  function showGate(message, botUrl) {
    gate.hidden = false;
    appRoot.hidden = true;
    gateMessage.textContent = message || "Вход доступен только через Telegram Mini App.";
    if (botUrl) {
      telegramButton.href = botUrl;
      telegramButton.hidden = false;
    }
  }

  async function telegramFullscreen() {
    if (!tg) return;
    tg.ready();
    tg.expand();
    try {
      if (
        typeof tg.isVersionAtLeast === "function"
        && tg.isVersionAtLeast("8.0")
        && typeof tg.requestFullscreen === "function"
      ) {
        await tg.requestFullscreen();
      }
    } catch {
      // Telegram can deny fullscreen on old clients; expanded mode remains active.
    }
  }

  async function authenticatedSession() {
    try {
      return await api("/api/v1/auth/session");
    } catch (error) {
      if (error.status !== 401) throw error;
    }
    if (!tg?.initData) return null;
    return api("/api/v1/auth/telegram", {
      method: "POST",
      body: JSON.stringify({ initData: tg.initData })
    });
  }

  async function boot() {
    const publicConfig = await api("/api/v1/config/public");
    await telegramFullscreen();
    const session = await authenticatedSession();
    if (!session?.user) {
      showGate("Откройте BALI через официального Telegram-бота. Браузерный вход в production отключён.", publicConfig.telegramBotUrl);
      return;
    }
    gate.hidden = true;
    appRoot.hidden = false;
    document.getElementById("currentUserName").textContent = session.user.name || "Гость BALI";
    document.getElementById("currentUserAvatar").textContent = String(session.user.name || "B").trim()[0]?.toUpperCase() || "B";
    document.getElementById("logoutButton").addEventListener("click", async () => {
      await api("/api/v1/auth/logout", { method: "POST", body: "{}" });
      showGate("Сессия завершена. Откройте Mini App снова через Telegram.", publicConfig.telegramBotUrl);
    });
    if (!window.BaliClanChatApp) throw new Error("Модуль кланового чата не загрузился");
    window.BaliClanChatApp({ api, user: session.user });
  }

  boot().catch(error => {
    console.error(error);
    showGate(error.message || "Не удалось подтвердить вход через Telegram.");
  });
})();
