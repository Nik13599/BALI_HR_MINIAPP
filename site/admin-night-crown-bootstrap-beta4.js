(() => {
  if (window.__BALI_CROWN_ADMIN_BOOTSTRAP__) return;
  window.__BALI_CROWN_ADMIN_BOOTSTRAP__ = true;

  const names = [
    'night-crown-awards-fix-beta4.js',
    'admin-night-crown-remove-beta4.js',
  ];
  let attempts = 0;

  function loadExtensions() {
    if (!window.BaliNightCrown) {
      attempts += 1;
      if (attempts < 100) window.setTimeout(loadExtensions, 50);
      return;
    }

    for (const name of names) {
      if (document.querySelector(`script[data-crown-extension="${name}"]`)) continue;
      const script = document.createElement('script');
      script.async = false;
      script.src = `./${name}?v=bali-full-demo-8-stable12`;
      script.dataset.crownExtension = name;
      document.body.appendChild(script);
    }
  }

  loadExtensions();
})();
