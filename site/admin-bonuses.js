(() => {
  const load = (src) => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
  const start = window.BaliPoints ? Promise.resolve() : load("./points-core.js?v=beta3-points");
  start.then(() => load("./points-admin.js?v=beta3-points"))
    .catch(() => window.toast?.("Не удалось загрузить управление BALI-Баллами"));
})();