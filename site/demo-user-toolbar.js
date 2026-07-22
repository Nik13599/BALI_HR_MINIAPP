(() => {
  if (window.__BALI_DEMO_USER_TOOLBAR__) return;
  window.__BALI_DEMO_USER_TOOLBAR__ = true;
  const demo = window.BaliDemo;
  if (!demo) return;

  const style = document.createElement("style");
  style.textContent = `.bali-demo-launch{position:fixed;z-index:2147483000;right:10px;bottom:calc(env(safe-area-inset-bottom) + 84px);font-family:Inter,system-ui,sans-serif}.bali-demo-launch button,.bali-demo-panel select,.bali-demo-panel a{font:800 10px/1.2 Inter,system-ui,sans-serif}.bali-demo-toggle{display:flex;align-items:center;gap:7px;min-height:42px;padding:0 12px;border:1px solid rgba(200,255,61,.4);border-radius:999px;background:rgba(7,10,8,.92);box-shadow:0 12px 38px #000a;color:#fff;backdrop-filter:blur(16px)}.bali-demo-toggle b{color:#c8ff3d}.bali-demo-panel{position:absolute;right:0;bottom:50px;width:min(310px,calc(100vw - 20px));display:none;gap:9px;padding:13px;border:1px solid rgba(255,255,255,.14);border-radius:18px;background:rgba(11,15,13,.97);box-shadow:0 22px 70px #000d}.bali-demo-panel.open{display:grid}.bali-demo-panel h3{margin:0;color:#fff;font-size:13px}.bali-demo-panel p{margin:0;color:#9ca69f;font-size:9px;line-height:1.5}.bali-demo-panel label{display:grid;gap:6px;color:#cbd2ce;font-size:9px;font-weight:800}.bali-demo-panel select{width:100%;min-height:44px;padding:0 10px;border:1px solid rgba(255,255,255,.14);border-radius:11px;background:#171c19;color:#fff}.bali-demo-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.bali-demo-actions button,.bali-demo-actions a{min-height:40px;display:flex;align-items:center;justify-content:center;padding:0 9px;border:1px solid rgba(255,255,255,.13);border-radius:10px;background:#ffffff08;color:#fff;text-decoration:none}.bali-demo-actions .primary{border-color:#c8ff3d;background:#c8ff3d;color:#080a0a}.bali-demo-actions .danger{color:#ff9e9e}.bali-demo-note{padding:8px;border:1px solid rgba(200,255,61,.16);border-radius:10px;background:rgba(200,255,61,.05);color:#b7c0ba;font-size:8px;line-height:1.45}`;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.className = "bali-demo-launch";
  const active = demo.activeUser();
  root.innerHTML = `<button class="bali-demo-toggle" type="button"><b>DEMO</b><span>${active.name}</span> ⚙</button><section class="bali-demo-panel"><h3>Тестовый пользователь</h3><p>Выберите гостя с другим балансом, VIP и историей посещений.</p><label><span>Профиль</span><select data-demo-user-select>${demo.users.map(user => `<option value="${user.key}" ${user.key === active.key ? "selected" : ""}>${user.name} · ${user.balance} баллов</option>`).join("")}</select></label><div class="bali-demo-actions"><button class="primary" type="button" data-demo-apply>Открыть профиль</button><button type="button" data-demo-refresh>Обновить</button><a href="./admin-beta4-categories.html?v=beta4-admin-content-1" target="_blank">Админ ↗</a><button class="danger" type="button" data-demo-reset>Сбросить</button></div><div class="bali-demo-note">Админка и приложение используют одну тестовую базу в этом браузере. После изменений в админке нажмите «Обновить».</div></section>`;
  document.body.appendChild(root);

  const panel = root.querySelector(".bali-demo-panel");
  const select = root.querySelector("[data-demo-user-select]");
  root.querySelector(".bali-demo-toggle").addEventListener("click", event => {
    event.stopPropagation();
    panel.classList.toggle("open");
  });
  document.addEventListener("click", event => {
    if (!root.contains(event.target)) panel.classList.remove("open");
  });
  root.querySelector("[data-demo-apply]").addEventListener("click", () => {
    demo.selectUser(select.value);
    location.reload();
  });
  root.querySelector("[data-demo-refresh]").addEventListener("click", () => location.reload());
  root.querySelector("[data-demo-reset]").addEventListener("click", () => {
    if (!confirm("Вернуть первоначальные тестовые данные BALI?")) return;
    demo.reset();
    localStorage.removeItem("bali_event_content_demo_seed_v1");
    localStorage.removeItem("bali_venue_content_v1");
    localStorage.removeItem("bali_reviews_v1");
    location.reload();
  });
})();