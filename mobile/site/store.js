(() => {
  if (window.__BALI_LOCAL_STORE_ONLY__) return;
  window.__BALI_LOCAL_STORE_ONLY__ = true;

  const keys = Object.freeze({
    events: "bali_events_v2",
    menu_items: "bali_menu_v2",
    hall_tables: "bali_tables_v2",
    customers: "bali_customers_v2",
    bookings: "bali_bookings_v2",
    venue_content: "bali_venue_content_v1",
    reviews: "bali_reviews_v1"
  });

  const now = new Date();
  const isoDate = (offset = 0) => {
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
  };

  const seed = Object.freeze({
    events: [
      { id:"event-tropic", title:"Tropic Party", event_date:isoDate(5), event_time:"23:00", description:"Тропическая ночь, DJ-сеты и свободный вход.", details_description:"Тропическая вечеринка BALI с яркой сценографией, клубной музыкой, баром, кальянами и танцами до утра.", performers:[], image_url:"", active:true, sort_order:1 },
      { id:"event-weekend", title:"BALI Weekend", event_date:isoDate(12), event_time:"23:00", description:"Главная вечеринка выходных: музыка, бар и кальяны.", details_description:"Большой клубный уикенд с насыщенной музыкальной программой и специальными участниками.", performers:[], image_url:"", active:true, sort_order:2 },
      { id:"event-special", title:"Special Night", event_date:isoDate(19), event_time:"23:00", description:"Специальная программа и приглашённые артисты.", details_description:"Специальная ночь BALI с приглашёнными артистами и расширенной шоу-программой.", performers:[], image_url:"", active:true, sort_order:3 }
    ],
    menu_items: [
      { id:"menu-1", category:"Коктейли", name:"BALI Signature", description:"Тропический фирменный коктейль", price:25, active:true, sort_order:1 },
      { id:"menu-2", category:"Коктейли", name:"Passion Spritz", description:"Маракуйя, цитрус, игристые ноты", price:23, active:true, sort_order:2 },
      { id:"menu-3", category:"Шоты", name:"BALI Shot Set", description:"Сет из 5 фирменных шотов", price:45, active:true, sort_order:3 },
      { id:"menu-4", category:"Пиво", name:"Пиво разливное", description:"Светлое, 0,5 л", price:10, active:true, sort_order:4 },
      { id:"menu-5", category:"Кальяны", name:"Classic Hookah", description:"Классическая чаша", price:45, active:true, sort_order:5 },
      { id:"menu-6", category:"Кальяны", name:"Premium Hookah", description:"Премиальная чаша и авторский микс", price:60, active:true, sort_order:6 }
    ],
    hall_tables: [
      { id:"table-1", name:"Стол 1", seats:4, x:12, y:18, shape:"round", active:true },
      { id:"table-2", name:"Стол 2", seats:4, x:40, y:18, shape:"round", active:true },
      { id:"table-3", name:"Стол 3", seats:6, x:68, y:18, shape:"round", active:true },
      { id:"table-4", name:"Стол 4", seats:4, x:15, y:52, shape:"square", active:true },
      { id:"table-5", name:"Стол 5", seats:6, x:43, y:52, shape:"square", active:true },
      { id:"table-6", name:"VIP 1", seats:8, x:72, y:50, shape:"vip", active:true },
      { id:"table-7", name:"VIP 2", seats:10, x:70, y:76, shape:"vip", active:true }
    ],
    customers: [],
    bookings: [],
    venue_content: [{
      id:"venue-main",
      title:"Площадка BALI",
      description:"BALI — многофункциональная клубная площадка в центре Минска с танцполом, большими экранами, профессиональным звуком, контактным баром, кухней, кальянами и комфортной рассадкой.",
      formats:"Клубные вечеринки, концерты, DJ-сеты, спортивные трансляции, закрытые мероприятия, презентации, дни рождения и корпоративные события.",
      media:[],
      active:true,
      updated_at:new Date().toISOString()
    }],
    reviews: []
  });

  const clone = (value) => {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  };

  function assertTable(table) {
    if (!Object.prototype.hasOwnProperty.call(keys, table)) throw new Error(`Неизвестный локальный раздел: ${table}`);
  }

  function readLocal(table) {
    assertTable(table);
    const raw = localStorage.getItem(keys[table]);
    if (!raw) {
      const initial = clone(seed[table] || []);
      localStorage.setItem(keys[table], JSON.stringify(initial));
      return initial;
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeLocal(table, rows) {
    assertTable(table);
    const safeRows = Array.isArray(rows) ? rows : [];
    localStorage.setItem(keys[table], JSON.stringify(safeRows));
    window.dispatchEvent(new CustomEvent("bali:data-changed", { detail:{ table, mode:"local" } }));
    return safeRows;
  }

  function makeId(prefix) {
    const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${suffix}`;
  }

  async function list(table, options = {}) {
    let rows = readLocal(table);
    if (options.filters) {
      for (const [field, value] of Object.entries(options.filters)) {
        rows = rows.filter(row => String(row?.[field] ?? "") === String(value ?? ""));
      }
    }
    const order = options.order || "sort_order";
    const direction = options.ascending === false ? -1 : 1;
    return rows.sort((a, b) => {
      const left = a?.[order];
      const right = b?.[order];
      if (typeof left === "string" || typeof right === "string") return String(left ?? "").localeCompare(String(right ?? "")) * direction;
      return (Number(left ?? 0) - Number(right ?? 0)) * direction;
    });
  }

  async function save(table, row) {
    assertTable(table);
    const payload = { ...row };
    if (!payload.id) payload.id = makeId(table.replace(/s$/, ""));
    const rows = readLocal(table);
    const index = rows.findIndex(item => item.id === payload.id);
    if (index >= 0) rows[index] = { ...rows[index], ...payload };
    else rows.push(payload);
    writeLocal(table, rows);
    return clone(payload);
  }

  async function remove(table, id) {
    writeLocal(table, readLocal(table).filter(row => row.id !== id));
  }

  async function findOrCreateCustomer(data = {}) {
    const phone = String(data.phone || "").replace(/\s+/g, "");
    if (!phone) return null;
    const customers = await list("customers");
    const existing = customers.find(item => String(item.phone || "").replace(/\s+/g, "") === phone);
    if (existing) {
      return save("customers", {
        ...existing,
        name:data.name || existing.name,
        visits:Number(existing.visits || 0)
      });
    }
    return save("customers", {
      name:data.name || "Гость",
      phone,
      notes:"",
      visits:0,
      total_spent:0,
      created_at:new Date().toISOString()
    });
  }

  async function createBooking(data = {}) {
    const customer = await findOrCreateCustomer(data);
    const tables = await list("hall_tables");
    const table = tables.find(item => item.id === data.table_id);
    const occupied = (await list("bookings", { filters:{ booking_date:data.booking_date } }))
      .some(item => item.table_id === data.table_id && !["cancelled", "completed"].includes(item.status));
    if (occupied) throw new Error("Этот стол уже забронирован на выбранную дату");
    return save("bookings", {
      booking_date:data.booking_date,
      booking_time:data.booking_time || "23:00",
      table_id:data.table_id,
      table_name:table?.name || data.table_id,
      customer_id:customer?.id || null,
      customer_name:data.name || customer?.name || "Гость",
      phone:data.phone || customer?.phone || "",
      guests:Number(data.guests || 2),
      status:data.status || "pending",
      comment:data.comment || "",
      created_at:new Date().toISOString()
    });
  }

  async function getAvailability(date) {
    const [tables, bookings] = await Promise.all([
      list("hall_tables"),
      list("bookings", { filters:{ booking_date:date } })
    ]);
    const activeBookings = bookings.filter(booking => !["cancelled", "completed"].includes(booking.status));
    return tables.filter(table => table.active !== false).map(table => {
      const booking = activeBookings.find(item => item.table_id === table.id);
      return { ...table, booking:booking || null, available:!booking };
    });
  }

  async function signIn() {
    return { user:{ email:"demo@bali.local" }, demo:true, local:true };
  }

  async function signOut() {
    return { ok:true, local:true };
  }

  async function getSession() {
    return { user:{ email:"demo@bali.local" }, demo:true, local:true };
  }

  window.BaliStore = Object.freeze({
    mode:"local-only",
    cloudEnabled:false,
    databaseEnabled:false,
    client:null,
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
      Object.values(keys).forEach(key => localStorage.removeItem(key));
      Object.keys(seed).forEach(readLocal);
      location.reload();
    }
  });
})();
