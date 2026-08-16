(() => {
  if (window.BaliAppUsers) return;
  const game = window.BaliBeta4Game;
  const points = window.BaliPoints;
  const KEY = "bali_app_users_v1";
  const AGE_KEY = "bali_age_verification_v1";
  const now = () => new Date().toISOString();
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
  const write = rows => { localStorage.setItem(KEY, JSON.stringify(rows)); window.dispatchEvent(new CustomEvent("bali:app-users-changed")); return rows; };
  const ageState = () => { try { return JSON.parse(localStorage.getItem(AGE_KEY) || "null"); } catch { return null; } };
  const ageVerified = () => ageState()?.verified === true;
  const ageOf = value => {
    if (!value) return null;
    const birth = new Date(`${value}T12:00:00`);
    if (Number.isNaN(birth.getTime())) return null;
    const current = new Date();
    let age = current.getFullYear() - birth.getFullYear();
    if (current.getMonth() < birth.getMonth() || (current.getMonth() === birth.getMonth() && current.getDate() < birth.getDate())) age -= 1;
    return age;
  };

  function currentIdentity() {
    const profile = game?.profile?.() || points?.profile?.() || {};
    const verified = ageState();
    const userKey = String(profile.id || profile.userKey || profile.ownerKey || profile.code || "");
    const birthDate = profile.birthDate || verified?.birthDate || "";
    return {
      user_key: userKey,
      name: profile.name || "Гость BALI",
      phone: profile.phone || "",
      avatar: profile.avatar || "",
      birth_date: birthDate,
      gender: ["male", "female"].includes(profile.gender) ? profile.gender : "unspecified",
      status: profile.status || "closed",
      vip_plan: profile.vipPlan || game?.vip?.()?.planId || "",
      age: ageOf(birthDate)
    };
  }

  async function register() {
    if (!document.getElementById("adminNav") && !ageVerified()) return null;
    const identity = currentIdentity();
    if (!identity.user_key) return null;
    const rows = read();
    const previous = rows[identity.user_key] || {};
    const row = {
      ...previous,
      ...identity,
      first_seen_at: previous.first_seen_at || now(),
      last_seen_at: now(),
      opens: Number(previous.opens || 0) + 1
    };
    rows[identity.user_key] = row;
    write(rows);
    return row;
  }

  async function listAdmin() {
    return Object.values(read()).sort((a, b) => String(b.last_seen_at || "").localeCompare(String(a.last_seen_at || "")));
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