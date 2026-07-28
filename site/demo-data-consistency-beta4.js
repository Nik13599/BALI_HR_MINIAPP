(() => {
  if (window.__BALI_DEMO_DATA_CONSISTENCY__) return;
  window.__BALI_DEMO_DATA_CONSISTENCY__ = true;

  const SCHEMA_VERSION = 3;
  const VERSION_KEY = "bali_demo_data_consistency_v3";
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const dayKey = today.toISOString().slice(0, 10);
  const version = `${SCHEMA_VERSION}:${dayKey}`;

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const writeIfChanged = (key, value) => {
    const next = JSON.stringify(value);
    if (localStorage.getItem(key) === next) return false;
    localStorage.setItem(key, next);
    return true;
  };
  const dateAt = offset => {
    const date = new Date(today);
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
  };
  const timestamp = row => Date.parse(row?.updated_at || row?.updatedAt || row?.created_at || row?.createdAt || 0) || 0;
  const dedupe = (rows, identity) => {
    const unique = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
      const key = String(identity(row) || "").trim();
      if (!key) continue;
      const current = unique.get(key);
      if (!current || timestamp(row) >= timestamp(current)) unique.set(key, row);
    }
    return [...unique.values()];
  };
  const normalizeRows = (key, identity, transform = rows => rows) => {
    const current = read(key, []);
    if (!Array.isArray(current)) return false;
    return writeIfChanged(key, transform(dedupe(current, identity)));
  };

  let changed = false;
  const eventSchedule = new Map([
    ["event-demo-crown", { offset:0, time:"23:00", order:1 }],
    ["event-demo-tropic", { offset:5, time:"23:00", order:2 }],
    ["event-demo-football", { offset:9, time:"21:00", order:3 }],
    ["event-demo-black", { offset:14, time:"23:00", order:4 }]
  ]);
  changed = normalizeRows("bali_events_v2", row => row.id, rows => rows.map(row => {
    const schedule = eventSchedule.get(String(row.id));
    return schedule ? { ...row, event_date:dateAt(schedule.offset), event_time:schedule.time, sort_order:schedule.order, active:true } : row;
  })) || changed;

  const bookingOffsets = new Map([
    ["booking-demo-1", 0], ["booking-demo-2", 0], ["booking-demo-3", 0],
    ["booking-demo-4", 5], ["booking-demo-5", 9], ["booking-demo-6", -7], ["booking-demo-7", 5]
  ]);
  changed = normalizeRows("bali_bookings_v2", row => row.id, rows => rows.map(row => {
    const offset = bookingOffsets.get(String(row.id));
    return offset === undefined ? row : { ...row, booking_date:dateAt(offset) };
  })) || changed;

  const rowStores = [
    ["bali_menu_v2", row => row.id || `${row.source || ""}:${row.category || ""}:${row.name || ""}`],
    ["bali_tables_v2", row => row.id],
    ["bali_customers_v2", row => row.id || row.phone || row.telegram || row.name],
    ["bali_social_people_v1", row => row.id],
    ["bali_social_requests_v1", row => row.id],
    ["bali_social_gifts_v1", row => row.id],
    ["bali_social_swipes_v2", row => row.id || `${row.fromId}:${row.toId}:${row.decision}:${row.createdAt}`],
    ["bali_beta4_vip_gifts_v1", row => row.id],
    ["bali_beta4_custom_rewards_v1", row => row.id],
    ["bali_beta4_reward_grants_v1", row => row.id],
    ["bali_night_crown_entries_v1", row => row.id],
    ["bali_night_crown_votes_v1", row => row.id],
    ["bali_night_crown_prizes_v1", row => row.id],
    ["bali_chip_requests_v1", row => row.id]
  ];
  for (const [key, identity] of rowStores) changed = normalizeRows(key, identity) || changed;

  const crownDateKeys = ["bali_night_crown_entries_v1", "bali_night_crown_votes_v1", "bali_night_crown_prizes_v1"];
  for (const key of crownDateKeys) {
    const rows = read(key, []);
    if (!Array.isArray(rows)) continue;
    changed = writeIfChanged(key, rows.map(row => String(row.event_id) === "event-demo-crown" ? { ...row, event_date:dayKey } : row)) || changed;
  }

  const checkins = read("bali_event_checkins_v1", {});
  if (checkins && typeof checkins === "object" && !Array.isArray(checkins)) {
    const next = Object.fromEntries(Object.entries(checkins).map(([key, row]) => [
      key,
      String(row?.event_id) === "event-demo-crown" ? { ...row, event_date:dayKey } : row
    ]));
    changed = writeIfChanged("bali_event_checkins_v1", next) || changed;
  }

  const homeDesign = read("bali_home_design_v1", {});
  const oldHero = homeDesign?.hero || {};
  if (
    oldHero.title === "Твоя ночь" &&
    oldHero.accentTitle === "начинается здесь" &&
    String(oldHero.text || "").startsWith("Клубный формат BALI:")
  ) {
    changed = writeIfChanged("bali_home_design_v1", {
      ...homeDesign,
      hero:{
        ...oldHero,
        title:"BALI",
        accentTitle:"",
        text:"BALI — приложение ночного клуба и комьюнити людей, объединённых музыкой, любимыми диджеями, артистами и яркими вечеринками."
      }
    }) || changed;
  }

  localStorage.setItem(VERSION_KEY, version);
  if (typeof document !== "undefined") document.documentElement.dataset.demoDataConsistency = version;
  window.BaliDemoDataConsistency = { version, runDate:dayKey, changed };
})();
