(() => {
  if (window.__BALI_ADMIN_REVIEWS_PRODUCTION__) return;
  window.__BALI_ADMIN_REVIEWS_PRODUCTION__ = true;

  const store = window.BaliStore;
  if (!store) return;

  const TYPES = {
    event: "Отзыв о мероприятии",
    improvement: "Что улучшить",
    party: "Тематика вечеринки",
    artist: "Артист или программа",
    venue: "Площадка и обслуживание",
    other: "Другое",
  };
  const STATUSES = {
    new: "Новый",
    reviewed: "Просмотрен",
    planned: "Принято в работу",
    completed: "Выполнено",
    archived: "В архиве",
  };
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[char]);
  const notify = message => window.toast ? window.toast(message) : console.info(message);
  const fmt = value => value ? new Date(value).toLocaleString("ru-RU", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";
  let rows = [];

  function styles() {
    if (document.getElementById("adminReviewsProductionStyle")) return;
    const style = document.createElement("style");
    style.id = "adminReviewsProductionStyle";
    style.textContent = `
      .reviews-prod-toolbar{display:flex;gap:8px;flex-wrap:wrap}.reviews-prod-toolbar select,.reviews-prod-toolbar input{min-height:40px;padding:0 10px;border:1px solid var(--line);border-radius:11px;background:#111614;color:#fff;font-size:9px}.reviews-prod-grid{display:grid;gap:10px}.review-prod-card{display:grid;grid-template-columns:minmax(0,1fr) minmax(200px,280px);gap:13px;padding:14px;border:1px solid var(--line);border-radius:16px;background:#101412}.review-prod-card.is-new{border-color:rgba(200,255,61,.35);background:rgba(200,255,61,.04)}.review-prod-meta{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:7px}.review-prod-meta span{padding:5px 7px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-size:8px}.review-prod-card h3{font-size:13px}.review-prod-message{margin-top:7px;color:#d2d8d4;font-size:10px;line-height:1.55;white-space:pre-line}.review-prod-user{margin-top:8px;color:var(--muted);font-size:8px}.review-prod-controls{display:grid;align-content:start;gap:8px}.review-prod-controls select,.review-prod-controls textarea,.review-prod-controls button{width:100%;min-height:38px;padding:8px 9px;border:1px solid var(--line);border-radius:10px;background:#171c19;color:#fff;font-size:9px}.review-prod-controls textarea{min-height:90px;resize:vertical;line-height:1.45}.review-prod-reply{margin-top:10px;padding:10px;border:1px solid rgba(200,255,61,.2);border-radius:12px;background:rgba(200,255,61,.05);color:#dce5df;font-size:9px;line-height:1.5}.review-prod-reply strong{color:var(--lime)}.review-prod-error{padding:18px;border:1px solid rgba(255,190,70,.3);border-radius:15px;background:rgba(255,190,70,.07);color:#f1d493;line-height:1.6}.review-prod-error code{display:block;margin-top:9px;padding:10px;border-radius:10px;background:#090c0b;color:#dfff7c;white-space:normal}.review-prod-danger{color:#ff9b9b!important;border-color:rgba(255,119,119,.25)!important}
      @media(max-width:860px){.review-prod-card{grid-template-columns:1fr}.review-prod-controls{grid-template-columns:1fr}.reviews-prod-toolbar>*{flex:1 1 190px}}@media(max-width:520px){.reviews-prod-toolbar>*{width:100%;flex-basis:100%}}
    `;
    document.head.appendChild(style);
  }

  function reviewCard(row) {
    const status = row.status || "new";
    return `<article class="review-prod-card ${status === "new" ? "is-new" : ""}" data-review-id="${esc(row.id)}"><div><div class="review-prod-meta"><span>${esc(TYPES[row.type] || TYPES.other)}</span>${row.event_title ? `<span>${esc(row.event_title)}</span>` : ""}${row.rating ? `<span>Оценка: ${Number(row.rating)}/5</span>` : ""}<span>${esc(fmt(row.created_at))}</span></div><h3>${esc(row.event_title || TYPES[row.type] || "Отзыв BALI")}</h3><div class="review-prod-message">${esc(row.message || "")}</div><div class="review-prod-user">От: ${esc(row.user_name || "Гость BALI")}${row.telegram ? ` · ${esc(row.telegram)}` : ""}${row.user_key ? ` · ${esc(row.user_key)}` : ""}</div>${row.admin_reply ? `<div class="review-prod-reply"><strong>Ответ BALI</strong><br>${esc(row.admin_reply)}</div>` : ""}</div><div class="review-prod-controls"><label><span class="eyebrow">СТАТУС</span><select data-review-status>${Object.entries(STATUSES).map(([value, label]) => `<option value="${value}" ${status === value ? "selected" : ""}>${label}</option>`).join("")}</select></label><label><span class="eyebrow">ОТВЕТ ПОЛЬЗОВАТЕЛЮ</span><textarea data-review-reply placeholder="Напишите ответ от BALI…">${esc(row.admin_reply || "")}</textarea></label><button type="button" class="primary" data-save-review>Сохранить ответ</button><button type="button" class="review-prod-danger" data-delete-review-production>Удалить отзыв</button></div></article>`;
  }

  function applyFilters() {
    const root = document.getElementById("reviewsProductionGrid");
    if (!root) return;
    const status = document.getElementById("reviewsProductionStatus")?.value || "";
    const type = document.getElementById("reviewsProductionType")?.value || "";
    const query = String(document.getElementById("reviewsProductionSearch")?.value || "").toLowerCase();
    const filtered = rows.filter(row => (!status || (row.status || "new") === status) && (!type || row.type === type) && (!query || `${row.message || ""} ${row.user_name || ""} ${row.event_title || ""} ${row.telegram || ""} ${row.admin_reply || ""}`.toLowerCase().includes(query)));
    root.innerHTML = filtered.length ? filtered.map(reviewCard).join("") : '<div class="empty">Отзывы не найдены</div>';
  }

  async function renderReviews() {
    styles();
    const root = document.getElementById("content");
    if (!root) return;
    document.getElementById("pageTitle").textContent = "Отзывы";
    const action = document.getElementById("primaryAction");
    if (action) action.style.display = "none";
    root.innerHTML = '<section class="panel"><div class="empty">Загрузка отзывов…</div></section>';

    try {
      if (!store.cloudEnabled || !store.client) throw new Error("Supabase не подключён");
      const { data, error } = await store.client.from("reviews").select("*").order("created_at", { ascending:false });
      if (error) throw error;
      rows = data || [];
      root.innerHTML = `<section class="panel"><div class="panel-head"><div><h3>Отзывы и предложения гостей</h3><small>${rows.length} сообщений · ответы сохраняются в общей базе</small></div><div class="reviews-prod-toolbar"><select id="reviewsProductionStatus"><option value="">Все статусы</option>${Object.entries(STATUSES).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select><select id="reviewsProductionType"><option value="">Все темы</option>${Object.entries(TYPES).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select><input id="reviewsProductionSearch" placeholder="Поиск по тексту, гостю или ответу"></div></div><div class="panel-body"><div class="reviews-prod-grid" id="reviewsProductionGrid"></div></div></section>`;
      ["reviewsProductionStatus", "reviewsProductionType"].forEach(id => document.getElementById(id)?.addEventListener("change", applyFilters));
      document.getElementById("reviewsProductionSearch")?.addEventListener("input", applyFilters);
      applyFilters();
    } catch (error) {
      const missing = /reviews|schema cache|relation|does not exist/i.test(String(error.message || ""));
      root.innerHTML = `<section class="panel"><div class="review-prod-error"><strong>${missing ? "Таблица отзывов не создана или не обновлён schema cache." : "Отзывы не загрузились."}</strong><br>${esc(error.message || "Ошибка Supabase")}<code>Выполните site/bali-production-admin-complete-migration.sql, затем site/bali-production-fix-2026-07-24.sql в Supabase SQL Editor.</code><button class="primary" type="button" data-reviews-production-retry>Повторить</button></div></section>`;
    }
  }

  async function saveReview(card) {
    const id = card?.dataset.reviewId;
    const status = card?.querySelector("[data-review-status]")?.value || "reviewed";
    const adminReply = card?.querySelector("[data-review-reply]")?.value.trim() || "";
    if (!id) return;
    const payload = { status, admin_reply:adminReply, reviewed_at:new Date().toISOString(), updated_at:new Date().toISOString() };
    const { error } = await store.client.from("reviews").update(payload).eq("id", id);
    if (error) return notify(error.message || "Не удалось сохранить ответ");
    notify("Отзыв обновлён");
    await renderReviews();
  }

  async function deleteReview(card) {
    const id = card?.dataset.reviewId;
    if (!id || !confirm("Удалить отзыв без возможности восстановления?")) return;
    const { error } = await store.client.from("reviews").delete().eq("id", id);
    if (error) return notify(error.message || "Не удалось удалить отзыв");
    notify("Отзыв удалён");
    await renderReviews();
  }

  document.addEventListener("click", event => {
    if (event.target.closest("[data-reviews-production-retry]")) return renderReviews();
    const save = event.target.closest("[data-save-review]");
    if (save) return saveReview(save.closest("[data-review-id]"));
    const remove = event.target.closest("[data-delete-review-production]");
    if (remove) return deleteReview(remove.closest("[data-review-id]"));
  }, true);

  document.addEventListener("change", event => {
    const status = event.target.closest("[data-review-status]");
    if (status) saveReview(status.closest("[data-review-id]"));
  }, true);

  const baseRender = window.render;
  if (typeof baseRender === "function") {
    window.render = async function(...args) {
      if (typeof state !== "undefined" && state.view === "reviews") return renderReviews();
      return baseRender.apply(this, args);
    };
  }

  window.BaliAdminReviewsProduction = { render:renderReviews };
})();
