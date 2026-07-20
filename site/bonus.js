(() => {
  const load = (src) => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
  load("./points-core.js?v=beta3-points")
    .then(() => load("./points-ui.js?v=beta3-points"))
    .catch(() => window.toast?.("Не удалось загрузить BALI-Баллы"));
})();