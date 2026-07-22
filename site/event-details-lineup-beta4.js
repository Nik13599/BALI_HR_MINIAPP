(() => {
  if (window.__BALI_EVENT_DETAILS_LINEUP__) return;
  window.__BALI_EVENT_DETAILS_LINEUP__ = true;

  const store = window.BaliStore;
  const tg = window.Telegram?.WebApp;
  if (!store) return;

  let activeEventId = "";
  let activeEvent = null;

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);

  const parsePerformers = value => {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const formatDate = value => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("ru-RU", {
    day: "2-digit", month: "long", year: "numeric"
  }) : "";

  function styles() {
    if (document.getElementById("eventDetailsLineupStyle")) return;
    const style = document.createElement("style");
    style.id = "eventDetailsLineupStyle";
    style.textContent = `
      .event-more-button{width:100%;min-height:45px;margin-top:4px;border:1px solid rgba(200,255,61,.28);border-radius:14px;background:rgba(200,255,61,.07);color:var(--lime);font-weight:900}
      .event-details-dialog{width:min(650px,calc(100% - 14px));max-height:95dvh;padding:0;border:1px solid var(--line);border-radius:24px;background:#0b0e0d;color:#fff;overflow:hidden}.event-details-dialog::backdrop{background:#000d;backdrop-filter:blur(6px)}
      .event-details-sheet{max-height:95dvh;overflow:auto}.event-details-hero{position:relative;min-height:245px;background:#171c19 center/cover no-repeat}.event-details-hero:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 32%,#0b0e0d)}
      .event-details-close{position:absolute;right:12px;top:12px;z-index:3;width:42px;height:42px;border:1px solid #ffffff25;border-radius:50%;background:#080a0acc;color:#fff;font-size:24px}
      .event-details-content{position:relative;z-index:2;display:grid;gap:16px;margin-top:-70px;padding:16px}.event-details-content h2{font-size:27px}.event-details-copy{color:#c8ceca;font-size:11px;line-height:1.65;white-space:pre-line}
      .event-details-meta{color:var(--lime);font-size:9px;font-weight:900;letter-spacing:.08em}.event-details-section{display:grid;gap:10px}.event-details-section h3{font-size:16px}
      .event-lineup-user{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.event-performer-card{display:grid;grid-template-columns:70px minmax(0,1fr);gap:10px;align-items:center;min-height:88px;padding:9px;border:1px solid var(--line);border-radius:16px;background:#ffffff06;text-decoration:none}.event-performer-card.has-link{cursor:pointer}.event-performer-card.has-link:after{content:"↗";position:absolute;right:10px;top:8px;color:var(--lime)}
      .event-performer-card{position:relative}.event-performer-photo{width:70px;height:70px;display:grid;place-items:center;overflow:hidden;border-radius:13px;background:#171c19;color:var(--muted);font-size:9px;text-align:center}.event-performer-photo img{width:100%;height:100%;object-fit:cover}.event-performer-card small{display:block;color:var(--lime);font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.09em}.event-performer-card strong{display:block;margin-top:4px;font-size:12px;line-height:1.25}.event-performer-card span{display:block;margin-top:4px;color:var(--muted);font-size:7px}
      .event-details-empty{padding:20px;border:1px dashed var(--line);border-radius:16px;color:var(--muted);text-align:center;font-size:10px}.event-details-actions{position:sticky;bottom:0;z-index:4;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--line);background:#0b0e0df2;backdrop-filter:blur(12px)}.event-details-actions .primary{grid-column:1/-1}.event-details-actions button{min-height:46px}
      @media(max-width:430px){.event-lineup-user{grid-template-columns:1fr}.event-details-content h2{font-size:23px}}
    `;
    document.head.appendChild(style);
  }

  function ensureDialog() {
    if (document.getElementById("eventDetailsLineupDialog")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <dialog class="event-details-dialog" id="eventDetailsLineupDialog">
        <div class="event-details-sheet">
          <div class="event-details-hero" id="eventDetailsHero"><button class="event-details-close" type="button" data-close-event-details>×</button></div>
          <div class="event-details-content" id="eventDetailsContent"></div>
          <div class="event-details-actions">
            <button class="secondary" type="button" data-close-event-details>Вернуться назад</button>
            <button class="secondary" type="button" data-event-details-going>Я хочу пойти</button>
            <button class="primary" type="button" data-event-details-booking>Перейти к бронированию</button>
          </div>
        </div>
      </dialog>`);
  }

  function performerCard(item) {
    const photo = item.photo_url || item.photo || "";
    const link = item.social_url || item.link || "";
    return `<article class="event-performer-card ${link ? "has-link" : ""}" ${link ? `data-performer-link="${esc(link)}" role="link" tabindex="0"` : ""}>
      <div class="event-performer-photo">${photo ? `<img src="${esc(photo)}" alt="${esc(item.name || item.role || "Участник")}">` : "BALI<br>ARTIST"}</div>
      <div><small>${esc(item.role || "Участник")}</small><strong>${esc(item.name || "Специальный гость")}</strong>${link ? "<span>Открыть страницу артиста</span>" : ""}</div>
    </article>`;
  }

  async function resolveEvent() {
    const rows = await store.list("events");
    if (activeEventId) activeEvent = rows.find(row => String(row.id) === String(activeEventId)) || null;
    if (!activeEvent) {
      const title = document.getElementById("eventDialogTitle")?.textContent.trim();
      const dateText = document.getElementById("eventDialogDate")?.textContent || "";
      activeEvent = rows.find(row => row.title === title && (!row.event_date || dateText.includes(formatDate(row.event_date)))) || rows.find(row => row.title === title) || null;
    }
    return activeEvent;
  }

  async function openDetails() {
    const event = await resolveEvent();
    if (!event) return;
    const performers = parsePerformers(event.performers);
    const hero = document.getElementById("eventDetailsHero");
    hero.style.backgroundImage = event.image_url ? `url("${String(event.image_url).replace(/"/g, "%22")}")` : "linear-gradient(145deg,#202722,#0b0e0d)";
    document.getElementById("eventDetailsContent").innerHTML = `
      <div><span class="event-details-meta">${esc(formatDate(event.event_date))} · ${esc(event.event_time || "23:00")}</span><h2>${esc(event.title || "Событие BALI")}</h2></div>
      <p class="event-details-copy">${esc(event.details_description || event.description || "Подробности мероприятия будут добавлены позднее.")}</p>
      <section class="event-details-section"><h3>Кто будет выступать</h3>${performers.length ? `<div class="event-lineup-user">${performers.map(performerCard).join("")}</div>` : '<div class="event-details-empty">Состав участников будет объявлен дополнительно</div>'}</section>`;
    syncGoingButton();
    document.getElementById("eventDetailsLineupDialog").showModal();
  }

  function syncGoingButton() {
    const source = document.getElementById("eventInterested");
    const target = document.querySelector("[data-event-details-going]");
    if (!target) return;
    const selected = source?.classList.contains("primary");
    target.classList.toggle("primary", Boolean(selected));
    target.classList.toggle("secondary", !selected);
    target.textContent = selected ? "✓ Я хочу пойти" : "Я хочу пойти";
  }

  function decorateEventDialog() {
    const description = document.getElementById("eventDialogDescription");
    const source = document.getElementById("eventInterested");
    if (!description || !source) return false;
    source.textContent = source.classList.contains("primary") ? "✓ Я хочу пойти" : "Я хочу пойти";
    let button = document.getElementById("eventMoreDetailsButton");
    if (!button) {
      button = document.createElement("button");
      button.id = "eventMoreDetailsButton";
      button.type = "button";
      button.className = "event-more-button";
      button.dataset.openEventDetails = "";
      button.textContent = "Подробнее о событии";
      description.insertAdjacentElement("afterend", button);
    }
    return true;
  }

  function openExternal(url) {
    if (!url) return;
    if (/^https:\/\/t\.me\//i.test(url) && tg?.openTelegramLink) return tg.openTelegramLink(url);
    if (tg?.openLink) return tg.openLink(url);
    window.open(url, "_blank", "noopener");
  }

  document.addEventListener("click", event => {
    const eventTarget = event.target.closest("[data-event]");
    if (eventTarget?.dataset.event) {
      activeEventId = eventTarget.dataset.event;
      activeEvent = null;
      setTimeout(decorateEventDialog, 30);
    }
    if (event.target.closest("[data-open-event-details]")) openDetails();
    if (event.target.closest("[data-close-event-details]")) document.getElementById("eventDetailsLineupDialog")?.close();
    if (event.target.closest("[data-event-details-going]")) {
      document.getElementById("eventInterested")?.click();
      setTimeout(syncGoingButton, 0);
    }
    if (event.target.closest("[data-event-details-booking]")) {
      document.getElementById("eventDetailsLineupDialog")?.close();
      setTimeout(() => document.getElementById("bookingForm")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }
    const performer = event.target.closest("[data-performer-link]");
    if (performer) openExternal(performer.dataset.performerLink);
  }, true);

  document.addEventListener("keydown", event => {
    const performer = event.target.closest?.("[data-performer-link]");
    if (performer && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openExternal(performer.dataset.performerLink);
    }
  });

  styles();
  ensureDialog();
  const observer = new MutationObserver(() => requestAnimationFrame(decorateEventDialog));
  observer.observe(document.body, { childList: true, subtree: true });
  [0, 200, 700].forEach(delay => setTimeout(decorateEventDialog, delay));
  window.BaliEventDetailsLineup = { openDetails, decorateEventDialog };
})();