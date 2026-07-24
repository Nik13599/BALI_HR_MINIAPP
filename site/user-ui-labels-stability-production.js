(() => {
  if (window.__BALI_USER_UI_LABELS_STABILITY_V2__) return;
  window.__BALI_USER_UI_LABELS_STABILITY_V2__ = true;

  const store = window.BaliStore;
  let applying = false;
  let attendanceVisible = false;

  const setText = (selector, text) => document.querySelectorAll(selector).forEach(node => {
    if (String(node.textContent || "").trim() !== text) node.textContent = text;
  });

  function eventDate(date, time = "00:00") {
    const value = new Date(`${String(date || "").slice(0, 10)}T${time || "00:00"}:00`);
    return Number.isNaN(value.getTime()) ? null : value;
  }

  function eventEnd(event = {}, row = {}) {
    const startDate = event.event_date || row.event_date || "";
    const startTime = event.event_time || row.event_time || "23:00";
    const endTime = event.event_end_time || event.end_time || row.event_end_time || row.end_time || "06:00";
    let endDate = event.event_end_date || event.end_date || row.event_end_date || row.end_date || startDate;
    if (!endDate) return null;
    if (!event.event_end_date && !event.end_date && !row.event_end_date && !row.end_date && endTime <= startTime) {
      const date = eventDate(startDate, "12:00");
      if (date) { date.setDate(date.getDate() + 1); endDate = date.toISOString().slice(0, 10); }
    }
    return eventDate(endDate, endTime);
  }

  async function listCheckins() {
    const liveAttendance = window.BaliEventQrAttendance;
    if (liveAttendance?.listCheckins) return liveAttendance.listCheckins();
    if (store?.cloudEnabled && store.client) {
      const { data, error } = await store.client.from("event_checkins").select("*");
      if (error) throw error;
      return data || [];
    }
    try { return Object.values(JSON.parse(localStorage.getItem("bali_event_checkins_v1") || "{}")); }
    catch { return []; }
  }

  async function hasActiveCheckin() {
    try {
      const [checkins, events] = await Promise.all([listCheckins(), store?.list?.("events") || Promise.resolve([])]);
      return (checkins || []).some(row => {
        if (row.left_at || row.presence_status === "left") return false;
        const event = (events || []).find(item => String(item.id) === String(row.event_id));
        const end = eventEnd(event, row);
        return Boolean(end && end.getTime() > Date.now());
      });
    } catch { return false; }
  }

  function applyCanonicalLabels() {
    if (applying) return;
    applying = true;
    try {
      setText('[data-screen="home"] .head h2', "Мероприятия");
      setText('[data-screen="events"] .head h2', "Мероприятия");
      setText('[data-page="events"] span', "МЕРОПРИЯТИЯ");
      setText('[data-screen="dating"] .head h2', "Люди BALI");
      setText('[data-social-v2-tab="all"]', "Все");
      setText('[data-social-v2-tab="inside"]', "Пришёл на мероприятие");
      setText('[data-social-v2-tab="thumbs"]', "👍 Лайки");
      setText('[data-screen="profile"] .head h2', "Мой профиль");
      setText('#profileV2Quick [data-open-profile-points] small', "МАГАЗИН");
      setText('#profileV2Quick [data-open-profile-points] strong', "BALI Shop");
      setText('#profileV2Quick [data-open-profile-rewards] small', "МОИ НАГРАДЫ");
      setText('#profileV2Quick [data-open-profile-invitations] small', "ВХОДЯЩИЕ");
      setText('#profileV2Quick [data-open-profile-gifts] small', "ОТ ПОЛЬЗОВАТЕЛЕЙ");

      const titles = {
        profilePointsTitle: "BALI Shop", profileRewardsTitle: "Мои награды",
        profileInvitationsTitle: "Входящие приглашения", profileGiftsTitle: "Мои подарки",
        profileSettingsTitle: "Настройки профиля", profileHistoryTitle: "История посещений"
      };
      Object.entries(titles).forEach(([id, text]) => {
        const node = document.getElementById(id);
        if (node && node.textContent !== text) node.textContent = text;
      });

      document.querySelectorAll('[data-open-profile-gifts] strong').forEach(node => {
        const count = String(node.textContent || "").match(/\d+/)?.[0];
        const text = `Мои подарки${count ? ` · ${count}` : ""}`;
        if (node.textContent !== text) node.textContent = text;
      });

      const inside = document.querySelector('[data-social-v2-tab="inside"]');
      if (inside) {
        inside.hidden = !attendanceVisible;
        inside.style.display = attendanceVisible ? "" : "none";
        inside.setAttribute("aria-hidden", attendanceVisible ? "false" : "true");
        const tabs = inside.closest(".social-tabs-v2");
        if (tabs) tabs.style.gridTemplateColumns = attendanceVisible ? "repeat(3,1fr)" : "repeat(2,1fr)";
        if (!attendanceVisible && inside.classList.contains("active")) document.querySelector('[data-social-v2-tab="all"]')?.click();
      }
    } finally { applying = false; }
  }

  async function refreshAttendanceVisibility() {
    attendanceVisible = await hasActiveCheckin();
    applyCanonicalLabels();
  }

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; applyCanonicalLabels(); });
  };

  new MutationObserver(records => {
    if (records.some(record => record.addedNodes.length || record.removedNodes.length || record.type === "characterData")) schedule();
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  ["bali:production-ready", "bali:data-changed", "bali:social-changed", "bali:checkin-complete", "bali:checkin-left"]
    .forEach(name => window.addEventListener(name, () => { schedule(); refreshAttendanceVisibility(); }));

  [0, 200, 700, 1500, 3000].forEach(delay => setTimeout(() => { applyCanonicalLabels(); refreshAttendanceVisibility(); }, delay));
  setInterval(refreshAttendanceVisibility, 10000);
})();