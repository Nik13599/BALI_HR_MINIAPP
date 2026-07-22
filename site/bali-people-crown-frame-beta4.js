(() => {
  if (window.__BALI_PEOPLE_CROWN_FRAME__) return;
  window.__BALI_PEOPLE_CROWN_FRAME__ = true;

  async function apply() {
    const social = window.BaliBeta4Social;
    const winsApi = window.BaliCrownWinCards;
    if (!social?.visiblePeople || !winsApi?.winCounts) return;
    const people = social.visiblePeople();
    await Promise.all([...document.querySelectorAll('[data-open-social-person]')].map(async card => {
      const person = people.find(row => String(row.id) === String(card.dataset.openSocialPerson));
      if (!person) return;
      let wins = { miss: 0, mister: 0 };
      try { wins = await winsApi.winCounts(person); } catch {}
      if (!Number(wins.miss || 0) && !Number(wins.mister || 0)) return;
      const photo = card.querySelector('.person-v2-photo');
      if (!photo) return;
      [...photo.classList].filter(name => name.startsWith('people-status-') || name.startsWith('people-level-')).forEach(name => photo.classList.remove(name));
      photo.classList.add('people-status-crown');
      const body = card.querySelector('.person-v2-body');
      if (!body) return;
      let badge = body.querySelector('.people-status-chip');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'people-status-chip';
        body.appendChild(badge);
      }
      badge.textContent = wins.miss ? `Королева ночи · ${Number(wins.miss)}×` : `Король ночи · ${Number(wins.mister)}×`;
    }));
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(async () => {
      scheduled = false;
      await apply();
    });
  }

  new MutationObserver(records => {
    if (records.some(record => record.addedNodes.length || record.removedNodes.length)) schedule();
  }).observe(document.body, { childList: true, subtree: true });
  ['bali:social-changed','bali:crown-win-cards-ready','bali:night-crown-changed','bali:data-changed'].forEach(name => window.addEventListener(name, schedule));
  schedule();
  window.BaliPeopleCrownFrame = { apply };
})();