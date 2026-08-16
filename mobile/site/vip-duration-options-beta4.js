(() => {
  if (window.__BALI_VIP_DURATION_OPTIONS__) return;
  window.__BALI_VIP_DURATION_OPTIONS__ = true;

  const game = window.BaliBeta4Game;
  const loyalty = window.BaliBeta4Loyalty;
  const points = window.BaliPoints;
  if (!game || !loyalty || !points) return;

  const CONFIG_KEY = "bali_vip_variant_prices_v1";
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const variants = [
    { id:"day", title:"1 день", subtitle:"VIP действует 24 часа", days:1 },
    { id:"event1", title:"1 мероприятие", subtitle:"Один вход на выбранное мероприятие", events:1 },
    { id:"event2", title:"2 мероприятия", subtitle:"Два отдельных мероприятия", events:2 },
    { id:"month", title:"1 месяц", subtitle:"VIP действует 30 дней", days:30 }
  ];

  function defaults() {
    const monthly = loyalty.config()?.vipPointPrices || {};
    const result = {};
    game.config().plans.forEach(plan => {
      const month = Math.max(1, Number(monthly[plan.id] || 0));
      result[plan.id] = {
        day: Math.max(1, Math.ceil(month * .14 / 50) * 50),
        event1: Math.max(1, Math.ceil(month * .22 / 50) * 50),
        event2: Math.max(1, Math.ceil(month * .4 / 50) * 50),
        month
      };
    });
    return result;
  }

  function prices() {
    const saved = read(CONFIG_KEY, {});
    const base = defaults();
    const result = {};
    Object.keys(base).forEach(planId => result[planId] = { ...base[planId], ...(saved[planId] || {}) });
    return result;
  }

  function currentRawVip() {
    return game.read(game.KEYS.vip, null);
  }

  function activeDescription(vip) {
    if (!vip) return "";
    if (vip.variantId === "event1" || vip.variantId === "event2") return `${Number(vip.eventPassesRemaining || 0)} из ${Number(vip.eventPassesTotal || 0)} мероприятий осталось`;
    return variants.find(row => row.id === vip.variantId)?.title || "VIP активен";
  }

  function styles() {
    if (document.getElementById("vipDurationOptionsStyle")) return;
    const style = document.createElement("style");
    style.id = "vipDurationOptionsStyle";
    style.textContent = `
      .vip-duration-groups{display:grid;gap:13px}.vip-duration-plan{padding:14px;border:1px solid var(--line);border-radius:18px;background:#ffffff06}
      .vip-duration-plan>header{display:flex;justify-content:space-between;align-items:start;gap:10px;margin-bottom:10px}.vip-duration-plan h3{margin:0;font-size:15px}.vip-duration-plan header span{color:var(--lime);font-size:9px;font-weight:900}
      .vip-duration-benefits{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:11px}.vip-duration-benefits span{padding:6px 8px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-size:8px}
      .vip-duration-options{display:grid;grid-template-columns:1fr 1fr;gap:8px}.vip-duration-option{display:grid;gap:4px;min-height:92px;padding:11px;border:1px solid var(--line);border-radius:14px;background:#111513;color:#fff;text-align:left}.vip-duration-option strong{font-size:11px}.vip-duration-option small{color:var(--muted);font-size:8px;line-height:1.4}.vip-duration-option b{margin-top:auto;color:var(--lime);font-size:10px}
      .vip-duration-active{padding:14px;border:1px solid rgba(200,255,61,.28);border-radius:17px;background:rgba(200,255,61,.07)}.vip-duration-active strong{color:var(--lime)}
      @media(max-width:390px){.vip-duration-options{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function renderShop() {
    const root = document.getElementById("profileVipBody");
    if (!root) return;
    const active = game.vip();
    const raw = currentRawVip();
    const allPrices = prices();
    root.innerHTML = `
      ${active ? `<section class="vip-duration-active"><small>АКТИВНЫЙ СТАТУС</small><h3>${esc(active.plan.name)}</h3><strong>${esc(activeDescription(raw))}</strong><br><small>Действует до ${new Date(active.expiresAt).toLocaleString("ru-RU", {day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</small></section>` : ""}
      <div class="vip-duration-groups">
        ${game.config().plans.filter(plan => plan.active !== false).map(plan => `
          <section class="vip-duration-plan">
            <header><div><h3>${esc(plan.name)}</h3><span>${Number(plan.discount || 0)}% скидка</span></div><span>×${Number(plan.pointsMultiplier || 1)} баллы</span></header>
            <div class="vip-duration-benefits"><span>${plan.freeEntry ? "Бесплатный вход" : "Спецусловия входа"}</span><span>${Number(plan.earlyBookingHours || 0)} ч. ранней брони</span><span>${Number(plan.guestPasses || 0)} гостевых проходов</span></div>
            <div class="vip-duration-options">
              ${variants.map(item => {
                const price = Number(allPrices[plan.id]?.[item.id] || 0);
                return `<button class="vip-duration-option" type="button" data-buy-vip-variant="${esc(plan.id)}:${item.id}" ${price ? "" : "disabled"}><strong>${esc(item.title)}</strong><small>${esc(item.subtitle)}</small><b>${price ? `${price} BALI-Баллов` : "Цена не настроена"}</b></button>`;
              }).join("")}
            </div>
          </section>`).join("")}
      </div>`;
  }

  function activate(planId, variantId) {
    const item = variants.find(row => row.id === variantId);
    const plan = game.config().plans.find(row => row.id === planId && row.active !== false);
    const price = Number(prices()[planId]?.[variantId] || 0);
    if (!item || !plan || !price) return { ok:false, message:"Вариант VIP не найден" };
    const spent = loyalty.spendPoints(price, `${plan.name} · ${item.title}`, "vip_variant");
    if (!spent.ok) return spent;
    try {
      const activeDays = item.events ? 90 : Number(item.days || 30);
      const vip = game.activateVip(planId, "bali_points_variant", activeDays);
      const extended = { ...vip, variantId:item.id, variantTitle:item.title, paidPoints:price, eventPassesTotal:Number(item.events || 0), eventPassesRemaining:Number(item.events || 0), usedEventIds:[] };
      game.write(game.KEYS.vip, extended);
      return { ok:true, vip:extended, price };
    } catch (error) {
      points.adjustAccount(points.profile(), price, `Возврат за ${plan.name}`);
      return { ok:false, message:error.message || "Не удалось активировать VIP" };
    }
  }

  function consumePasses() {
    const vip = currentRawVip();
    if (!vip || !vip.eventPassesTotal || Number(vip.eventPassesRemaining || 0) <= 0) return;
    let rows = [];
    try { rows = Object.values(JSON.parse(localStorage.getItem("bali_event_checkins_v1") || "{}")); } catch {}
    const profile = game.profile();
    const keys = new Set(game.identityKeys(profile).map(String));
    const used = new Set((vip.usedEventIds || []).map(String));
    const mine = rows.filter(row => keys.has(String(row.user_key || "")) || (profile.telegramId && String(row.telegram_id || "") === String(profile.telegramId))).sort((a,b) => String(a.checked_in_at || "").localeCompare(String(b.checked_in_at || "")));
    let remaining = Number(vip.eventPassesRemaining || 0);
    let last = null;
    for (const row of mine) {
      const eventId = String(row.event_id || "");
      if (!eventId || used.has(eventId) || remaining <= 0) continue;
      used.add(eventId);
      remaining -= 1;
      last = row;
    }
    if (remaining === Number(vip.eventPassesRemaining || 0)) return;
    const next = { ...vip, eventPassesRemaining:remaining, usedEventIds:[...used] };
    if (remaining <= 0 && last) {
      const end = new Date(last.checked_in_at || Date.now());
      end.setDate(end.getDate() + 1);
      end.setHours(8, 0, 0, 0);
      next.expiresAt = end.toISOString();
    }
    game.write(game.KEYS.vip, next);
  }

  const toast = message => {
    const node = document.getElementById("toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2400);
  };

  document.addEventListener("click", event => {
    if (event.target.closest("[data-open-profile-points], [data-open-profile-vip]")) setTimeout(renderShop, 0);
    const button = event.target.closest("[data-buy-vip-variant]");
    if (!button) return;
    event.preventDefault();
    const [planId, variantId] = button.dataset.buyVipVariant.split(":");
    const item = variants.find(row => row.id === variantId);
    const plan = game.config().plans.find(row => row.id === planId);
    const price = Number(prices()[planId]?.[variantId] || 0);
    if (!confirm(`Активировать ${plan?.name || "VIP"} — ${item?.title || "вариант"} за ${price} BALI-Баллов?`)) return;
    const result = activate(planId, variantId);
    toast(result.ok ? "VIP-статус активирован" : result.message);
    renderShop();
    window.BaliCompactProfile?.mount?.();
  }, true);

  ["bali:data-changed", "bali:beta4-changed", "bali:points-changed", "bali:loyalty-changed"].forEach(name => window.addEventListener(name, () => {
    consumePasses();
    if (document.getElementById("profilePointsDialog")?.open) requestAnimationFrame(renderShop);
  }));

  styles();
  consumePasses();
  window.BaliVipVariants = { CONFIG_KEY, variants, prices, activate, renderShop };
})();