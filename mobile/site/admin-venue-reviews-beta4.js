(() => {
  if (window.__BALI_ADMIN_VENUE_REVIEWS__) return;
  window.__BALI_ADMIN_VENUE_REVIEWS__ = true;

  const reviewTypes = {
    event: "Отзыв о мероприятии",
    improvement: "Что улучшить",
    party: "Тематика вечеринки",
    artist: "Артист или программа",
    venue: "Площадка и обслуживание",
    other: "Другое"
  };
  const reviewStatuses = {
    new: "Новый",
    reviewed: "Просмотрен",
    planned: "Принято в работу",
    completed: "Выполнено",
    archived: "В архиве"
  };

  const parseMedia = value => {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const uid = () => `media-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

  function styles() {
    if (document.getElementById("adminVenueReviewsStyle")) return;
    const style = document.createElement("style");
    style.id = "adminVenueReviewsStyle";
    style.textContent = `
      .venue-admin-panel{margin-top:14px}.venue-admin-form{display:grid;gap:13px}.venue-admin-form>label{display:grid;gap:6px;color:var(--muted);font-size:9px;font-weight:800}.venue-admin-form input,.venue-admin-form textarea,.venue-admin-form select{width:100%;min-height:45px;padding:9px 11px;border:1px solid var(--line);border-radius:12px;background:#111614;color:#fff}.venue-admin-form textarea{min-height:105px;resize:vertical}
      .venue-media-admin-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.venue-media-admin-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.venue-media-admin-empty{grid-column:1/-1;padding:20px;border:1px dashed var(--line);border-radius:14px;color:var(--muted);text-align:center;font-size:10px}
      .venue-media-admin-card{position:relative;display:grid;grid-template-columns:105px minmax(0,1fr);gap:10px;padding:11px;border:1px solid var(--line);border-radius:15px;background:#0d110f}.venue-media-admin-preview{width:105px;aspect-ratio:1;display:grid;place-items:center;overflow:hidden;border:1px solid var(--line);border-radius:13px;background:#171c19;color:var(--muted);font-size:9px;text-align:center}.venue-media-admin-preview img,.venue-media-admin-preview video{width:100%;height:100%;object-fit:cover}.venue-media-admin-fields{display:grid;gap:7px}.venue-media-admin-fields label{display:grid;gap:4px;color:var(--muted);font-size:8px;font-weight:800}.venue-media-admin-fields input,.venue-media-admin-fields select{min-height:38px;font-size:9px}.venue-media-admin-remove{position:absolute;right:7px;top:7px;width:29px;height:29px;border:1px solid rgba(255,119,119,.28);border-radius:50%;background:#ff777714;color:#ff9b9b}.venue-upload-note{padding:10px;border:1px solid rgba(200,255,61,.18);border-radius:13px;background:rgba(200,255,61,.04);color:var(--muted);font-size:9px;line-height:1.5}
      .reviews-toolbar{display:flex;gap:8px;flex-wrap:wrap}.reviews-toolbar select,.reviews-toolbar input{min-height:40px;padding:0 10px;border:1px solid var(--line);border-radius:11px;background:#111614;color:#fff;font-size:9px}.reviews-grid{display:grid;gap:9px}.review-admin-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:14px;border:1px solid var(--line);border-radius:16px;background:#101412}.review-admin-card.is-new{border-color:rgba(200,255,61,.3);background:rgba(200,255,61,.04)}.review-admin-meta{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:7px}.review-admin-meta span{padding:5px 7px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-size:8px}.review-admin-card h3{font-size:13px}.review-admin-card p{margin-top:7px;color:#d2d8d4;font-size:10px;line-height:1.55;white-space:pre-line}.review-admin-user{margin-top:8px!important;color:var(--muted)!important;font-size:8px!important}.review-admin-controls{display:grid;align-content:start;gap:7px;min-width:145px}.review-admin-controls select,.review-admin-controls button{min-height:38px;padding:0 9px;border:1px solid var(--line);border-radius:10px;background:#171c19;color:#fff;font-size:8px}.review-admin-controls .danger{color:#ff9b9b}
      @media(max-width:860px){.venue-media-admin-list{grid-template-columns:1fr}.review-admin-card{grid-template-columns:1fr}.review-admin-controls{grid-template-columns:1fr auto;min-width:0}}
      @media(max-width:520px){.venue-media-admin-card{grid-template-columns:82px minmax(0,1fr)}.venue-media-admin-preview{width:82px}.reviews-toolbar>*{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function addReviewsNav() {
    const nav = document.getElementById("adminNav");
    if (!nav || nav.querySelector('[data-view="reviews"]')) return;
    const settings = nav.querySelector('[data-view="settings"]');
    const button = document.createElement("button");
    button.dataset.view = "reviews";
    button.innerHTML = "✦ <span>Отзывы</span>";
    nav.insertBefore(button, settings || null);
  }

  function mediaEditor(item = {}) {
    const id = item.id || uid();
    const url = item.url || item.src || "";
    const type = item.type || (/^data:video|\.(mp4|webm|mov)(\?|$)/i.test(url) ? "video" : "image");
    return `<article class="venue-media-admin-card" data-venue-media-id="${esc(id)}" data-existing-url="${esc(url)}">
      <button type="button" class="venue-media-admin-remove" data-remove-venue-media title="Удалить">×</button>
      <div class="venue-media-admin-preview">${url ? (type === "video" ? `<video src="${esc(url)}" muted preload="metadata"></video>` : `<img src="${esc(url)}" alt="">`) : "ФОТО<br>ИЛИ ВИДЕО"}</div>
      <div class="venue-media-admin-fields">
        <label><span>Тип</span><select data-venue-media-type><option value="image" ${type === "image" ? "selected" : ""}>Фотография</option><option value="video" ${type === "video" ? "selected" : ""}>Видео</option></select></label>
        <label><span>Подпись</span><input data-venue-media-title value="${esc(item.title || item.caption || "")}" placeholder="Танцпол, VIP-зона, большой экран"></label>
        <label><span>Загрузить файл</span><input type="file" data-venue-media-file accept="image/*,video/mp4,video/webm,video/quicktime"></label>
        <label><span>Или ссылка</span><input type="url" data-venue-media-url value="${esc(url && !url.startsWith("data:") ? url : "")}" placeholder="https://..."></label>
      </div>
    </article>`;
  }

  async function mountVenueSettings() {
    const root = document.getElementById("content");
    if (!root || document.getElementById("venueAdminPanel")) return;
    const rows = await store.list("venue_content");
    const venue = rows.find(row => row.active !== false) || rows[0] || { id: "venue-main", media: [] };
    const media = parseMedia(venue.media);
    root.insertAdjacentHTML("beforeend", `<section class="panel venue-admin-panel" id="venueAdminPanel"><div class="panel-head"><div><h3>Страница площадки BALI</h3><small>Эта информация открывается пользователю по кнопке «Узнать подробнее о площадке»</small></div></div><div class="panel-body"><form class="venue-admin-form" id="venueAdminForm" data-venue-id="${esc(venue.id || "venue-main")}"><label><span>Название страницы</span><input name="title" value="${esc(venue.title || "Площадка BALI")}" required></label><label><span>Подробное описание площадки</span><textarea name="description" required>${esc(venue.description || "")}</textarea></label><label><span>Для каких мероприятий подходит площадка</span><textarea name="formats">${esc(venue.formats || "")}</textarea></label><div class="venue-upload-note">Можно добавлять несколько фотографий и видео. Для быстрой работы Mini App видеофайл ограничен 12 МБ; для больших роликов используйте прямую ссылку.</div><div class="venue-media-admin-head"><strong>Фотографии и видео</strong><button class="ghost" type="button" data-add-venue-media>＋ Добавить медиа</button></div><div class="venue-media-admin-list" id="venueMediaAdminList">${media.length ? media.map(mediaEditor).join("") : '<div class="venue-media-admin-empty">Медиафайлы пока не добавлены</div>'}</div><button class="primary" type="submit">Сохранить страницу площадки</button></form></div></section>`);
  }

  const fmt = value => value ? new Date(value).toLocaleString("ru-RU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  function reviewCard(row) {
    const status = row.status || "new";
    return `<article class="review-admin-card ${status === "new" ? "is-new" : ""}" data-review-id="${esc(row.id)}"><div><div class="review-admin-meta"><span>${esc(reviewTypes[row.type] || reviewTypes.other)}</span>${row.event_title ? `<span>${esc(row.event_title)}</span>` : ""}${row.rating ? `<span>Оценка: ${Number(row.rating)}/5</span>` : ""}<span>${esc(fmt(row.created_at || row.createdAt))}</span></div><h3>${esc(row.event_title || reviewTypes[row.type] || "Отзыв BALI")}</h3><p>${esc(row.message || "")}</p><p class="review-admin-user">От: ${esc(row.user_name || "Гость BALI")}${row.telegram ? ` · ${esc(row.telegram)}` : ""}</p></div><div class="review-admin-controls"><select data-review-status>${Object.entries(reviewStatuses).map(([value, label]) => `<option value="${value}" ${status === value ? "selected" : ""}>${label}</option>`).join("")}</select><button type="button" class="danger" data-delete-review>Удалить</button></div></article>`;
  }

  async function renderReviews(root) {
    document.getElementById("pageTitle").textContent = "Отзывы";
    const action = document.getElementById("primaryAction");
    if (action) action.style.display = "none";
    let rows = await store.list("reviews");
    rows = [...rows].sort((a, b) => String(b.created_at || b.createdAt || "").localeCompare(String(a.created_at || a.createdAt || "")));
    root.innerHTML = `<section class="panel"><div class="panel-head"><div><h3>Отзывы и предложения гостей</h3><small>${rows.length} сообщений · новые отзывы выделены</small></div><div class="reviews-toolbar"><select id="reviewsStatusFilter"><option value="">Все статусы</option>${Object.entries(reviewStatuses).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select><select id="reviewsTypeFilter"><option value="">Все темы</option>${Object.entries(reviewTypes).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select><input id="reviewsSearch" placeholder="Поиск по тексту или гостю"></div></div><div class="panel-body"><div class="reviews-grid" id="reviewsGrid"></div></div></section>`;
    const apply = () => {
      const status = document.getElementById("reviewsStatusFilter")?.value || "";
      const type = document.getElementById("reviewsTypeFilter")?.value || "";
      const query = (document.getElementById("reviewsSearch")?.value || "").toLowerCase();
      const filtered = rows.filter(row => (!status || (row.status || "new") === status) && (!type || row.type === type) && (!query || `${row.message || ""} ${row.user_name || ""} ${row.event_title || ""}`.toLowerCase().includes(query)));
      document.getElementById("reviewsGrid").innerHTML = filtered.length ? filtered.map(reviewCard).join("") : '<div class="empty">Отзывы не найдены</div>';
    };
    ["reviewsStatusFilter", "reviewsTypeFilter"].forEach(id => document.getElementById(id)?.addEventListener("change", apply));
    document.getElementById("reviewsSearch")?.addEventListener("input", apply);
    apply();
  }

  function fileToDataUrl(file) {
    if (file.type.startsWith("image/") && window.BaliImageTools?.fileToDataUrl) return window.BaliImageTools.fileToDataUrl(file, 1400, 0.84);
    if (file.size > 12 * 1024 * 1024) return Promise.reject(new Error("Видео больше 12 МБ. Используйте ссылку или более короткий файл."));
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(file);
    });
  }

  async function collectVenueMedia() {
    const result = [];
    for (const card of document.querySelectorAll("#venueMediaAdminList [data-venue-media-id]")) {
      const file = card.querySelector("[data-venue-media-file]")?.files?.[0];
      const typedUrl = card.querySelector("[data-venue-media-url]")?.value.trim() || "";
      let url = typedUrl || card.dataset.existingUrl || "";
      let type = card.querySelector("[data-venue-media-type]")?.value || "image";
      if (file) {
        url = await fileToDataUrl(file);
        type = file.type.startsWith("video/") ? "video" : "image";
      }
      if (!url) continue;
      result.push({ id: card.dataset.venueMediaId || uid(), type, title: card.querySelector("[data-venue-media-title]")?.value.trim() || "", url });
    }
    return result;
  }

  const baseRender = render;
  render = async function() {
    addReviewsNav();
    if (state.view === "reviews") {
      await renderReviews(document.getElementById("content"));
      return;
    }
    await baseRender();
    if (state.view === "settings") await mountVenueSettings();
  };

  document.addEventListener("click", event => {
    const add = event.target.closest("[data-add-venue-media]");
    if (add) {
      const list = document.getElementById("venueMediaAdminList");
      list?.querySelector(".venue-media-admin-empty")?.remove();
      list?.insertAdjacentHTML("beforeend", mediaEditor());
      return;
    }
    const remove = event.target.closest("[data-remove-venue-media]");
    if (remove) {
      const list = document.getElementById("venueMediaAdminList");
      remove.closest("[data-venue-media-id]")?.remove();
      if (list && !list.querySelector("[data-venue-media-id]")) list.innerHTML = '<div class="venue-media-admin-empty">Медиафайлы пока не добавлены</div>';
      return;
    }
    const del = event.target.closest("[data-delete-review]");
    if (del && confirm("Удалить отзыв без возможности восстановления?")) {
      const id = del.closest("[data-review-id]")?.dataset.reviewId;
      if (id) store.remove("reviews", id).then(() => { toast("Отзыв удалён"); render(); });
    }
  }, true);

  document.addEventListener("change", event => {
    const fileInput = event.target.closest("[data-venue-media-file]");
    if (fileInput?.files?.[0]) {
      const card = fileInput.closest("[data-venue-media-id]");
      const file = fileInput.files[0];
      const preview = card?.querySelector(".venue-media-admin-preview");
      if (preview) preview.innerHTML = file.type.startsWith("video/") ? `<video src="${URL.createObjectURL(file)}" muted controls></video>` : `<img src="${URL.createObjectURL(file)}" alt="Предпросмотр">`;
      const type = card?.querySelector("[data-venue-media-type]");
      if (type) type.value = file.type.startsWith("video/") ? "video" : "image";
      return;
    }
    const status = event.target.closest("[data-review-status]");
    if (status) {
      const id = status.closest("[data-review-id]")?.dataset.reviewId;
      store.list("reviews").then(rows => {
        const row = rows.find(item => String(item.id) === String(id));
        if (!row) return;
        return store.save("reviews", { ...row, status: status.value, updated_at: new Date().toISOString() });
      }).then(() => toast("Статус отзыва обновлён"));
    }
  }, true);

  document.addEventListener("submit", async event => {
    if (event.target.id !== "venueAdminForm") return;
    event.preventDefault();
    const form = event.target;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      await store.save("venue_content", {
        id: form.dataset.venueId || "venue-main",
        title: String(data.title || "Площадка BALI").trim(),
        description: String(data.description || "").trim(),
        formats: String(data.formats || "").trim(),
        media: await collectVenueMedia(),
        active: true,
        updated_at: new Date().toISOString()
      });
      toast("Страница площадки сохранена");
      await render();
    } catch (error) {
      toast(error.message || "Не удалось сохранить площадку");
    }
  }, true);

  styles();
  addReviewsNav();
  window.BaliAdminVenueReviews = { renderReviews, mountVenueSettings };
})();