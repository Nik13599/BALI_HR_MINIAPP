(() => {
  if (window.__BALI_DEMO_USER_TOOLBAR__) return;
  window.__BALI_DEMO_USER_TOOLBAR__ = true;
  const demo = window.BaliDemo;
  if (!demo) return;

  const style = document.createElement("style");
  style.textContent = `.bali-demo-chip{position:fixed;z-index:2147483000;top:calc(env(safe-area-inset-top) + 7px);left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:7px;max-width:calc(100% - 150px);padding:6px 10px;border:1px solid rgba(200,255,61,.32);border-radius:999px;background:rgba(7,10,8,.88);backdrop-filter:blur(16px);box-shadow:0 8px 30px #0008;color:#fff;font:700 9px/1.2 Inter,system-ui;pointer-events:none}.bali-demo-chip b{color:#c8ff3d;white-space:nowrap}.bali-demo-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}`;
  document.head.appendChild(style);
  const chip = document.createElement("div");
  chip.className = "bali-demo-chip";
  const user = demo.activeUser();
  chip.innerHTML = `<b>DEMO</b><span>${user.name}</span>`;
  document.body.appendChild(chip);
})();
