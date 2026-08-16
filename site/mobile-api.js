(() => {
  "use strict";
  if (window.BaliApi) return;

  const TOKEN_KEY = "bali_mobile_access_token";
  const configuredBase = String(window.BALI_API_BASE || "").trim().replace(/\/+$/, "");

  function token() {
    try { return String(localStorage.getItem(TOKEN_KEY) || ""); }
    catch { return ""; }
  }

  function setToken(value) {
    try {
      if (value) localStorage.setItem(TOKEN_KEY, String(value));
      else localStorage.removeItem(TOKEN_KEY);
    } catch {}
  }

  function clearToken() {
    setToken("");
  }

  function url(path) {
    const value = String(path || "");
    if (/^https?:\/\//i.test(value)) return value;
    if (!configuredBase) return value;
    return `${configuredBase}${value.startsWith("/") ? value : `/${value}`}`;
  }

  function request(path, options = {}) {
    const accessToken = token();
    const headers = { ...(options.headers || {}) };
    if (accessToken && !headers.Authorization && !headers.authorization) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    return fetch(url(path), {
      ...options,
      credentials: configuredBase ? "omit" : (options.credentials || "include"),
      headers
    });
  }

  window.BaliApi = {
    base: configuredBase,
    tokenKey: TOKEN_KEY,
    token,
    setToken,
    clearToken,
    url,
    request
  };
})();
