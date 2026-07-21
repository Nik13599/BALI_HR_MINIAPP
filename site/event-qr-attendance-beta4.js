(() => {
  if (window.BaliEventQrAttendance) return;
  const store = window.BaliStore;
  const game = window.BaliBeta4Game;
  const points = window.BaliPoints;
  if (!store) return;

  const CHECKIN_KEY = "bali_event_checkins_v1";
  const RSVP_KEY = "bali_event_rsvps_v1";
  const APP_URL = window.BALI_CONFIG?.checkinAppUrl || "https://nik13599.github.io/BALI_HR_MINIAPP/site/beta4-square-app.html";
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new CustomEvent("bali:data-changed", { detail: { table: "event_checkins" } })); return value; };
  const now = () => new Date().toISOString();
  const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(18))).map(byte => byte.toString(16).padStart(2, "0")).join("");
  const safeKey = value => String(value || "guest").replace(/[^a-zA-Z0-9_-]/g, "-");
  const encode = value => btoa(unescape(encodeURIComponent(JSON.stringify(value)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  const decode = value => JSON.parse(decodeURIComponent(escape(atob(String(value).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(value).length + 3) % 4)))));

  async function ensureEvent(event) {
    if (!event) throw new Error("Мероприятие не найдено");
    if (event.qr_token) return event;
    const saved = await store.save("events", { ...event, qr_token: randomToken(), qr_created_at: now() });
    return saved;
  }

  async function ensureAllEvents() {
    const events = await store.list("events", { order: "event_date" });
    const result = [];
    for (const event of events) result.push(await ensureEvent(event));
    return result;
  }

  function payload(event) {
    if (!event?.id || !event?.qr_token) throw new Error("QR-код мероприятия ещё не создан");
    return encode({ v: 1, eventId: event.id, token: event.qr_token });
  }

  function payloadUrl(event) {
    const url = new URL(APP_URL);
    url.searchParams.set("checkin", payload(event));
    return url.toString();
  }

  function parse(raw) {
    const source = String(raw || "").trim();
    if (!source) throw new Error("QR-код пустой");
    let encoded = source;
    try {
      const url = new URL(source);
      encoded = url.searchParams.get("checkin") || "";
    } catch {}
    if (source.startsWith("BALI-EVENT:")) encoded = source.slice("BALI-EVENT:".length);
    if (!encoded) throw new Error("Это не QR-код мероприятия BALI");
    const data = decode(encoded);
    if (Number(data.v) !== 1 || !data.eventId || !data.token) throw new Error("QR-код имеет неверный формат");
    return data;
  }

  function localCheckins() { return read(CHECKIN_KEY, {}); }

  async function cloudCheckins(eventId = "") {
    if (!store.cloudEnabled || !store.client) return [];
    try {
      let query = store.client.from("event_checkins").select("*");
      if (eventId) query = query.eq("event_id", eventId);
      const { data, error } = await query;
      if (error) return [];
      return data || [];
    } catch { return []; }
  }

  async function listCheckins(eventId = "") {
    const local = Object.values(localCheckins()).filter(row => !eventId || String(row.event_id) === String(eventId));
    const cloud = await cloudCheckins(eventId);
    return [...new Map([...cloud, ...local].map(row => [`${row.event_id}:${row.user_key || row.telegram_id || row.id}`, row])).values()]
      .sort((a, b) => String(b.checked_in_at || "").localeCompare(String(a.checked_in_at || "")));
  }

  async function updateCustomer(profile) {
    if (!profile?.phone) return;
    try {
      const customer = await store.findOrCreateCustomer({ name: profile.name, phone: profile.phone, telegram: profile.username });
      if (customer) await store.save("customers", { ...customer, visits: Number(customer.visits || 0) + 1, last_visit_at: now() });
    } catch {}
  }

  async function saveCloud(row) {
    if (!store.cloudEnabled || !store.client) return;
    try { await store.client.from("event_checkins").upsert(row, { onConflict: "event_id,user_key" }); } catch {}
  }

  async function checkIn(raw) {
    if (!game || !points) return { ok: false, message: "Профиль пользователя ещё не загрузился" };
    let parsed;
    try { parsed = parse(raw); } catch (error) { return { ok: false, message: error.message }; }
    const events = await store.list("events");
    const event = events.find(item => String(item.id) === String(parsed.eventId));
    if (!event || !event.qr_token || event.qr_token !== parsed.token) return { ok: false, message: "QR-код не принадлежит активному мероприятию BALI" };

    const profile = game.profile();
    const userKey = String(profile.id || profile.userKey || points.profile().userKey);
    const id = `checkin-${safeKey(event.id)}-${safeKey(userKey)}`;
    const registry = localCheckins();
    if (registry[id]) return { ok: false, duplicate: true, event, row: registry[id], message: "Посещение этого мероприятия уже подтверждено" };
    const existing = (await listCheckins(event.id)).find(row => String(row.user_key || "") === userKey || (profile.telegramId && String(row.telegram_id || "") === String(profile.telegramId)));
    if (existing) return { ok: false, duplicate: true, event, row: existing, message: "Посещение этого мероприятия уже подтверждено" };

    const pointAmount = Number(points.settings().attendance || 100);
    const before = game.profile();
    game.recordVisit();
    points.add("attendance", pointAmount, `Посещение «${event.title}»`, `event-checkin-${event.id}-${userKey}`);
    const after = game.profile();
    const row = {
      id,
      event_id: event.id,
      event_title: event.title,
      event_date: event.event_date,
      event_time: event.event_time || "23:00",
      user_key: userKey,
      telegram_id: profile.telegramId || null,
      telegram: profile.username || "",
      name: profile.name || "Гость BALI",
      phone: profile.phone || "",
      checked_in_at: now(),
      source: "event_qr",
      reward: pointAmount,
      xp: Math.max(0, Number(after.xp || 0) - Number(before.xp || 0)),
      visits: Number(after.visits || 0),
      level: game.levelFor(after.xp).current.name
    };
    registry[id] = row;
    write(CHECKIN_KEY, registry);

    const rsvps = read(RSVP_KEY, {});
    rsvps[event.id] ||= {};
    rsvps[event.id][userKey] = { user_key: userKey, name: row.name, telegram: row.telegram, telegram_id: row.telegram_id, status: "checked_in", attendance_mode: "qr", updated_at: row.checked_in_at };
    localStorage.setItem(RSVP_KEY, JSON.stringify(rsvps));

    await Promise.all([saveCloud(row), updateCustomer(after)]);
    try { window.BaliBeta4Loyalty?.evaluateRewards?.(game.profile()); } catch {}
    window.dispatchEvent(new CustomEvent("bali:points-changed"));
    window.dispatchEvent(new CustomEvent("bali:beta4-changed"));
    return { ok: true, event, row, points: pointAmount, xp: row.xp, visits: row.visits, level: row.level };
  }

  window.BaliEventQrAttendance = { CHECKIN_KEY, ensureEvent, ensureAllEvents, payload, payloadUrl, parse, checkIn, listCheckins };
})();