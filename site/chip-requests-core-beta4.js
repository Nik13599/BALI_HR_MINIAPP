(() => {
  if (window.BaliChipRequests) return;
  const points = window.BaliPoints;
  const game = window.BaliBeta4Game;
  const loyalty = window.BaliBeta4Loyalty;
  const store = window.BaliStore;
  if (!points || !game || !loyalty) return;
  const KEY = "bali_chip_requests_v1";
  const now = () => new Date().toISOString();
  const uid = () => `chip-request-${crypto.randomUUID?.() || Date.now()}`;
  const readLocal = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
  const writeLocal = rows => {
    localStorage.setItem(KEY, JSON.stringify(rows));
    window.dispatchEvent(new CustomEvent("bali:chip-requests-changed", { detail:{ count:rows.length } }));
    return rows;
  };
  const rate = () => Math.max(1, Number(loyalty.config()?.chipRatePoints || 100));
  const identity = profile => ({
    user_key: String(profile.id || profile.userKey || points.profile().userKey || profile.code || ""),
    telegram_id: profile.telegramId || null,
    name: profile.name || "Гость BALI",
    phone: profile.phone || "",
    telegram: profile.username || profile.telegram || ""
  });
  async function saveCloud(row) {
    if (!store?.cloudEnabled || !store.client) return null;
    try {
      const { data, error } = await store.client.from("chip_requests").upsert(row).select().single();
      if (error) return null;
      return data;
    } catch { return null; }
  }
  async function listCloud() {
    if (!store?.cloudEnabled || !store.client) return [];
    try {
      const { data, error } = await store.client.from("chip_requests").select("*").order("created_at", { ascending:false });
      return error ? [] : (data || []);
    } catch { return []; }
  }
  async function list() {
    const local = readLocal(), cloud = await listCloud();
    return [...new Map([...cloud, ...local].map(row => [String(row.id), row])).values()].sort((a,b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  }
  async function create(quantity) {
    const chips = Math.max(1, Math.floor(Number(quantity || 0)));
    if (!Number.isFinite(chips) || chips < 1) return { ok:false, message:"Укажите количество фишек" };
    const cost = chips * rate();
    const profile = game.profile();
    const spent = loyalty.spendPoints(cost, `Заявка на ${chips} фиш.`, "chip_request");
    if (!spent.ok) return spent;
    const row = {
      id:uid(),
      ...identity(profile),
      quantity:chips,
      points_cost:cost,
      rate_points:rate(),
      status:"pending",
      created_at:now(),
      fulfilled_at:null,
      fulfilled_by:"",
      cancelled_at:null,
      refund_at:null
    };
    const rows = readLocal(); rows.unshift(row); writeLocal(rows.slice(0,1000));
    await saveCloud(row);
    return { ok:true, request:row, balance:Number(spent.balance || 0) };
  }
  async function update(id, patch) {
    const rows = readLocal();
    const index = rows.findIndex(row => String(row.id) === String(id));
    let row = index >= 0 ? { ...rows[index], ...patch } : { id, ...patch };
    if (index >= 0) rows[index] = row; else rows.unshift(row);
    writeLocal(rows.slice(0,1000));
    const cloud = await saveCloud(row);
    return cloud || row;
  }
  async function fulfill(id, adminName = "BALI Admin") {
    const rows = await list(), current = rows.find(row => String(row.id) === String(id));
    if (!current) return { ok:false, message:"Заявка не найдена" };
    if (current.status === "fulfilled") return { ok:false, message:"Фишки уже вручены" };
    const row = await update(id, { ...current, status:"fulfilled", fulfilled_at:now(), fulfilled_by:adminName });
    return { ok:true, request:row };
  }
  async function cancel(id, refund = true, adminName = "BALI Admin") {
    const rows = await list(), current = rows.find(row => String(row.id) === String(id));
    if (!current) return { ok:false, message:"Заявка не найдена" };
    if (current.status === "fulfilled") return { ok:false, message:"Вручённую заявку нельзя отменить" };
    let refundAt = current.refund_at || null;
    if (refund && !refundAt) {
      const target = { userKey:current.user_key, name:current.name, phone:current.phone, telegram:current.telegram };
      points.adjustAccount(target, Number(current.points_cost || 0), `Возврат за отменённую заявку на ${Number(current.quantity || 0)} фиш.`);
      refundAt = now();
    }
    const row = await update(id, { ...current, status:"cancelled", cancelled_at:now(), cancelled_by:adminName, refund_at:refundAt });
    return { ok:true, request:row };
  }
  function mine(rows = readLocal()) {
    const p = game.profile(), keys = new Set(game.identityKeys(p).map(String));
    return rows.filter(row => keys.has(String(row.user_key || "")) || (p.telegramId && String(row.telegram_id || "") === String(p.telegramId)));
  }
  window.BaliChipRequests = { KEY, rate, list, mine, create, fulfill, cancel, update };
})();