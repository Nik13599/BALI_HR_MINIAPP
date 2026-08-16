(() => {
  const frame = document.getElementById("adminFrame");
  if (!frame) return;
  frame.addEventListener("load", () => {
    const win = frame.contentWindow;
    const doc = frame.contentDocument;
    ["admin-loyalty-rewards-beta4.css", "beta4-admin-layout-overrides.css"].forEach(name => {
      const link = doc.createElement("link");
      link.rel = "stylesheet";
      link.href = `./${name}?v=beta4-stable-3`;
      doc.head.appendChild(link);
    });
    let started = false;
    const load = name => new Promise((resolve, reject) => {
      if ([...doc.scripts].some(script => script.src.includes(`/${name}`))) return resolve();
      const script = doc.createElement("script");
      script.src = `./${name}?v=beta4-stable-3`;
      script.async = false;
      script.onload = resolve;
      script.onerror = reject;
      doc.body.appendChild(script);
    });
    const timer = setInterval(async () => {
      if (started || !win.state || win.state.view !== "bonuses" || !win.BaliPoints || !win.BaliBeta4Game) return;
      started = true;
      try {
        for (const name of ["beta4-loyalty-core.js", "beta4-reward-icons-core.js", "reward-png-validator-beta4.js", "admin-loyalty-economy-beta4.js", "admin-custom-rewards-beta4.js", "admin-reward-icon-list-beta4.js"]) await load(name);
        await win.render?.();
      } catch {
        started = false;
        win.toast?.("Не удалось загрузить настройки наград");
      }
    }, 700);
    win.addEventListener("beforeunload", () => clearInterval(timer));
  });
})();