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
    style.textContent = `.home-design-panel{margin-top:18px}.home-design-form{display:grid;gap:15px}.home-design-section{padding:14px;border:1px solid var(--line);border-radius:17px;background:rgba(255,255,255,.025)}.home-design-section summary{cursor:pointer;font-weight:900;color:var(--text);list-style:none}.home-design-section summary::-webkit-details-marker{display:none}.home-design-section summary:after{content:'＋';float:right;color:var(--lime)}.home-design-section[open] summary:after{content:'−'}.home-design-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;margin-top:13px}.home-design-grid label{display:grid;gap:6px;color:var(--muted);font-size:9px;font-weight:800}.home-design-grid input,.home-design-grid textarea,.home-design-grid select{width:100%;min-height:45px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.045);color:var(--text)}.home-design-grid textarea{min-height:92px;resize:vertical}.home-design-full{grid-column:1/-1}.home-design-upload{display:grid;grid-template-columns:84px 1fr;gap:10px;align-items:center}.home-design-preview{width:84px;height:84px;display:grid;place-items:center;overflow:hidden;border:1px solid var(--line);border-radius:14px;background:repeating-conic-gradient(#262a28 0 25%,#151817 0 50%) 50%/16px 16px}.home-design-preview img{width:100%;height:100%;object-fit:contain}.home-design-upload-actions{display:flex;gap:7px;flex-wrap:wrap}.home-design-image-size{margin:4px 0 7px;color:#d7ad68;font-size:8px;font-weight:800}.home-design-contact{display:grid;grid-template-columns:55px minmax(0,1fr) minmax(0,1fr) auto;gap:8px;align-items:end;padding:9px;border:1px solid rgba(255,255,255,.07);border-radius:13px}.home-design-contact .home-design-preview{width:55px;height:55px}.home-design-actions{display:flex;gap:9px;position:sticky;bottom:0;padding:12px;border:1px solid var(--line);border-radius:16px;background:rgba(8,10,10,.94);backdrop-filter:blur(10px);z-index:4}.home-design-actions button{flex:1}.home-design-note{padding:11px;border:1px solid rgba(255,200,87,.2);border-radius:13px;background:rgba(255,200,87,.06);color:#dec77f;font-size:9px;line-height:1.55}.home-design-upload-status{margin-top:6px;color:var(--lime);font-size:8px}@media(max-width:720px){.home-design-grid{grid-template-columns:1fr}.home-design-full{grid-column:auto}.home-design-contact{grid-template-columns:55px 1fr}.home-design-contact label:nth-of-type(2),.home-design-contact .home-design-upload-actions{grid-column:1/-1}.home-design-actions{bottom:68px}}`;
    document.head.appendChild(style);
  }

  const alignField = path => `<label><span>Расположение текста</span><select name="${path}"><option value="left" ${get(draft,path)==="left"?"selected":""}>Слева</option><option value="center" ${get(draft,path)==="center"?"selected":""}>По центру</option><option value="right" ${get(draft,path)==="right"?"selected":""}>Справа</option></select></label>`;
  const text = (path, label, full = false) => `<label class="${full?"home-design-full":""}"><span>${label}</span><input name="${path}" value="${esc(get(draft,path)||"")}"></label>`;
  const area = (path, label) => `<label class="home-design-full"><span>${label}</span><textarea name="${path}">${esc(get(draft,path)||"")}</textarea></label>`;
  const color = (path, label) => `<label><span>${label}</span><input name="${path}" type="color" value="${esc(get(draft,path)||"#111413")}"></label>`;
  const height = (path, label = "Минимальная высота блока, px") => `<label><span>${label}</span><input name="${path}" type="number" min="0" max="900" step="10" value="${Number(get(draft,path)||0)}"></label>`;
  const imageSizes = {
    "brand.logo":"512 × 512 px",
    "hero.backgroundImage":"1600 × 1000 px",
    "actions.events.icon":"256 × 256 px",
    "actions.profile.icon":"256 × 256 px",
    "actions.backgroundImage":"1200 × 720 px",
    "checkin.icon":"256 × 256 px",
    "checkin.backgroundImage":"1200 × 800 px",
    "upcoming.backgroundImage":"1400 × 900 px",
    "about.backgroundImage":"1400 × 850 px",
    "contacts.backgroundImage":"1200 × 720 px",
  };
  const imageBox = (path, label) => `<div class="home-design-upload home-design-full"><div class="home-design-preview">${get(draft,path)?`<img src="${esc(get(draft,path))}" alt="">`:`<span>${label}</span>`}</div><div><strong>${label}</strong><div class="home-design-image-size">Исходный размер: ${imageSizes[path] || "256 × 256 px"}</div><div class="home-design-upload-actions"><button class="secondary" type="button" data-home-image="${path}">Загрузить</button><button class="ghost" type="button" data-home-image-clear="${path}" ${get(draft,path)?"":"disabled"}>Удалить</button></div>${get(draft,path)?'<div class="home-design-upload-status">Файл загружен и сохранён</div>':""}</div></div>`;
  const contactRow = key => {
    const labels = { instagram:"Instagram", telegram:"Telegram", tiktok:"TikTok", manager:"Менеджер", phone:"Телефон", map:"Как добраться" };
    const item = draft.contacts[key] || {};
    return `<div class="home-design-contact home-design-full"><div class="home-design-preview">${item.icon?`<img src="${esc(item.icon)}" alt="">`:`<span>ICON</span>`}</div><label><span>${labels[key]} — название</span><input name="contacts.${key}.title" value="${esc(item.title||"")}"></label><label><span>Подпись</span><input name="contacts.${key}.subtitle" value="${esc(item.subtitle||"")}"></label><div><div class="home-design-image-size">256 × 256 px</div><div class="home-design-upload-actions"><button class="secondary" type="button" data-home-image="contacts.${key}.icon">Иконка</button><button class="ghost" type="button" data-home-image-clear="contacts.${key}.icon" ${item.icon?"":"disabled"}>×</button></div></div><label class="home-design-full"><span>Название над блоком${["instagram","telegram","tiktok"].includes(key)?" (обычно пусто)":""}</span><input name="contacts.${key}.heading" value="${esc(item.heading||"")}"></label><label class="home-design-full"><span>Ссылка / телефон</span><input name="contacts.${key}.href" value="${esc(item.href||"")}" placeholder="Оставьте пустым для исходного значения"></label></div>`;
  };
  const statRow = key => {
    const labels = { points:"Баллы", vip:"VIP-статус", game:"Рейтинг игры", rank:"Общий рейтинг", notice:"Уведомления" };
    const item = draft.stats?.[key] || {};
    return `<div class="home-design-contact home-design-full"><div class="home-design-preview">${item.icon?`<img src="${esc(item.icon)}" alt="">`:`<span>ICON</span>`}</div><label><span>${labels[key]} — название</span><input name="stats.${key}.title" value="${esc(item.title||"")}"></label><label><span>Дополнительная подпись</span><input name="stats.${key}.subtitle" value="${esc(item.subtitle||"")}" placeholder="Если используется в карточке"></label><div><div class="home-design-image-size">256 × 256 px</div><div class="home-design-upload-actions"><button class="secondary" type="button" data-home-image="stats.${key}.icon">Иконка</button><button class="ghost" type="button" data-home-image-clear="stats.${key}.icon" ${item.icon?"":"disabled"}>×</button></div></div></div>`;
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
    draft.hero.pill1 = p[0] || "";
    draft.hero.pill2 = p[1] || "";
    draft.hero.pill3 = p[2] || "";
    return `<section class="panel home-design-panel"><div class="panel-head"><div><h3>Полная настройка главного экрана</h3><small>Все названия блоков, подписи, кнопки, ссылки и иконки пользовательской главной</small></div><span class="count">ВСЕ ЭЛЕМЕНТЫ</span></div><div class="panel-body"><form id="homeDesignForm" class="home-design-form">
      <div class="home-design-note">Иконки: рекомендуемый исходный размер <strong>256 × 256 px</strong>. Фоны и логотип имеют отдельные размеры рядом с загрузкой. Изображения сохраняются сразу, тексты и ссылки — кнопкой «Сохранить главную».</div>
      <details class="home-design-section" open><summary>Логотип и основные цвета</summary><div class="home-design-grid">${text("brand.name","Название клуба")}${text("brand.subtitle","Подпись под названием")}${imageBox("brand.logo","Логотип клуба")}${color("global.accent","Акцентный цвет")}${color("global.pageBackground","Фон приложения")}${color("global.text","Основной текст")}</div></details>
      <details class="home-design-section" open><summary>Главный баннер</summary><div class="home-design-grid">${text("hero.eyebrow","Верхняя подпись",true)}${text("hero.title","Главный заголовок")}${area("hero.text","Описание клуба")}${imageBox("hero.backgroundImage","Фон баннера")}</div></details>
      <details class="home-design-section"><summary>Карточки показателей</summary><div class="home-design-grid">${["points","vip","game","rank","notice"].map(statRow).join("")}</div></details>
      <details class="home-design-section"><summary>Ближайшее событие и все его кнопки</summary><div class="home-design-grid">${text("event.empty","Текст, если событий нет",true)}${text("event.kicker","Название блока события")}${text("event.allEvents","Кнопка всех мероприятий")}${text("event.participants","Подпись количества участников")}${text("event.friends","Подпись количества друзей")}${text("event.clans","Подпись количества кланов")}${text("event.join","Кнопка участия")}${text("event.book","Кнопка бронирования")}${text("event.people","Кнопка списка людей и кланов",true)}${imageBox("event.participantsIcon","Иконка участников")}${imageBox("event.friendsIcon","Иконка друзей")}${imageBox("event.clansIcon","Иконка кланов")}${imageBox("event.joinIcon","Иконка кнопки участия")}${imageBox("event.bookIcon","Иконка кнопки бронирования")}${imageBox("event.peopleIcon","Иконка списка людей и кланов")}${imageBox("controls.arrowIcon","Общая иконка перехода / стрелки")}</div></details>
      <details class="home-design-section"><summary>QR-подтверждение входа</summary><div class="home-design-grid">${text("checkin.eyebrow","Верхняя подпись")}${text("checkin.title","Название блока")}${area("checkin.text","Описание")}${text("checkin.button","Текст кнопки")}${imageBox("checkin.icon","Иконка QR-кнопки")}${alignField("checkin.align")}${height("checkin.minHeight")}${color("checkin.backgroundColor","Цвет фона")}${imageBox("checkin.backgroundImage","Фоновая картинка")}</div></details>
      <details class="home-design-section"><summary>Ближайшее бронирование</summary><div class="home-design-grid">${text("booking.title","Название блока")}${text("booking.empty","Текст без активной брони")}${text("booking.choose","Кнопка выбора стола")}${text("booking.open","Кнопка открытия брони")}${imageBox("booking.icon","Иконка бронирования")}</div></details>
      <details class="home-design-section"><summary>Информация о заведении</summary><div class="home-design-grid">${text("about.heading","Название над блоком")}${text("about.title","Название блока")}${area("about.text","Информация о клубе")}${imageBox("about.icon","Иконка блока")}${alignField("about.align")}${height("about.minHeight")}${color("about.backgroundColor","Цвет фона")}${imageBox("about.backgroundImage","Фоновая картинка")}</div></details>
      <details class="home-design-section"><summary>Соцсети, карта, контакты и телефон</summary><div class="home-design-grid">${text("social.heading","Название блока соцсетей",true)}${alignField("contacts.align")}${height("contacts.minHeight")}${color("contacts.backgroundColor","Цвет фона")}${imageBox("contacts.backgroundImage","Фоновая картинка")}${["instagram","telegram","tiktok","manager","phone","map"].map(contactRow).join("")}</div></details>
      <div class="home-design-actions"><button class="primary" type="submit">Сохранить главную</button><button class="danger" type="button" data-home-design-reset>Вернуть всю главную в исходное состояние</button></div>
      <input type="file" id="homeDesignImageInput" accept="image/png,image/jpeg,image/webp" hidden>
    </form></div></section>`;
  }

  function renderPanel(root, preserveDraft = false) {
    if (!root || state.view !== "settings") return;
    if (!preserveDraft) draft = design.read();
    root.insertAdjacentHTML("beforeend", panel());
  }

  function rerenderPreservingDraft() {
    const root = document.getElementById("content");
    root?.querySelector(".home-design-panel")?.remove();
    renderPanel(root, true);
  }

  document.addEventListener("click", event => {
    const pick = event.target.closest("[data-home-image]");
    if (pick) {
      event.preventDefault();
      collect();
      uploadPath = pick.dataset.homeImage;
      const input = document.getElementById("homeDesignImageInput");
      if (input) { input.value = ""; input.click(); }
      return;
    }
    const clear = event.target.closest("[data-home-image-clear]");
    if (clear) {
      event.preventDefault();
      collect();
      set(draft, clear.dataset.homeImageClear, "");
      draft = design.write(draft);
      rerenderPreservingDraft();
      toastMsg("Изображение удалено");
      return;
    }
    if (event.target.closest("[data-home-design-reset]")) {
      event.preventDefault();
      if (!confirm("Вернуть стандартный дизайн главной страницы?")) return;
      design.reset();
      draft = design.read();
      window.render?.();
      toastMsg("Стандартный дизайн восстановлен");
    }
  }, true);

  document.addEventListener("change", async event => {
    if (event.target.id !== "homeDesignImageInput" || !uploadPath) return;
    const file = event.target.files?.[0];
    if (!file) return;
    const targetPath = uploadPath;
    uploadPath = "";
    try {
      if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) throw new Error("Поддерживаются PNG, JPG и WEBP");
      const max = targetPath.includes("icon") || targetPath.includes("logo") ? 640 : 1800;
      const data = await design.imageData(file, max, targetPath.includes("logo") || targetPath.includes("icon") ? .92 : .84);
      set(draft, targetPath, data);
      try {
        draft = design.write(draft);
      } catch (error) {
        if (error?.name === "QuotaExceededError") throw new Error("Изображение слишком большое для браузера. Выберите файл меньшего размера.");
        throw error;
      }
      rerenderPreservingDraft();
      toastMsg(targetPath === "brand.logo" ? "Логотип загружен и сохранён" : "Изображение загружено и сохранено");
    } catch (error) {
      toastMsg(error.message || "Не удалось загрузить изображение");
    }
  }, true);

  document.addEventListener("submit", event => {
    if (event.target.id !== "homeDesignForm") return;
    event.preventDefault();
    try {
      draft = design.write(collect());
      toastMsg("Дизайн главной страницы сохранён");
    } catch (error) {
      toastMsg(error?.name === "QuotaExceededError" ? "Недостаточно памяти браузера. Уменьшите изображения." : "Не удалось сохранить дизайн");
    }
  }, true);

  styles();
  const baseRenderSettings = window.renderSettings;
  window.renderSettings = function(root) { baseRenderSettings(root); renderPanel(root); };
  if (typeof state !== "undefined" && state.view === "settings") window.render?.();
})();
