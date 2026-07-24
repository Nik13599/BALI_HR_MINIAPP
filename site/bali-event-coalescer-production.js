(() => {
  if (window.__BALI_EVENT_COALESCER_PRODUCTION__) return;
  window.__BALI_EVENT_COALESCER_PRODUCTION__ = true;

  const coalesced = new Set([
    "bali:points-changed",
    "bali:beta4-changed",
    "bali:loyalty-changed",
    "bali:data-changed"
  ]);
  const originalAdd = window.addEventListener.bind(window);
  const originalRemove = window.removeEventListener.bind(window);
  const wrappers = new WeakMap();

  window.addEventListener = function(type, listener, options) {
    if (!coalesced.has(type) || typeof listener !== "function") {
      return originalAdd(type, listener, options);
    }

    let typeMap = wrappers.get(listener);
    if (!typeMap) {
      typeMap = new Map();
      wrappers.set(listener, typeMap);
    }
    if (typeMap.has(type)) return originalAdd(type, typeMap.get(type), options);

    const source = Function.prototype.toString.call(listener);
    const legacyHeavyProfileHandler = source.includes("points-profile") || source.includes("game-profile") || source.includes("points-ranking") || source.includes("game-ranking");
    let timer = 0;
    let latestEvent = null;
    const wrapped = function(event) {
      latestEvent = event;
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = 0;
        if (legacyHeavyProfileHandler && window.__BALI_PROFILE_LITE_PRODUCTION__) return;
        try { listener.call(window, latestEvent); }
        catch (error) { window.BaliErrorBoundary?.capture?.(error, { module:"event-coalescer", event:type }); }
      }, 100);
    };
    typeMap.set(type, wrapped);
    return originalAdd(type, wrapped, options);
  };

  window.removeEventListener = function(type, listener, options) {
    const wrapped = typeof listener === "function" ? wrappers.get(listener)?.get(type) : null;
    return originalRemove(type, wrapped || listener, options);
  };
})();