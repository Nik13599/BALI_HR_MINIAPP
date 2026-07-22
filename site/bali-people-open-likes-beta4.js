(() => {
  if (window.__BALI_PEOPLE_OPEN_LIKES__) return;
  window.__BALI_PEOPLE_OPEN_LIKES__ = true;
  const social = window.BaliBeta4Social;
  if (!social) return;

  const originalToggle = social.toggleThumb.bind(social);
  social.isConnection = () => true;
  social.connections = () => social.visiblePeople();
  social.likeCount = personId => social.thumbs().filter(row => String(row.toId) === String(personId) && (row.decision === "thumb" || row.decision === "like")).length;
  social.toggleThumb = targetId => {
    const result = originalToggle(targetId);
    return { ...result, connected: false, count: social.likeCount(targetId) };
  };

  function addStyles() {
    if (document.getElementById("baliPeopleOpenLikesStyle")) return;
    const style = document.createElement("style");
    style.id = "baliPeopleOpenLikesStyle";
    style.textContent = `
      .person-v2-photo.is-locked img,.person-v2-photo.is-locked .person-v2-placeholder{filter:none!important;transform:none!important}
      .person-v2-lock{display:none!important}
      .person-v2-like-count{display:inline-flex;align-items:center;gap:4px;margin-top:7px;padding:5px 8px;border:1px solid var(--line);border-radius:999px;background:#ffffff07;color:#fff;font-size:8px;font-weight:900}
      .person-v2-like-count b{color:var(--lime);font-size:10px}
      .social-v2-profile .person-v2-like-count{margin-top:10px}
    `;
    document.head.appendChild(style);
  }

  function decorate() {
    document.querySelectorAll(".person-v2-photo.is-locked").forEach(photo => photo.classList.remove("is-locked"));
    document.querySelectorAll(".person-v2-lock").forEach(lock => lock.remove());

    document.querySelectorAll("article.person-v2[data-open-social-person]").forEach(card => {
      const id = card.dataset.openSocialPerson;
      const body = card.querySelector(".person-v2-body");
      if (!body) return;
      let counter = body.querySelector(".person-v2-like-count");
      if (!counter) {
        counter = document.createElement("span");
        counter.className = "person-v2-like-count";
        body.querySelector(".person-v2-actions")?.insertAdjacentElement("beforebegin", counter);
      }
      const count = social.likeCount(id);
      if (counter.dataset.count !== String(count)) {
        counter.dataset.count = String(count);
        counter.innerHTML = `👍 <b>${count}</b> лайков`;
      }
    });

    const profile = document.getElementById("socialPersonBody");
    const likeButton = profile?.querySelector("[data-person-thumb]");
    if (profile && likeButton) {
      const id = likeButton.dataset.personThumb;
      let counter = profile.querySelector(".person-v2-like-count");
      if (!counter) {
        counter = document.createElement("span");
        counter.className = "person-v2-like-count";
        profile.querySelector(".person-v2-actions")?.insertAdjacentElement("beforebegin", counter);
      }
      const count = social.likeCount(id);
      if (counter.dataset.count !== String(count)) {
        counter.dataset.count = String(count);
        counter.innerHTML = `👍 <b>${count}</b> лайков`;
      }
    }
  }

  let scheduled = false;
  const scheduleDecorate = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      decorate();
    });
  };

  addStyles();
  const observer = new MutationObserver(records => {
    const relevant = records.some(record => [...record.addedNodes].some(node => node.nodeType === 1 && (node.matches?.(".person-v2,#socialPersonBody,.person-v2-photo") || node.querySelector?.(".person-v2,#socialPersonBody,.person-v2-photo"))));
    if (relevant) scheduleDecorate();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  [0, 120, 400].forEach(delay => setTimeout(scheduleDecorate, delay));
  window.addEventListener("bali:social-changed", scheduleDecorate);
  window.BaliPeopleOpenLikes = { decorate, scheduleDecorate, likeCount: social.likeCount };
})();