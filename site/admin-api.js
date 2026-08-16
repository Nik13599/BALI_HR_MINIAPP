(() => {
  "use strict";
  if (window.BaliAdminApi) return;

  const TOKEN_KEY = "bali_admin_access_token";
  const configuredBase = String(window.BALI_ADMIN_API_BASE || "").trim().replace(/\/+$/, "");
  const nativeFetch = window.fetch.bind(window);

  function token() {
    try { return String(sessionStorage.getItem(TOKEN_KEY) || ""); }
    catch { return ""; }
  }

  function setToken(value) {
    try {
      if (value) sessionStorage.setItem(TOKEN_KEY, String(value));
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch {}
  }

  function clearToken() { setToken(""); }

  function toRemoteUrl(value) {
    const text = String(value || "");
    if (/^https?:\/\//i.test(text)) return text;
    if (!configuredBase) return text;
    return `${configuredBase}${text.startsWith("/") ? text : `/${text}`}`;
  }

  function isApiUrl(value) {
    const text = String(value || "");
    return text.startsWith("/api/v1/") || Boolean(configuredBase && text.startsWith(`${configuredBase}/api/v1/`));
  }

  async function routedFetch(input, options = {}) {
    const originalUrl = typeof input === "string" || input instanceof URL
      ? String(input)
      : String(input?.url || "");
    const routeApi = isApiUrl(originalUrl);
    const target = routeApi && originalUrl.startsWith("/api/v1/") ? toRemoteUrl(originalUrl) : input;
    const headers = new Headers(options.headers || (input instanceof Request ? input.headers : undefined));
    const accessToken = token();
    if (routeApi && accessToken && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    const response = await nativeFetch(target, {
      ...options,
      credentials: routeApi && configuredBase ? "omit" : (options.credentials || "same-origin"),
      headers
    });

    if (routeApi && /\/api\/v1\/auth\/admin\/login(?:$|[?#])/.test(originalUrl) && response.ok) {
      const payload = await response.clone().json().catch(() => null);
      if (payload?.accessToken) setToken(payload.accessToken);
    }
    if (routeApi && /\/api\/v1\/auth\/admin\/logout(?:$|[?#])/.test(originalUrl) && response.ok) {
      clearToken();
    }
    if (routeApi && response.status === 401 && !/\/api\/v1\/auth\/admin\/login/.test(originalUrl)) {
      clearToken();
    }
    return response;
  }

  window.fetch = routedFetch;

  document.addEventListener("click", async event => {
    const link = event.target.closest("a[download][href^='/api/v1/']");
    if (!link || !configuredBase) return;
    event.preventDefault();
    try {
      const response = await routedFetch(link.getAttribute("href"), { headers: { Accept: "text/csv,*/*" } });
      if (!response.ok) throw new Error("Не удалось выгрузить файл");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const download = document.createElement("a");
      download.href = objectUrl;
      download.download = link.getAttribute("download") || "bali-export.csv";
      document.body.append(download);
      download.click();
      download.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      console.error("BALI admin download failed", error);
    }
  }, true);

  window.BaliAdminApi = { base: configuredBase, token, setToken, clearToken, request: routedFetch };
})();
