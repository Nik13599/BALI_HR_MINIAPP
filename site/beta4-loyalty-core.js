(() => {
  if (window.BaliBeta4Loyalty) return;
  const points = window.BaliPoints;
  const game = window.BaliBeta4Game;
  if (!points || !game) return;

  const KEYS = {
    config: "bali_beta4_loyalty_config_v1",
    chips: "bali_beta4_chips_v1",
    rewards: "bali_beta4_custom_rewards_v1",
    grants: "bali_beta4_reward_grants_v1"
  };
  const DEFAULT_CONFIG = {
    chipRatePoints: 100,
    chipDescription: "Фишки можно тратить на баре BALI: на коктейли, кальяны и специальные предложения клуба.",
    vipPointPrices: { vip: 2500, black: 5000, legend: 9000 }
  };
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("bali:loyalty-changed", { detail: { key } }));
    return value;
  };
  const now = () => new Date().toISOString();
  const uid = (prefix) => `${prefix}-${crypto.randomUUID?.() || Date.now()}`;
  const config = () => ({ ...DEFAULT_CONFIG, ...read(KEYS.config, {}), vipPointPrices: { ...DEFAULT_CONFIG.vipPointPrices, ...(read(KEYS.config, {}).vipPointPrices || {}) } });
  const saveConfig = (patch = {}) => write(KEYS.config, { ...config(), ...patch, vipPointPrices: { ...config().vipPointPrices, ...(patch.vipPointPrices || {}) } });
  const identityKeys = (subject = game.profile()) => new Set(game.identityKeys(subject).map(String));
  const subjectKey = (subject = game.profile()) => String(subject.userKey || subject.id || subject.ownerKey || subject.code || game.profile().id);

  function spendPoints(amount, title, type = "purchase") {
    const value = Math.max(0, Number(amount || 0));
    const profile = points.profile();
    if (!value) return { ok: false, message: "Стоимость не настроена" };
    if (Number(profile.balance || 0) < value) return { ok: false, message: "Недостаточно BALI-Баллов" };
    const result = points.adjustAccount(profile, -value, title);
    return result.ok ? { ok: true, spent: value, balance: Number(result.account?.balance || 0), type } : result;
  }

  const chipsRegistry = () => read(KEYS.chips, {});
  function chipBalance(subject = game.profile()) {
    const keys = identityKeys(subject), rows = chipsRegistry();
    for (const key of keys) if (rows[key] !== undefined) return Number(rows[key] || 0);
    return 0;
  }
  function setChipBalance(subject, value, note = "Корректировка фишек") {
    const rows = chipsRegistry(), key = subjectKey(subject);
    rows[key] = Math.max(0, Number(value || 0));
    write(KEYS.chips, rows);
    const history = read("bali_beta4_chip_history_v1", []);
    history.unshift({ id: uid("chip"), userKey: key, amount: rows[key], title: note, createdAt: now() });
    write("bali_beta4_chip_history_v1", history.slice(0, 300));
    return rows[key];
  }
  function adjustChips(subject, delta, note = "Корректировка фишек") {
    return setChipBalance(subject, chipBalance(subject) + Number(delta || 0), note);
  }
  function exchangeForChips(count = 1) {
    const quantity = Math.max(1, Math.floor(Number(count || 1)));
    const cost = quantity * Math.max(1, Number(config().chipRatePoints || 100));
    const spent = spendPoints(cost, `Обмен на ${quantity} фиш.${quantity === 1 ? "ку" : "ки"}`, "chips");
    if (!spent.ok) return spent;
    const balance = adjustChips(game.profile(), quantity, `Получено ${quantity} фиш.`);
    return { ok: true, quantity, cost, chipBalance: balance, pointsBalance: spent.balance };
  }

  function buyVipWithPoints(planId) {
    const plan = game.config().plans.find((row) => row.id === planId && row.active !== false);
    if (!plan) return { ok: false, message: "VIP-тариф не найден" };
    const cost = Math.max(0, Number(config().vipPointPrices?.[planId] || 0));
    const spent = spendPoints(cost, `Покупка ${plan.name} за BALI-Баллы`, "vip_points");
    if (!spent.ok) return spent;
    try {
      const vip = game.activateVip(planId, "bali_points", Number(plan.days || 30));
      return { ok: true, vip, cost, balance: spent.balance };
    } catch (error) {
      points.adjustAccount(points.profile(), cost, `Возврат за ${plan.name}`);
      return { ok: false, message: error.message || "Не удалось активировать VIP" };
    }
  }

  const rewards = () => read(KEYS.rewards, []).sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  function saveRewards(rows) {
    return write(KEYS.rewards, rows.map((row, index) => ({
      id: row.id || uid("reward"), title: String(row.title || "Награда BALI").trim(),
      description: String(row.description || "").trim(), image: row.image || "", xp: Math.max(0, Number(row.xp || 0)),
      conditionType: row.conditionType || "manual", eventId: row.eventId || "", eventTitle: row.eventTitle || "",
      threshold: Math.max(1, Number(row.threshold || 1)), active: row.active !== false,
      sort_order: Number(row.sort_order ?? index + 1), createdAt: row.createdAt || now(), updatedAt: now()
    })));
  }
  function upsertReward(reward) {
    const rows = rewards(), index = rows.findIndex((row) => row.id === reward.id);
    if (index >= 0) rows[index] = { ...rows[index], ...reward }; else rows.push(reward);
    return saveRewards(rows);
  }
  function removeReward(id) { return saveRewards(rewards().filter((row) => row.id !== id)); }
  const grants = () => read(KEYS.grants, []);
  const grantKey = (rewardId, userKey) => `${rewardId}:${userKey}`;

  function grantReward(subject, reward, source = "manual") {
    const key = subjectKey(subject), existing = grants().find((row) => row.rewardId === reward.id && row.userKey === key && !row.revokedAt);
    if (existing) return { ok: false, message: "Награда уже получена", grant: existing };
    const grant = { id: uid("grant"), rewardId: reward.id, userKey: key, userName: subject.name || "Гость BALI", source, xp: Number(reward.xp || 0), earnedAt: now() };
    const rows = grants(); rows.unshift(grant); write(KEYS.grants, rows.slice(0, 1000));
    const currentKeys = identityKeys(game.profile());
    if (currentKeys.has(key)) game.addXp(Number(reward.xp || 0), `Награда: ${reward.title}`);
    else {
      const all = points.accounts(), account = all[key] || { ...subject, userKey: key, balance: Number(subject.balance || 0) };
      account.xp = Number(account.xp || 0) + Number(reward.xp || 0);
      points.saveAccount(account);
    }
    return { ok: true, grant };
  }
  function earnedRewardIds(subject = game.profile()) {
    const keys = identityKeys(subject);
    return new Set(grants().filter((row) => !row.revokedAt && keys.has(String(row.userKey))).map((row) => row.rewardId));
  }
  function yearsSince(dateValue) {
    if (!dateValue) return 0;
    const start = new Date(dateValue), today = new Date();
    let years = today.getFullYear() - start.getFullYear();
    const anniversary = new Date(today.getFullYear(), start.getMonth(), start.getDate());
    if (today < anniversary) years -= 1;
    return Math.max(0, years);
  }
  function hasEventCheckin(subject, eventId) {
    const keys = identityKeys(subject), rows = Object.values(read("bali_event_checkins_v1", {}));
    return rows.some((row) => String(row.event_id || "") === String(eventId || "") && (keys.has(String(row.user_key || "")) || String(row.telegram_id || "") === String(subject.telegramId || "")));
  }
  function evaluateRewards(subject = game.profile()) {
    const earned = earnedRewardIds(subject), awarded = [];
    for (const reward of rewards().filter((row) => row.active !== false && !earned.has(row.id))) {
      let eligible = false;
      if (reward.conditionType === "visits") eligible = Number(subject.visits || 0) >= Number(reward.threshold || 1);
      if (reward.conditionType === "anniversary") eligible = yearsSince(subject.createdAt) >= Number(reward.threshold || 1);
      if (reward.conditionType === "event") eligible = hasEventCheckin(subject, reward.eventId);
      if (eligible) {
        const result = grantReward(subject, reward, `auto_${reward.conditionType}`);
        if (result.ok) awarded.push(reward);
      }
    }
    return awarded;
  }

  window.BaliBeta4Loyalty = { KEYS, DEFAULT_CONFIG, config, saveConfig, spendPoints, chipBalance, setChipBalance, adjustChips, exchangeForChips, buyVipWithPoints, rewards, saveRewards, upsertReward, removeReward, grants, grantReward, earnedRewardIds, evaluateRewards, yearsSince };
})();