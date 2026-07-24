(() => {
  if (window.__BALI_CLOUD_LOYALTY__) return;
  window.__BALI_CLOUD_LOYALTY__ = true;

  const cfg = window.BALI_CONFIG || {};
  const store = window.BaliStore;
  const tg = window.Telegram?.WebApp;
  const points = window.BaliPoints;
  const game = window.BaliBeta4Game;
  const loyalty = window.BaliBeta4Loyalty;
  const social = window.BaliBeta4Social;
  if (!points || !game) return;

  const state = {
    balance: Number(points.profile().balance || 0),
    vip: null,
    plans: [],
    chip_requests: [],
    reward_grants: [],
    gift_grants: [],
    loading: false
  };

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
  const toast = message => {
    const node = document.getElementById("toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2400);
  };
  const functionUrl = () => cfg.supabaseUrl ? `${String(cfg.supabaseUrl).replace(/\/$/, "")}/functions/v1/loyalty-action` : "";

  async function invoke(action, extra = {}) {
    if (!store?.cloudEnabled || !tg?.initData) throw new Error("Бонусная система ещё не подключена");
    const response = await fetch(functionUrl(), {
      method: "POST",
      headers: { "Content-Type":"application/json", apikey:cfg.supabaseAnonKey, Authorization:`Bearer ${cfg.supabaseAnonKey}` },
      body: JSON.stringify({ action, init_data:tg.initData, ...extra })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) throw new Error(data.error || "Ошибка бонусной системы");
    return data;
  }

  function syncGrantedRewards(rows = []) {
    if (!loyalty?.KEYS?.grants) return;
    const mapped = rows.map(row => {
      const reward = row.loyalty_rewards || {};
      return {
        id: String(row.id),
        rewardId: String(row.reward_id || reward.id || ""),
        rewardTitle: row.reward_title || reward.title || "Награда BALI",
        userKey: String(row.user_key || game.profile().userKey || game.profile().id || ""),
        userName: game.profile().name || "Гость BALI",
        source: row.source || "admin",
        xp: Number(reward.xp || 0),
        earnedAt: row.created_at || new Date().toISOString(),
        revokedAt: row.revoked_at || null
      };
    });
    localStorage.setItem(loyalty.KEYS.grants, JSON.stringify(mapped));
    window.dispatchEvent(new CustomEvent("bali:loyalty-changed", { detail: { key: loyalty.KEYS.grants } }));
  }

  function syncGrantedGifts(rows = []) {
    if (!social?.KEYS?.gifts) return;
    const mine = String(social.myId());
    const local = social.gifts().filter(item => item.source !== "cloud_admin");
    const cloud = rows.map(row => {
      const gift = row.loyalty_gifts || {};
      return {
        id: String(row.id),
        fromId: String(row.from_user_key || "bali-admin"),
        fromName: row.from_user_key ? "Пользователь BALI" : "BALI",
        toId: mine,
        toName: game.profile().name || "Гость BALI",
        giftId: String(row.gift_id || gift.id || ""),
        giftName: row.gift_title || gift.title || "Подарок BALI",
        icon: gift.icon || "🎁",
        stars: Number(gift.points_cost || 0),
        source: "cloud_admin",
        createdAt: row.created_at || new Date().toISOString()
      };
    });
    const merged = [...new Map([...cloud, ...local].map(item => [String(item.id), item])).values()];
    localStorage.setItem(social.KEYS.gifts, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent("bali:social-changed", { detail: { key: social.KEYS.gifts } }));
  }

  function syncLocal(data = {}) {
    if (data.balance !== undefined) {
      state.balance = Number(data.balance || 0);
      const profile = points.profile();
      points.write(points.keys.profile, { ...profile, balance:state.balance });
    }
    state.vip = data.vip || null;
    state.plans = data.plans || state.plans;
    state.chip_requests = data.chip_requests || state.chip_requests;
    state.reward_grants = data.reward_grants || [];
    state.gift_grants = data.gift_grants || [];

    syncGrantedRewards(state.reward_grants);
    syncGrantedGifts(state.gift_grants);

    if (state.vip) {
      const plan = game.config().plans.find(item => item.id === state.vip.plan_id);
      game.write(game.KEYS.vip, {
        id:state.vip.id,
        planId:state.vip.plan_id,
        source:state.vip.source || "server",
        purchasedAt:state.vip.starts_at,
        expiresAt:state.vip.expires_at,
        days:plan?.days || 30
      });
    } else {
      game.write(game.KEYS.vip, null);
    }
    window.dispatchEvent(new CustomEvent("bali:cloud-loyalty-changed"));
  }

  async function load() {
    if (state.loading) return;
    state.loading = true;
    try {
      syncLocal(await invoke("get_profile"));
      renderShop();
      window.BaliCompactProfile?.mount?.();
    } catch (error) {
      console.warn("[BALI cloud loyalty]", error?.message || error);
    } finally {
      state.loading = false;
    }
  }

  function renderShop() {
    const root = document.getElementById("profilePointsBody");
    if (!root) return;
    const active = state.vip;
    root.innerHTML = `<div class="profile-v2-balance"><span>ВАШ БАЛАНС</span><strong>${state.balance}</strong><small>BALI-Баллов</small></div><div class="profile-v2-shop-note">Накапливайте BALI-Баллы и оплачивайте ими до 90% стоимости продукции клуба.</div><section class="profile-v2-section"><h3>VIP-статусы</h3>${active ? `<div class="vip-duration-active"><small>АКТИВНЫЙ СТАТУС</small><h3>${esc(active.plan_name || active.plan_id)}</h3><small>Действует до ${new Date(active.expires_at).toLocaleDateString("ru-RU")}</small></div>` : ""}<div class="vip-duration-groups">${state.plans.map(plan => `<section class="vip-duration-plan"><header><div><h3>${esc(plan.name)}</h3><span>${Number(plan.discount || 0)}% скидка</span></div><span>${Number(plan.points_price || 0)} BALI-Баллов</span></header><button class="primary full" type="button" data-cloud-buy-vip="${esc(plan.id)}">Активировать на ${Number(plan.days || 30)} дней</button></section>`).join("") || '<div class="empty">VIP-планы пока не настроены</div>'}</div></section><section class="profile-v2-section"><h3>Приобрести фишки</h3><div class="chip-request-box"><label><span>Количество фишек</span><input id="cloudChipQuantity" type="number" min="1" value="1"></label><div class="chip-request-cost"><span>Стоимость</span><strong id="cloudChipCost">100 баллов</strong></div><button class="primary full" type="button" id="cloudChipSubmit">Отправить заявку</button><p class="chip-request-note">100 BALI-Баллов = 1 фишка. Заявка поступит администратору, выдача подтверждается в клубе.</p></div><div class="chip-request-history">${state.chip_requests.map(request => `<article class="chip-request-row"><div><strong>${Number(request.quantity || 0)} фиш. · ${Number(request.points_cost || 0)} баллов</strong><small>${new Date(request.created_at).toLocaleString("ru-RU")}</small></div><span class="chip-request-status ${esc(request.status)}">${request.status === "fulfilled" ? "Вручено" : request.status === "cancelled" ? "Отменено" : "Ожидает"}</span></article>`).join("")}</div></section>`;
    const input = document.getElementById("cloudChipQuantity");
    const cost = document.getElementById("cloudChipCost");
    input?.addEventListener("input", () => cost.textContent = `${Math.max(1, Math.floor(Number(input.value || 1))) * 100} баллов`);
    document.getElementById("cloudChipSubmit")?.addEventListener("click", async () => {
      const quantity = Math.max(1, Math.floor(Number(input?.value || 1)));
      if (!confirm(`Отправить заявку на ${quantity} фиш. за ${quantity * 100} BALI-Баллов?`)) return;
      try {
        syncLocal(await invoke("create_chip_request", { quantity }));
        toast("Заявка отправлена администратору");
        renderShop();
      } catch (error) { toast(error.message || "Не удалось отправить заявку"); }
    });
  }

  document.addEventListener("click", async event => {
    if (event.target.closest("[data-open-profile-points],[data-open-profile-vip]")) {
      setTimeout(() => { renderShop(); load(); }, 0);
      return;
    }
    const button = event.target.closest("[data-cloud-buy-vip]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const plan = state.plans.find(item => item.id === button.dataset.cloudBuyVip);
    if (!plan || !confirm(`Активировать ${plan.name} за ${Number(plan.points_price || 0)} BALI-Баллов?`)) return;
    try {
      syncLocal(await invoke("buy_vip", { plan_id:plan.id, days:Number(plan.days || 30) }));
      toast("VIP-статус активирован");
      renderShop();
    } catch (error) { toast(error.message || "Не удалось активировать VIP"); }
  }, true);

  setTimeout(load, 800);
  setInterval(load, 120000);
  window.BaliVipVariants = { renderShop };
  window.BaliCloudLoyalty = { load, renderShop, state };
})();