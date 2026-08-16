(() => {
  if (window.__BALI_NIGHT_CROWN_PRESENCE_FIX__ || !window.BaliNightCrown) return;
  window.__BALI_NIGHT_CROWN_PRESENCE_FIX__ = true;
  const crown = window.BaliNightCrown;
  const attendance = window.BaliEventQrAttendance;
  const store = window.BaliStore;
  const game = window.BaliBeta4Game;
  if (!attendance || !store || !game) return;

  const mine = row => {
    const profile = game.profile();
    const keys = new Set(game.identityKeys(profile).map(String));
    const telegramId = String(profile.telegramId || "");
    return !row.left_at && row.presence_status !== "left" && (keys.has(String(row.user_key || "")) || (telegramId && String(row.telegram_id || "") === telegramId));
  };

  async function myCheckin(eventId) {
    return (await attendance.listCheckins(eventId)).find(mine) || null;
  }

  async function canAccess(eventId) {
    const event = await crown.eventById(eventId);
    return Boolean(event && crown.isActiveEvent?.(event) && await myCheckin(eventId));
  }

  async function activeEvent() {
    const events = (await crown.events()).filter(event => crown.isActiveEvent?.(event));
    const rows = (await attendance.listCheckins()).filter(mine).sort((a, b) => String(b.checked_in_at || "").localeCompare(String(a.checked_in_at || "")));
    for (const row of rows) {
      const event = events.find(item => String(item.id) === String(row.event_id));
      if (event) return event;
    }
    return null;
  }

  crown.myCheckin = myCheckin;
  crown.canAccess = canAccess;
  crown.activeEvent = activeEvent;
  window.addEventListener("bali:checkin-left", () => window.dispatchEvent(new CustomEvent("bali:night-crown-changed")));
})();