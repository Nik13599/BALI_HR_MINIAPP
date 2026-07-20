(() => {
  const keys = {
    settings: "bali_bonus_settings_v1",
    profile: "bali_bonus_profile_v1",
    ledger: "bali_bonus_ledger_v1",
    actions: "bali_bonus_actions_v1",
    visits: "bali_attendance_codes_v1"
  };
  const defaults = { referral: 50, attendance: 100, eventShare: 10 };
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const write = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("bali:points-changed"));
    return value;
  };
  const settings = () => {
    const value = read(keys.settings, {});
    return { ...defaults, ...value, attendance: Number(value.attendance ?? value.story ?? defaults.attendance) };
  };
  const profile = () => {
    const saved = read(keys.profile, null);
    if (saved?.code) return saved;
    const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const source = user?.id ? String(user.id) : String(Date.now()).slice(-7);
    return write(keys.profile, {
      code: `BALI-${source.slice(-7).toUpperCase()}`,
      name: user?.first_name || "Гость BALI",
      balance: 0,
      createdAt: new Date().toISOString()
    });
  };
  const ledger = () => read(keys.ledger, []);
  const actions = () => read(keys.actions, {});
  const visits = () => read(keys.visits, []);
  const add = (type, amount, title, actionKey) => {
    const used = actions();
    if (actionKey && used[actionKey]) return false;
    const user = profile();
    const value = Math.max(0, Number(amount || 0));
    user.balance = Number(user.balance || 0) + value;
    const rows = ledger();
    rows.unshift({ id: crypto.randomUUID?.() || String(Date.now()), type, title, amount: value, createdAt: new Date().toISOString() });
    if (actionKey) used[actionKey] = new Date().toISOString();
    write(keys.profile, user);
    write(keys.ledger, rows.slice(0, 50));
    write(keys.actions, used);
    return true;
  };
  const redeemVisit = (rawCode) => {
    const code = String(rawCode || "").trim().toUpperCase();
    if (!code) return { ok: false, message: "Введите код посещения" };
    const rows = visits();
    const index = rows.findIndex((item) => String(item.code || "").toUpperCase() === code);
    if (index < 0) return { ok: false, message: "Код посещения не найден" };
    if (rows[index].usedAt) return { ok: false, message: "Этот код уже использован" };
    const amount = Number(rows[index].amount ?? settings().attendance);
    const title = rows[index].eventTitle ? `Посещение «${rows[index].eventTitle}»` : "Посещение мероприятия BALI";
    if (!add("attendance", amount, title, `attendance-${code}`)) return { ok: false, message: "Баллы уже начислены" };
    rows[index] = { ...rows[index], usedAt: new Date().toISOString(), usedBy: profile().code };
    write(keys.visits, rows);
    return { ok: true, amount, title };
  };
  window.BaliPoints = { keys, defaults, read, write, settings, profile, ledger, actions, visits, add, redeemVisit };
})();