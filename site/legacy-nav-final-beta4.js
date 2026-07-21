(() => {
  if (window.__BALI_LEGACY_FINAL_NAV__) return;
  window.__BALI_LEGACY_FINAL_NAV__ = true;

  const buttons = [
    ["home", "⌂", "Главная"],
    ["events", "◫", "Афиши"],
    ["menu", "◇", "Меню"],
    ["dating", "🌴", "BALI PEOPLE"],
    ["crown", "👑", "Конкурс"],
    ["profile", "◎", "Профиль"]
  ];

  function ready() {
    return Boolean(
      document.querySelector('.pages') &&
      document.querySelector('[data-screen="home"]') &&
      document.querySelector('[data-screen="events"]') &&
      document.querySelector('[data-screen="menu"]') &&
      document.querySelector('[data-screen="dating"]') &&
      document.querySelector('[data-screen="crown"]') &&
      document.querySelector('[data-screen="profile"]')
    );
  }

  function finalize() {
    const nav = document.querySelector('.shell > nav.nav');
    if (!nav || !ready()) return false;

    const activePage = document.querySelector('.page.active[data-screen]')?.dataset.screen || 'home';
    nav.replaceChildren(...buttons.map(([page, icon, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.page = page;
      if (page === activePage) button.classList.add('active');

      const i = document.createElement('i');
      i.textContent = icon;
      const span = document.createElement('span');
      span.textContent = label;
      button.append(i, span);
      return button;
    }));

    nav.classList.remove('social-six');
    nav.style.removeProperty('grid-template-columns');
    nav.dataset.navigationReady = 'true';
    return true;
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (finalize() || attempts >= 60) {
      clearInterval(timer);
      if (!document.querySelector('.shell > nav.nav[data-navigation-ready="true"]')) {
        const nav = document.querySelector('.shell > nav.nav');
        if (nav) nav.dataset.navigationReady = 'true';
      }
    }
  }, 100);

  window.BaliLegacyNavigation = { finalize };
})();
