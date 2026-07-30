(() => {
  if (window.__BALI_ADMIN_INTEGRATED_OVERVIEW__) return;
  window.__BALI_ADMIN_INTEGRATED_OVERVIEW__ = true;

  function styles() {
    if (document.getElementById("baliAdminIntegratedOverviewStyle")) return;
    const style = document.createElement("style");
    style.id = "baliAdminIntegratedOverviewStyle";
    style.textContent = `
      .bali-admin-control{position:relative;overflow:hidden;border-color:rgba(227,189,100,.28)!important;background:radial-gradient(circle at 95% 0,rgba(174,76,24,.18),transparent 32%),linear-gradient(145deg,rgba(35,29,20,.96),rgba(13,16,14,.98))!important}
      #content>.bali-admin-control~*{display:none!important}
      .bali-admin-control:before{content:"";position:absolute;inset:0;background:linear-gradient(120deg,transparent 47%,rgba(255,255,255,.025) 48%,transparent 49%);background-size:24px 24px;pointer-events:none}
      .bali-admin-control>*{position:relative;z-index:1}
      .bali-admin-control-head{display:flex;align-items:start;justify-content:space-between;gap:16px;padding:17px}
      .bali-admin-control-head h3{margin:5px 0 0;font-size:20px}.bali-admin-control-head p{margin:7px 0 0;color:var(--muted);font-size:9px;line-height:1.5}
      .bali-admin-online{display:inline-flex;align-items:center;gap:6px;padding:7px 9px;border:1px solid rgba(200,255,61,.32);border-radius:999px;color:var(--lime);font-size:8px;font-weight:900;white-space:nowrap}
      .bali-admin-online:before{content:"";width:7px;height:7px;border-radius:50%;background:var(--lime);box-shadow:0 0 10px var(--lime)}
      .bali-admin-control-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:0 17px 13px}
      .bali-admin-control-metrics article{min-width:0;padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(0,0,0,.2)}
      .bali-admin-control-metrics span{display:block;color:var(--muted);font-size:7px;letter-spacing:.08em}.bali-admin-control-metrics strong{display:block;margin-top:6px;color:#f2d08b;font:600 19px Unbounded}
      .bali-admin-control-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:0 17px 17px}
      .bali-admin-module{min-width:0;display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:9px;min-height:72px;padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:15px;background:rgba(255,255,255,.025);color:#fff;text-align:left}
      .bali-admin-module:hover{border-color:rgba(200,255,61,.35);background:rgba(200,255,61,.055)}
      .bali-admin-module i{width:34px;height:34px;display:grid;place-items:center;border-radius:11px;background:rgba(200,255,61,.08);color:#f2d08b;font-style:normal;font-size:17px}
      .bali-admin-module strong{display:block;font-size:10px}.bali-admin-module small{display:block;margin-top:4px;color:var(--muted);font-size:7px;line-height:1.35}.bali-admin-module b{color:var(--lime);font-size:15px}
      @media(max-width:1050px){.bali-admin-control-grid{grid-template-columns:1fr 1fr}.bali-admin-control-metrics{grid-template-columns:1fr 1fr}}
      @media(max-width:620px){.bali-admin-control-head{padding:13px}.bali-admin-control-grid{grid-template-columns:1fr;padding:0 13px 13px}.bali-admin-control-metrics{padding:0 13px 10px}.bali-admin-control-head h3{font-size:17px}}
    `;
    document.head.appendChild(style);
  }

  function counts() {
    const snapshot = window.BaliClans?.snapshot?.() || {};
    const clans = Array.isArray(snapshot.clans) ? snapshot.clans : [];
    const matchTop = Math.min(10, window.BaliMatch3?.leaderboard?.().length || 10);
    return {
      users:Number(window.BaliDemo?.users?.length || 0),
      clans:clans.length,
      matchTop,
      visualBlocks:30
    };
  }

  function mount() {
    const dashboardActive = document.querySelector('#adminNav [data-view="dashboard"].active');
    const content = document.getElementById("content");
    if (!dashboardActive || !content || content.querySelector(".bali-admin-control") || content.querySelector(".empty")) return;
    const value = counts();
    const section = document.createElement("section");
    section.className = "panel bali-admin-control";
    section.innerHTML = `
      <header class="bali-admin-control-head">
        <div><span class="eyebrow">ЕДИНЫЙ ЦЕНТР УПРАВЛЕНИЯ · BALI PEOPLE</span><h3>Каждый модуль находится в своём разделе</h3><p>Выберите нужное направление: данные и инструменты больше не смешиваются на одном экране.</p></div>
        <span class="bali-admin-online">БЕТА РАБОТАЕТ</span>
      </header>
      <div class="bali-admin-control-metrics">
        <article><span>ПОЛЬЗОВАТЕЛИ</span><strong>${value.users}</strong></article>
        <article><span>КЛАНЫ ДВУХ ТИПОВ</span><strong>${value.clans}</strong></article>
        <article><span>РЕЙТИНГ MATCH-3</span><strong>TOP ${value.matchTop}</strong></article>
        <article><span>ВИЗУАЛЬНЫЕ БЛОКИ</span><strong>${value.visualBlocks}</strong></article>
      </div>
      <div class="bali-admin-control-grid">
        <button class="bali-admin-module" type="button" data-admin-production-view="customers"><i>◎</i><span><strong>BALI People + CRM</strong><small>Профили, балансы, визиты и история гостей</small></span><b>›</b></button>
        <button class="bali-admin-module" type="button" data-admin-production-view="clans"><i>♜</i><span><strong>Пользовательские и корпоративные кланы</strong><small>Создание, старшие, составы и раздельные рейтинги</small></span><b>›</b></button>
        <button class="bali-admin-module" type="button" data-admin-production-view="crown"><i>◆</i><span><strong>Игра 3 в ряд</strong><small>Недельный сезон, TOP 10, предметы и награды</small></span><b>›</b></button>
        <button class="bali-admin-module" type="button" data-admin-production-view="bonuses"><i>★</i><span><strong>Баллы, VIP и подарки</strong><small>Цены, обмен, статусы, выдача и возврат наград</small></span><b>›</b></button>
        <button class="bali-admin-module" type="button" data-admin-production-view="events"><i>◫</i><span><strong>События, QR и бронирования</strong><small>Афиши, гости, столы и автоматический QR-вход</small></span><b>›</b></button>
        <button class="bali-admin-module" type="button" data-admin-production-view="settings"><i>⚙</i><span><strong>Дизайн и нижнее меню</strong><small>Картинки, названия блоков, размеры, иконки и сброс</small></span><b>›</b></button>
      </div>`;
    content.prepend(section);
  }

  styles();
  const observer = new MutationObserver(() => requestAnimationFrame(mount));
  const start = () => {
    const content = document.getElementById("content");
    if (!content) return setTimeout(start, 50);
    observer.observe(content, { childList:true, subtree:true });
    mount();
  };
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-admin-production-view]");
    if (!button) return;
    event.preventDefault();
    document.querySelector(`#adminNav [data-view="${CSS.escape(button.dataset.adminProductionView)}"]`)?.click();
  });
  start();
})();
