(() => {
  if (window.BaliChipRequests) return;
  const points = window.BaliPoints;
  const game = window.BaliBeta4Game;
  const loyalty = window.BaliBeta4Loyalty;
  if (!points || !game || !loyalty) return;

  const KEY = "bali_chip_requests_v1";
  const now = () => new Date().toISOString();
  const uid = () => `chip-request-${crypto.randomUUID?.() || Date.now()}`;
  const secret = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const readLocal = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
  const writeLocal = rows => {
    localStorage.setItem(KEY, JSON.stringify(rows));
    window.dispatchEvent(new CustomEvent("bali:chip-requests-changed", { detail:{ count:rows.length, mode:"local" } }));
    return rows;
  };
  const rate = () => Math.max(1, Number(loyalty.config()?.chipRatePoints || 100));
  const identity = profile => ({
    user_key:String(profile.id || profile.userKey || points.profile().userKey || profile.code || ""),
    name:profile.name || "Гость BALI",
    phone:profile.phone || ""
  });

  async function list() {
    return readLocal().sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
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
      lookup_token:secret(),
      ...identity(profile),
      quantity:chips,
      points_cost:cost,
      rate_points:rate(),
      status:"pending",
      created_at:now(),
      fulfilled_at:null,
      fulfilled_by:"",
      cancelled_at:null,
      cancelled_by:"",
      refund_at:null
    };
    const rows = readLocal();
    rows.unshift(row);
    writeLocal(rows.slice(0, 1000));
    return { ok:true, request:row, balance:Number(spent.balance || 0) };
  }

  async function update(id, patch) {
    const rows = readLocal();
    const index = rows.findIndex(row => String(row.id) === String(id));
    const row = index >= 0 ? { ...rows[index], ...patch } : { id, ...patch };
    if (index >= 0) rows[index] = row; else rows.unshift(row);
    writeLocal(rows.slice(0, 1000));
    return row;
  }

  async function fulfill(id, adminName = "BALI Demo Admin") {
    const rows = await list();
    const current = rows.find(row => String(row.id) === String(id));
    if (!current) return { ok:false, message:"Заявка не найдена" };
    if (current.status === "fulfilled") return { ok:false, message:"Фишки уже вручены" };
    return { ok:true, request:await update(id, { ...current, status:"fulfilled", fulfilled_at:now(), fulfilled_by:adminName }) };
  }

  async function cancel(id, refund = true, adminName = "BALI Demo Admin") {
    const rows = await list();
    const current = rows.find(row => String(row.id) === String(id));
    if (!current) return { ok:false, message:"Заявка не найдена" };
    if (current.status === "fulfilled") return { ok:false, message:"Вручённую заявку нельзя отменить" };
    let refundAt = current.refund_at || null;
    if (refund && !refundAt) {
      points.adjustAccount({ userKey:current.user_key, name:current.name, phone:current.phone }, Number(current.points_cost || 0), `Возврат за отменённую заявку на ${Number(current.quantity || 0)} фиш.`);
      refundAt = now();
    }
    return { ok:true, request:await update(id, { ...current, status:"cancelled", cancelled_at:now(), cancelled_by:adminName, refund_at:refundAt }) };
  }

  function mine(rows = readLocal()) {
    const profile = game.profile();
    const keys = new Set(game.identityKeys(profile).map(String));
    return rows.filter(row => keys.has(String(row.user_key || "")));
  }

  window.BaliChipRequests = { KEY, rate, list, mine, create, fulfill, cancel, update };
})();