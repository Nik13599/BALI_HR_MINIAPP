(() => {
  if (window.__BALI_PROFILE_RECENT_REWARDS__) return;
  window.__BALI_PROFILE_RECENT_REWARDS__ = true;
  const game = window.BaliBeta4Game;
  const loyalty = window.BaliBeta4Loyalty;
  if (!game) return;

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));

  function styles() {
    if (document.getElementById("profileRecentRewardsStyle")) return;
    const style = document.createElement("style");
    style.id = "profileRecentRewardsStyle";
    style.textContent = `.profile-recent-icons{display:flex;align-items:center;gap:7px;margin-top:7px}.profile-recent-icons i{width:34px;height:34px;display:grid;place-items:center;overflow:hidden;border:1px solid rgba(200,255,61,.22);border-radius:11px;background:rgba(200,255,61,.07);font-style:normal;font-size:18px}.profile-recent-icons i img{width:100%;height:100%;object-fit:contain}.profile-recent-empty{color:var(--muted);font-size:8px}`;
    document.head.appendChild(style);
  }

  function recentRewards() {
    const standard = game.achievements().filter(row => row.earnedAt).map(row => ({ ...row, earnedAt:row.earnedAt, image:"" }));
    if (!loyalty) return standard.sort((a,b) => String(b.earnedAt).localeCompare(String(a.earnedAt)));
    const rewards = new Map(loyalty.rewards().map(row => [row.id, row]));
    const keys = new Set(game.identityKeys(game.profile()).map(String));
    const custom = loyalty.grants().filter(row => !row.revokedAt && keys.has(String(row.userKey))).map(grant => ({ ...rewards.get(grant.rewardId), earnedAt:grant.earnedAt, id:grant.rewardId })).filter(row => row.title);
    return [...standard, ...custom].sort((a,b) => String(b.earnedAt || "").localeCompare(String(a.earnedAt || "")));
  }

  function apply() {
    const stats = document.getElementById("profileStats");
    if (stats) {
      stats.innerHTML = "";
      stats.hidden = true;
      stats.classList.add("profile-v2-hidden");
    }
    document.querySelector(".profile-visit-history")?.remove();
    const quick = document.getElementById("profileV2Quick");
    if (!quick) return;
    const tile = quick.querySelector("[data-open-profile-rewards]");
    if (!tile) return;
    const rows = recentRewards();
    const latest = rows.slice(0, 3);
    const html = `<small>МОИ НАГРАДЫ</small><strong>${rows.length}</strong><span>Полученные и доступные награды BALI →</span>${latest.length ? `<div class="profile-recent-icons">${latest.map(row => `<i title="${esc(row.title)}">${row.image ? `<img src="${esc(row.image)}" alt="">` : esc(row.icon || "🏆")}</i>`).join("")}</div>` : '<div class="profile-recent-empty">Полученные награды появятся здесь</div>'}`;
    if (tile.innerHTML !== html) tile.innerHTML = html;
  }

  styles();
  let lock = false;
  const refresh = () => {
    if (lock) return;
    lock = true;
    requestAnimationFrame(() => { lock = false; apply(); });
  };
  refresh();
  new MutationObserver(records => {
    if (records.some(record => record.addedNodes.length || record.removedNodes.length)) refresh();
  }).observe(document.body, { childList:true, subtree:true });
  ["bali:beta4-changed", "bali:loyalty-changed", "bali:points-changed", "bali:social-changed"].forEach(name => window.addEventListener(name, refresh));
})();