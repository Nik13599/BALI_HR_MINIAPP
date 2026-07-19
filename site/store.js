(() => {
  const cfg = window.BALI_CONFIG || {};
  const cloudEnabled = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  const client = cloudEnabled
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true }
      })
    : null;

  const keys = {
    events: "bali_events_v2",
    menu_items: "bali_menu_v2",
    hall_tables: "bali_tables_v2",
    customers: "bali_customers_v2",
    bookings: "bali_bookings_v2"
  };

  const now = new Date();
  const isoDate = (offset = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  const seed = {
    events: [
      { id: "event-tropic", title: "Tropic Party", event_date: isoDate(5), event_time: "23:00", description: "Тропическая ночь, DJ-сеты и свободный вход.", image_url: "", active: true, sort_order: 1 },
      { id: "event-weekend", title: "BALI Weekend", event_date: isoDate(12), event_time: "23:00", description: "Главная вечеринка выходных: музыка, бар и кальяны.", image_url: "", active: true, sort_order: 2 },
      { id: "event-special", title: "Special Night", event_date: isoDate(19), event_time: "23:00", description: "Специальная программа и приглашённые артисты.", image_url: "", active: true, sort_order: 3 }
    ],
    menu_items: [
      { id: "menu-1", category: "Коктейли", name: "BALI Signature", description: "Тропический фирменный коктейль", price: 25, active: true, sort_order: 1 },
      { id: "menu-2", category: "Коктейли", name: "Passion Spritz", description: "Маракуйя, цитрус, игристые ноты", price: 23, active: true, sort_order: 2 },
      { id: "menu-3", category: "Шоты", name: "BALI Shot Set", description: "Сет из 5 фирменных шотов", price: 45, active: true, sort_order: 3 },
      { id: "menu-4", category: "Пиво", name: "Пиво разливное", description: "Светлое, 0,5 л", price: 10, active: true, sort_order: 4 },
      { id: "menu-5", category: "Кальяны", name: "Classic Hookah", description: "Классическая чаша", price: 45, active: true, sort_order: 5 },
      { id: "menu-6", category: "Кальяны", name: "Premium Hookah", description: "Премиальная чаша и авторский микс", price: 60, active: true, sort_order: 6 }
    ],
    hall_tables: [
      { id: "table-1", name: "Стол 1", seats: 4, x: 12, y: 18, shape: "round", active: true },
      { id: "table-2", name: "Стол 2", seats: 4, x: 40, y: 18, shape: "round", active: true },
      { id: "table-3", name: "Стол 3", seats: 6, x: 68, y: 18, shape: "round", active: true },
      { id: "table-4", name: "Стол 4", seats: 4, x: 15, y: 52, shape: "square", active: true },
      { id: "table-5", name: "Стол 5", seats: 6, x: 43, y: 52, shape: "square", active: true },
      { id: "table-6", name: "VIP 1", seats: 8, x: 72, y: 50, shape: "vip", active: true },
      { id: "table-7", name: "VIP 2", seats: 10, x: 70, y: 76, shape: "vip", active: true }
    ],
    customers: [],
    bookings: []
  };

  function readLocal(table) {
    const raw = localStorage.getItem(keys[table]);
    if (!raw) {
      const initial = seed[table] || [];
      localStorage.setItem(keys[table], JSON.stringify(initial));
      return structuredClone(initial);
    }
    try { return JSON.parse(raw); } catch { return []; }
  }

  function writeLocal(table, rows) {
    localStorage.setItem(keys[table], JSON.stringify(rows));
    window.dispatchEvent(new CustomEvent("bali:data-changed", { detail: { table } }));
    return rows;
  }

  function makeId(prefix) {
    return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
  }

  async function list(table, options = {}) {
    if (!cloudEnabled) {
      let rows = readLocal(table);
      if (options.filters) {
        for (const [field, value] of Object.entries(options.filters)) rows = rows.filter((row) => String(row[field]) === String(value));
      }
      const order = options.order || "sort_order";
      return rows.sort((a, b) => (a[order] ?? 0) - (b[order] ?? 0));
    }

    let query = client.from(table).select("*");
    if (options.filters) {
      for (const [field, value] of Object.entries(options.filters)) query = query.eq(field, value);
    }
    if (options.order) query = query.order(options.order, { ascending: options.ascending !== false });
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async function save(table, row) {
    const payload = { ...row };
    if (!payload.id) payload.id = makeId(table.replace(/s$/, ""));
    if (!cloudEnabled) {
      const rows = readLocal(table);
      const index = rows.findIndex((item) => item.id === payload.id);
      if (index >= 0) rows[index] = { ...rows[index], ...payload };
      else rows.push(payload);
      writeLocal(table, rows);
      return payload;
    }
    const { data, error } = await client.from(table).upsert(payload).select().single();
    if (error) throw error;
    return data;
  }

  async function remove(table, id) {
    if (!cloudEnabled) {
      writeLocal(table, readLocal(table).filter((row) => row.id !== id));
      return;
    }
    const { error } = await client.from(table).delete().eq("id", id);
    if (error) throw error;
  }

  async function findOrCreateCustomer(data) {
    const phone = String(data.phone || "").replace(/\s+/g, "");
    if (!phone) return null;
    const customers = await list("customers");
    let customer = customers.find((item) => String(item.phone || "").replace(/\s+/g, "") === phone);
    if (customer) {
      customer = await save("customers", {
        ...customer,
        name: data.name || customer.name,
        telegram: data.telegram || customer.telegram || "",
        visits: Number(customer.visits || 0)
      });
      return customer;
    }
    return save("customers", {
      name: data.name || "Гость",
      phone,
      telegram: data.telegram || "",
      notes: "",
      visits: 0,
      total_spent: 0,
      created_at: new Date().toISOString()
    });
  }

  async function createBooking(data) {
    if (cloudEnabled) {
      const { data: booking, error } = await client.rpc("create_public_booking", {
        p_booking_date: data.booking_date,
        p_booking_time: data.booking_time || "23:00",
        p_table_id: data.table_id,
        p_name: data.name || data.customer_name || "Гость",
        p_phone: data.phone || "",
        p_guests: Number(data.guests || 2),
        p_telegram: data.telegram || "",
        p_comment: data.comment || ""
      });
      if (error) throw error;
      return booking;
    }

    const customer = await findOrCreateCustomer(data);
    const tables = await list("hall_tables");
    const table = tables.find((item) => item.id === data.table_id);
    const occupied = (await list("bookings", { filters: { booking_date: data.booking_date } }))
      .some((item) => item.table_id === data.table_id && !["cancelled", "completed"].includes(item.status));
    if (occupied) throw new Error("Этот стол уже забронирован на выбранную дату");
    return save("bookings", {
      booking_date: data.booking_date,
      booking_time: data.booking_time || "23:00",
      table_id: data.table_id,
      table_name: table?.name || data.table_id,
      customer_id: customer?.id || null,
      customer_name: data.name || customer?.name || "Гость",
      phone: data.phone || customer?.phone || "",
      guests: Number(data.guests || 2),
      status: data.status || "pending",
      comment: data.comment || "",
      created_at: new Date().toISOString()
    });
  }

  async function getAvailability(date) {
    if (cloudEnabled) {
      const { data, error } = await client.rpc("get_table_availability", { p_date: date });
      if (error) throw error;
      const { data: authData } = await client.auth.getSession();
      let privateBookings = [];
      if (authData.session) privateBookings = await list("bookings", { filters: { booking_date: date } });
      return (data || []).map((table) => {
        const booking = privateBookings.find((item) => item.table_id === table.id && !["cancelled", "completed"].includes(item.status));
        return {
          ...table,
          available: Boolean(table.available),
          booking: booking || (table.available ? null : { status: table.booking_status })
        };
      });
    }

    const [tables, bookings] = await Promise.all([
      list("hall_tables"),
      list("bookings", { filters: { booking_date: date } })
    ]);
    const activeBookings = bookings.filter((b) => !["cancelled", "completed"].includes(b.status));
    return tables.filter((t) => t.active !== false).map((table) => {
      const booking = activeBookings.find((b) => b.table_id === table.id);
      return { ...table, booking: booking || null, available: !booking };
    });
  }

  async function signIn(email, password) {
    if (!cloudEnabled) return { user: { email: "demo@bali.local" }, demo: true };
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    if (cloudEnabled) await client.auth.signOut();
  }

  async function getSession() {
    if (!cloudEnabled) return { user: { email: "demo@bali.local" }, demo: true };
    const { data } = await client.auth.getSession();
    return data.session;
  }

  window.BaliStore = {
    cloudEnabled,
    client,
    list,
    save,
    remove,
    createBooking,
    findOrCreateCustomer,
    getAvailability,
    signIn,
    signOut,
    getSession,
    resetDemo() {
      Object.values(keys).forEach((key) => localStorage.removeItem(key));
      Object.keys(seed).forEach(readLocal);
      location.reload();
    }
  };
})();
