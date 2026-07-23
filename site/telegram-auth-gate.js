(() => {
  if (window.BaliTelegramAuth) return;

  const cfg = window.BALI_CONFIG || {};
  const tg = window.Telegram?.WebApp;
  const bot = String(cfg.telegramUsername || "BaliMinskAppBot").replace(/^@/, "");
  const endpoint = cfg.telegramAuthEndpoint || (cfg.supabaseUrl
    ? `${String(cfg.supabaseUrl).replace(/\/$/, "")}/functions/v1/telegram-auth-bootstrap`
    : "");
  let authenticated = false;
  let verifiedUser = null;
  let resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });

  function root() {
    return document.getElementById("app") || document.body;
  }

  function styles() {
    if (document.getElementById("baliTelegramGateStyle")) return;
    const style = document.createElement("style");
    style.id = "baliTelegramGateStyle";
    style.textContent = `
      html,body{min-height:100%;margin:0;background:#07100c;color:#fff;font-family:Inter,Arial,sans-serif}
      .tg-auth-gate{min-height:100dvh;display:grid;place-items:center;padding:22px;box-sizing:border-box;background:radial-gradient(circle at 20% 0,rgba(196,255,45,.2),transparent 38%),radial-gradient(circle at 100% 80%,rgba(0,190,138,.15),transparent 42%),#07100c}
      .tg-auth-card{width:min(430px,100%);box-sizing:border-box;padding:24px;border:1px solid rgba(210,255,104,.24);border-radius:28px;background:linear-gradient(145deg,rgba(20,35,27,.97),rgba(8,15,11,.98));box-shadow:0 28px 80px rgba(0,0,0,.5)}
      .tg-auth-logo{width:68px;height:68px;display:grid;place-items:center;border-radius:22px;background:linear-gradient(145deg,#d5ff54,#8fdb26);color:#07100c;font-size:30px;font-weight:1000;box-shadow:0 14px 32px rgba(169,255,43,.22)}
      .tg-auth-label{display:block;margin-top:19px;color:#bfff43;font-size:10px;font-weight:900;letter-spacing:.16em}
      .tg-auth-card h1{margin:8px 0 10px;font-size:27px;line-height:1.08}.tg-auth-card p{margin:0;color:#b4c0b8;font-size:13px;line-height:1.65}
      .tg-auth-user{display:flex;gap:11px;align-items:center;margin:18px 0;padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:17px;background:rgba(255,255,255,.04)}
      .tg-auth-avatar{width:46px;height:46px;display:grid;place-items:center;overflow:hidden;border-radius:50%;background:#c8ff3d;color:#07100c;font-size:18px;font-weight:900}.tg-auth-avatar img{width:100%;height:100%;object-fit:cover}
      .tg-auth-user strong,.tg-auth-user small{display:block}.tg-auth-user small{margin-top:3px;color:#849088;font-size:10px}
      .tg-auth-action{width:100%;min-height:52px;margin-top:18px;border:0;border-radius:16px;background:#c8ff3d;color:#07100c;font-size:14px;font-weight:950;cursor:pointer}.tg-auth-action.secondary{margin-top:9px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff}
      .tg-auth-spinner{width:32px;height:32px;margin:22px auto 0;border:3px solid rgba(255,255,255,.12);border-top-color:#c8ff3d;border-radius:50%;animation:tgAuthSpin .8s linear infinite}@keyframes tgAuthSpin{to{transform:rotate(360deg)}}
      .tg-auth-error{margin-top:14px!important;padding:11px;border:1px solid rgba(255,111,111,.25);border-radius:13px;background:rgba(255,72,72,.07);color:#ffb0b0!important;font-size:11px!important}
    `;
    document.head.appendChild(style);
  }

  function initials(user = {}) {
    return [user.first_name, user.last_name].filter(Boolean).map(value => String(value)[0]).join("").slice(0,2).toUpperCase() || "B";
  }

  function telegramLink() {
    return `https://t.me/${bot}?startapp`;
  }

  function renderOutsideTelegram() {
    styles();
    root().innerHTML = `<main class="tg-auth-gate"><section class="tg-auth-card"><div class="tg-auth-logo">B</div><span class="tg-auth-label">BALI MINSK · TELEGRAM</span><h1>Вход только через Telegram</h1><p>Чтобы открыть афиши, бронирование, BALI Shop, бонусы и BALI People, запустите приложение через официальный бот.</p><button class="tg-auth-action" id="openBaliTelegram" type="button">Открыть @${bot}</button><p style="margin-top:12px;font-size:10px">Прямая ссылка в браузере не предоставляет подтверждённый Telegram-профиль, поэтому доступ закрыт.</p></section></main>`;
    document.getElementById("openBaliTelegram")?.addEventListener("click", () => { location.href = telegramLink(); });
  }

  function renderLoading() {
    styles();
    const user = tg?.initDataUnsafe?.user || {};
    root().innerHTML = `<main class="tg-auth-gate"><section class="tg-auth-card"><div class="tg-auth-logo">B</div><span class="tg-auth-label">ЗАЩИЩЁННЫЙ ВХОД</span><h1>Проверяем Telegram-профиль</h1><div class="tg-auth-user"><span class="tg-auth-avatar">${user.photo_url ? `<img src="${String(user.photo_url).replace(/"/g, "&quot;")}" alt="">` : initials(user)}</span><div><strong>${[user.first_name,user.last_name].filter(Boolean).join(" ") || "Пользователь Telegram"}</strong><small>${user.username ? `@${user.username}` : "Telegram ID подтверждается"}</small></div></div><p>Проверяем цифровую подпись Telegram и подключаем вашу учётную запись к BALI.</p><div class="tg-auth-spinner"></div></section></main>`;
  }

  function renderError(message) {
    styles();
    root().innerHTML = `<main class="tg-auth-gate"><section class="tg-auth-card"><div class="tg-auth-logo">!</div><span class="tg-auth-label">ВХОД НЕ ЗАВЕРШЁН</span><h1>Не удалось подтвердить Telegram</h1><p>Закройте окно Mini App, снова откройте @${bot} и нажмите кнопку запуска приложения.</p><p class="tg-auth-error">${String(message || "Ошибка авторизации").replace(/[<>&]/g, "")}</p><button class="tg-auth-action" id="retryTelegramAuth" type="button">Повторить проверку</button><button class="tg-auth-action secondary" id="reopenTelegramBot" type="button">Открыть бота</button></section></main>`;
    document.getElementById("retryTelegramAuth")?.addEventListener("click", authenticate);
    document.getElementById("reopenTelegramBot")?.addEventListener("click", () => {
      if (tg?.openTelegramLink) tg.openTelegramLink(telegramLink()); else location.href = telegramLink();
    });
  }

  async function authenticate() {
    if (!tg || !String(tg.initData || "").trim() || !tg.initDataUnsafe?.user?.id) {
      renderOutsideTelegram();
      resolveReady({ ok:false, reason:"telegram_required" });
      return;
    }
    if (!endpoint || !cfg.supabaseAnonKey) {
      renderError("Общая база BALI ещё не подключена.");
      return;
    }

    try {
      tg.ready();
      tg.expand();
      try { tg.setHeaderColor("#07100c"); tg.setBackgroundColor("#07100c"); } catch {}
      renderLoading();
      const response = await fetch(endpoint, {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          apikey:cfg.supabaseAnonKey,
          Authorization:`Bearer ${cfg.supabaseAnonKey}`
        },
        body:JSON.stringify({ action:"bootstrap", init_data:tg.initData })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.authenticated || !data.user) throw new Error(data.error || "Telegram не подтвердил вход");
      authenticated = true;
      verifiedUser = data.user;
      window.BALI_TELEGRAM_USER = data.user;
      window.BALI_TELEGRAM_AUTH_DATA = data;
      sessionStorage.setItem("bali_telegram_authenticated", "1");
      document.documentElement.dataset.telegramAuthenticated = "true";
      root().innerHTML = "";
      resolveReady({ ok:true, user:data.user, balance:Number(data.balance || 0), vip:data.vip || null });
      window.dispatchEvent(new CustomEvent("bali:telegram-authenticated", { detail:data }));
    } catch (error) {
      authenticated = false;
      renderError(error instanceof Error ? error.message : "Ошибка входа через Telegram");
    }
  }

  window.BaliTelegramAuth = {
    ready,
    authenticate,
    isAuthenticated:() => authenticated,
    user:() => verifiedUser,
    initData:() => tg?.initData || ""
  };

  authenticate();
})();