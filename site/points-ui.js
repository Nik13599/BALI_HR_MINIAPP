(() => {
  const points = window.BaliPoints;
  if (!points) return;
  const byDate = (a, b) => `${a.event_date || "9999-12-31"}T${a.event_time || "23:59"}`.localeCompare(`${b.event_date || "9999-12-31"}T${b.event_time || "23:59"}`);
  const icon = (type) => ({ referral: "👥", attendance: "🎟", event: "↗" })[type] || "★";
  const when = (value) => new Date(value).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  function prepareUi() {
    const heroText = document.querySelector(".hero-copy p");
    if (heroText) heroText.textContent = "Афиши ближайших событий, барное меню, BALI-Баллы и бронирование свободного стола — прямо в Telegram.";
    document.querySelectorAll('[data-scroll="bonuses"]').forEach((button) => {
      if (!button.closest(".bonus-actions")) button.textContent = "BALI-Баллы";
    });
    const nav = document.querySelector('.bottom a[href="#bonuses"]');
    if (nav) nav.innerHTML = "<span>★</span>Баллы";
    const head = document.querySelector(".bonus-head");
    if (head) {
      head.querySelector(".eyebrow").textContent = "БАЛЛЬНАЯ СИСТЕМА BALI";
      head.querySelector("h2").textContent = "BALI-Баллы";
      head.querySelector("p").textContent = "Зарабатывайте баллы за репосты мероприятий, приглашение друзей в приложение и посещение событий BALI.";
    }
    const walletLabel = document.querySelector(".bonus-wallet > div:first-child span");
    if (walletLabel) walletLabel.textContent = "баллов";
    const actions = document.querySelector(".bonus-actions");
    if (actions) actions.innerHTML = `
      <article><span class="bonus-icon">↗</span><div><h3>Поделиться мероприятием</h3><p>Баллы начисляются один раз за репост каждой афиши.</p></div><button class="primary" type="button" id="chooseEventButton">Выбрать событие · +<span id="eventShareReward">0</span></button></article>
      <article><span class="bonus-icon">👥</span><div><h3>Пригласить друга</h3><p>Отправьте другу персональную ссылку на приложение BALI.</p></div><button class="secondary" id="inviteFriendButton" type="button">Пригласить · +<span id="referralReward">0</span></button></article>
      <article><span class="bonus-icon">🎟</span><div><h3>Посетить мероприятие</h3><p>Получите одноразовый код у администратора после посещения.</p></div><div class="attendance-code-form"><input id="attendanceCodeInput" maxlength="24" placeholder="Код посещения"/><button class="secondary" id="attendanceCodeButton" type="button">Начислить · +<span id="attendanceReward">0</span></button></div></article>`;
    if (!document.getElementById("pointsUiStyle")) {
      const style = document.createElement("style");
      style.id = "pointsUiStyle";
      style.textContent = ".attendance-code-form{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;width:100%;margin-top:10px}.attendance-code-form input{min-width:0;min-height:46px;padding:0 13px;border:1px solid rgba(255,255,255,.12);border-radius:13px;background:rgba(255,255,255,.045);color:#fff;outline:0}@media(max-width:520px){.attendance-code-form{grid-template-columns:1fr}.attendance-code-form button{width:100%}}";
      document.head.appendChild(style);
    }
  }

  function renderPoints() {
    const settings = points.settings();
    const profile = points.profile();
    const ledger = points.ledger();
    $("#bonusBalance").textContent = Number(profile.balance || 0).toLocaleString("ru-RU");
    $("#bonusReferralCode").textContent = profile.code;
    $("#referralReward").textContent = settings.referral;
    $("#attendanceReward").textContent = settings.attendance;
    $("#eventShareReward").textContent = settings.eventShare;
    $("#bonusHistoryCount").textContent = `${ledger.length} операций`;
    $("#bonusHistory").innerHTML = ledger.length ? ledger.slice(0, 8).map((item) => `<div class="bonus-history-item"><i>${icon(item.type)}</i><div><strong>${esc(item.title)}</strong><small>${when(item.createdAt)}</small></div><b>+${Number(item.amount || 0)}</b></div>`).join("") : '<div class="bonus-empty">Начислений пока нет. Поделитесь мероприятием, пригласите друга или подтвердите посещение.</div>';
  }

  async function share(payload) {
    if (navigator.share) return navigator.share(payload);
    const url = payload.url || location.href;
    const text = `${payload.text || ""} ${url}`.trim();
    if (window.Telegram?.WebApp?.openTelegramLink) window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(payload.text || "")}`);
    else await navigator.clipboard.writeText(text);
  }

  async function inviteFriend() {
    const settings = points.settings();
    const profile = points.profile();
    const url = new URL(location.href);
    url.searchParams.set("ref", profile.code);
    url.hash = "bonuses";
    try {
      await share({ title: "BALI Minsk", text: `Присоединяйся к BALI по моему коду ${profile.code}`, url: url.toString() });
      const added = points.add("referral", settings.referral, "Приглашение друга", "referral-beta3");
      toast(added ? `Начислено ${settings.referral} BALI-баллов` : "Баллы за тестовое приглашение уже получены");
    } catch { toast("Отправка приглашения отменена"); }
  }

  async function shareEvent(eventId) {
    const event = state.events.find((item) => item.id === eventId);
    if (!event) return;
    const settings = points.settings();
    try {
      const url = new URL(location.href); url.hash = "events";
      await share({ title: event.title, text: `${event.title} в BALI · ${formatDate(event.event_date)} · ${event.event_time}`, url: url.toString() });
      const added = points.add("event", settings.eventShare, `Репост мероприятия «${event.title}»`, `event-share-${event.id}`);
      toast(added ? `Начислено ${settings.eventShare} BALI-баллов` : "Баллы за эту афишу уже получены");
      renderEvents(); renderPoints();
    } catch { toast("Публикация события отменена"); }
  }

  renderEvents = function() {
    const settings = points.settings();
    const used = points.actions();
    const events = [...state.events].sort(byDate); state.events = events;
    $("#eventCount").textContent = `${events.length} событий`;
    $("#eventTrack").innerHTML = events.length ? events.map((event, index) => {
      const claimed = Boolean(used[`event-share-${event.id}`]);
      return `<article class="poster poster-${(index % 3) + 1}" data-event="${event.id}">${event.image_url ? `<img src="${esc(event.image_url)}" alt="${esc(event.title)}"/>` : ""}<button class="poster-share ${claimed ? "claimed" : ""}" type="button" data-event-share="${event.id}">${claimed ? "✓ Баллы получены" : `Поделиться · +${settings.eventShare}`}</button><div class="poster-visual"><small>BALI PRESENTS</small><b>${esc(event.title)}</b><i>${formatDate(event.event_date)} · ${esc(event.event_time)}</i></div><div class="poster-info"><span>${formatDate(event.event_date)}</span><h3>${esc(event.title)}</h3><p>${esc(event.description)}</p></div></article>`;
    }).join("") : '<div class="empty-card">Новые афиши скоро появятся</div>';
  };

  const baseHall = renderHall;
  renderHall = function() {
    baseHall();
    const hall = $("#hallMap");
    if (hall?.classList.contains("has-background")) hall.style.backgroundSize = "auto, auto, contain";
  };

  prepareUi();
  $("#chooseEventButton").addEventListener("click", () => document.getElementById("events").scrollIntoView({ behavior: "smooth" }));
  $("#inviteFriendButton").addEventListener("click", inviteFriend);
  $("#attendanceCodeButton").addEventListener("click", () => {
    const input = $("#attendanceCodeInput");
    const result = points.redeemVisit(input.value);
    toast(result.ok ? `Начислено ${result.amount} BALI-баллов за посещение` : result.message);
    if (result.ok) input.value = "";
    renderPoints();
  });
  $("#copyReferralCode").addEventListener("click", async () => { await navigator.clipboard.writeText(points.profile().code); toast("Код приглашения скопирован"); });
  $("#eventTrack").addEventListener("click", (event) => { const button = event.target.closest("[data-event-share]"); if (button) { event.preventDefault(); event.stopPropagation(); shareEvent(button.dataset.eventShare); } });
  window.addEventListener("bali:points-changed", renderPoints);
  window.addEventListener("storage", (event) => { if (Object.values(points.keys).includes(event.key)) renderPoints(); });
  state.events.sort(byDate); renderEvents(); renderPoints(); renderHall();
})();