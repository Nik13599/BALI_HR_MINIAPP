(() => {
  if (window.__BALI_PEOPLE_STATUS_SYNC__) return;
  window.__BALI_PEOPLE_STATUS_SYNC__ = true;
  const social = window.BaliBeta4Social;
  const game = window.BaliBeta4Game;
  if (!social || !game) return;

  let syncing = false;
  function sync() {
    if (syncing) return;
    syncing = true;
    try {
      const current = social.profile();
      const vip = game.vip();
      const level = game.levelFor(Number(game.profile().xp || 0)).current;
      const next = {
        vipPlanId: vip?.planId || vip?.plan?.id || "",
        vipExpiresAt: vip?.expiresAt || "",
        levelId: level?.id || "",
        levelName: level?.name || ""
      };
      const changed = Object.entries(next).some(([key, value]) => String(current[key] || "") !== String(value || ""));
      if (changed) social.saveProfile(next);
    } finally {
      syncing = false;
    }
  }

  ["bali:beta4-changed", "bali:points-changed"].forEach(name => window.addEventListener(name, () => setTimeout(sync, 0)));
  setTimeout(sync, 50);
  window.BaliPeopleStatusSync = { sync };
})();