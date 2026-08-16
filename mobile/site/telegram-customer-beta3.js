(() => {
  const store = window.BaliStore;
  const tg = window.Telegram?.WebApp;
  const user = tg?.initDataUnsafe?.user;
  if (!store || !tg || !user?.id) return;

  const CURRENT_KEY = "bali_current_customer_v1";
  const OPEN_KEY = `bali_customer_open_${user.id}`;
  const clientKey = `tg:${user.id}`;
  const digits = (value = "") => String(value).replace(/\D/g, "");
  let customer = null;

  const profile = () => ({
    client_key: clientKey,
    owner_key: clientKey,
    telegram_id: String(user.id),
    telegram_username: user.username || "",
    telegram: user.username ? `@${user.username}` : "",
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    name: `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Гость BALI",
    language_code: user.language_code || "",
    photo_url: user.photo_url || "",
    is_premium: Boolean(user.is_premium)
  });

  function saveSession(value) {
    customer = value;
    localStorage.setItem(CURRENT_KEY, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("bali:customer-session", { detail: { customer: value } }));
    return value;
  }

  async function registerLocal(extra = {}, incrementOpen = false) {
    const rows = await store.list("customers");
    const base = profile();
    const existing = rows.find((item) => String(item.telegram_id || "") === String(user.id)) || rows.find((item) => item.client_key === clientKey);
    const now = new Date().toISOString();
    const result = await store.save("customers", {
      ...(existing || {}),
      ...base,
      ...extra,
      phone: digits(extra.phone || existing?.phone || ""),
      phone_source: extra.phone_source || existing?.phone_source || "",
      visits: Number(existing?.visits || 0),
      points_balance: Number(existing?.points_balance || 0),
      app_opens: Number(existing?.app_opens || 0) + (incrementOpen ? 1 : 0),
      first_seen_at: existing?.first_seen_at || existing?.created_at || now,
      last_opened_at: incrementOpen ? now : (existing?.last_opened_at || now),
      created_at: existing?.created_at || now,
      updated_at: now
    });
    return saveSession(result);
  }

  async function registerSecure(extra = {}, incrementOpen = false) {
    const endpoint = String(window.BALI_CONFIG?.telegramAuthEndpoint || "").replace(/\/$/, "");
    if (!endpoint || !tg.initData) return null;
    const response = await fetch(`${endpoint}/telegram/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: tg.initData, profile: extra, incrementOpen })
    });
    if (!response.ok) throw new Error("Telegram session error");
    const payload = await response.json();
    return saveSession(payload.customer || payload);
  }

  async function register(extra = {}, incrementOpen = false) {
    try {
      const secure = await registerSecure(extra, incrementOpen);
      if (secure) return secure;
    } catch (error) {
      console.warn("Secure Telegram CRM endpoint is not connected yet", error);
    }
    return registerLocal(extra, incrementOpen);
  }

  async function completedVisits() {
    const rows = await store.list("bookings");
    return rows.filter((row) => (row.owner_key === clientKey || row.customer_id === customer?.id || String(row.telegram_id || "") === String(user.id)) && row.status === "completed").length;
  }

  function prefillBooking() {
    const form = document.getElementById("bookingForm");
    if (!form || !customer) return;
    if (form.elements.name && !form.elements.name.value) form.elements.name.value = customer.name || profile().name;
    if (form.elements.telegram && !form.elements.telegram.value) form.elements.telegram.value = customer.telegram || profile().telegram;
    if (form.elements.phone && !form.elements.phone.value && customer.phone) form.elements.phone.value = customer.phone.startsWith("+") ? customer.phone : `+${customer.phone}`;
  }

  async function renderProfile() {
    if (!customer) return;
    customer.visits = await completedVisits();
    customer.points_balance = Number(window.BaliPoints?.profile()?.balance ?? customer.points_balance ?? 0);
    const phone = customer.phone ? (String(customer.phone).startsWith("+") ? customer.phone : `+${customer.phone}`) : "";
    const html = `<section class="section" id="customerProfile"><div class="customer-profile-card">
      <div><span class="eyebrow">ВАШ ПРОФИЛЬ BALI</span><h2>${esc(customer.name || profile().name)}</h2><p>${esc(customer.telegram || "Telegram-никнейм скрыт или не задан")}</p></div>
      <div class="customer-profile-stats"><article><span>ТЕЛЕФОН</span><strong>${phone ? esc(phone) : "Не указан"}</strong></article><article><span>ПОСЕЩЕНИЯ</span><strong>${Number(customer.visits || 0)}</strong></article><article><span>БАЛЛЫ</span><strong>${Number(customer.points_balance || 0)}</strong></article></div>
      <div class="customer-phone-tools"><button class="secondary" id="requestTelegramPhone" type="button">Предоставить телефон через Telegram</button><form id="manualCustomerPhone"><input name="phone" inputmode="tel" placeholder="Введите телефон вручную" value="${esc(phone)}"/><button class="primary" type="submit">Сохранить</button></form></div>
      <small>Имя, Telegram ID и никнейм сохраняются при входе в Mini App. Телефон добавляется только после вашего подтверждения или ручного ввода.</small>
    </div></section>`;
    const old = document.getElementById("customerProfile");
    if (old) old.outerHTML = html;
    else document.getElementById("booking")?.insertAdjacentHTML("beforebegin", html);
    bindProfile();
    prefillBooking();
  }

  function bindProfile() {
    document.getElementById("manualCustomerPhone")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const phone = digits(new FormData(event.currentTarget).get("phone"));
      if (phone.length < 7) return toast("Введите корректный номер телефона");
      await register({ phone, phone_source: "manual" }, false);
      toast("Телефон привязан к профилю BALI");
      renderProfile();
    });
    document.getElementById("requestTelegramPhone")?.addEventListener("click", () => {
      if (!tg.requestContact) return toast("Запрос телефона недоступен в этой версии Telegram");
      tg.requestContact((shared) => {
        if (!shared) return toast("Передача телефона отменена");
        toast("Телефон отправлен боту. Профиль обновится после обработки контакта");
        setTimeout(() => register({}, false).then(renderProfile), 1500);
      });
    });
  }

  function injectStyles() {
    if (document.getElementById("telegramCustomerStyle")) return;
    const style = document.createElement("style");
    style.id = "telegramCustomerStyle";
    style.textContent = `.customer-profile-card{padding:25px 20px;border:1px solid var(--line);border-radius:28px;background:linear-gradient(145deg,#151917,#0d0f0f)}.customer-profile-card h2{margin:7px 0 4px;font-size:clamp(27px,7vw,42px)}.customer-profile-card p,.customer-profile-card>small{color:var(--muted);line-height:1.5}.customer-profile-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:18px 0}.customer-profile-stats article{padding:13px;border:1px solid rgba(255,255,255,.08);border-radius:16px;background:rgba(255,255,255,.025)}.customer-profile-stats span{display:block;color:var(--muted);font-size:8px;letter-spacing:.1em}.customer-profile-stats strong{display:block;margin-top:6px;color:var(--lime);font-size:13px;overflow-wrap:anywhere}.customer-phone-tools{display:grid;gap:9px;margin-bottom:12px}.customer-phone-tools form{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}.customer-phone-tools input{min-width:0;min-height:48px;padding:0 13px;border:1px solid var(--line);border-radius:13px;background:rgba(255,255,255,.045);color:var(--text)}@media(max-width:560px){.customer-profile-stats{grid-template-columns:1fr}.customer-phone-tools form{grid-template-columns:1fr}.customer-phone-tools form button{width:100%}}`;
    document.head.appendChild(style);
  }

  const previousCreateBooking = store.createBooking.bind(store);
  store.createBooking = async function(data) {
    const phone = digits(data.phone || customer?.phone || "");
    if (phone) await register({ phone, phone_source: customer?.phone_source || "booking" }, false);
    const enriched = {
      ...data,
      name: data.name || customer?.name || profile().name,
      phone: phone || data.phone || "",
      telegram: data.telegram || customer?.telegram || profile().telegram,
      telegram_id: String(user.id),
      telegram_username: user.username || "",
      client_key: clientKey,
      owner_key: clientKey
    };
    const booking = await previousCreateBooking(enriched);
    if (booking?.id) {
      await store.save("bookings", { ...booking, customer_id: customer?.id || booking.customer_id, telegram_id: String(user.id), telegram_username: user.username || "", client_key: clientKey, owner_key: clientKey });
    }
    renderProfile();
    return booking;
  };

  injectStyles();
  register({}, !sessionStorage.getItem(OPEN_KEY)).then(async () => {
    sessionStorage.setItem(OPEN_KEY, "1");
    prefillBooking();
    await renderProfile();
  }).catch((error) => console.warn(error));
  window.addEventListener("bali:data-changed", (event) => { if (!event.detail?.table || ["bookings", "customers"].includes(event.detail.table)) renderProfile(); });
})();