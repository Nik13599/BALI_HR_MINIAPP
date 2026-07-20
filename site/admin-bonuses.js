(() => {
  const load = (src) => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
  const start = window.BaliPoints ? Promise.resolve() : load("./points-core.js?v=beta3-bookings");
  start
    .then(() => load("./points-admin.js?v=beta3-bookings"))
    .then(() => load("./points-admin-manual.js?v=beta3-bookings"))
    .then(() => load("./booking-admin-beta3.js?v=beta3-bookings"))
    .then(() => {
      const label = document.querySelector('[data-view="bonuses"] span');
      if (label) label.textContent = "BALI-Баллы";
    })
    .catch(() => window.toast?.("Не удалось загрузить расширения Beta3"));
})();