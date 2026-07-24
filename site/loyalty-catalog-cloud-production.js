(() => {
  if (window.__BALI_LOYALTY_CATALOG_CLOUD_PRODUCTION__) return;
  window.__BALI_LOYALTY_CATALOG_CLOUD_PRODUCTION__ = true;

  const store = window.BaliStore;
  const loyalty = window.BaliBeta4Loyalty;
  const social = window.BaliBeta4Social;
  if (!store || !loyalty || !social) return;

  let loading = false;
  let signature = "";

  async function refresh() {
    if (loading) return;
    loading = true;
    try {
      const [rewardRows, giftRows] = await Promise.all([
        store.list("loyalty_rewards", { order: "created_at", ascending: true }).catch(() => []),
        store.list("loyalty_gifts", { order: "created_at", ascending: true }).catch(() => [])
      ]);

      const rewards = rewardRows.filter(row => row.active !== false).map((row, index) => ({
        id: String(row.id),
        title: row.title || "Награда BALI",
        description: row.description || "",
        image: row.image || "",
        icon: row.icon || "🏆",
        xp: Number(row.xp || 0),
        points_cost: Number(row.points_cost || 0),
        conditionType: row.condition_type || "manual",
        threshold: Number(row.threshold || 1),
        eventId: row.event_id || "",
        active: true,
        sort_order: Number(row.sort_order ?? index + 1),
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || new Date().toISOString()
      }));

      const gifts = giftRows.filter(row => row.active !== false).map(row => ({
        id: String(row.id),
        icon: row.icon || "🎁",
        name: row.title || "Подарок BALI",
        stars: Number(row.points_cost || 0),
        points: Number(row.points_cost || 0),
        image: row.image || "",
        stock: row.stock
      }));

      const nextSignature = JSON.stringify([
        rewards.map(row => [row.id, row.updatedAt, row.active]),
        gifts.map(row => [row.id, row.points, row.stock])
      ]);
      if (nextSignature === signature) return;
      signature = nextSignature;

      if (rewards.length) loyalty.saveRewards(rewards);
      if (gifts.length) social.GIFT_CATALOG.splice(0, social.GIFT_CATALOG.length, ...gifts);

      window.dispatchEvent(new CustomEvent("bali:loyalty-catalog-changed", {
        detail: { rewards: rewards.length, gifts: gifts.length }
      }));
      window.dispatchEvent(new CustomEvent("bali:social-changed"));
    } finally {
      loading = false;
    }
  }

  window.addEventListener("bali:data-changed", event => {
    if (["loyalty_rewards", "loyalty_gifts"].includes(event.detail?.table)) refresh();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refresh();
  });
  setTimeout(refresh, 200);
  setInterval(refresh, 60000);

  window.BaliCloudCatalog = { refresh };
})();