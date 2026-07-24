(() => {
  'use strict';
  if (window.__BALI_REBUILD_CONTACT_ACTIONS_V1__) return;
  window.__BALI_REBUILD_CONTACT_ACTIONS_V1__ = true;

  function external(url, telegram = false) {
    if (!url) return;
    const tg = window.Telegram?.WebApp;
    try {
      if (telegram && tg?.openTelegramLink) {
        tg.openTelegramLink(url);
        return;
      }
      if (!telegram && tg?.openLink) {
        tg.openLink(url, { try_instant_view:false });
        return;
      }
    } catch (error) {
      console.warn('[BALI contact]', error);
    }
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = telegram ? '_self' : '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  function phone(value) {
    const number = String(value || '+375296700300').replace(/[^+\d]/g, '');
    const anchor = document.createElement('a');
    anchor.href = `tel:${number}`;
    anchor.style.display = 'none';
    anchor.dataset.baliPhoneLink = number;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-link]');
    if (!button) return;
    const cfg = window.BALI_CONFIG || {};
    const type = button.dataset.link;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (type === 'instagram') external(cfg.instagramUrl || 'https://www.instagram.com/baliminsk/');
    if (type === 'manager') external(cfg.managerTelegramUrl || 'https://t.me/BaliMinskAppBot', true);
    if (type === 'phone') phone(cfg.venuePhone || '+375296700300');
    if (type === 'map') external(cfg.yandexMapUrl || 'https://yandex.by/maps/');
  }, true);
})();
