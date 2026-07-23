(() => {
  const cfg = window.BALI_CONFIG || {};
  const cloudEnabled = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  const client = cloudEnabled
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;

  const keys = {
    events: "bali_events_v2",
    menu_items: "bali_menu_v2",
    hall_tables: "bali_tables_v2",
    customers: "bali_customers_v2",
    bookings: "bali_bookings_v2",
    venue_content: "bali_venue_content_v1",
    reviews: "bali_reviews_v1"
  };

  const LEGACY_DEMO_IDS = new Set([
    "event-tropic", "event-weekend", "event-special",
    "menu-1", "menu-2", "menu-3", "menu-4", "menu-5", "menu-6"
  ]);

  function purgeLegacyDemo() {
    if (localStorage.getItem("bali_production_demo_purged_v1") === "1") return;
    Object.entries(keys).forEach(([table, key]) => {
      try {
        const rows = JSON.parse(localStorage.getItem(key) || "[]");
        if (!Array.isArray(rows)) return;
        const cleaned = rows.filter(row => !LEGACY_DEMO_IDS.has(String(row?.id || "")) && !String(row?.id || "").startsWith("demo-"));
        if (cleaned.length !== rows.length) localStorage.setItem(key, JSON.stringify(cleaned));
      } catch {}
    });
    ["bali_admin_messages_demo_v1", "bali_demo_seed_version", "bali_demo_live_sync_v1"].forEach(key => localStorage.removeItem(key));
    localStorage.setItem("bali_production_demo_purged_v1", "1");
  }
  purgeLegacyDemo();

  function readCache(table) {
    try {
      const value = JSON.parse(localStorage.getItem(keys[table]) || "[]");
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  function writeCache(table, rows) {
    if (keys[table]) localStorage.setItem(keys[table], JSON.stringify(rows || []));
    window.dispatchEvent(new CustomEvent("bali:data-changed", { detail: { table } }));
    return rows || [];
  }

  function requireCloud() {
    if (!cloudEnabled || !client) throw new Error("Рабочая база Supabase ещё не подключена");
  }

  async function list(table, options = {}) {
    if (!cloudEnabled) {
      let rows = readCache(table);
      if (options.filters) {
        for (const [field, value] of Object.entries(options.filters)) rows = rows.filter(row => String(row?.[field]) === String(value));
      }
      const order = options.order;
      if (order) rows.sort((a, b) => String(a?.[order] ?? "").localeCompare(String(b?.[order] ?? "")));
      return rows;
    }
    let query = client.from(table).select("*");
    if (options.filters) for (const [field, value] of Object.entries(options.filters)) query = query.eq(field, value);
    if (options.order) query = query.order(options.order, { ascending: options.ascending !== false, nullsFirst: false });
    const { data, error } = await query;
    if (error) throw error;
    if (keys[table]) writeCache(table, data || []);
    return data || [];
  }

  async function save(table, row) {
    requireCloud();
    const payload = { ...row };
    if (!payload.id) payload.id = crypto.randomUUID?.() || `${table}-${Date.now()}`;
    const { data, error } = await client.from(table).upsert(payload).select().single();
    if (error) throw error;
    return data;
  }

  async function remove(table, id) {
    requireCloud();
    const { error } = await client.from(table).delete().eq("id", id);
    if (error) throw error;
  }

  async function createBooking(data) {
    requireCloud();
    const { data: booking, error } = await client.rpc("create_public_booking", {
      p_booking_date: data.booking_date,
      p_booking_time: data.booking_time || "23:00",
      p_table_id: data.table_id,
      p_name: data.name || data.customer_name || "Гость",
      p_phone: data.phone || "",
      p_guests: Number(data.guests || 2),
      p_telegram: data.telegram || "",
      p_comment: data.comment || "",
      p_event_id: data.event_id || null
    });
    if (error) throw error;
    return booking;
  }

  async function findOrCreateCustomer(data) {
    requireCloud();
    const phone = String(data.phone || "").replace(/\s+/g, "");
    if (!phone) return null;
    const rows = await list("customers");
    const existing = rows.find(row => String(row.phone || "").replace(/\s+/g, "") === phone);
    return save("customers", {
      ...(existing || {}),
      name: data.name || existing?.name || "Гость",
      phone,
      telegram: data.telegram || existing?.telegram || "",
      notes: existing?.notes || "",
      visits: Number(existing?.visits || 0),
      total_spent: Number(existing?.total_spent || 0)
    });
  }

  async function getAvailability(date) {
    if (!cloudEnabled) return [];
    const { data, error } = await client.rpc("get_table_availability", { p_date: date });
    if (error) throw error;
    const { data: authData } = await client.auth.getSession();
    let privateBookings = [];
    if (authData.session) privateBookings = await list("bookings", { filters: { booking_date: date } });
    return (data || []).map(table => {
      const booking = privateBookings.find(item => item.table_id === table.id && !["cancelled", "completed"].includes(item.status));
      return { ...table, available: Boolean(table.available), booking: booking || null };
    });
  }

  async function signIn(email, password) {
    requireCloud();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }
  async function signOut() { if (client) await client.auth.signOut(); }
  async function getSession() {
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return data.session;
  }

  window.BaliStore = {
    cloudEnabled, production: true, client, list, save, remove, createBooking,
    findOrCreateCustomer, getAvailability, signIn, signOut, getSession,
    readCache, writeCache, requireCloud
  };
})();