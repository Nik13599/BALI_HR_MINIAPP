(() => {
  const store = window.BaliStore;
  if (!store || window.__BALI_ADMIN_LOGIN_GUARD__) return;
  window.__BALI_ADMIN_LOGIN_GUARD__ = true;

  const cfg = window.BALI_CONFIG || {};
  const LOGIN = String(cfg.adminLogin || "BaliBali");
  const ADMIN_EMAIL = String(cfg.adminEmail || "balibali@bali.local");
  const PASSWORD_SHA256 = "b3866eebf3d9c3d40280fbca38cee1ccf618f97f824f7705f7c46635b39c47f0";
  const SESSION_KEY = "bali_admin_authenticated_v1";

  const originalSignIn = store.signIn?.bind(store);
  const originalSignOut = store.signOut?.bind(store);
  const originalGetSession = store.getSession?.bind(store);

  async function sha256(value) {
    const bytes = new TextEncoder().encode(String(value || ""));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  }

  store.signIn = async (login, password) => {
    if (String(login || "").trim() !== LOGIN) throw new Error("Неверный логин или пароль");

    if (store.cloudEnabled) {
      if (!originalSignIn) throw new Error("Авторизация Supabase недоступна");
      return originalSignIn(ADMIN_EMAIL, password);
    }

    if (await sha256(password) !== PASSWORD_SHA256) throw new Error("Неверный логин или пароль");
    sessionStorage.setItem(SESSION_KEY, "1");
    return { user: { email: ADMIN_EMAIL, user_metadata: { login: LOGIN } }, local: true };
  };

  store.signOut = async () => {
    sessionStorage.removeItem(SESSION_KEY);
    if (store.cloudEnabled && originalSignOut) await originalSignOut();
  };

  store.getSession = async () => {
    if (store.cloudEnabled && originalGetSession) return originalGetSession();
    return sessionStorage.getItem(SESSION_KEY) === "1"
      ? { user: { email: ADMIN_EMAIL, user_metadata: { login: LOGIN } }, local: true }
      : null;
  };
})();