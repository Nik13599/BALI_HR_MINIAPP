(() => {
  const version = "beta3-event-layouts";
  const load = (src) => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
  const start = window.BaliPoints ? Promise.resolve() : load(`./points-core.js?v=${version}`);
  start
    .then(() => load(`./points-admin.js?v=${version}`))
    .then(() => load(`./points-admin-manual.js?v=${version}`))
    .then(() => load(`./booking-admin-beta3.js?v=${version}`))
    .then(() => load(`./customer-admin-beta3.js?v=${version}`))
    .then(() => load(`./event-layouts-beta3.js?v=${version}`))
    .then(() => load(`./event-layout-admin-beta3.js?v=${version}`))
    .then(() => {
      const label = document.querySelector('[data-view="bonuses"] span');
      if (label) label.textContent = "BALI-Баллы";
      if (["bookings", "bonuses", "customers", "events"].includes(state.view)) render();
    })
    .catch(() => window.toast?.("Не удалось загрузить расширения Beta3"));
})();