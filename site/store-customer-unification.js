(() => {
  if (window.__BALI_STORE_CUSTOMER_UNIFICATION__) return;
  window.__BALI_STORE_CUSTOMER_UNIFICATION__ = true;
  const store = window.BaliStore;
  if (!store) return;
  const baseSave = store.save.bind(store);

  store.save = async function(table, row) {
    if (table !== "customers" || !store.cloudEnabled || !store.client) return baseSave(table, row);
    const payload = row || {};
    const { data, error } = await store.client.rpc("admin_upsert_customer", {
      p_id: payload.id || null,
      p_name: String(payload.name || "Гость BALI").trim(),
      p_phone: String(payload.phone || "").trim(),
      p_username: String(payload.telegram_username || payload.telegram || "").trim(),
      p_notes: String(payload.notes || ""),
      p_visits: Number(payload.visits || 0),
      p_total_spent: Number(payload.total_spent || 0)
    });
    if (error) {
      if (error.code === "PGRST202" || /admin_upsert_customer/i.test(error.message || "")) {
        throw new Error("Сначала выполните bali-production-client-unification-migration.sql в Supabase");
      }
      throw error;
    }
    window.dispatchEvent(new CustomEvent("bali:data-changed", { detail:{ table:"customers" } }));
    return data;
  };
})();