(() => {
  if (window.__BALI_HOME_COMMUNITY_COPY__) return;
  window.__BALI_HOME_COMMUNITY_COPY__ = true;

  const COPY = {
    title: "BALI",
    paragraph: "BALI — приложение ночного клуба и комьюнити людей, объединённых музыкой, любимыми диджеями, артистами и яркими вечеринками."
  };

  function apply() {
    const hero = document.querySelector('[data-screen="home"] .hero');
    if (!hero) return false;
    const title = hero.querySelector('h1');
    if (title && title.textContent !== COPY.title) title.textContent = COPY.title;
    const paragraph = hero.querySelector('p');
    if (paragraph && paragraph.textContent !== COPY.paragraph) paragraph.textContent = COPY.paragraph;
    return true;
  }

  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      apply();
    });
  };
  const app = document.getElementById("app");
  const observer = app ? new MutationObserver(records => {
    if (records.some(record => [...record.addedNodes].some(node => node.nodeType === 1))) schedule();
  }) : null;
  observer?.observe(app, { childList: true });
  ['bali:full-demo-ready', 'bali:full-demo-enhancements-ready', 'bali:beta4-changed'].forEach(name => window.addEventListener(name, schedule));
  apply();
  window.BaliHomeCommunityCopy = { apply, schedule };
})();
