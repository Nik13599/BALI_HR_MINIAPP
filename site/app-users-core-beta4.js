(() => {
  if (window.BaliAppUsers) return;
  const store = window.BaliStore;
  const game = window.BaliBeta4Game;
  const points = window.BaliPoints;
  const cfg = window.BALI_CONFIG || {};
  const tg = window.Telegram?.WebApp;
  const KEY = "bali_app_users_v1";
  const AGE_KEY = "bali_age_verification_v1";
  const now = () => new Date().toISOString();
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
  const write = rows => { localStorage.setItem(KEY, JSON.stringify(rows)); window.dispatchEvent(new CustomEvent("bali:app-users-changed")); return rows; };
  const digits = value => String(value || "").replace(/\D/g, "");
  const ageState = () => { try { return JSON.parse(localStorage.getItem(AGE_KEY) || "null"); } catch { return null; } };
  const ageVerified = () => ageState()?.verified === true;
  const ageOf = value => { if(!value)return null; const b=new Date(`${value}T12:00:00`); if(Number.isNaN(b.getTime()))return null; const n=new Date(); let age=n.getFullYear()-b.getFullYear(); if(n.getMonth()<b.getMonth()||(n.getMonth()===b.getMonth()&&n.getDate()<b.getDate()))age--; return age; };
  const endpoint = cfg.telegramAuthEndpoint || (cfg.supabaseUrl ? `${String(cfg.supabaseUrl).replace(/\/$/, "")}/functions/v1/telegram-auth-bootstrap` : "");
  let heartbeatTimer = 0;
  let heartbeatBusy = false;

  function verifiedTelegramUser() {
    if (!window.BaliTelegramAuth?.isAuthenticated?.()) return null;
    return window.BALI_TELEGRAM_USER || window.BaliTelegramAuth.user?.() || null;
  }

  function currentIdentity() {
    const profile = game?.profile?.() || points?.profile?.() || {};
    const verified = verifiedTelegramUser() || {};
    const age = ageState();
    const telegramId = verified.telegram_id || verified.telegramId || null;
    const userKey = String(verified.user_key || (telegramId ? `tg:${telegramId}` : ""));
    const birthDate = profile.birthDate || verified.birth_date || age?.birthDate || "";
    return {
      user_key: userKey,
      telegram_id: telegramId,
      name: profile.name || verified.name || "Гость BALI",
      username: verified.username || profile.username || profile.telegram || "",
      phone: profile.phone || verified.phone || "",
      avatar: verified.avatar || profile.avatar || "",
      birth_date: birthDate,
      gender: ["male","female"].includes(profile.gender) ? profile.gender : (verified.gender || "unspecified"),
      age: ageOf(birthDate)
    };
  }

  async function serverAction(action, profile = null) {
    if (!endpoint || !cfg.supabaseAnonKey || !tg?.initData) return null;
    const response = await fetch(endpoint, {
      method:"POST",
      headers:{ "Content-Type":"application/json", apikey:cfg.supabaseAnonKey, Authorization:`Bearer ${cfg.supabaseAnonKey}` },
      body:JSON.stringify({ action, init_data:tg.initData, ...(profile ? { profile } : {}) })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.user) throw new Error(data.error || "Не удалось обновить Telegram-профиль");
    window.BALI_TELEGRAM_USER = data.user;
    return data.user;
  }

  async function syncVerifiedProfile(row) {
    return await serverAction("update_profile", { name:row.name, phone:digits(row.phone), birth_date:row.birth_date || null, gender:row.gender || "unspecified" }) || row;
  }

  async function heartbeat() {
    if (heartbeatBusy || document.getElementById("adminNav") || document.visibilityState !== "visible") return;
    if (!window.BaliTelegramAuth?.isAuthenticated?.() || !tg?.initData) return;
    heartbeatBusy = true;
    try {
      const saved = await serverAction("heartbeat");
      if (saved?.user_key) {
        const rows = read();
        rows[saved.user_key] = { ...(rows[saved.user_key] || {}), ...saved, last_seen_at:saved.last_seen_at || now() };
        write(rows);
      }
    } catch {} finally { heartbeatBusy = false; }
  }

  function startHeartbeat() {
    if (document.getElementById("adminNav")) return;
    clearInterval(heartbeatTimer);
    heartbeat();
    heartbeatTimer = setInterval(heartbeat, 60000);
  }

  async function register() {
    if (document.getElementById("adminNav")) return null;
    if (!window.BaliTelegramAuth?.isAuthenticated?.() || !ageVerified()) return null;
    const identity = currentIdentity();
    if (!identity.user_key || !identity.telegram_id) return null;
    const rows = read();
    const previous = rows[identity.user_key] || {};
    const row = { ...previous, ...identity, first_seen_at:previous.first_seen_at || now(), last_seen_at:now(), opens:Number(previous.opens || 0) + 1 };
    rows[identity.user_key] = row;
    write(rows);
    try {
      const saved = await syncVerifiedProfile(row);
      rows[identity.user_key] = { ...row, ...saved };
      write(rows);
      return rows[identity.user_key];
    } catch { return row; }
  }

  async function isAdminSession() {
    if (!store?.cloudEnabled || !store.client) return false;
    try { const { data } = await store.client.auth.getSession(); return Boolean(data?.session?.user); }
    catch { return false; }
  }

  async function listAdmin() {
    const local = Object.values(read());
    if (!store?.cloudEnabled || !store.client || !(await isAdminSession())) return local;
    try {
      const { data, error } = await store.client.from("app_users").select("*").order("last_seen_at", { ascending:false });
      if (error) return local;
      return [...new Map([...(data || []), ...local].map(row => [String(row.user_key), row])).values()];
    } catch { return local; }
  }

  window.BaliAppUsers = { KEY, register, listAdmin, currentIdentity, ageOf, verifiedTelegramUser, heartbeat, startHeartbeat };
  if (!document.getElementById("adminNav") && sessionStorage.getItem("bali_app_user_registered") !== "1") {
    const run = () => {
      if (sessionStorage.getItem("bali_app_user_registered") === "1") return;
      sessionStorage.setItem("bali_app_user_registered", "1");
      register();
    };
    if (ageVerified()) setTimeout(run, 0);
    else window.addEventListener("bali:age-verified", run, { once:true });
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") heartbeat(); });
  window.addEventListener("bali:telegram-authenticated", startHeartbeat, { once:true });
  if (window.BaliTelegramAuth?.isAuthenticated?.()) setTimeout(startHeartbeat, 250);
})();