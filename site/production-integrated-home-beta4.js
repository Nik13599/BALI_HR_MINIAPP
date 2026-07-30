(() => {
  if (window.__BALI_PRODUCTION_INTEGRATED_HOME__) return;
  window.__BALI_PRODUCTION_INTEGRATED_HOME__ = true;

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;"
  })[char]);
  const digits = value => String(value || "").replace(/\D/g, "");
  const money = value => new Intl.NumberFormat("ru-RU").format(Math.max(0, Number(value || 0)));
  const dateLabel = value => value
    ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("ru-RU", { day:"2-digit", month:"long" })
    : "дата уточняется";
  const vipLabel = value => value?.plan?.name || "Без VIP";
  const statusLabel = value => ({
    pending:"Ожидает подтверждения",
    confirmed:"Подтверждено",
    seated:"Гость в клубе"
  })[value] || "Активно";

  let renderQueued = false;
  let renderToken = 0;

  function styles() {
    if (document.getElementById("baliIntegratedHomeStyle")) return;
    const style = document.createElement("style");
    style.id = "baliIntegratedHomeStyle";
    style.textContent = `
      .nav[data-navigation-ready="true"]>[data-page="menu"]{display:none!important}
      [data-screen="home"] .inner>:not(.hero):not(#baliProductionHome){display:none!important}
      [data-screen="home"] .hero{min-height:215px!important}
      .bali-now-event-duplicate{display:none!important}
      [data-screen="home"] .home-events:has(>.bali-now-event-duplicate){grid-template-columns:repeat(2,minmax(0,1fr))!important}
      .bali-now{position:relative;display:grid;gap:10px;padding:15px;border:1px solid rgba(227,189,100,.25);border-radius:22px;background:radial-gradient(circle at 88% 0,rgba(193,86,28,.19),transparent 36%),linear-gradient(145deg,rgba(31,27,20,.98),rgba(11,14,12,.98));overflow:hidden}
      .bali-now:before{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 48%,rgba(255,255,255,.025) 49%,transparent 50%);background-size:21px 21px;pointer-events:none}
      .bali-now>*{position:relative;z-index:1}
      .bali-now-head{display:flex;align-items:start;justify-content:space-between;gap:10px}
      .bali-now-head h2{margin:4px 0 0;font-size:20px;line-height:1.05}
      .bali-now-head p{margin:5px 0 0;color:var(--muted);font-size:8px;line-height:1.45}
      .bali-now-live{display:inline-flex;align-items:center;gap:5px;padding:6px 8px;border:1px solid rgba(200,255,61,.32);border-radius:999px;color:var(--lime);font-size:7px;font-weight:900;white-space:nowrap}
      .bali-now-live:before{content:"";width:6px;height:6px;border-radius:50%;background:var(--lime);box-shadow:0 0 10px var(--lime)}
      .bali-now-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
      .bali-now-metric{min-width:0;display:grid;gap:4px;padding:10px 7px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(0,0,0,.22)}
      .bali-now-metric span{color:var(--muted);font-size:6px;letter-spacing:.07em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .bali-now-metric strong{color:#f2d08b;font:600 13px Unbounded;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .bali-now-metric small{color:#aab0ac;font-size:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .bali-now-event{display:grid;grid-template-columns:92px minmax(0,1fr);gap:12px;padding:10px;border:1px solid rgba(255,255,255,.1);border-radius:18px;background:rgba(0,0,0,.22)}
      .bali-now-poster{min-height:126px;overflow:hidden;border-radius:13px;background:linear-gradient(145deg,#3b2716,#111)}
      .bali-now-poster img{width:100%;height:100%;object-fit:cover;display:block}
      .bali-now-event-copy{min-width:0;display:grid;align-content:start;gap:7px}
      .bali-now-event-copy>span{color:#f2d08b;font-size:7px;font-weight:900;letter-spacing:.08em}
      .bali-now-event-copy h3{margin:0;font-size:16px;line-height:1.15}
      .bali-now-event-copy p{margin:0;color:var(--muted);font-size:8px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .bali-now-attendance{display:flex;gap:5px;flex-wrap:wrap}
      .bali-now-attendance span{padding:5px 7px;border:1px solid rgba(255,255,255,.09);border-radius:999px;background:rgba(255,255,255,.035);color:#d7dbd8;font-size:7px}
      .bali-now-actions{display:grid;grid-template-columns:1.15fr 1fr;gap:6px}
      .bali-now-actions button{min-height:36px;padding:0 8px;border-radius:11px;font-size:8px;font-weight:900}
      .bali-now-actions .wide{grid-column:1/-1}
      .bali-now-booking{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 11px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.025)}
      .bali-now-booking div{min-width:0}.bali-now-booking span{display:block;color:var(--muted);font-size:7px}.bali-now-booking strong{display:block;margin-top:3px;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .bali-now-booking button{flex:0 0 auto;min-height:32px;padding:0 10px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.04);color:var(--lime);font-size:8px;font-weight:900}
      .bali-now-shortcuts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
      .bali-now-shortcuts button{min-width:0;min-height:47px;display:grid;place-items:center;gap:3px;padding:5px 3px;border:1px solid rgba(255,255,255,.08);border-radius:13px;background:rgba(255,255,255,.025);color:#fff}
      .bali-now-shortcuts i{font-style:normal;font-size:16px}.bali-now-shortcuts span{max-width:100%;font-size:6px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      @media(max-width:390px){[data-screen="home"] .hero{min-height:185px!important;padding:17px!important}.bali-now{padding:12px}.bali-now-metrics{grid-template-columns:1fr 1fr}.bali-now-event{grid-template-columns:78px minmax(0,1fr)}.bali-now-poster{min-height:116px}.bali-now-shortcuts span{font-size:5.5px}}
    `;
    document.head.appendChild(style);
  }

  function myBooking(bookings, profile) {
    const today = new Date().toISOString().slice(0, 10);
    const keys = new Set(window.BaliBeta4Game?.identityKeys?.(profile) || []);
    return bookings
      .filter(row => String(row.booking_date || "") >= today && !["cancelled", "completed"].includes(row.status))
      .filter(row => keys.has(String(row.owner_key || ""))
        || (profile.phone && digits(row.phone) === digits(profile.phone))
        || String(row.customer_name || "").trim() === String(profile.name || "").trim())
      .sort((left, right) => `${left.booking_date || ""}${left.booking_time || ""}`.localeCompare(`${right.booking_date || ""}${right.booking_time || ""}`))[0] || null;
  }

  async function context() {
    const store = window.BaliStore;
    const game = window.BaliBeta4Game;
    const points = window.BaliPoints;
    if (!store || !game || !points || !window.BaliMatch3) return null;
    const [events, bookings, checkins] = await Promise.all([
      store.list("events"),
      store.list("bookings"),
      window.BaliEventQrAttendance?.listCheckins?.() || []
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = events
      .filter(row => row.active !== false && String(row.event_date || "") >= today)
      .sort((left, right) => `${left.event_date || ""}T${left.event_time || "23:00"}`.localeCompare(`${right.event_date || ""}T${right.event_time || "23:00"}`));
    const event = upcoming[0] || events[0] || null;
    const profile = game.profile();
    const account = points.profile();
    const vip = game.vip();
    const level = game.levelFor(Number(profile.xp || 0));
    let leaderboard = window.BaliMatch3.leaderboard();
    let matchRow = leaderboard.find(row => row.isMe) || null;
    if (!matchRow) {
      window.BaliMatch3.submitScore(12450, { completed:false });
      leaderboard = window.BaliMatch3.leaderboard();
      matchRow = leaderboard.find(row => row.isMe) || null;
    }
    const eventBookings = bookings.filter(row => String(row.booking_date || "") === String(event?.event_date || "") && row.status !== "cancelled");
    const bookedGuests = eventBookings.reduce((sum, row) => sum + Number(row.guests || 0), 0);
    const checkedIn = new Set(checkins.filter(row => String(row.event_id || "") === String(event?.id || "")).map(row => row.user_key || row.telegram_id || row.id)).size;
    const people = window.BaliBeta4Social?.visiblePeople?.() || [];
    const clanState = window.BaliClans?.snapshot?.();
    const myClans = clanState?.clans?.filter(clan => clan.members?.some(member => member.user_key === clanState.currentUser?.userKey && member.status === "active")) || [];
    const notifications = Number(window.BaliBeta4Social?.activeIncomingRequests?.().length || 0)
      + Number(window.BaliBeta4Social?.incomingGifts?.().length || 0);
    return {
      event,
      profile,
      account,
      vip,
      level,
      matchRow,
      nextBooking:myBooking(bookings, profile),
      participants:Math.max(bookedGuests, checkedIn, Number(window.BaliDemo?.users?.length || 0)),
      friends:Math.min(3, people.length),
      clans:Math.max(myClans.length, 2),
      notifications
    };
  }

  function eventHtml(data) {
    const event = data.event;
    if (!event) return '<div class="empty">Ближайшее событие скоро появится</div>';
    const image = event.image_url
      ? `<img src="${esc(event.image_url)}" alt="${esc(event.title || "Афиша BALI")}">`
      : "";
    return `
      <article class="bali-now-event">
        <div class="bali-now-poster">${image}</div>
        <div class="bali-now-event-copy">
          <span>БЛИЖАЙШЕЕ СОБЫТИЕ · ${esc(dateLabel(event.event_date))} · ${esc(event.event_time || "23:00")}</span>
          <h3>${esc(event.title || "Ночь BALI")}</h3>
          <p>${esc(event.description || "Музыка, артисты и атмосфера BALI.")}</p>
          <div class="bali-now-attendance">
            <span>${data.participants} участников</span>
            <span>${data.friends} друзей</span>
            <span>${data.clans} клана</span>
          </div>
          <div class="bali-now-actions">
            <button class="primary" type="button" data-event="${esc(event.id)}">Я иду</button>
            <button class="secondary" type="button" data-event="${esc(event.id)}">Забронировать</button>
            <button class="secondary wide" type="button" data-page="dating">Посмотреть людей и кланы</button>
          </div>
        </div>
      </article>`;
  }

  function bookingHtml(booking) {
    if (!booking) return `
      <div class="bali-now-booking">
        <div><span>БЛИЖАЙШЕЕ БРОНИРОВАНИЕ</span><strong>Активной брони пока нет</strong></div>
        <button type="button" data-page="events">Выбрать стол</button>
      </div>`;
    return `
      <div class="bali-now-booking">
        <div><span>БЛИЖАЙШЕЕ БРОНИРОВАНИЕ · ${esc(statusLabel(booking.status))}</span><strong>${esc(dateLabel(booking.booking_date))} · ${esc(booking.booking_time || "23:00")} · ${esc(booking.table_name || booking.table_id || "стол")}</strong></div>
        <button type="button" data-user-booking-open="${esc(booking.id)}">Открыть</button>
      </div>`;
  }

  function syncLegacyBlocks(event) {
    const homeEvents = document.getElementById("homeEvents");
    if (!homeEvents || !event) return;
    homeEvents.querySelectorAll("[data-event]").forEach(card => {
      const duplicate = String(card.dataset.event || "") === String(event.id || "");
      card.hidden = duplicate;
      card.classList.toggle("bali-now-event-duplicate", duplicate);
      if (duplicate) card.style.setProperty("display", "none", "important");
      else card.style.removeProperty("display");
    });
    const title = homeEvents.closest(".card")?.querySelector(".card-head h3");
    if (title) title.textContent = "Другие ближайшие события";
  }

  async function render() {
    const token = ++renderToken;
    const inner = document.querySelector('[data-screen="home"] .inner');
    const hero = inner?.querySelector(".hero");
    if (!inner || !hero) return false;
    const data = await context();
    if (!data || token !== renderToken) return false;

    let section = document.getElementById("baliProductionHome");
    if (!section) {
      section = document.createElement("section");
      section.id = "baliProductionHome";
      section.className = "bali-now";
      hero.insertAdjacentElement("afterend", section);
    }
    const nextXp = data.level.next ? Math.max(0, Number(data.level.next.minXp || 0) - Number(data.profile.xp || 0)) : 0;
    section.innerHTML = `
      <header class="bali-now-head">
        <div><span class="eyebrow">BALI PEOPLE · ЕДИНОЕ ПРИЛОЖЕНИЕ</span><h2>${esc(data.profile.name || "Гость")}, ваш BALI сейчас</h2><p>События, люди, кланы, игра и награды собраны на одной главной.</p></div>
        <span class="bali-now-live">БЕТА АКТИВНА</span>
      </header>
      <div class="bali-now-metrics">
        <article class="bali-now-metric"><span>БАЛЛЫ</span><strong>${money(data.account.balance)}</strong><small>${data.level.next ? `${nextXp} XP до ${esc(data.level.next.name)}` : "Максимальный уровень"}</small></article>
        <article class="bali-now-metric"><span>VIP СТАТУС</span><strong>${esc(vipLabel(data.vip))}</strong><small>${data.vip?.expiresAt ? `до ${esc(dateLabel(String(data.vip.expiresAt).slice(0, 10)))}` : "можно активировать"}</small></article>
        <article class="bali-now-metric"><span>ИГРА НЕДЕЛИ</span><strong>${data.matchRow ? `#${data.matchRow.position}` : "—"}</strong><small>${money(data.matchRow?.score || 0)} очков</small></article>
        <article class="bali-now-metric"><span>УВЕДОМЛЕНИЯ</span><strong>${data.notifications}</strong><small>подарки и приглашения</small></article>
      </div>
      ${eventHtml(data)}
      ${bookingHtml(data.nextBooking)}
      <div class="bali-now-shortcuts">
        <button type="button" data-page="events"><i>◫</i><span>События</span></button>
        <button type="button" data-page="dating"><i>♜</i><span>BALI People</span></button>
        <button type="button" data-page="crown"><i>◆</i><span>Игра</span></button>
        <button type="button" data-page="menu"><i>☷</i><span>Меню / Shop</span></button>
      </div>`;
    syncLegacyBlocks(data.event);
    setTimeout(() => syncLegacyBlocks(data.event), 500);
    return true;
  }

  function schedule() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      render().catch(error => console.error("[BALI integrated home]", error));
    });
  }

  styles();
  [
    "bali:full-demo-ready",
    "bali:full-demo-enhancements-ready",
    "bali:demo-user-changed",
    "bali:points-changed",
    "bali:beta4-changed",
    "bali:match3-changed",
    "bali:social-changed",
    "bali:data-changed",
    "bali:clans-changed"
  ].forEach(name => window.addEventListener(name, schedule));
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    schedule();
    if (document.getElementById("baliProductionHome") || attempts >= 50) clearInterval(timer);
  }, 100);
})();
