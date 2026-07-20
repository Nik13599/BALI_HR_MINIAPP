(() => {
  const load = (src) => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
  load("./points-core.js?v=beta3-bookings")
    .then(() => load("./points-ui.js?v=beta3-bookings"))
    .then(() => load("./my-bookings-beta3.js?v=beta3-bookings"))
    .catch(() => {
      const node = document.getElementById("toast");
      if (node) {
        node.textContent = "Не удалось загрузить BALI-Баллы и мои брони";
        node.classList.add("show");
      }
    });
})();