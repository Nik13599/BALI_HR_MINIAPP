(() => {
  if (window.__BALI_PEOPLE_VIP_FRAME__) return;
  window.__BALI_PEOPLE_VIP_FRAME__ = true;

  const DEFAULT_RING = "#46524b";

  function styles() {
    if (document.getElementById("baliPeopleVipFrameStyle")) return;
    const style = document.createElement("style");
    style.id = "baliPeopleVipFrameStyle";
    style.textContent = `
      .person-v2-photo{
        --vip-ring:${DEFAULT_RING};
        --vip-glow:rgba(90,110,98,.28);
        width:calc(100% - 24px)!important;
        max-width:230px;
        aspect-ratio:1!important;
        margin:12px auto 0;
        border:4px solid var(--vip-ring)!important;
        border-radius:50%!important;
        box-shadow:0 0 0 3px #0d100f,0 0 22px var(--vip-glow)!important;
        overflow:hidden!important;
        background:#171c19!important;
      }
      .person-v2-photo img,.person-v2-photo .person-v2-placeholder{border-radius:50%!important}
      .person-v2-photo img{object-fit:cover!important}
      .person-v2-photo.is-locked img,.person-v2-photo.is-locked .person-v2-placeholder{filter:none!important;transform:none!important}
      .person-v2-photo .person-v2-lock{display:none!important}
      .person-v2-photo .person-v2-status{left:50%!important;right:auto!important;bottom:5px!important;max-width:86%;transform:translateX(-50%);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .person-v2-photo.people-has-vip{border-width:5px!important}
      .people-status-chip{display:inline-flex;align-items:center;gap:5px;margin-top:8px;padding:5px 8px;border:1px solid var(--vip-ring,#c8ff3d);border-radius:999px;background:color-mix(in srgb,var(--vip-ring,#c8ff3d) 13%,transparent);color:var(--vip-ring,#c8ff3d);font-size:8px;font-weight:900;letter-spacing:.05em}
      .people-status-chip:before{content:"◆";font-size:7px}
      .people-vip-benefits{display:grid;gap:6px;margin-top:12px;padding:12px;border:1px solid var(--vip-ring,#c8ff3d);border-radius:14px;background:color-mix(in srgb,var(--vip-ring,#c8ff3d) 8%,transparent)}
      .people-vip-benefits strong{color:var(--vip-ring,#c8ff3d);font-size:11px}
      .people-vip-benefits p{margin:0!important;color:#cfd7d2!important;font-size:9px!important;line-height:1.5!important}
      .people-vip-benefits ul{display:grid;gap:4px;margin:0;padding-left:17px;color:#d9dfdb;font-size:9px;line-height:1.45}
      .people-vip-benefits time{color:var(--muted);font-size:8px}
      @media(max-width:360px){.person-v2-photo{max-width:190px}}
    `;
    document.head.appendChild(style);
  }

  function fallbackColor(planId = "") {
    const id = String(planId).toLowerCase();
    if (id.includes("legend") || id.includes("gold")) return "#e3bd64";
    if (id.includes("black")) return "#a7b0bd";
    return "#c8ff3d";
  }

  function activeVip(person) {
    const planId = String(person?.vipPlanId || person?.vip_plan_id || "");
    if (!planId) return null;
    const expires = person?.vipExpiresAt || person?.vip_expires_at || "";
    if (expires && new Date(expires).getTime() <= Date.now()) return null;
    return {
      planId,
      name: String(person?.vipPlanName || person?.vip_plan_name || "BALI VIP"),
      color: String(person?.vipColor || person?.vip_color || fallbackColor(planId)),
      description: String(person?.vipDescription || ""),
      privileges: Array.isArray(person?.vipPrivileges) ? person.vipPrivileges.filter(Boolean) : [],
      expires,
    };
  }

  function personMap() {
    const social = window.BaliBeta4Social;
    const people = social?.visiblePeople?.() || [];
    return new Map(people.map(person => [String(person.id), person]));
  }

  function applyCard(card, person) {
    const photo = card.querySelector(".person-v2-photo");
    if (!photo) return;
    photo.classList.remove("is-locked");
    photo.querySelector(".person-v2-lock")?.remove();
    photo.style.setProperty("--vip-ring", DEFAULT_RING);
    photo.style.setProperty("--vip-glow", "rgba(90,110,98,.28)");
    photo.classList.remove("people-has-vip");

    const body = card.querySelector(".person-v2-body");
    body?.querySelector(".people-status-chip")?.remove();
    const vip = activeVip(person);
    if (!vip) return;

    photo.classList.add("people-has-vip");
    photo.style.setProperty("--vip-ring", vip.color);
    photo.style.setProperty("--vip-glow", `${vip.color}66`);
    if (body) {
      const badge = document.createElement("span");
      badge.className = "people-status-chip";
      badge.style.setProperty("--vip-ring", vip.color);
      badge.textContent = vip.name;
      badge.title = vip.privileges.length ? vip.privileges.join(" · ") : "У пользователя активны VIP-привилегии";
      body.appendChild(badge);
    }
  }

  function applyDialog(person) {
    const body = document.getElementById("socialPersonBody");
    if (!body || !person) return;
    body.querySelector(".people-vip-benefits")?.remove();
    const vip = activeVip(person);
    const photo = body.querySelector(".person-v2-photo");
    if (photo) {
      photo.classList.remove("is-locked");
      photo.querySelector(".person-v2-lock")?.remove();
      photo.style.setProperty("--vip-ring", vip?.color || DEFAULT_RING);
      photo.style.setProperty("--vip-glow", vip ? `${vip.color}66` : "rgba(90,110,98,.28)");
      photo.classList.toggle("people-has-vip", Boolean(vip));
    }
    if (!vip) return;

    const section = document.createElement("section");
    section.className = "people-vip-benefits";
    section.style.setProperty("--vip-ring", vip.color);
    const expiry = vip.expires ? new Date(vip.expires).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" }) : "без ограничения";
    section.innerHTML = `<strong>${escapeHtml(vip.name)} · активные привилегии</strong>${vip.description ? `<p>${escapeHtml(vip.description)}</p>` : ""}${vip.privileges.length ? `<ul>${vip.privileges.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : '<p>Для пользователя действуют преимущества выбранного VIP-статуса.</p>'}<time>Действует до: ${escapeHtml(expiry)}</time>`;
    const actions = body.querySelector(".person-v2-actions");
    if (actions) actions.insertAdjacentElement("beforebegin", section);
    else body.appendChild(section);
  }

  function apply() {
    styles();
    const people = personMap();
    document.querySelectorAll("[data-open-social-person]").forEach(card => {
      applyCard(card, people.get(String(card.dataset.openSocialPerson)) || {});
    });

    const dialog = document.getElementById("socialPersonDialog");
    if (dialog?.open) {
      const activeCard = document.querySelector("[data-open-social-person].is-active") || document.querySelector("[data-open-social-person][data-last-opened='1']");
      const id = activeCard?.dataset.openSocialPerson || window.__BALI_LAST_SOCIAL_PERSON__ || "";
      if (id) applyDialog(people.get(String(id)));
    }
  }

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
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

  document.addEventListener("click", event => {
    const card = event.target.closest("[data-open-social-person]");
    if (!card) return;
    document.querySelectorAll("[data-open-social-person]").forEach(node => {
      node.classList.remove("is-active");
      delete node.dataset.lastOpened;
    });
    card.classList.add("is-active");
    card.dataset.lastOpened = "1";
    window.__BALI_LAST_SOCIAL_PERSON__ = card.dataset.openSocialPerson;
    setTimeout(() => {
      const people = personMap();
      applyDialog(people.get(String(card.dataset.openSocialPerson)));
      schedule();
    }, 0);
  }, true);

  new MutationObserver(records => {
    const relevant = records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => {
      if (node.nodeType !== 1) return false;
      return node.matches?.("[data-open-social-person],.people-v2-grid,#socialV2Content,#socialPersonBody") || node.querySelector?.("[data-open-social-person]");
    }));
    if (relevant) schedule();
  }).observe(document.body, { childList: true, subtree: true });

  ["bali:social-changed", "bali:beta4-changed", "bali:points-changed", "bali:loyalty-changed"]
    .forEach(name => window.addEventListener(name, schedule));

  schedule();
  window.BaliPeopleVipFrame = { apply, activeVip };
})();
