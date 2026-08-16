(() => {
  const load = (src) => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
  const run = async () => {
    if (!window.BaliPoints) await load("./points-core.js?v=beta3-bookings");
    await load("./points-admin.js?v=beta3-bookings");
    await load("./points-admin-manual.js?v=beta3-bookings");
    await load("./booking-admin-beta3.js?v=beta3-bookings");
  };
  run().catch(() => window.toast?.("Ошибка загрузки расширений Beta3"));
})();