(() => {
  "use strict";

  const beta = window.BaliClanBeta;
  const user = beta.currentUser();
  const root = document.getElementById("baliApp");
  root.hidden = false;
  document.getElementById("currentUserName").textContent = user.name;
  document.getElementById("currentUserAvatar").textContent = user.name[0].toUpperCase();

  const app = window.BaliClanChatApp({ api:beta.api, user });

  document.querySelectorAll("[data-beta-reset]").forEach(button => {
    button.addEventListener("click", () => {
      if (!confirm("Вернуть исходные данные beta-чата?")) return;
      beta.reset();
      location.reload();
    });
  });

  document.querySelectorAll("[data-beta-fullscreen]").forEach(button => {
    button.addEventListener("click", async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch {
        // Some mobile browsers allow fullscreen only after installation.
      }
    });
  });

  window.addEventListener("storage", event => {
    if (event.key === "bali_clan_chat_beta_v1") app.reload().catch(() => {});
  });
})();
