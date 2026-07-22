(() => {
  if (window.__BALI_BETA4_HOME_LINKS__) return;
  window.__BALI_BETA4_HOME_LINKS__ = true;
  const cfg = window.BALI_CONFIG || {};
  const tg = window.Telegram?.WebApp;

  function mount() {
    const inner = document.querySelector('[data-screen="home"] .inner');
    if (!inner || document.getElementById("clubLinks")) return Boolean(document.getElementById("clubLinks"));
    const actions = inner.querySelector(".actions");
    const phone = cfg.venuePhone || "+375296700300";
    const telegram = cfg.telegramChannelUrl || "https://t.me/baliclubminsk";
    const manager = cfg.managerTelegramUrl || "https://t.me/BALI_MINSK";
    const instagram = cfg.instagramUrl || "https://www.instagram.com/baliminsk/";
    const map = cfg.yandexMapUrl || "https://yandex.by/maps/org/bali_night_club/104137822369/";
    const card = document.createElement("section");
    card.className = "card home-links-card";
    card.id = "clubLinks";
    card.innerHTML = `
      <section class="home-links-section home-social-section">
        <div class="home-links-heading"><span>СОЦСЕТИ</span><h3>Мы в соцсетях</h3></div>
        <div class="club-links home-social-links">
          <a href="${instagram}" data-contact-key="instagram" data-open-link><i>◎</i><span><strong>Instagram</strong><small>Новости и атмосфера</small></span></a>
          <a href="${telegram}" data-contact-key="telegram" data-telegram-link><i>✈</i><span><strong>Telegram-канал</strong><small>Афиши и новости</small></span></a>
        </div>
      </section>
      <section class="home-links-section home-map-section">
        <div class="home-links-heading"><span>АДРЕС</span><h3>Как нас найти</h3></div>
        <div class="club-links home-map-links">
          <a href="${map}" data-contact-key="map" data-open-link><i>⌖</i><span><strong>Открыть в Яндекс.Картах</strong><small>Минск, ул. Кирова, 13 · построить маршрут</small></span><b>→</b></a>
        </div>
      </section>
      <section class="home-links-section home-contact-section">
        <div class="home-links-heading"><span>КОНТАКТЫ</span><h3 data-contact-title="contact">Связаться с BALI</h3></div>
        <div class="club-links home-contact-links">
          <a href="tel:${phone.replace(/[^+\d]/g, "")}" data-contact-key="phone"><i>☎</i><span><strong>Позвонить</strong><small>${phone}</small></span></a>
          <a href="${manager}" data-contact-key="manager" data-telegram-link><i>💬</i><span><strong>Менеджер</strong><small>Telegram</small></span></a>
        </div>
      </section>`;
    actions?.insertAdjacentElement("afterend", card);
    return true;
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

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (mount() || attempts > 30) clearInterval(timer);
  }, 100);
})();