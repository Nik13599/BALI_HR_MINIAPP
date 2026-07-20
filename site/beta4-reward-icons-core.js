(() => {
  if (window.BaliRewardIcons) return;
  const KEY = "bali_beta4_reward_icons_v1";
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const save = rows => { localStorage.setItem(KEY, JSON.stringify(rows)); window.dispatchEvent(new CustomEvent("bali:reward-icons-changed")); return rows; };
  const get = id => read()[id] || "";
  const set = (id, image) => { const rows = read(); rows[id] = image; return save(rows); };
  const remove = id => { const rows = read(); delete rows[id]; return save(rows); };
  function allRewards() {
    const game = window.BaliBeta4Game;
    const loyalty = window.BaliBeta4Loyalty;
    const standard = (game?.DEFAULT_ACHIEVEMENTS || []).map(row => ({ ...row, source: "standard", image: get(row.id) }));
    const custom = (loyalty?.rewards?.() || []).map(row => ({ ...row, source: "custom", image: get(row.id) || row.image || "" }));
    return [...standard, ...custom];
  }
  window.BaliRewardIcons = { KEY, read, save, get, set, remove, allRewards };
})();