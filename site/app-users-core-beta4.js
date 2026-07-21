(() => {
  if (window.BaliAppUsers) return;
  const store = window.BaliStore;
  const game = window.BaliBeta4Game;
  const points = window.BaliPoints;
  const KEY = "bali_app_users_v1";
  const AGE_KEY = "bali_age_verification_v1";
  const now = () => new Date().toISOString();
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
  const write = rows => { localStorage.setItem(KEY, JSON.stringify(rows)); window.dispatchEvent(new CustomEvent("bali:app-users-changed")); return rows; };
  const digits = value => String(value || "").replace(/\D/g, "");
  const ageState = () => { try { return JSON.parse(localStorage.getItem(AGE_KEY) || "null"); } catch { return null; } };
  const ageVerified = () => ageState()?.verified === true;
  const ageOf = value => { if(!value)return null; const b=new Date(`${value}T12:00:00`); if(Number.isNaN(b.getTime()))return null; const n=new Date(); let age=n.getFullYear()-b.getFullYear(); if(n.getMonth()<b.getMonth()||(n.getMonth()===b.getMonth()&&n.getDate()<b.getDate()))age--; return age; };

  function currentIdentity() {
    const profile = game?.profile?.() || points?.profile?.() || {};
    const tg = window.Telegram?.WebApp?.initDataUnsafe?.user || {};
    const verified = ageState();
    const userKey = String(profile.id || profile.userKey || (tg.id ? `tg:${tg.id}` : profile.code || ""));
    const birthDate = profile.birthDate || verified?.birthDate || "";
    return {
      user_key: userKey,
      telegram_id: profile.telegramId || tg.id || null,
      name: profile.name || tg.first_name || "Гость BALI",
      username: profile.username || profile.telegram || (tg.username ? `@${tg.username}` : ""),
      phone: profile.phone || "",
      avatar: profile.avatar || tg.photo_url || "",
      birth_date: birthDate,
      gender: ["male","female"].includes(profile.gender) ? profile.gender : "unspecified",
      age: ageOf(birthDate)
    };
  }

  async function register() {
    if (!document.getElementById("adminNav") && !ageVerified()) return null;
    const identity = currentIdentity();
    if (!identity.user_key) return null;
    const rows = read();
    const previous = rows[identity.user_key] || {};
    const row = { ...previous, ...identity, first_seen_at: previous.first_seen_at || now(), last_seen_at: now(), opens: Number(previous.opens || 0) + 1 };
    rows[identity.user_key] = row;
    write(rows);
    if (store?.cloudEnabled && store.client) {
      try {
        await store.client.rpc("register_app_user", {
          p_user_key: row.user_key,
          p_telegram_id: row.telegram_id ? String(row.telegram_id) : null,
          p_name: row.name,
          p_username: row.username,
          p_phone: digits(row.phone),
          p_avatar: row.avatar,
          p_birth_date: row.birth_date || null,
          p_gender: row.gender || "unspecified"
        });
      } catch {}
    }
    return row;
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

  window.BaliAppUsers = { KEY, register, listAdmin, currentIdentity, ageOf };
  if (!document.getElementById("adminNav") && sessionStorage.getItem("bali_app_user_registered") !== "1") {
    const run = () => {
      if (sessionStorage.getItem("bali_app_user_registered") === "1") return;
      sessionStorage.setItem("bali_app_user_registered", "1");
      register();
    };
    if (ageVerified()) setTimeout(run, 0);
    else window.addEventListener("bali:age-verified", run, { once:true });
  }
})();