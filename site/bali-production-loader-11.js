(() => {
  if (window.__BALI_PRODUCTION_LOADER_PATCHED__) return;
  window.__BALI_PRODUCTION_LOADER_PATCHED__ = true;

  const script = document.createElement('script');
  script.src = './bali-production-integrity-fix.js?v=bali-production-15';
  script.async = false;
  document.body.appendChild(script);

  // keep original loader entry compatibility
  const original = document.createElement('script');
  original.src = './bali-production-loader-11.js?v=bali-production-14-core';
  original.async = false;
  original.onload = () => {};
  document.body.appendChild(original);
})();
