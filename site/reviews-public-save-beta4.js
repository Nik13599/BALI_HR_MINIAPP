(() => {
  if (window.__BALI_REVIEWS_PUBLIC_SAVE__ || !window.BaliStore) return;
  window.__BALI_REVIEWS_PUBLIC_SAVE__ = true;

  const store = window.BaliStore;
  const cfg = window.BALI_CONFIG || {};
  const tg = window.Telegram?.WebApp;
  const baseSave = store.save.bind(store);
  const endpoint = cfg.supabaseUrl ? `${String(cfg.supabaseUrl).replace(/\/$/, "")}/functions/v1/review-submit-production` : "";

  function rewardNotice(amount) {
    if (!amount) return;
    setTimeout(() => {
      const node = document.getElementById("toast");
      if (!node) return;
      node.textContent = `Отзыв принят · +${amount} BALI-Баллов`;
      node.classList.add("show");
      clearTimeout(rewardNotice.timer);
      rewardNotice.timer = setTimeout(() => node.classList.remove("show"), 3000);
    }, 350);
  }

  store.save = async function(table, row) {
    if (table !== "reviews" || !store.cloudEnabled || !store.client) return baseSave(table, row);
    const { data:sessionData } = await store.client.auth.getSession();
    if (sessionData?.session) return baseSave(table, row);
    if (!endpoint || !cfg.supabaseAnonKey || !tg?.initData) throw new Error("Отзывы доступны только внутри Telegram-приложения");

    const response = await fetch(endpoint, {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        apikey:cfg.supabaseAnonKey,
        Authorization:`Bearer ${cfg.supabaseAnonKey}`
      },
      body:JSON.stringify({
        init_data:tg.initData,
        type:row.type || "other",
        event_id:row.event_id || "",
        rating:row.rating || null,
        message:row.message || ""
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) throw new Error(data.error || "Не удалось отправить отзыв");

    const points = window.BaliPoints;
    if (data.balance !== undefined && points?.keys?.profile) {
      const profile = points.profile();
      points.write(points.keys.profile, { ...profile, balance:Number(data.balance || 0) });
      window.dispatchEvent(new CustomEvent("bali:points-changed"));
    }
    if (Number(data.reward_amount || 0) > 0) {
      rewardNotice(Number(data.reward_amount));
      window.dispatchEvent(new CustomEvent("bali:review-reward", {
        detail:{ amount:Number(data.reward_amount), status:data.reward_status }
      }));
    }
    return { ...(data.review || row), reward_amount:Number(data.reward_amount || 0), reward_status:data.reward_status || "not_eligible" };
  };
})();