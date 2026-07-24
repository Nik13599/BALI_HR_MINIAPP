(() => {
  if (window.__BALI_SOCIAL_GIFTS_PRODUCTION__) return;
  window.__BALI_SOCIAL_GIFTS_PRODUCTION__ = true;
  const cfg = window.BALI_CONFIG || {};
  const store = window.BaliStore;
  const social = window.BaliBeta4Social;
  const points = window.BaliPoints;
  const tg = window.Telegram?.WebApp;
  if (!store || !social || !tg) return;
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const endpoint = cfg.supabaseUrl ? `${String(cfg.supabaseUrl).replace(/\/$/, "")}/functions/v1/loyalty-gift-action` : "";
  let catalog = [];
  let activeTarget = "";

  function toast(message) {
    const node = document.getElementById("toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2500);
  }

  async function invoke(action, body = {}) {
    if (!endpoint || !cfg.supabaseAnonKey || !tg.initData) throw new Error("Сервер подарков не подключён");
    const response = await fetch(endpoint, {
      method:"POST",
      headers:{ "Content-Type":"application/json", apikey:cfg.supabaseAnonKey, Authorization:`Bearer ${cfg.supabaseAnonKey}` },
      body:JSON.stringify({ action, init_data:tg.initData, ...body })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) throw new Error(data.error || "Ошибка сервера подарков");
    return data;
  }

  function targetKey(id) {
    const person = social.visiblePeople?.().find(row => String(row.id) === String(id)) || {};
    return String(person.user_key || person.userKey || (person.telegram_id || person.telegramId ? `tg:${person.telegram_id || person.telegramId}` : person.id || id));
  }

  function applyBalance(value) {
    if (value === undefined || !points?.keys?.profile) return;
    try { points.write(points.keys.profile, { ...points.profile(), balance:Number(value) }); } catch {}
  }

  function renderCatalog() {
    const root = document.querySelector("#socialGiftV2 .social-v2-gifts");
    if (!root) return;
    root.innerHTML = catalog.length ? catalog.map(gift => `<button type="button" data-send-production-gift="${esc(gift.id)}">${gift.image_url ? `<img src="${esc(gift.image_url)}" alt="" style="width:56px;height:56px;object-fit:contain;margin:auto">` : `<i>${esc(gift.icon || "🎁")}</i>`}<strong>${esc(gift.title)}</strong><small>${Number(gift.points_price || 0)} BALI-Баллов</small></button>`).join("") : '<div class="social-v2-empty">Каталог подарков пока пуст</div>';
  }

  async function loadCatalog() {
    try {
      const data = await invoke("catalog");
      catalog = data.gifts || [];
      social.GIFT_CATALOG.splice(0, social.GIFT_CATALOG.length, ...catalog.map(gift => ({ id:gift.id, icon:gift.icon || "🎁", name:gift.title, points:Number(gift.points_price || 0), image:gift.image_url || "" })));
      renderCatalog();
    } catch (error) { console.warn("[BALI gifts]", error.message); }
  }

  async function sendGift(giftId) {
    if (!activeTarget) return toast("Получатель не выбран");
    const gift = catalog.find(row => String(row.id) === String(giftId));
    if (!gift) return toast("Подарок не найден");
    if (!confirm(`Отправить «${gift.title}» за ${Number(gift.points_price || 0)} BALI-Баллов?`)) return;
    try {
      const data = await invoke("send", { gift_id:gift.id, target_user_key:targetKey(activeTarget) });
      applyBalance(data.balance);
      document.getElementById("socialGiftV2")?.close();
      toast(`Подарок «${gift.title}» отправлен`);
    } catch (error) { toast(error.message || "Не удалось отправить подарок"); }
  }

  async function renderInbox() {
    const root = document.getElementById("profileGiftsBody");
    if (!root) return;
    try {
      const data = await invoke("inbox");
      const rows = data.gifts || [];
      const title = document.getElementById("profileGiftsTitle");
      if (title) title.textContent = "Подарки";
      root.innerHTML = rows.length ? `<div class="profile-v2-list">${rows.map(row => `<article class="profile-gift-card"><span class="profile-gift-icon">${esc(row.gift_icon || "🎁")}</span><div><h3>${esc(row.gift_title || "Подарок BALI")}</h3><p>От кого: <strong>${esc(row.from_name || "BALI")}</strong>${row.note ? `<br>${esc(row.note)}` : ""}</p></div><time>${new Date(row.granted_at).toLocaleString("ru-RU", {day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</time></article>`).join("")}</div>` : '<div class="empty">Вам пока не дарили подарки</div>';
      document.querySelectorAll('[data-open-profile-gifts] strong').forEach(node => node.textContent = `Подарки · ${rows.length}`);
    } catch (error) { root.innerHTML = `<div class="empty">${esc(error.message || "Не удалось загрузить подарки")}</div>`; }
  }

  document.addEventListener("click", event => {
    const personGift = event.target.closest("[data-person-gift]");
    if (personGift) { activeTarget = personGift.dataset.personGift; setTimeout(() => { renderCatalog(); }, 20); }
    const send = event.target.closest("[data-send-production-gift]");
    if (send) { event.preventDefault(); event.stopImmediatePropagation(); sendGift(send.dataset.sendProductionGift); }
    if (event.target.closest("[data-open-profile-gifts]")) setTimeout(renderInbox, 30);
  }, true);

  const observer = new MutationObserver(() => {
    const root = document.querySelector("#socialGiftV2 .social-v2-gifts");
    if (root && !root.querySelector("[data-send-production-gift]") && catalog.length) renderCatalog();
  });
  observer.observe(document.body, { childList:true, subtree:true });
  setTimeout(loadCatalog, 500);
})();