(() => {
  if (window.__BALI_USER_PROFILE_FINAL_CLEANUP__) return;
  window.__BALI_USER_PROFILE_FINAL_CLEANUP__ = true;

  try { localStorage.removeItem("bali_social_requests_v1"); } catch {}

  function ensureStyle() {
    if (document.getElementById("userProfileFinalCleanupStyle")) return;
    const style = document.createElement("style");
    style.id = "userProfileFinalCleanupStyle";
    style.textContent = `
      [data-open-profile-invitations],[data-person-invite],#socialInviteV2,#profileInvitationsDialog,.profile-invite-tabs,.profile-invite-summary{display:none!important}
      .person-v2-actions{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      #profileV2Quick .profile-v2-tile.gifts:last-child{grid-column:auto}
    `;
    document.head.appendChild(style);
  }

  function renameGifts() {
    document.querySelectorAll('[data-open-profile-gifts] strong').forEach(node => {
      node.textContent = String(node.textContent || "").replace(/^Мои подарки/i, "Подарки");
    });
    const title = document.getElementById("profileGiftsTitle");
    if (title && /^Мои подарки$/i.test(title.textContent || "")) title.textContent = "Подарки";
  }

  function removeInvitations() {
    document.querySelectorAll('[data-open-profile-invitations],[data-person-invite]').forEach(node => node.remove());
    document.getElementById("profileInvitationsDialog")?.remove();
    document.getElementById("socialInviteV2")?.remove();
  }

  function apply() {
    ensureStyle();
    removeInvitations();
    renameGifts();
  }

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; apply(); });
  };

  new MutationObserver(schedule).observe(document.body, { childList:true, subtree:true });
  window.addEventListener("bali:social-changed", schedule);
  [0,150,500,1200].forEach(delay => setTimeout(apply, delay));
})();