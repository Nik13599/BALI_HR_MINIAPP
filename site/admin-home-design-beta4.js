(() => {
  if (window.__BALI_ADMIN_HOME_DESIGN__ || !window.BaliHomeDesign) return;
  window.__BALI_ADMIN_HOME_DESIGN__ = true;
  const design = window.BaliHomeDesign;
  let draft = design.read();
  let uploadPath = "";
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
  const get = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);
  const set = (object, path, value) => { const keys = path.split("."); let target = object; keys.slice(0, -1).forEach(key => target = target[key] ||= {}); target[keys.at(-1)] = value; };
  const toastMsg = message => window.toast?.(message);

  function styles() {
    if (document.getElementById("adminHomeDesignStyle")) return;
    const style = document.createElement("style");
    style.id = "adminHomeDesignStyle";
    style.textContent = `.home-design-panel{margin-top:18px}.home-design-form{display:grid;gap:15px}.home-design-section{padding:14px;border:1px solid var(--line);border-radius:17px;background:rgba(255,255,255,.025)}.home-design-section summary{cursor:pointer;font-weight:900;color:var(--text);list-style:none}.home-design-section summary::-webkit-details-marker{display:none}.home-design-section summary:after{content:'＋';float:right;color:var(--lime)}.home-design-section[open] summary:after{content:'−'}.home-design-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;margin-top:13px}.home-design-grid label{display:grid;gap:6px;color:var(--muted);font-size:9px;font-weight:800}.home-design-grid input,.home-design-grid textarea,.home-design-grid select{width:100%;min-height:45px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.045);color:var(--text)}.home-design-grid textarea{min-height:92px;resize:vertical}.home-design-full{grid-column:1/-1}.home-design-upload{display:grid;grid-template-columns:84px 1fr;gap:10px;align-items:center}.home-design-preview{width:84px;height:84px;display:grid;place-items:center;overflow:hidden;border:1px solid var(--line);border-radius:14px;background:repeating-conic-gradient(#262a28 0 25%,#151817 0 50%) 50%/16px 16px}.home-design-preview img{width:100%;height:100%;object-fit:contain}.home-design-upload-actions{display:flex;gap:7px;flex-wrap:wrap}.home-design-contact{display:grid;grid-template-columns:55px minmax(0,1fr) minmax(0,1fr) auto;gap:8px;align-items:end;padding:9px;border:1px solid rgba(255,255,255,.07);border-radius:13px}.home-design-contact .home-design-preview{width:55px;height:55px}.home-design-actions{display:flex;gap:9px;position:sticky;bottom:0;padding:12px;border:1px solid var(--line);border-radius:16px;background:rgba(8,10,10,.94);backdrop-filter:blur(10px);z-index:4}.home-design-actions button{flex:1}.home-design-note{padding:11px;border:1px solid rgba(255,200,87,.2);border-radius:13px;background:rgba(255,200,87,.06);color:#dec77f;font-size:9px;line-height:1.55}@media(max-width:720px){.home-design-grid{grid-template-columns:1fr}.home-design-full{grid-column:auto}.home-design-contact{grid-template-columns:55px 1fr}.home-design-contact label:nth-of-type(2),.home-design-contact .home-design-upload-actions{grid-column:1/-1}.home-design-actions{bottom:68px}}`;
    document.head.appendChild(style);
  }

  const alignField = path => `<label><span>Расположение текста</span><select name="${path}"><option value="left" ${get(draft,path)==="left"?"selected":""}>Слева</option><option value="center" ${get(draft,path)==="center"?"selected":""}>По центру</option><option value="right" ${get(draft,path)==="right"?"selected":""}>Справа</option></select></label>`;
  const text = (path, label, full = false) => `<label class="${full?"home-design-full":""}"><span>${label}</span><input name="${path}" value="${esc(get(draft,path)||"")}"></label>`;
  const area = (path, label) => `<label class="home-design-full"><span>${label}</span><textarea name="${path}">${esc(get(draft,path)||"")}</textarea></label>`;
  const color = (path, label) => `<label><span>${label}</span><input name="${path}" type="color" value="${esc(get(draft,path)||"#111413")}"></label>`;
  const height = (path, label = "Минимальная высота блока, px") => `<label><span>${label}</span><input name="${path}" type="number" min="0" max="900" step="10" value="${Number(get(draft,path)||0)}"></label>`;
  const imageBox = (path, label) => `<div class="home-design-upload home-design-full"><div class="home-design-preview">${get(draft,path)?`<img src="${esc(get(draft,path))}" alt="">`:`<span>${label}</span>`}</div><div><strong>${label}</strong><div class="home-design-upload-actions"><button class="secondary" type="button" data-home-image="${path}">Загрузить</button><button class="ghost" type="button" data-home-image-clear="${path}" ${get(draft,path)?"":"disabled"}>Удалить</button></div></div></div>`;
  const contactRow = key => {
    const labels = { instagram:"Instagram", telegram:"Telegram", manager:"Менеджер", phone:"Телефон", map:"Как добраться" };
    const item = draft.contacts[key] || {};
    return `<div class="home-design-contact home-design-full"><div class="home-design-preview">${item.icon?`<img src="${esc(item.icon)}" alt="">`:`<span>ICON</span>`}</div><label><span>${labels[key]} — название</span><input name="contacts.${key}.title" value="${esc(item.title||"")}"></label><label><span>Подпись</span><input name="contacts.${key}.subtitle" value="${esc(item.subtitle||"")}"></label><div class="home-design-upload-actions"><button class="secondary" type="button" data-home-image="contacts.${key}.icon">Иконка</button><button class="ghost" type="button" data-home-image-clear="contacts.${key}.icon" ${item.icon?"":"disabled"}>×</button></div><label class="home-design-full"><span>Ссылка / телефон</span><input name="contacts.${key}.href" value="${esc(item.href||"")}" placeholder="Оставьте пустым для значения из config.js"></label></div>`;
  };

  function collect() {
    const form = document.getElementById("homeDesignForm");
    if (!form) return draft;
    const next = JSON.parse(JSON.stringify(draft));
    new FormData(form).forEach((value, path) => {
      if (path.endsWith("minHeight")) value = Number(value || 0);
      set(next, path, value);
    });
    next.hero.pills = [form.elements["hero.pill1"]?.value, form.elements["hero.pill2"]?.value, form.elements["hero.pill3"]?.value].filter(Boolean);
    delete next.hero.pill1; delete next.hero.pill2; delete next.hero.pill3;
    draft = next;
    return next;
  }

  function panel() {
    const p = draft.hero.pills || [];
    return `<section class="panel home-design-panel"><div class="panel-head"><div><h3>Дизайн главной страницы пользователя</h3><small>Логотип, тексты, фон, цвета, размеры блоков, выравнивание и иконки</small></div><span class="count">LIVE</span></div><div class="panel-body"><form id="homeDesignForm" class="home-design-form">
      <div class="home-design-note">Настройки применяются только к главной странице. Афиши, меню и рейтинг сохраняют текущий дизайн.</div>
      <details class="home-design-section" open><summary>Логотип и основные цвета</summary><div class="home-design-grid">${text("brand.name","Название клуба")}${text("brand.subtitle","Подпись под названием")}${imageBox("brand.logo","Логотип клуба")}${color("global.accent","Акцентный цвет")}${color("global.pageBackground","Фон приложения")}${color("global.text","Основной текст")}</div></details>
      <details class="home-design-section" open><summary>Главный баннер</summary><div class="home-design-grid">${text("hero.eyebrow","Верхняя подпись",true)}${text("hero.title","Главный заголовок")}${text("hero.accentTitle","Выделенная строка")}${area("hero.text","Описание клуба")}${text("hero.pill1","Метка 1")}${text("hero.pill2","Метка 2")}${text("hero.pill3","Метка 3")}${alignField("hero.align")}${height("hero.minHeight")}${color("hero.backgroundColor","Цвет фона")}${imageBox("hero.backgroundImage","Фон баннера")}</div></details>
      <details class="home-design-section"><summary>Основные кнопки</summary><div class="home-design-grid">${text("actions.events.title","Кнопка афиш")}${imageBox("actions.events.icon","Иконка афиш")}${text("actions.profile.title","Кнопка профиля")}${imageBox("actions.profile.icon","Иконка профиля")}${alignField("actions.align")}${color("actions.backgroundColor","Фон блока")}${imageBox("actions.backgroundImage","Фоновая картинка")}</div></details>
      <details class="home-design-section"><summary>QR-подтверждение входа</summary><div class="home-design-grid">${text("checkin.eyebrow","Верхняя подпись")}${text("checkin.title","Название блока")}${area("checkin.text","Описание")}${text("checkin.button","Текст кнопки")}${imageBox("checkin.icon","Иконка QR-кнопки")}${alignField("checkin.align")}${height("checkin.minHeight")}${color("checkin.backgroundColor","Цвет фона")}${imageBox("checkin.backgroundImage","Фоновая картинка")}</div></details>
      <details class="home-design-section"><summary>Ближайшие события</summary><div class="home-design-grid">${text("upcoming.title","Название блока")}${text("upcoming.button","Текст кнопки")}${alignField("upcoming.align")}${height("upcoming.minHeight")}${color("upcoming.backgroundColor","Цвет фона")}${imageBox("upcoming.backgroundImage","Фоновая картинка")}</div></details>
      <details class="home-design-section"><summary>Информация о клубе</summary><div class="home-design-grid">${text("about.title","Название блока")}${area("about.text","Информация о клубе")}${alignField("about.align")}${height("about.minHeight")}${color("about.backgroundColor","Цвет фона")}${imageBox("about.backgroundImage","Фоновая картинка")}</div></details>
      <details class="home-design-section"><summary>Связаться с BALI и иконки кнопок</summary><div class="home-design-grid">${text("contacts.title","Название блока")}${alignField("contacts.align")}${height("contacts.minHeight")}${color("contacts.backgroundColor","Цвет фона")}${imageBox("contacts.backgroundImage","Фоновая картинка")}${["instagram","telegram","manager","phone","map"].map(contactRow).join("")}</div></details>
      <div class="home-design-actions"><button class="primary" type="submit">Сохранить дизайн</button><button class="danger" type="button" data-home-design-reset>Вернуть стандартный</button></div>
      <input type="file" id="homeDesignImageInput" accept="image/*" hidden>
    </form></div></section>`;
  }

  function renderPanel(root) {
    if (!root || state.view !== "settings") return;
    draft = design.read();
    root.insertAdjacentHTML("beforeend", panel());
  }

  document.addEventListener("click", event => {
    const pick = event.target.closest("[data-home-image]");
    if (pick) { event.preventDefault(); collect(); uploadPath = pick.dataset.homeImage; document.getElementById("homeDesignImageInput")?.click(); return; }
    const clear = event.target.closest("[data-home-image-clear]");
    if (clear) { event.preventDefault(); collect(); set(draft, clear.dataset.homeImageClear, ""); const root = document.getElementById("content"); root.querySelector(".home-design-panel")?.remove(); renderPanel(root); return; }
    if (event.target.closest("[data-home-design-reset]")) { event.preventDefault(); if (!confirm("Вернуть стандартный дизайн главной страницы?")) return; design.reset(); draft = design.read(); window.render?.(); toastMsg("Стандартный дизайн восстановлен"); }
  }, true);

  document.addEventListener("change", async event => {
    if (event.target.id !== "homeDesignImageInput" || !uploadPath) return;
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const max = uploadPath.includes("icon") || uploadPath.includes("logo") ? 700 : 1800;
      set(draft, uploadPath, await design.imageData(file, max, .86));
      const root = document.getElementById("content");
      root.querySelector(".home-design-panel")?.remove();
      renderPanel(root);
      toastMsg("Изображение добавлено. Нажмите «Сохранить дизайн».");
    } catch (error) { toastMsg(error.message || "Не удалось загрузить изображение"); }
  }, true);

  document.addEventListener("submit", event => {
    if (event.target.id !== "homeDesignForm") return;
    event.preventDefault();
    design.write(collect());
    toastMsg("Дизайн главной страницы сохранён");
  }, true);

  styles();
  const baseRenderSettings = window.renderSettings;
  window.renderSettings = function(root) { baseRenderSettings(root); renderPanel(root); };
  if (typeof state !== "undefined" && state.view === "settings") window.render?.();
})();