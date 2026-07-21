(() => {
  if (window.__BALI_FULL_RANKING__) return;
  window.__BALI_FULL_RANKING__ = true;
  const game = window.BaliBeta4Game;
  const points = window.BaliPoints;
  if (!game || !points) return;
  const esc = value => String(value || "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const initials = name => String(name || "B").trim().split(/\s+/).slice(0,2).map(part => part[0]).join("").toUpperCase();
  const avatar = user => `<span class="avatar">${user.avatar ? `<img src="${esc(user.avatar)}" alt="">` : esc(initials(user.name))}</span>`;
  function renderAll() {
    const screen = document.querySelector('[data-screen="ranking"]');
    const list = document.getElementById("rankingList");
    if (!screen || !list) return;
    const rows = game.ranking(Object.values(points.accounts?.() || {}));
    list.innerHTML = rows.slice(3).map(user => `<article class="rank-row ${user.isMe ? "me" : ""}"><b>#${Number(user.position || 0)}</b>${avatar(user)}<div><h3>${esc(user.name || "Гость BALI")}</h3><p>${esc(user.username || user.telegram || "")} · ${Number(user.visits || 0)} посещений</p></div><b>${Number(user.xp || 0)} XP</b></article>`).join("") || '<div class="empty">Пользователей в рейтинге пока нет</div>';
    list.dataset.fullRanking = String(rows.length);
  }
  document.addEventListener("click", event => {
    if (event.target.closest('[data-page="ranking"]') || event.target.closest('[data-ranking-v2="xp"]')) setTimeout(renderAll, 0);
  });
  ["bali:beta4-changed","bali:points-changed","bali:data-changed"].forEach(name => window.addEventListener(name, () => setTimeout(renderAll, 0)));
  setTimeout(renderAll, 300);
})();