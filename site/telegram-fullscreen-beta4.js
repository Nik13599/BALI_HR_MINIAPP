(() => {
  if (window.__BALI_TELEGRAM_FULLSCREEN__) return;
  window.__BALI_TELEGRAM_FULLSCREEN__ = true;

  const tg = window.BALI_TELEGRAM_MINI_APP ? window.Telegram?.WebApp : null;
  const root = document.documentElement;
  let fullscreenRequested = false;

  const px = value => `${Math.max(0, Number(value) || 0)}px`;

  function setInsetVariables(prefix, inset = {}) {
    root.style.setProperty(`--${prefix}-top`, px(inset.top));
    root.style.setProperty(`--${prefix}-right`, px(inset.right));
    root.style.setProperty(`--${prefix}-bottom`, px(inset.bottom));
    root.style.setProperty(`--${prefix}-left`, px(inset.left));
  }

  function syncViewport() {
    const height = Number(tg?.viewportStableHeight || tg?.viewportHeight || window.visualViewport?.height || window.innerHeight);
    if (height > 0) root.style.setProperty("--bali-viewport-height", `${Math.round(height)}px`);

    if (tg) {
      setInsetVariables("bali-safe", tg.safeAreaInset);
      setInsetVariables("bali-content-safe", tg.contentSafeAreaInset || tg.safeAreaInset);
    }
    root.dataset.telegramFullscreen = tg?.isFullscreen ? "true" : "false";
    root.dataset.telegramExpanded = tg?.isExpanded ? "true" : "false";
  }

  function requestFullscreen() {
    if (!tg || fullscreenRequested || tg.isFullscreen) {
      syncViewport();
      return;
    }

    fullscreenRequested = true;
    try {
      tg.expand?.();
      if (typeof tg.requestFullscreen === "function" && (!tg.isVersionAtLeast || tg.isVersionAtLeast("8.0"))) {
        tg.requestFullscreen();
      }
    } catch (error) {
      console.warn("Telegram fullscreen request was not accepted", error);
      try { tg.expand?.(); } catch {}
    }
    syncViewport();
  }

  if (!tg) {
    syncViewport();
    window.visualViewport?.addEventListener?.("resize", syncViewport, { passive:true });
    window.addEventListener("resize", syncViewport, { passive:true });
    window.BaliTelegramFullscreen = { active:false, syncViewport, requestFullscreen };
    return;
  }

  try {
    tg.ready();
    tg.setHeaderColor?.("#080a0a");
    tg.setBackgroundColor?.("#080a0a");
    tg.setBottomBarColor?.("#0c0f0e");
  } catch {}

  ["viewportChanged", "safeAreaChanged", "contentSafeAreaChanged", "fullscreenChanged"].forEach(eventName => {
    try { tg.onEvent?.(eventName, syncViewport); } catch {}
  });
  try {
    tg.onEvent?.("fullscreenFailed", () => {
      try { tg.expand?.(); } catch {}
      syncViewport();
    });
  } catch {}

  window.visualViewport?.addEventListener?.("resize", syncViewport, { passive:true });
  window.addEventListener("resize", syncViewport, { passive:true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) syncViewport();
  });

  syncViewport();
  requestAnimationFrame(requestFullscreen);
  window.BaliTelegramFullscreen = { active:true, syncViewport, requestFullscreen };
})();
