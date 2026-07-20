(() => {
  if (window.__BALI_BETA4_HOME_LINKS__) return;
  window.__BALI_BETA4_HOME_LINKS__ = true;
  const cfg = window.BALI_CONFIG || {};
  const tg = window.Telegram?.WebApp;

  function mount() {
    const inner = document.querySelector('[data-screen="home"] .inner');
    if (!inner || document.getElementById("clubLinks")) return;
    const actions = inner.querySelector(".actions");
    const phone = cfg.venuePhone || "+375296700300";
    const telegram = cfg.telegramChannelUrl || "https://t.me/baliclubminsk";
    const manager = cfg.managerTelegramUrl || "https://t.me/BALI_MINSK";
    const instagram = cfg.instagramUrl || "https://www.instagram.com/baliminsk/";
    const map = cfg.yandexMapUrl || "https://yandex.by/maps/org/bali_night_club/104137822369/";
    const card = document.createElement("section");
    card.className = "card";
    card.id = "clubLinks";
    card.innerHTML = `<div class="card-head"><h3>Связаться с BALI</h3></div><div class="club-links"><a href="${instagram}" data-open-link><i>◎</i><span><strong>Instagram</strong><small>Новости и атмосфера</small></span></a><a href="${telegram}" data-telegram-link><i>✈</i><span><strong>Telegram</strong><small>Канал клуба</small></span></a><a href="${manager}" data-telegram-link><i>💬</i><span><strong>Связаться с менеджером</strong><small>Личный чат в Telegram</small></span></a><a href="tel:${phone.replace(/[^+\d]/g, "")}"><i>☎</i><span><strong>Позвонить</strong><small>${phone}</small></span></a><a href="${map}" data-open-link><i>⌖</i><span><strong>Как добраться</strong><small>Яндекс Карты</small></span></a></div>`;
    actions?.insertAdjacentElement("afterend", card);
  }

  document.addEventListener("click", event => {
    const telegram = event.target.closest("[data-telegram-link]");
    if (telegram && tg?.openTelegramLink) {
      event.preventDefault();
      tg.openTelegramLink(telegram.href);
      return;
    }
    const external = event.target.closest("[data-open-link]");
    if (external && tg?.openLink) {
      event.preventDefault();
      tg.openLink(external.href);
    }
  });

  const observer = new MutationObserver(mount);
  observer.observe(document.documentElement, {subtree:true, childList:true});
  setTimeout(mount, 0);
})();