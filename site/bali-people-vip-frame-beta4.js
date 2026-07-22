(() => {
  if (window.__BALI_PEOPLE_VIP_FRAME__) return;
  window.__BALI_PEOPLE_VIP_FRAME__ = true;

  const classFor = planId => planId === "legend" ? "people-status-legend" : planId === "black" ? "people-status-black" : "people-status-vip";
  const labelFor = planId => planId === "legend" ? "BALI LEGEND" : planId === "black" ? "BALI BLACK" : "BALI VIP";

  function activeVip(person) {
    const planId = String(person?.vipPlanId || person?.vip_plan_id || "");
    if (!planId) return null;
    const expires = person?.vipExpiresAt || person?.vip_expires_at || "";
    if (expires && new Date(expires).getTime() <= Date.now()) return null;
    return { planId };
  }

  function apply() {
    const social = window.BaliBeta4Social;
    if (!social?.visiblePeople) return;
    const people = social.visiblePeople();
    document.querySelectorAll('[data-open-social-person]').forEach(card => {
      const person = people.find(row => String(row.id) === String(card.dataset.openSocialPerson));
      const vip = activeVip(person);
      if (!vip) return;
      const photo = card.querySelector('.person-v2-photo');
      if (!photo || photo.classList.contains('people-status-crown')) return;
      [...photo.classList].filter(name => name.startsWith('people-status-') || name.startsWith('people-level-')).forEach(name => photo.classList.remove(name));
      photo.classList.add(classFor(vip.planId));
      const body = card.querySelector('.person-v2-body');
      if (!body) return;
      let badge = body.querySelector('.people-status-chip');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'people-status-chip';
        body.appendChild(badge);
      }
      const text = labelFor(vip.planId);
      if (badge.textContent !== text) badge.textContent = text;
    });
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  }

  new MutationObserver(records => {
    const relevant = records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => {
      if (node.nodeType !== 1) return false;
      return node.matches?.('[data-open-social-person],.people-v2-grid,#socialV2Content') || node.querySelector?.('[data-open-social-person]');
    }));
    if (relevant) schedule();
  }).observe(document.body, { childList: true, subtree: true });
  ['bali:social-changed','bali:beta4-changed','bali:points-changed'].forEach(name => window.addEventListener(name, schedule));
  schedule();
  window.BaliPeopleVipFrame = { apply };
})();