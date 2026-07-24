(() => {
  if (window.__BALI_USER_VIP_CARD_PRODUCTION__) return;
  window.__BALI_USER_VIP_CARD_PRODUCTION__ = true;

  function styles() {
    if (document.getElementById("userVipCardProductionStyle")) return;
    const style = document.createElement("style");
    style.id = "userVipCardProductionStyle";
    style.textContent = `
      #profileHero .profile-avatar{--vip-profile-color:#46524b;border:5px solid var(--vip-profile-color)!important;border-radius:50%!important;box-shadow:0 0 0 3px #0b0e0d,0 0 24px color-mix(in srgb,var(--vip-profile-color) 48%,transparent)!important;overflow:hidden!important}
      #profileHero .profile-avatar img{border-radius:50%!important;object-fit:cover!important}
      #profileHero .profile-avatar.has-active-vip{border-width:6px!important}
      .user-vip-profile-card{display:grid;gap:7px;margin-top:10px;padding:11px 12px;border:1px solid var(--vip-profile-color,#c8ff3d);border-radius:15px;background:color-mix(in srgb,var(--vip-profile-color,#c8ff3d) 9%,transparent)}
      .user-vip-profile-card strong{color:var(--vip-profile-color,#c8ff3d);font-size:11px}.user-vip-profile-card p{margin:0!important;color:#d7ded9!important;font-size:9px!important;line-height:1.5!important}
      .user-vip-profile-card ul{display:grid;gap:3px;margin:0;padding-left:17px;color:#d7ded9;font-size:9px;line-height:1.45}.user-vip-profile-card time{color:var(--muted);font-size:8px}
      .user-vip-profile-badge{display:inline-flex!important;align-items:center;gap:5px;border:1px solid var(--vip-profile-color,#c8ff3d)!important;background:color-mix(in srgb,var(--vip-profile-color,#c8ff3d) 12%,transparent)!important;color:var(--vip-profile-color,#c8ff3d)!important}.user-vip-profile-badge:before{content:"◆";font-size:7px}
    `;
    document.head.appendChild(style);
  }

  function fallbackColor(planId = "") {
    const id = String(planId).toLowerCase();
    if (id.includes("legend") || id.includes("gold")) return "#e3bd64";
    if (id.includes("black")) return "#a7b0bd";
    return "#c8ff3d";
  }

  function normalizePrivileges(value) {
    if (Array.isArray(value)) return value.map(item => String(item || "").trim()).filter(Boolean);
    if (typeof value === "string") return value.split(/\r?\n|,/).map(item => item.trim()).filter(Boolean);
    return [];
  }

  function activeVip() {
    const cloud = window.BaliCloudLoyalty?.state || {};
    const serverVip = cloud.vip || null;
    const plans = Array.isArray(cloud.plans) ? cloud.plans : [];
    if (serverVip && (!serverVip.expires_at || new Date(serverVip.expires_at).getTime() > Date.now())) {
      const plan = plans.find(item => String(item.id) === String(serverVip.plan_id)) || {};
      return {
        id: String(serverVip.plan_id || plan.id || "vip"),
        name: String(serverVip.plan_name || plan.name || "BALI VIP"),
        color: String(plan.color || fallbackColor(serverVip.plan_id)),
        description: String(plan.description || ""),
        privileges: normalizePrivileges(plan.privileges),
        expiresAt: serverVip.expires_at || "",
      };
    }

    const localVip = window.BaliBeta4Game?.vip?.();
    if (!localVip || (localVip.expiresAt && new Date(localVip.expiresAt).getTime() <= Date.now())) return null;
    const plan = localVip.plan || {};
    return {
      id: String(plan.id || localVip.planId || "vip"),
      name: String(plan.name || "BALI VIP"),
      color: String(plan.color || fallbackColor(plan.id || localVip.planId)),
      description: String(plan.description || ""),
      privileges: normalizePrivileges(plan.privileges || plan.benefits),
      expiresAt: localVip.expiresAt || "",
    };
  }

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[char]);
  }

  function apply() {
    styles();
    const hero = document.getElementById("profileHero");
    if (!hero) return;
    const avatar = hero.querySelector(".profile-avatar");
    const vip = activeVip();
    if (avatar) {
      avatar.style.setProperty("--vip-profile-color", vip?.color || "#46524b");
      avatar.classList.toggle("has-active-vip", Boolean(vip));
    }

    hero.querySelector(".user-vip-profile-card")?.remove();
    hero.querySelectorAll(".user-vip-profile-badge").forEach(node => node.remove());
    if (!vip) return;

    const badges = hero.querySelector(".badges");
    if (badges) {
      const badge = document.createElement("span");
      badge.className = "vip user-vip-profile-badge";
      badge.style.setProperty("--vip-profile-color", vip.color);
      badge.textContent = vip.name;
      badges.appendChild(badge);
    }

    const card = document.createElement("section");
    card.className = "user-vip-profile-card";
    card.style.setProperty("--vip-profile-color", vip.color);
    const expiry = vip.expiresAt ? new Date(vip.expiresAt).toLocaleDateString("ru-RU", { day:"2-digit", month:"long", year:"numeric" }) : "без ограничения";
    card.innerHTML = `<strong>${escapeHtml(vip.name)} · ваши привилегии</strong>${vip.description ? `<p>${escapeHtml(vip.description)}</p>` : ""}${vip.privileges.length ? `<ul>${vip.privileges.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : '<p>Для вашего профиля активны преимущества выбранного VIP-статуса.</p>'}<time>Статус действует до: ${escapeHtml(expiry)}</time>`;
    const content = hero.querySelector(":scope > div:last-child") || hero;
    content.appendChild(card);
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

  ["bali:cloud-loyalty-changed", "bali:beta4-changed", "bali:points-changed", "bali:production-ready"]
    .forEach(name => window.addEventListener(name, schedule));
  document.addEventListener("click", event => {
    if (event.target.closest('[data-page="profile"]')) setTimeout(schedule, 0);
  }, true);
  new MutationObserver(records => {
    if (records.some(record => [...record.addedNodes].some(node => node.nodeType === 1 && (node.id === "profileHero" || node.querySelector?.("#profileHero,.profile-avatar"))))) schedule();
  }).observe(document.body, { childList:true, subtree:true });

  setTimeout(schedule, 0);
  window.BaliUserVipCard = { apply, activeVip };
})();
