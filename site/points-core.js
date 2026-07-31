(() => {
  const keys = {
    settings: "bali_bonus_settings_v1",
    profile: "bali_bonus_profile_v1",
    ledger: "bali_bonus_ledger_v1",
    actions: "bali_bonus_actions_v1",
    visits: "bali_attendance_codes_v1",
    accounts: "bali_points_accounts_v1"
  };
  const defaults = { referral: 50, attendance: 100, eventShare: 10 };
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const write = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("bali:points-changed", { detail: { key } }));
    return value;
  };
  const normalizePhone = (value = "") => String(value).replace(/\D/g, "");
  const settings = () => {
    const value = read(keys.settings, {});
    return { ...defaults, ...value, attendance: Number(value.attendance ?? value.story ?? defaults.attendance) };
  };
  const accounts = () => read(keys.accounts, {});
  const accountKey = (data = {}) => data.userKey || data.ownerKey || data.code || (data.phone ? `phone:${normalizePhone(data.phone)}` : "") || "";

  function saveAccount(account) {
    const key = accountKey(account);
    if (!key) return account;
    const all = accounts();
    const previous = all[key] || null;
    const candidate = { ...(previous || {}), ...account, userKey: key };
    const previousComparable = previous ? { ...previous } : null;
    const candidateComparable = { ...candidate };
    if (previousComparable) delete previousComparable.updatedAt;
    delete candidateComparable.updatedAt;
    if (previousComparable && JSON.stringify(previousComparable) === JSON.stringify(candidateComparable)) return previous;
    candidate.updatedAt = new Date().toISOString();
    all[key] = candidate;
    write(keys.accounts, all);
    return candidate;
  }

  function browserIdentity() {
    const key = "bali_browser_identity_v1";
    let value = localStorage.getItem(key);
    if (!value) {
      value = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(key, value);
    }
    return value;
  }

  const profile = () => {
    const saved = read(keys.profile, null);
    if (saved?.code) {
      if (!saved.userKey) {
        saved.userKey = saved.ownerKey || saved.code;
        write(keys.profile, saved);
      }
      const registry = accounts();
      if (!registry[saved.userKey]) saveAccount(saved);
      return saved;
    }
    const source = browserIdentity().replace(/\W/g, "").slice(-7).toUpperCase();
    const created = {
      code: `BALI-${source}`,
      userKey: `web:${source}`,
      ownerKey: `web:${source}`,
      name: "Гость BALI",
      balance: 0,
      createdAt: new Date().toISOString()
    };
    write(keys.profile, created);
    saveAccount(created);
    return created;
  };
  const ledger = () => read(keys.ledger, []);
  const actions = () => read(keys.actions, {});
  const visits = () => read(keys.visits, []);

  function linkIdentity(data = {}) {
    const current = profile();
    const key = accountKey(data) || current.userKey || current.code;
    const linked = {
      ...current,
      userKey: key,
      name: data.name || current.name,
      phone: normalizePhone(data.phone) || current.phone || "",
      ownerKey: data.ownerKey || current.ownerKey || key
    };
    write(keys.profile, linked);
    saveAccount(linked);
    return linked;
  }

  function add(type, amount, title, actionKey) {
    const used = actions();
    if (actionKey && used[actionKey]) return false;
    const user = profile();
    const value = Math.max(0, Number(amount || 0));
    user.balance = Number(user.balance || 0) + value;
    const rows = ledger();
    rows.unshift({ id: crypto.randomUUID?.() || String(Date.now()), userKey: user.userKey, type, title, amount: value, createdAt: new Date().toISOString() });
    if (actionKey) used[actionKey] = new Date().toISOString();
    write(keys.profile, user);
    write(keys.ledger, rows.slice(0, 100));
    write(keys.actions, used);
    saveAccount(user);
    return true;
  }

  function adjustAccount(target, delta, note = "Корректировка администратора", options = {}) {
    const key = accountKey(target);
    if (!key) return { ok: false, message: "Не выбран пользователь" };
    const actionKey = String(options.actionKey || options.idempotencyKey || "");
    const used = actions();
    if (actionKey && used[actionKey]) {
      const previous = ledger().find((row) => row.actionKey === actionKey || row.metadata?.idempotencyKey === actionKey);
      if (used[actionKey]?.status === "pending" && !previous) {
        delete used[actionKey];
        write(keys.actions, used);
      } else {
        return {
          ok: true,
          duplicate: true,
          account: accounts()[key] || target,
          delta: Number(previous?.amount || 0),
          transaction: previous || null
        };
      }
    }
    const all = accounts();
    const currentProfile = profile();
    const existing = all[key] || {
      userKey: key,
      code: target.code || "",
      name: target.name || "Пользователь BALI",
      phone: normalizePhone(target.phone),
      balance: 0,
      createdAt: new Date().toISOString()
    };
    const value = Number(delta || 0);
    if (!value) return { ok: false, message: "Укажите количество баллов" };
    const balanceBefore = Number(existing.balance || 0);
    const balanceAfter = Math.max(0, balanceBefore + value);
    const appliedDelta = balanceAfter - balanceBefore;
    if (!appliedDelta) return { ok: false, message: value < 0 ? "Недостаточно баллов для списания" : "Укажите количество баллов" };
    const transactionId = options.transactionId || crypto.randomUUID?.() || String(Date.now());
    if (actionKey) {
      used[actionKey] = {
        status: "pending",
        transactionId,
        userKey: key,
        createdAt: new Date().toISOString()
      };
      write(keys.actions, used);
    }
    existing.balance = balanceAfter;
    existing.updatedAt = new Date().toISOString();
    all[key] = existing;
    write(keys.accounts, all);
    const rows = ledger();
    const transaction = {
      id: transactionId,
      userKey: key,
      type: options.type || (appliedDelta > 0 ? "admin_add" : "admin_remove"),
      title: note,
      amount: appliedDelta,
      balanceBefore,
      balanceAfter,
      actionKey,
      metadata: { ...(options.metadata || {}), ...(actionKey ? { idempotencyKey: actionKey } : {}) },
      createdAt: new Date().toISOString()
    };
    rows.unshift(transaction);
    write(keys.ledger, rows.slice(0, 500));
    if (actionKey) {
      used[actionKey] = {
        status: "completed",
        transactionId,
        userKey: key,
        createdAt: transaction.createdAt
      };
      write(keys.actions, used);
    }
    if (currentProfile.userKey === key || currentProfile.ownerKey === key || currentProfile.code === key) {
      write(keys.profile, { ...currentProfile, ...existing, userKey: key });
    }
    return {
      ok: true,
      account: existing,
      delta: appliedDelta,
      requestedDelta: value,
      partial: appliedDelta !== value,
      transaction
    };
  }

  function redeemVisit(rawCode) {
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
  }

  window.BaliPoints = { keys, defaults, read, write, settings, profile, ledger, actions, visits, accounts, saveAccount, linkIdentity, add, adjustAccount, redeemVisit, accountKey };
})();
