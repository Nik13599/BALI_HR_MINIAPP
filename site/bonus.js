(() => {
  const version = "beta3-event-layouts";
  const load = (src) => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = `./event-details-beta3.css?v=${version}`;
  document.head.appendChild(style);
  load(`./points-core.js?v=${version}`)
    .then(() => load(`./points-ui.js?v=${version}`))
    .then(() => load(`./event-layouts-beta3.js?v=${version}`))
    .then(() => load(`./my-bookings-beta3.js?v=${version}`))
    .then(() => load(`./telegram-customer-beta3.js?v=${version}`))
    .then(() => load(`./upcoming-booking-beta3.js?v=${version}`))
    .then(() => load(`./event-details-beta3.js?v=${version}`))
    .catch(() => {
      const node = document.getElementById("toast");
      if (node) {
        node.textContent = "Не удалось загрузить профиль, брони или схемы мероприятий";
        node.classList.add("show");
      }
    });
})();