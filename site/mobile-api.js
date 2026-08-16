(() => {
  "use strict";
  if (window.BaliApi) return;

  const TOKEN_KEY = "bali_mobile_access_token";
  const configuredBase = String(window.BALI_API_BASE || "").trim().replace(/\/+$/, "");
  const nativeFetch = window.fetch.bind(window);

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

  function isApiPath(value) {
    const text = String(value || "");
    return text.startsWith("/api/v1/") || Boolean(configuredBase && text.startsWith(`${configuredBase}/api/v1/`));
  }

  function routedFetch(input, options = {}) {
    const originalUrl = typeof input === "string" || input instanceof URL ? String(input) : String(input?.url || "");
    const routeApi = isApiPath(originalUrl);
    const target = routeApi && originalUrl.startsWith("/api/v1/") ? url(originalUrl) : input;
    const headers = new Headers(options.headers || (input instanceof Request ? input.headers : undefined));
    const accessToken = token();
    if (routeApi && accessToken && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
    return nativeFetch(target, {
      ...options,
      credentials: routeApi && configuredBase ? "omit" : (options.credentials || "include"),
      headers
    });
  }

  window.fetch = routedFetch;

  function request(path, options = {}) {
    return routedFetch(url(path), options);
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
