(() => {
  if (window.__BALI_BETA4_HOME_LINKS__) return;
  window.__BALI_BETA4_HOME_LINKS__ = true;

  const cfg = window.BALI_CONFIG || {};
  const VERSION = "social-channel-v2";

  const values = () => ({
    phone: cfg.venuePhone || "+375296700300",
    telegram: cfg.telegramChannelUrl || "https://t.me/baliclubminsk",
    manager: cfg.managerTelegramUrl || "https://t.me/BALI_MINSK",
    instagram: cfg.instagramUrl || "https://www.instagram.com/baliminsk/",
    tiktok: cfg.tiktokUrl || "https://www.tiktok.com/@baliminsk",
    map: cfg.yandexMapUrl || "https://yandex.by/maps/org/bali_night_club/104137822369/"
  });

  function html() {
    const { phone, telegram, manager, instagram, tiktok, map } = values();
    return `
      <section class="home-links-section home-social-section">
        <div class="home-links-heading"><span>СОЦСЕТИ</span><h3>Мы в соцсетях</h3></div>
        <div class="club-links home-social-links">
          <a class="social-instagram" href="${instagram}" data-contact-key="instagram" data-open-link><i>◎</i><span><strong>Instagram</strong><small>Новости и атмосфера</small></span></a>
          <a class="social-tiktok" href="${tiktok}" data-contact-key="tiktok" data-open-link><i>♪</i><span><strong>TikTok</strong><small>Видео из BALI</small></span></a>
          <a class="social-telegram" href="${telegram}" data-contact-key="telegram-channel" data-telegram-link><i>✈</i><span><strong>Telegram-канал</strong><small>Сообщество, афиши и новости</small></span></a>
        </div>
      </section>
      <section class="home-links-section home-map-section">
        <div class="home-links-heading"><span>КАК ДОБРАТЬСЯ</span><h3>Яндекс Карты</h3></div>
        <div class="club-links home-map-links">
          <a class="yandex-map-button" href="${map}" data-contact-key="map" data-open-link><i class="yandex-map-icon">Я</i><span><strong>Открыть в Яндекс Картах</strong><small>Минск, ул. Кирова, 13 · построить маршрут</small></span><b>→</b></a>
        </div>
      </section>
      <section class="home-links-section home-contact-section">
        <div class="home-links-heading"><span>КОНТАКТЫ</span><h3 data-contact-title="contact">Связаться с BALI</h3></div>
        <div class="club-links home-contact-links">
          <a class="contact-phone" href="tel:${phone.replace(/[^+\d]/g, "")}" data-contact-key="phone"><i>☎</i><span><strong>Позвонить</strong><small>${phone}</small></span></a>
          <a class="contact-manager" href="${manager}" data-contact-key="manager" data-telegram-link><i>✈</i><span><strong>Написать менеджеру</strong><small>в Telegram</small></span></a>
        </div>
      </section>`;
  }

  function sync() {
    const inner = document.querySelector('[data-screen="home"] .inner');
    if (!inner) return false;
    let card = document.getElementById("clubLinks");
    if (!card) {
      card = document.createElement("section");
      card.className = "card home-links-card";
      card.id = "clubLinks";
      inner.querySelector(".actions")?.insertAdjacentElement("afterend", card);
    }
    if (card.dataset.linksVersion !== VERSION) {
      card.innerHTML = html();
      card.dataset.linksVersion = VERSION;
    }
    return true;
  }

  document.addEventListener("click", event => {
    const link = event.target.closest("[data-telegram-link], [data-open-link]");
    if (!link) return;
    const tg = window.Telegram?.WebApp;
    if (link.matches("[data-telegram-link]") && tg?.openTelegramLink) {
      event.preventDefault();
      tg.openTelegramLink(link.href);
    } else if (link.matches("[data-open-link]") && tg?.openLink) {
      event.preventDefault();
      tg.openLink(link.href);
    }
  });

  ["bali:full-demo-ready", "bali:full-demo-enhancements-ready", "bali:home-design-changed"].forEach(name => window.addEventListener(name, sync));
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (sync() || attempts > 30) clearInterval(timer);
  }, 100);

  window.BaliHomeLinks = { sync };
})();