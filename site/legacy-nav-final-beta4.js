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

  const screenExists = page => Boolean(document.querySelector(`[data-screen="${page}"]`));

  function syncAvailability(nav) {
    nav.querySelectorAll('button[data-page]').forEach(button => {
      const page = button.dataset.page;
      const available = screenExists(page);
      button.disabled = !available;
      button.classList.toggle('navigation-loading', !available);
      button.setAttribute('aria-busy', available ? 'false' : 'true');
      button.title = available ? '' : 'Раздел загружается';
    });
    return buttons.every(([page]) => screenExists(page));
  }

  function finalize() {
    const nav = document.querySelector('.shell > nav.nav');
    if (!nav) return false;

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
    syncAvailability(nav);
    return true;
  }

  let mountAttempts = 0;
  const mountTimer = setInterval(() => {
    mountAttempts += 1;
    if (finalize() || mountAttempts >= 40) clearInterval(mountTimer);
  }, 25);

  let availabilityAttempts = 0;
  const availabilityTimer = setInterval(() => {
    availabilityAttempts += 1;
    const nav = document.querySelector('.shell > nav.nav[data-navigation-ready="true"]');
    if (!nav) return;
    if (syncAvailability(nav) || availabilityAttempts >= 200) clearInterval(availabilityTimer);
  }, 50);

  window.BaliLegacyNavigation = { finalize, syncAvailability };
})();