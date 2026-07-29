(() => {
  if (window.BaliEventQrAttendance) return;
  const store = window.BaliStore;
  const game = window.BaliBeta4Game;
  const points = window.BaliPoints;
  if (!store) return;

  const CHECKIN_KEY = "bali_event_checkins_v1";
  const RSVP_KEY = "bali_event_rsvps_v1";
  const TRUST_KEY = "bali_event_qr_trust_v2";
  const OLD_QR_KEY = "bali_event_qr_registry_v1";
  const APP_URL = window.BALI_CONFIG?.checkinAppUrl || new URL("./beta4-qr-app.html", location.href).toString();
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new CustomEvent("bali:data-changed", { detail:{ table:"event_checkins", mode:"local" } })); return value; };
  const now = () => new Date().toISOString();
  const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(18))).map(byte => byte.toString(16).padStart(2, "0")).join("");
  const safeKey = value => String(value || "guest").replace(/[^a-zA-Z0-9_-]/g, "-");
  const encode = value => btoa(unescape(encodeURIComponent(JSON.stringify(value)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  const decode = value => {
    const source = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = source + "=".repeat((4 - source.length % 4) % 4);
    return JSON.parse(decodeURIComponent(escape(atob(padded))));
  };

  async function ensureEvent(event) {
    if (!event) throw new Error("Мероприятие не найдено");
    if (event.qr_token) return event;
    return store.save("events", { ...event, qr_token:randomToken(), qr_created_at:now() });
  }

  async function ensureAllEvents() {
    const events = await store.list("events", { order:"event_date" });
    const result = [];
    for (const event of events) result.push(await ensureEvent(event));
    return result;
  }

  function payload(event) {
    if (!event?.id || !event?.qr_token) throw new Error("QR-код мероприятия ещё не создан");
    return encode({ v:2, eventId:event.id, token:event.qr_token, title:event.title || "Мероприятие BALI", date:event.event_date || "", time:event.event_time || "23:00", issuedAt:now() });
  }

  function payloadUrl(event) {
    const url = new URL(APP_URL, location.href);
    url.searchParams.set("checkin", payload(event));
    return url.toString();
  }

  function normalizePayload(data) {
    if (!data || !data.eventId || !data.token) throw new Error("QR-код имеет неверный формат");
    return { v:Number(data.v || 1), eventId:String(data.eventId), token:String(data.token), title:String(data.title || data.eventTitle || ""), date:String(data.date || data.eventDate || ""), time:String(data.time || data.eventTime || "23:00") };
  }

  function parse(raw) {
    const source = String(raw || "").trim();
    if (!source) throw new Error("QR-код пустой");
    try {
      const url = new URL(source);
      const encoded = url.searchParams.get("checkin");
      if (encoded) return normalizePayload(decode(encoded));
      const eventId = url.searchParams.get("event") || url.searchParams.get("eventId");
      const token = url.searchParams.get("token");
      if (eventId && token) return normalizePayload({ v:1, eventId, token });
    } catch {}
    if (source.startsWith("BALI-EVENT:")) {
      const body = source.slice("BALI-EVENT:".length);
      try { return normalizePayload(decode(body)); } catch {}
      const separator = body.indexOf(":");
      if (separator > 0) return normalizePayload({ v:1, eventId:body.slice(0, separator), token:body.slice(separator + 1) });
    }
    try { return normalizePayload(JSON.parse(source)); } catch {}
    try { return normalizePayload(decode(source)); }
    catch { throw new Error("Это не QR-код мероприятия BALI"); }
  }

  const localCheckins = () => read(CHECKIN_KEY, {});

  async function listCheckins(eventId = "") {
    return Object.values(localCheckins())
      .filter(row => !eventId || String(row.event_id) === String(eventId))
      .sort((a, b) => String(b.checked_in_at || "").localeCompare(String(a.checked_in_at || "")));
  }

  async function updateCustomer(profile) {
    if (!profile?.phone) return;
    try {
      const customer = await store.findOrCreateCustomer({ name:profile.name, phone:profile.phone });
      if (customer) await store.save("customers", { ...customer, visits:Number(customer.visits || 0) + 1, last_visit_at:now() });
    } catch {}
  }

  function validateLocalToken(event, parsed) {
    const oldRegistry = read(OLD_QR_KEY, {});
    const trusted = read(TRUST_KEY, {});
    const oldEntry = oldRegistry[parsed.eventId];
    if (oldEntry?.active === false) return false;
    const expected = event?.qr_token || oldEntry?.token || trusted[parsed.eventId] || "";
    if (expected) return String(expected) === String(parsed.token);
    trusted[parsed.eventId] = parsed.token;
    localStorage.setItem(TRUST_KEY, JSON.stringify(trusted));
    return true;
  }

  function currentIdentity() {
    const profile = game?.profile?.() || {};
    return {
      profile,
      userKey:String(profile.id || profile.userKey || points?.profile?.()?.userKey || "")
    };
  }

  function updateRsvp(eventId, userKey, row, status) {
    const rsvps = read(RSVP_KEY, {});
    rsvps[eventId] ||= {};
    const previous = rsvps[eventId][userKey] || {};
    const previousStatus = String(previous.status || "");
    const hadIntent = previous.interested === true || (previous.interested !== false && ["interested","going","booked","checked_in"].includes(previousStatus));
    const previousPartySize = Math.max(0, Number(previous.party_size || previous.partySize || previous.guests || previous.interest_count || (hadIntent ? 1 : 0)));
    rsvps[eventId][userKey] = {
      ...previous,
      user_key:userKey,
      name:row.name,
      interested:hadIntent,
      party_size:hadIntent ? Math.max(1, previousPartySize || 1) : 0,
      companions:hadIntent ? Math.max(0, Math.max(1, previousPartySize || 1) - 1) : 0,
      status,
      attendance_mode:"qr",
      updated_at:now()
    };
    localStorage.setItem(RSVP_KEY, JSON.stringify(rsvps));
    window.dispatchEvent(new CustomEvent("bali:rsvp-changed", { detail:{ eventId, userKey, status } }));
  }

  function reactivate(row, event, registry, id, userKey) {
    const next = { ...row, id:row.id || id, left_at:null, presence_status:"active", reentered_at:now() };
    registry[next.id] = next;
    write(CHECKIN_KEY, registry);
    updateRsvp(event.id, userKey, next, "checked_in");
    window.dispatchEvent(new CustomEvent("bali:checkin-complete", { detail:{ event, result:{ ok:true, reentered:true, row:next } } }));
    return { ok:true, reentered:true, event, row:next, points:0, xp:0, visits:Number(next.visits || 0), level:next.level || game?.levelFor?.(game.profile().xp)?.current?.name || "" };
  }

  async function checkIn(raw) {
    if (!game || !points) return { ok:false, message:"Профиль пользователя ещё не загрузился" };
    let parsed;
    try { parsed = parse(raw); } catch (error) { return { ok:false, message:error.message }; }

    const events = await store.list("events");
    let event = events.find(item => String(item.id) === String(parsed.eventId));
    if (!event && parsed.v >= 2 && parsed.title) event = { id:parsed.eventId, title:parsed.title, event_date:parsed.date, event_time:parsed.time, active:true, qr_token:parsed.token };
    if (!event || event.active === false) return { ok:false, message:"Мероприятие не найдено или уже закрыто" };
    if (!validateLocalToken(event, parsed)) return { ok:false, message:"Этот QR-код создан для другой версии мероприятия" };

    const { profile, userKey } = currentIdentity();
    const id = `checkin-${safeKey(event.id)}-${safeKey(userKey)}`;
    const registry = localCheckins();
    if (registry[id]) {
      if (registry[id].left_at) return reactivate(registry[id], event, registry, id, userKey);
      return { ok:false, duplicate:true, event, row:registry[id], message:"Посещение этого мероприятия уже подтверждено" };
    }
    const existing = (await listCheckins(event.id)).find(row => String(row.user_key || "") === userKey);
    if (existing) {
      if (existing.left_at) return reactivate(existing, event, registry, id, userKey);
      return { ok:false, duplicate:true, event, row:existing, message:"Посещение этого мероприятия уже подтверждено" };
    }

    const pointAmount = Number(points.settings().attendance || 100);
    const before = game.profile();
    game.recordVisit();
    points.add("attendance", pointAmount, `Посещение «${event.title}»`, `event-checkin-${event.id}-${userKey}`);
    const after = game.profile();
    const row = {
      id,
      event_id:event.id,
      event_title:event.title,
      event_date:event.event_date || parsed.date,
      event_time:event.event_time || parsed.time || "23:00",
      user_key:userKey,
      name:profile.name || "Гость BALI",
      phone:profile.phone || "",
      checked_in_at:now(),
      left_at:null,
      presence_status:"active",
      source:"browser_demo_qr",
      reward:pointAmount,
      xp:Math.max(0, Number(after.xp || 0) - Number(before.xp || 0)),
      visits:Number(after.visits || 0),
      level:game.levelFor(after.xp).current.name
    };
    registry[id] = row;
    write(CHECKIN_KEY, registry);
    updateRsvp(event.id, userKey, row, "checked_in");
    await updateCustomer(after);
    try { window.BaliBeta4Loyalty?.evaluateRewards?.(game.profile()); } catch {}
    window.dispatchEvent(new CustomEvent("bali:points-changed"));
    window.dispatchEvent(new CustomEvent("bali:beta4-changed"));
    return { ok:true, event, row, points:pointAmount, xp:row.xp, visits:row.visits, level:row.level };
  }

  async function leave(eventId = "") {
    if (!game || !points) return { ok:false, message:"Профиль пользователя ещё не загрузился" };
    const { userKey } = currentIdentity();
    const rows = await listCheckins(eventId);
    const current = rows.find(row => !row.left_at && (!eventId || String(row.event_id) === String(eventId)) && String(row.user_key || "") === userKey);
    if (!current) return { ok:false, message:"Активное мероприятие не найдено" };
    const next = { ...current, left_at:now(), presence_status: "left" };
    const registry = localCheckins();
    registry[next.id || `checkin-${safeKey(next.event_id)}-${safeKey(userKey)}`] = next;
    write(CHECKIN_KEY, registry);
    updateRsvp(next.event_id, userKey, next, "left");
    window.dispatchEvent(new CustomEvent("bali:checkin-left", { detail:{ eventId:next.event_id, row:next } }));
    window.dispatchEvent(new CustomEvent("bali:beta4-changed"));
    return { ok:true, row:next };
  }

  window.BaliEventQrAttendance = { CHECKIN_KEY, ensureEvent, ensureAllEvents, payload, payloadUrl, parse, checkIn, leave, listCheckins };
})();
