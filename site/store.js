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
    reviews: "bali_reviews_v1",
    loyalty_rules: "bali_loyalty_rules_v1",
    loyalty_rewards: "bali_loyalty_rewards_v1",
    reward_grants: "bali_reward_grants_v1",
    loyalty_gifts: "bali_loyalty_gifts_v1",
    gift_grants: "bali_gift_grants_v1",
    app_settings: "bali_app_settings_v1",
    app_users: "bali_app_users_v1",
    event_checkins: "bali_event_checkins_cache_v1",
    event_history: "bali_event_history_v1"
  };

  const resilientTables = new Set([
    "reviews", "loyalty_rules", "loyalty_rewards", "reward_grants",
    "loyalty_gifts", "gift_grants", "app_settings", "app_users",
    "event_checkins", "event_history", "venue_content"
  ]);

  const LOCAL_ADMIN_SESSION = "bali_admin_local_session_v2";
  const ADMIN_PASSWORD_SHA256 = "b3866eebf3d9c3d40280fbca38cee1ccf618f97f824f7705f7c46635b39c47f0";

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

  function idFor(table) {
    return crypto.randomUUID?.() || `${table}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function applyOptions(rows, options = {}) {
    let result = [...(rows || [])];
    if (options.filters) {
      for (const [field, value] of Object.entries(options.filters)) {
        result = result.filter(row => String(row?.[field]) === String(value));
      }
    }
    if (options.order) {
      result.sort((a, b) => String(a?.[options.order] ?? "").localeCompare(String(b?.[options.order] ?? "")) * (options.ascending === false ? -1 : 1));
    }
    return result;
  }

  function isSchemaError(error) {
    const text = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
    return error?.code === "PGRST205" || error?.code === "42P01" || text.includes("schema cache") || text.includes("could not find the table") || text.includes("does not exist");
  }

  function markFallback(table, error) {
    window.dispatchEvent(new CustomEvent("bali:storage-fallback", {
      detail: { table, message: error?.message || "Таблица недоступна" }
    }));
  }

  async function sha256(value) {
    const bytes = new TextEncoder().encode(String(value || ""));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  }

  async function list(table, options = {}) {
    if (!cloudEnabled) return applyOptions(readCache(table), options);
    let query = client.from(table).select("*");
    if (options.filters) for (const [field, value] of Object.entries(options.filters)) query = query.eq(field, value);
    if (options.order) query = query.order(options.order, { ascending: options.ascending !== false, nullsFirst: false });
    const { data, error } = await query;
    if (error) {
      if (resilientTables.has(table) && isSchemaError(error)) {
        markFallback(table, error);
        return applyOptions(readCache(table), options);
      }
      throw error;
    }
    if (keys[table]) writeCache(table, data || []);
    return data || [];
  }

  async function saveLocal(table, payload) {
    const rows = readCache(table);
    const index = rows.findIndex(item => String(item.id) === String(payload.id));
    if (index >= 0) rows[index] = { ...rows[index], ...payload };
    else rows.unshift({ created_at: new Date().toISOString(), ...payload });
    writeCache(table, rows);
    return rows.find(item => String(item.id) === String(payload.id));
  }

  async function save(table, row) {
    const payload = { ...row };
    if (!payload.id) payload.id = idFor(table);
    payload.updated_at = new Date().toISOString();
    if (!cloudEnabled) return saveLocal(table, payload);
    const { data, error } = await client.from(table).upsert(payload).select().single();
    if (error) {
      if (resilientTables.has(table) && isSchemaError(error)) {
        markFallback(table, error);
        return saveLocal(table, payload);
      }
      throw error;
    }
    const cached = readCache(table);
    const index = cached.findIndex(item => String(item.id) === String(data.id));
    if (index >= 0) cached[index] = data; else cached.unshift(data);
    writeCache(table, cached);
    return data;
  }

  async function remove(table, id) {
    const removeLocal = () => {
      writeCache(table, readCache(table).filter(item => String(item.id) !== String(id)));
      return true;
    };
    if (!cloudEnabled) return removeLocal();
    const { error } = await client.from(table).delete().eq("id", id);
    if (error) {
      if (resilientTables.has(table) && isSchemaError(error)) {
        markFallback(table, error);
        return removeLocal();
      }
      throw error;
    }
    return removeLocal();
  }

  async function findOrCreateCustomer(data) {
    const phone = String(data.phone || "").replace(/\s+/g, "");
    if (!phone) return null;
    const rows = await list("customers");
    const existing = rows.find(row => String(row.phone || "").replace(/\s+/g, "") === phone);
    return save("customers", {
      ...(existing || {}),
      name: data.name || data.customer_name || existing?.name || "Гость",
      phone,
      telegram: data.telegram || existing?.telegram || "",
      notes: existing?.notes || "",
      visits: Number(existing?.visits || 0),
      total_spent: Number(existing?.total_spent || 0)
    });
  }

  async function createBooking(data) {
    if (!cloudEnabled) {
      const date = data.booking_date;
      const conflict = readCache("bookings").find(row => String(row.table_id) === String(data.table_id) && row.booking_date === date && !["cancelled", "completed"].includes(row.status));
      if (conflict) throw new Error("Этот стол уже забронирован на выбранную дату");
      const customer = await findOrCreateCustomer(data);
      const table = readCache("hall_tables").find(row => String(row.id) === String(data.table_id));
      return save("bookings", {
        ...data,
        customer_id: customer?.id || null,
        customer_name: data.name || data.customer_name || customer?.name || "Гость",
        table_name: table?.name || data.table_name || data.table_id || "",
        guests: Number(data.guests || 2),
        status: data.status || "pending",
        booking_time: data.booking_time || "23:00"
      });
    }
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

  async function getAvailability(date) {
    if (!cloudEnabled) {
      const [tables, bookings] = await Promise.all([list("hall_tables"), list("bookings")]);
      return tables.filter(table => table.active !== false).map(table => {
        const booking = bookings.find(row => String(row.table_id) === String(table.id) && row.booking_date === date && !["cancelled", "completed"].includes(row.status));
        return { ...table, available: !booking, booking: booking || null };
      });
    }
    const { data, error } = await client.rpc("get_table_availability", { p_date: date });
    if (error) throw error;
    const privateBookings = await list("bookings", { filters: { booking_date: date } }).catch(() => []);
    return (data || []).map(table => {
      const booking = privateBookings.find(row => String(row.table_id) === String(table.id) && !["cancelled", "completed"].includes(row.status));
      return { ...table, available: Boolean(table.available), booking: booking || null };
    });
  }

  async function signIn(login, password) {
    if (!cloudEnabled) {
      const allowedLogin = String(cfg.adminLogin || "BaliBali");
      if (String(login || "").trim() !== allowedLogin || await sha256(password) !== ADMIN_PASSWORD_SHA256) throw new Error("Неверный логин или пароль");
      sessionStorage.setItem(LOCAL_ADMIN_SESSION, "1");
      return { user: { email: cfg.adminEmail || "balibali@bali.local", user_metadata: { login: allowedLogin } }, local: true };
    }
    const email = String(login || "").trim() === String(cfg.adminLogin || "BaliBali") ? String(cfg.adminEmail || "balibali@bali.local") : String(login || "").trim();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    sessionStorage.removeItem(LOCAL_ADMIN_SESSION);
    if (client) await client.auth.signOut();
  }

  async function getSession() {
    if (!cloudEnabled) return sessionStorage.getItem(LOCAL_ADMIN_SESSION) === "1" ? { user: { user_metadata: { login: cfg.adminLogin || "BaliBali" } }, local: true } : null;
    const { data } = await client.auth.getSession();
    return data.session;
  }

  function resetDemo() { return false; }

  window.BaliStore = {
    cloudEnabled, client, list, save, remove, createBooking, findOrCreateCustomer,
    getAvailability, signIn, signOut, getSession, readCache, writeCache, resetDemo,
    isSchemaError, resilientTables
  };
})();