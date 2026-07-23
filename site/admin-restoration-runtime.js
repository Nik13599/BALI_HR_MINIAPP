(() => {
  if (window.__BALI_ADMIN_RESTORATION_RUNTIME__) return;
  window.__BALI_ADMIN_RESTORATION_RUNTIME__ = true;

  function apply() {
    const badge = document.getElementById("modeBadge");
    if (badge && /демо|beta|content|stable/i.test(badge.textContent || "")) badge.textContent = window.BaliStore?.cloudEnabled ? "ОБЛАКО" : "ЛОКАЛЬНО";
    document.querySelectorAll("#resetDemo").forEach(node => node.remove());
    document.querySelectorAll(".step strong,.step p,.login-card small,.login-card .eyebrow,.brand small").forEach(node => {
      node.textContent = String(node.textContent || "")
        .replace(/демонстрационный режим/gi,"локальное рабочее хранилище")
        .replace(/демонстрационные данные/gi,"локальные данные")
        .replace(/·\s*(?:BETA\s*\d*|CONTENT\s*\d*|STABLE\s*\d*)/gi,"")
        .trim();
    });
    const hallNav = document.querySelector('#adminNav [data-view="hall"] span');
    if (hallNav) hallNav.textContent = "Схемы";
    const bonusesNav = document.querySelector('#adminNav [data-view="bonuses"] span');
    if (bonusesNav) bonusesNav.textContent = "Баллы + VIP";
  }

  const observer = new MutationObserver(() => requestAnimationFrame(apply));
  observer.observe(document.body,{childList:true,subtree:true});
  [0,150,600,1500].forEach(delay => setTimeout(apply,delay));
})();