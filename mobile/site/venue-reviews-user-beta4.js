(() => {
  if (window.__BALI_VENUE_REVIEWS_USER__) return;
  window.__BALI_VENUE_REVIEWS_USER__ = true;

  const store = window.BaliStore;
  const game = window.BaliBeta4Game;
  const tg = window.Telegram?.WebApp;
  if (!store) return;

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);

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

  const toast = message => {
    const node = document.getElementById("toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2400);
  };

  function styles() {
    if (document.getElementById("venueReviewsUserStyle")) return;
    const style = document.createElement("style");
    style.id = "venueReviewsUserStyle";
    style.textContent = `
      .home-about-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.home-about-actions button{min-height:48px;padding:8px 10px;border-radius:14px;font-size:9px;font-weight:900}.home-about-actions .venue-primary{border:0;background:var(--lime);color:#080a0a}.home-about-actions .venue-secondary{border:1px solid var(--line);background:#ffffff07;color:#fff}
      .venue-user-dialog{width:min(660px,calc(100% - 14px));max-height:95dvh;padding:0;border:1px solid var(--line);border-radius:24px;background:#0b0e0d;color:#fff;overflow:hidden}.venue-user-dialog::backdrop{background:#000d;backdrop-filter:blur(6px)}.venue-user-sheet{max-height:95dvh;overflow:auto}.venue-user-head{position:sticky;top:0;z-index:4;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 16px;border-bottom:1px solid var(--line);background:#0b0e0df2}.venue-user-head h2{margin:3px 0 0;font-size:18px}.venue-user-close{width:41px;height:41px;border:1px solid var(--line);border-radius:50%;background:#ffffff08;color:#fff;font-size:24px}.venue-user-body{display:grid;gap:16px;padding:15px}
      .venue-gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.venue-media{position:relative;overflow:hidden;min-height:150px;border:1px solid var(--line);border-radius:17px;background:#171c19}.venue-media img,.venue-media video{width:100%;height:100%;min-height:150px;display:block;object-fit:cover}.venue-media span{position:absolute;left:8px;right:8px;bottom:8px;padding:6px 8px;border-radius:999px;background:#080a0acc;color:#fff;font-size:8px;text-align:center}.venue-media-link{display:grid;place-items:center;padding:18px;color:var(--lime);text-decoration:none;text-align:center;font-size:10px;line-height:1.5}
      .venue-copy{color:#c8ceca;font-size:11px;line-height:1.7;white-space:pre-line}.venue-formats{padding:14px;border:1px solid rgba(200,255,61,.23);border-radius:16px;background:rgba(200,255,61,.055)}.venue-formats h3{font-size:14px}.venue-formats p{margin-top:7px;color:#d5dbd7;font-size:10px;line-height:1.6;white-space:pre-line}.venue-empty{padding:24px;border:1px dashed var(--line);border-radius:16px;color:var(--muted);font-size:10px;text-align:center}
      .review-user-form{display:grid;gap:11px}.review-user-form label{display:grid;gap:6px;color:var(--muted);font-size:9px;font-weight:900}.review-user-form select,.review-user-form textarea{width:100%;min-height:47px;padding:10px 12px;border:1px solid var(--line);border-radius:13px;background:#171b19;color:#fff}.review-user-form textarea{min-height:130px;resize:vertical}.review-note{padding:11px;border:1px solid var(--line);border-radius:14px;background:#ffffff05;color:var(--muted);font-size:9px;line-height:1.55}
      @media(max-width:430px){.home-about-actions{grid-template-columns:1fr}.venue-gallery{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureDialogs() {
    if (document.getElementById("venueDetailsDialog")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <dialog class="venue-user-dialog" id="venueDetailsDialog"><div class="venue-user-sheet"><div class="venue-user-head"><div><span class="eyebrow">BALI · МИНСК</span><h2>О площадке</h2></div><button class="venue-user-close" type="button" data-close-venue-dialog>×</button></div><div class="venue-user-body" id="venueDetailsBody"></div></div></dialog>
      <dialog class="venue-user-dialog" id="venueReviewDialog"><div class="venue-user-sheet"><div class="venue-user-head"><div><span class="eyebrow">ВАШЕ МНЕНИЕ</span><h2>Отзыв или предложение</h2></div><button class="venue-user-close" type="button" data-close-venue-dialog>×</button></div><div class="venue-user-body"><div class="review-note">Расскажите, что понравилось, что можно улучшить, какую вечеринку или артиста вы хотели бы видеть — либо, наоборот, не хотели бы видеть в программе.</div><form class="review-user-form" id="venueReviewForm"><label><span>Тема обращения</span><select name="type" required><option value="event">Отзыв о мероприятии</option><option value="improvement">Что можно улучшить</option><option value="party">Идея или нежелательная тематика вечеринки</option><option value="artist">Артист, DJ, MC или шоу-программа</option><option value="venue">Площадка и обслуживание</option><option value="other">Другое</option></select></label><label><span>Мероприятие</span><select name="event_id" id="reviewEventSelect"><option value="">Без привязки к мероприятию</option></select></label><label><span>Оценка</span><select name="rating"><option value="">Без оценки</option><option value="5">5 — отлично</option><option value="4">4 — хорошо</option><option value="3">3 — нормально</option><option value="2">2 — есть проблемы</option><option value="1">1 — плохо</option></select></label><label><span>Ваш отзыв или предложение</span><textarea name="message" required maxlength="2000" placeholder="Опишите ваше мнение максимально конкретно"></textarea></label><button class="primary full" type="submit">Отправить в BALI</button></form></div></div></dialog>`);
  }

  function mountHomeButtons() {
    const about = document.querySelector('[data-screen="home"] .home-club-footer') || [...document.querySelectorAll('[data-screen="home"] .inner > section.card')].find(card => card.id !== "clubLinks" && !card.querySelector("#homeEvents"));
    if (!about) return false;
    let actions = about.querySelector(".home-about-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "home-about-actions";
      actions.innerHTML = `<button class="venue-primary" type="button" data-open-venue-details>Узнать подробнее о площадке</button><button class="venue-secondary" type="button" data-open-venue-review>Оставить отзыв</button>`;
      about.appendChild(actions);
    }
    return true;
  }

  function mediaHtml(item) {
    const url = item.url || item.src || "";
    const type = item.type || (/^data:video|\.(mp4|webm|mov)(\?|$)/i.test(url) ? "video" : "image");
    const title = item.title || item.caption || "";
    if (!url) return "";
    if (type === "video" && (/^data:video/i.test(url) || /\.(mp4|webm|mov)(\?|$)/i.test(url))) return `<figure class="venue-media"><video src="${esc(url)}" controls playsinline preload="metadata"></video>${title ? `<span>${esc(title)}</span>` : ""}</figure>`;
    if (type === "video") return `<a class="venue-media venue-media-link" href="${esc(url)}" data-venue-external-link>▶ Открыть видео${title ? `<br>${esc(title)}` : ""}</a>`;
    return `<figure class="venue-media"><img src="${esc(url)}" alt="${esc(title || "Площадка BALI")}" loading="lazy">${title ? `<span>${esc(title)}</span>` : ""}</figure>`;
  }

  async function openVenue() {
    const rows = await store.list("venue_content");
    const venue = rows.find(row => row.active !== false) || rows[0] || {};
    const media = parseMedia(venue.media);
    document.getElementById("venueDetailsBody").innerHTML = `
      <div><span class="eyebrow">ПЛОЩАДКА</span><h2>${esc(venue.title || "Площадка BALI")}</h2></div>
      ${media.length ? `<div class="venue-gallery">${media.map(mediaHtml).join("")}</div>` : '<div class="venue-empty">Фотографии и видео площадки скоро появятся</div>'}
      <p class="venue-copy">${esc(venue.description || "Информация о площадке будет добавлена позднее.")}</p>
      <section class="venue-formats"><h3>Для каких мероприятий подходит BALI</h3><p>${esc(venue.formats || "Клубные вечеринки, концерты, трансляции, частные и корпоративные мероприятия.")}</p></section>`;
    document.getElementById("venueDetailsDialog").showModal();
  }

  async function openReview() {
    const events = (await store.list("events")).filter(row => row.active !== false).sort((a, b) => `${a.event_date || ""}T${a.event_time || ""}`.localeCompare(`${b.event_date || ""}T${b.event_time || ""}`));
    document.getElementById("reviewEventSelect").innerHTML = `<option value="">Без привязки к мероприятию</option>${events.map(row => `<option value="${esc(row.id)}">${esc(row.title)} · ${esc(row.event_date || "")}</option>`).join("")}`;
    document.getElementById("venueReviewDialog").showModal();
  }

  function openExternal(url) {
    if (!url) return;
    if (/^https:\/\/t\.me\//i.test(url) && tg?.openTelegramLink) return tg.openTelegramLink(url);
    if (tg?.openLink) return tg.openLink(url);
    window.open(url, "_blank", "noopener");
  }

  document.addEventListener("click", event => {
    if (event.target.closest("[data-open-venue-details]")) openVenue();
    if (event.target.closest("[data-open-venue-review]")) openReview();
    if (event.target.closest("[data-close-venue-dialog]")) event.target.closest("dialog")?.close();
    const external = event.target.closest("[data-venue-external-link]");
    if (external) {
      event.preventDefault();
      openExternal(external.href);
    }
  }, true);

  document.addEventListener("submit", async event => {
    if (event.target.id !== "venueReviewForm") return;
    event.preventDefault();
    const form = event.target;
    const data = Object.fromEntries(new FormData(form).entries());
    const events = await store.list("events");
    const selected = events.find(row => String(row.id) === String(data.event_id));
    const profile = game?.profile?.() || {};
    try {
      await store.save("reviews", {
        user_key: profile.id || profile.userKey || "",
        user_name: profile.name || "Гость BALI",
        telegram: profile.username || profile.telegram || "",
        event_id: data.event_id || "",
        event_title: selected?.title || "",
        type: data.type || "other",
        rating: data.rating ? Number(data.rating) : null,
        message: String(data.message || "").trim(),
        status: "new",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      form.reset();
      document.getElementById("venueReviewDialog")?.close();
      toast("Спасибо! Отзыв отправлен администрации BALI");
    } catch (error) {
      toast(error.message || "Не удалось отправить отзыв");
    }
  }, true);

  styles();
  ensureDialogs();
  const observer = new MutationObserver(() => requestAnimationFrame(mountHomeButtons));
  observer.observe(document.body, { childList: true, subtree: true });
  [0, 200, 700, 1500].forEach(delay => setTimeout(mountHomeButtons, delay));
  window.BaliVenueReviewsUser = { openVenue, openReview, mountHomeButtons };
})();