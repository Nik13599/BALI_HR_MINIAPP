(() => {
  if (window.__BALI_PEOPLE_PRESENT__) return;
  window.__BALI_PEOPLE_PRESENT__ = true;

  const social = window.BaliBeta4Social;
  const attendance = window.BaliEventQrAttendance;
  if (!social || !attendance) return;

  let presentMode = false;
  let applying = false;
  const identity = person => new Set([
    person?.id, person?.userKey, person?.user_key, person?.ownerKey, person?.owner_key, person?.code,
    person?.telegramId ? `tg:${person.telegramId}` : ""
  ].filter(Boolean).map(String));

  function styles() {
    if (document.getElementById("baliPeoplePresentStyle")) return;
    const style = document.createElement("style");
    style.id = "baliPeoplePresentStyle";
    style.textContent = `
      [data-screen="dating"] [data-social-v2-tab="inside"]{font-size:8px!important;line-height:1.25!important;padding:0 5px!important}
      .person-v2.people-not-present{display:none!important}
      .people-present-dot{display:inline-flex;align-items:center;gap:5px;margin-top:5px;color:var(--lime);font-size:7px;font-weight:900}
      .people-present-dot:before{content:"";width:6px;height:6px;border-radius:50%;background:var(--lime);box-shadow:0 0 9px rgba(200,255,61,.8)}
    `;
    document.head.appendChild(style);
  }

  async function activeIdentities() {
    const rows = await attendance.listCheckins();
    const set = new Set();
    rows.filter(row => !row.left_at && row.presence_status !== "left").forEach(row => {
      if (row.user_key) set.add(String(row.user_key));
      if (row.telegram_id) set.add(`tg:${row.telegram_id}`);
    });
    return set;
  }

  async function apply() {
    if (applying) return;
    applying = true;
    try {
      const inside = document.querySelector('[data-screen="dating"] [data-social-v2-tab="inside"]');
      if (inside) inside.textContent = "Пришёл на мероприятие";
      const cards = [...document.querySelectorAll('[data-screen="dating"] [data-open-social-person]')];
      if (!cards.length) return;
      const active = await activeIdentities();
      const people = social.visiblePeople?.() || [];
      cards.forEach(card => {
        const person = people.find(row => String(row.id) === String(card.dataset.openSocialPerson)) || {};
        const isPresent = [...identity(person)].some(key => active.has(key));
        card.classList.toggle("people-not-present", presentMode && !isPresent);
        const body = card.querySelector(".person-v2-body");
        let badge = body?.querySelector(".people-present-dot");
        if (isPresent && body && !badge) {
          badge = document.createElement("span");
          badge.className = "people-present-dot";
          badge.textContent = "Сейчас на мероприятии";
          body.querySelector(".people-demographic-meta")?.insertAdjacentElement("afterend", badge) || body.appendChild(badge);
        }
        if (!isPresent) badge?.remove();
      });
    } catch (error) {
      console.warn("BALI People presence filter", error);
    } finally {
      applying = false;
    }
  }

  document.addEventListener("click", event => {
    const tab = event.target.closest("[data-social-v2-tab]");
    if (!tab) return;
    if (tab.dataset.socialV2Tab === "inside") {
      presentMode = true;
      setTimeout(() => {
        document.querySelector('[data-social-v2-tab="all"]')?.click();
        document.querySelectorAll("[data-social-v2-tab]").forEach(button => button.classList.toggle("active", button.dataset.socialV2Tab === "inside"));
        apply();
      }, 0);
    } else {
      presentMode = false;
      setTimeout(apply, 0);
    }
  }, true);

  const observer = new MutationObserver(records => {
    if (records.some(record => record.addedNodes.length)) requestAnimationFrame(apply);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  ["bali:checkin-complete", "bali:checkin-left", "bali:data-changed", "bali:social-changed"].forEach(name => window.addEventListener(name, () => setTimeout(apply, 0)));
  styles();
  setTimeout(apply, 250);
})();