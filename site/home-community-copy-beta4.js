(() => {
  if (window.__BALI_HOME_COMMUNITY_COPY__) return;
  window.__BALI_HOME_COMMUNITY_COPY__ = true;

  function apply() {
    const hero = document.querySelector('[data-screen="home"] .hero');
    if (!hero) return;
    const title = hero.querySelector('h1');
    if (title) title.textContent = 'BALI';
    const paragraph = hero.querySelector('p');
    if (paragraph) paragraph.textContent = 'BALI — приложение ночного клуба и комьюнити людей, объединённых музыкой, любимыми диджеями, артистами и яркими вечеринками.';
  }

  const observer = new MutationObserver(() => requestAnimationFrame(apply));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  ['bali:full-demo-ready', 'bali:full-demo-enhancements-ready', 'bali:beta4-changed'].forEach(name => window.addEventListener(name, apply));
  apply();
  window.BaliHomeCommunityCopy = { apply };
})();