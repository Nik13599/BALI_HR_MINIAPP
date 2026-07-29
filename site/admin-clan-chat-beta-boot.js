(() => {
  "use strict";

  document.querySelectorAll("[data-beta-reset]").forEach(button => {
    button.addEventListener("click", () => {
      if (!confirm("Вернуть исходные данные beta user/admin?")) return;
      window.BaliClanBeta.reset();
      location.reload();
    });
  });

  window.addEventListener("storage", event => {
    if (event.key === "bali_clan_chat_beta_v1") location.reload();
  });
})();
