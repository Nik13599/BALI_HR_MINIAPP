(() => {
  if (window.__BALI_LOYALTY_ADMIN_LOADER__) return;
  window.__BALI_LOYALTY_ADMIN_LOADER__ = true;
  let loading = false;
  const loaded = new Set([...document.querySelectorAll("script[src]")].map(s => String(s.src).split("?")[0].split("/").pop()));
  const waitFor = (test, limit = 8000) => new Promise((resolve, reject) => {
    const started = Date.now();
    const check = () => test() ? resolve() : Date.now() - started > limit ? reject(new Error("Не загрузились зависимости раздела")) : setTimeout(check, 80);
    check();
  });
  function load(name) {
    if (loaded.has(name)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `./${name}?v=beta4-social-loyalty-1`;
      script.async = false;
      script.onload = () => { loaded.add(name); resolve(); };
      script.onerror = () => reject(new Error(`Не удалось загрузить ${name}`));
      document.body.appendChild(script);
    });
  }
  async function ensure() {
    if (loading || typeof state === "undefined" || state.view !== "bonuses") return;
    loading = true;
    try {
      await waitFor(() => window.BaliPoints && window.BaliBeta4Game);
      await load("beta4-loyalty-core.js");
      await load("admin-loyalty-economy-beta4.js");
      await load("admin-custom-rewards-beta4.js");
      await window.render?.();
    } catch (error) {
      window.toast?.(error.message || "Не удалось открыть настройки лояльности");
    } finally { loading = false; }
  }
  new MutationObserver(() => setTimeout(ensure, 0)).observe(document.documentElement, { subtree: true, childList: true });
  document.addEventListener("click", event => { if (event.target.closest('[data-view="bonuses"]')) setTimeout(ensure, 120); }, true);
})();