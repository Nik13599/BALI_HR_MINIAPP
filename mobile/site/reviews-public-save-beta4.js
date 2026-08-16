(() => {
  if (window.__BALI_REVIEWS_PUBLIC_SAVE__ || !window.BaliStore) return;
  window.__BALI_REVIEWS_PUBLIC_SAVE__ = true;
  const store = window.BaliStore;
  const baseSave = store.save.bind(store);
  store.save = async function(table, row) {
    if (table !== "reviews" || !store.cloudEnabled || !store.client) return baseSave(table, row);
    const { data } = await store.client.auth.getSession();
    if (data?.session) return baseSave(table, row);
    const payload = { ...row };
    if (!payload.id) payload.id = `review-${crypto.randomUUID?.() || Date.now()}`;
    const { error } = await store.client.from("reviews").insert(payload);
    if (error) throw error;
    return payload;
  };
})();