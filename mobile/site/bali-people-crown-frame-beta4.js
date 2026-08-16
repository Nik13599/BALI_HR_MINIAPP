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
      const conflicting = [...photo.classList].filter(name => (name.startsWith('people-status-') || name.startsWith('people-level-')) && name !== 'people-status-crown');
      conflicting.forEach(name => photo.classList.remove(name));
      if (!photo.classList.contains('people-status-crown')) photo.classList.add('people-status-crown');
      const body = card.querySelector('.person-v2-body');
      if (!body) return;
      let badge = body.querySelector('.people-status-chip');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'people-status-chip';
        body.appendChild(badge);
      }
      const text = wins.miss ? `Королева ночи · ${Number(wins.miss)}×` : `Король ночи · ${Number(wins.mister)}×`;
      if (badge.textContent !== text) badge.textContent = text;
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
    const relevant = records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => {
      if (node.nodeType !== 1) return false;
      return node.matches?.('[data-open-social-person],.people-v2-grid,#socialV2Content')
        || node.querySelector?.('[data-open-social-person]');
    }));
    if (relevant) schedule();
  }).observe(document.body, { childList: true, subtree: true });
  ['bali:social-changed','bali:crown-win-cards-ready','bali:night-crown-changed','bali:data-changed'].forEach(name => window.addEventListener(name, schedule));
  schedule();
  window.BaliPeopleCrownFrame = { apply };
})();