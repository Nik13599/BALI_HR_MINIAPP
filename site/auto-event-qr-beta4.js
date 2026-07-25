(() => {
  if (window.__BALI_AUTO_EVENT_QR__) return;
  window.__BALI_AUTO_EVENT_QR__ = true;
  const store = window.BaliStore;
  if (!store) return;

  const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(18))).map(byte => byte.toString(16).padStart(2,"0")).join("");
  const originalSave = store.save.bind(store);
  const originalList = store.list.bind(store);

  async function save(table, row = {}) {
    if (table !== "events") return originalSave(table, row);
    const payload = { ...row };
    if (!payload.qr_token) {
      payload.qr_token = randomToken();
      payload.qr_created_at = new Date().toISOString();
    }
    if (!payload.event_end_time) payload.event_end_time = "06:00";
    return originalSave(table, payload);
  }

  async function ensureAll() {
    const rows = await originalList("events", { order:"event_date" });
    const result = [];
    for (const row of rows) result.push(row.qr_token ? row : await save("events", row));
    return result;
  }

  window.BaliStore = Object.freeze({ ...store, save, __autoEventQr:true });
  ensureAll().catch(console.error);
  window.BaliAutoEventQr = { save, ensureAll, randomToken };
})();