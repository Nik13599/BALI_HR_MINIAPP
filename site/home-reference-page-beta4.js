(() => {
  "use strict";

  if (window.__BALI_HOME_REFERENCE_PAGE__) return;
  window.__BALI_HOME_REFERENCE_PAGE__ = true;

  const game = window.BaliBeta4Game;
  const points = window.BaliPoints;
  const store = window.BaliStore;
  const social = window.BaliBeta4Social;
  const match3 = window.BaliMatch3;
  const clans = window.BaliClans;
  if (!game || !store) return;

  const ASSET = "./assets/bali-temple/";
  const HOME_ICON = "./assets/home-icons/";
  const ICONS = {
    points: `${HOME_ICON}star.svg`,
    vip: `${HOME_ICON}crown.svg`,
    game: `${HOME_ICON}chart-no-axes-column-increasing.svg`,
    rank: `${HOME_ICON}trophy.svg`,
    notice: `${HOME_ICON}bell.svg`,
    people: `${HOME_ICON}users.svg`,
    clan: `${HOME_ICON}shield.svg`,
    calendar: `${HOME_ICON}calendar-days.svg`,
    qr: `${HOME_ICON}qr-code.svg`,
    map: `${HOME_ICON}map-pin.svg`,
    contact: `${HOME_ICON}headphones.svg`,
    phone: `${HOME_ICON}phone.svg`,
    venue: `${HOME_ICON}building-2.svg`,
    arrow: `${HOME_ICON}arrow-up-right.svg`
  };
  const LIST_META = {
    participants: { eyebrow: "БЛИЖАЙШЕЕ СОБЫТИЕ", title: "Участники" },
    friends: { eyebrow: "ВАШИ ЗНАКОМЫЕ", title: "Друзья на событии" },
    clans: { eyebrow: "BALI PEOPLE", title: "Кланы на событии" }
  };
  const state = { event: null, participants: [], friends: [], eventClans: [], booking: null, renderToken: 0 };

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const number = value => new Intl.NumberFormat("ru-RU").format(Math.max(0, Number(value || 0)));
  const initials = value => String(value || "B").trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase();
  const dateText = value => {
    const date = new Date(`${String(value || "").slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime())
      ? ""
      : new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long" }).format(date);
  };
  const bookingDateText = value => {
    const date = new Date(`${String(value || "").slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime())
      ? "Дата уточняется"
      : new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long" }).format(date);
  };
  const personKey = row => String(row?.user_key || row?.userKey || row?.id || row?.code || "");
  const profileKeys = () => new Set(game.identityKeys?.(game.profile()) || [game.profile().id]);
  const eventDateTime = row => new Date(`${String(row?.event_date || "").slice(0, 10)}T${row?.event_time || "23:00"}:00`).getTime();
  const eventIsActive = row => row?.active !== false && eventDateTime(row) >= Date.now() - 12 * 60 * 60 * 1000;
  const avatarHtml = person => {
    const source = String(person?.avatar || person?.photo || "");
    return `<span class="bali-home-list-avatar">${source ? `<img src="${esc(source)}" alt="">` : esc(initials(person?.name))}</span>`;
  };
  const iconSource = (name, custom = "") => String(custom || ICONS[name] || ICONS.game);
  const iconHtml = (name, className = "bali-home-stat-icon", custom = "") => `<span class="${className}${custom ? " bali-home-icon-custom" : ""}" aria-hidden="true"><img src="${esc(iconSource(name, custom))}" alt=""></span>`;
  const inlineIcon = (name, custom = "", className = "") => `<img class="${className}${custom ? `${className ? " " : ""}bali-home-inline-custom` : ""}" src="${esc(iconSource(name, custom))}" alt="">`;
  const externalHref = (value, fallback) => /^https?:\/\//i.test(String(value || "").trim()) ? String(value).trim() : fallback;

  function applyBrand(design) {
    const brand = document.querySelector(".top .brand");
    const logo = brand?.querySelector(".logo");
    const name = brand?.querySelector("strong");
    const subtitle = brand?.querySelector("small");
    if (!brand || !logo || !name || !subtitle) return;
    name.textContent = design.brand?.name || "BALI";
    subtitle.textContent = design.brand?.subtitle || "МИНСК · NIGHT CLUB";
    const image = String(design.brand?.logo || "").trim();
    if (image) {
      logo.style.backgroundImage = `url("${image.replaceAll('"', '\\"')}")`;
      logo.style.backgroundSize = "cover";
      logo.style.backgroundPosition = "center";
      logo.textContent = "";
    } else {
      logo.style.removeProperty("background-image");
      logo.style.removeProperty("background-size");
      logo.style.removeProperty("background-position");
      logo.textContent = "B";
    }
  }

  function applyBlockStyle(root, selector, section = {}) {
    const node = root.querySelector(selector);
    if (!node) return;
    node.dataset.align = section.align || "left";
    node.style.textAlign = section.align || "left";
    node.style.minHeight = Number(section.minHeight || 0) ? `${Number(section.minHeight)}px` : "";
    node.style.backgroundColor = section.backgroundColor || "";
    node.style.backgroundImage = section.backgroundImage
      ? `linear-gradient(rgba(4,7,5,.34),rgba(4,7,5,.68)),url("${String(section.backgroundImage).replace(/"/g, "%22")}")`
      : "";
    if (section.backgroundImage) {
      node.style.backgroundPosition = "center";
      node.style.backgroundSize = "cover";
    }
  }

  function socialPeople() {
    const rows = social?.people?.() || read("bali_social_people_v1", []);
    const users = read("bali_full_demo_users_v1", []);
    const map = new Map();
    [...users, ...rows].forEach(row => {
      const key = String(row.id || row.key || row.userKey || "");
      if (!key) return;
      map.set(key, { ...(map.get(key) || {}), ...row, id:key, userKey:key });
    });
    return [...map.values()];
  }

  function eventParticipants(event, bookings) {
    if (!event) return [];
    const people = socialPeople();
    const byKey = new Map(people.map(row => [String(row.id || row.key || row.userKey), row]));
    const rows = window.BaliFastEventDialog?.wantRows?.(event.id)
      || Object.values(read("bali_event_rsvps_v1", {})?.[event.id] || {});
    const normalized = rows.map(row => {
      const key = personKey(row);
      const person = byKey.get(key) || {};
      return {
        ...person,
        ...row,
        id:key || String(person.id || ""),
        userKey:key || String(person.userKey || ""),
        name:row.name || person.name || "Гость BALI",
        partySize:Math.max(1, Number(row.partySize || row.guests || 1)),
        detail:row.status === "checked_in" ? "Вход подтверждён" : "Собирается на событие"
      };
    });
    const bookedGroups = bookings
      .filter(row => String(row.booking_date) === String(event.event_date) && !["cancelled", "completed"].includes(String(row.status)))
      .map(row => ({
        id:String(row.customer_id || row.id),
        name:row.customer_name || "Гость BALI",
        partySize:Math.max(1, Number(row.guests || 1)),
        detail:`Бронь · ${row.table_name || "стол"} · ${row.guests || 1} гостей`,
        booking:true
      }));
    return bookedGroups.length ? bookedGroups : normalized;
  }

  function friendParticipants(participants) {
    const mine = profileKeys();
    const people = socialPeople().filter(row => !mine.has(String(row.id || row.userKey || row.key)));
    const interactions = new Set();
    (social?.requests?.() || []).forEach(row => {
      if (mine.has(String(row.fromId))) interactions.add(String(row.toId));
      if (mine.has(String(row.toId))) interactions.add(String(row.fromId));
    });
    (social?.gifts?.() || []).forEach(row => {
      if (mine.has(String(row.fromId))) interactions.add(String(row.toId));
      if (mine.has(String(row.toId))) interactions.add(String(row.fromId));
    });
    const participantNames = new Set(participants.map(row => String(row.name || "").toLowerCase()));
    const eventPeople = people.filter(row => participantNames.has(String(row.name || "").toLowerCase()));
    return [...eventPeople]
      .sort((left, right) => Number(interactions.has(String(right.id))) - Number(interactions.has(String(left.id))))
      .slice(0, 3);
  }

  function currentEventClans() {
    const snapshot = clans?.snapshot?.();
    const current = String(snapshot?.currentUser?.id || clans?.currentUser?.()?.id || "tg:1001");
    return (snapshot?.clans || [])
      .filter(row => row.enabled !== false && row.members?.some(member => String(member.user_key) === current && member.status !== "blocked"))
      .map(row => ({
        id:row.id,
        name:row.name,
        type:row.clan_type === "corporate" ? "Корпоративный" : "Пользовательский",
        rating:Number(row.rating_points || 0),
        memberCount:(row.members || []).filter(member => member.status === "active").length
      }))
      .slice(0, 2);
  }

  function notificationsCount() {
    const mine = social?.myId?.() || String(game.profile().id || "");
    const incoming = (social?.requests?.() || []).filter(row => String(row.toId) === mine && row.status === "pending").length;
    const gifts = (social?.incomingGifts?.() || []).length;
    const rewardNotices = read("bali_beta4_reward_notifications_v1", []).filter(row => row.read !== true && row.readAt == null).length;
    return Math.max(0, incoming + gifts + rewardNotices);
  }

  function rankingData() {
    const leaderboard = match3?.leaderboard?.() || [];
    const matchRow = leaderboard.find(row => row.isMe) || { position:4, score:12450 };
    const accounts = Object.values(points?.accounts?.() || {});
    const generalRows = game.ranking(accounts);
    const mine = profileKeys();
    const general = generalRows.find(row => row.isMe || mine.has(String(row.id))) || { position:27 };
    return { matchRow, general };
  }

  function participantTotal(event, participants) {
    if (!event) return 0;
    const fastTotal = Number(window.BaliFastEventDialog?.wantTotal?.(event.id) || 0);
    const bookingTotal = participants.filter(row => row.booking).reduce((sum, row) => sum + Number(row.partySize || 1), 0);
    return bookingTotal || fastTotal || participants.reduce((sum, row) => sum + Number(row.partySize || 1), 0);
  }

  function findBooking(bookings) {
    const profile = game.profile();
    const activeUser = window.BaliDemo?.activeUser?.() || {};
    const phone = String(profile.phone || activeUser.phone || "").replace(/\D/g, "");
    const names = new Set([profile.name, activeUser.name].filter(Boolean).map(value => String(value).toLowerCase()));
    return bookings
      .filter(row => !["cancelled", "completed"].includes(String(row.status)))
      .filter(row => {
        const rowPhone = String(row.phone || "").replace(/\D/g, "");
        return (phone && rowPhone === phone) || names.has(String(row.customer_name || "").toLowerCase()) || profileKeys().has(String(row.owner_key || ""));
      })
      .filter(row => new Date(`${row.booking_date}T${row.booking_time || "23:00"}:00`).getTime() >= Date.now() - 12 * 60 * 60 * 1000)
      .sort((left, right) => String(left.booking_date || "").localeCompare(String(right.booking_date || "")) || String(left.booking_time || "").localeCompare(String(right.booking_time || "")))[0] || null;
  }

  function renderStats(rankings, design) {
    const profile = game.profile();
    const balance = Number(points?.profile?.()?.balance ?? profile.points ?? 0);
    const level = game.levelFor(profile.xp);
    const vip = game.vip();
    const vipUntil = vip?.expiresAt ? `До ${dateText(vip.expiresAt.slice(0, 10))}` : "Статус не активирован";
    const nextXp = level.next ? `${number(Math.max(0, Number(level.next.minXp) - Number(profile.xp || 0)))} XP до ${level.next.name}` : "Максимальный уровень";
    const notices = notificationsCount();
    const config = design.stats || {};
    const items = [
      { icon:"points", custom:config.points?.icon, label:config.points?.title || "Баллы", value:number(balance), detail:config.points?.subtitle || nextXp },
      { icon:"vip", custom:config.vip?.icon, label:config.vip?.title || "VIP статус", value:vip?.plan?.name || "НЕТ VIP", detail:config.vip?.subtitle || vipUntil },
      { icon:"game", custom:config.game?.icon, label:config.game?.title || "Рейтинг в игре", value:`#${rankings.matchRow.position || "—"}`, detail:config.game?.subtitle || `${number(rankings.matchRow.score)} очков` },
      { icon:"rank", custom:config.rank?.icon, label:config.rank?.title || "Общий рейтинг", value:`#${rankings.general.position || "—"}`, detail:config.rank?.subtitle || "Минск" },
      { icon:"notice", custom:config.notice?.icon, label:config.notice?.title || "Уведомления", value:number(notices), detail:config.notice?.subtitle || "подарки и приглашения", notices }
    ];
    return items.map(item => `<article class="bali-home-stat ${item.notices !== undefined ? "bali-home-stat-notifications" : ""}">
      ${iconHtml(item.icon, "bali-home-stat-icon", item.custom)}
      ${item.notices ? `<span class="bali-home-notice-badge">${number(item.notices)}</span>` : ""}
      <div class="bali-home-stat-copy">
        <span class="bali-home-stat-label">${esc(item.label)}</span>
        <strong>${esc(item.value)}</strong>
        <small>${esc(item.detail)}</small>
      </div>
    </article>`).join("");
  }

  function renderEvent(event, total, design) {
    const eventUi = design.event || {};
    if (!event) {
      return `<section class="bali-home-reference-event"><div class="bali-home-list-body"><div class="empty">${esc(eventUi.empty || "Ближайшие события скоро появятся")}</div></div></section>`;
    }
    const poster = event.image_url || `${ASSET}hero-stone-face.webp`;
    const checkin = design.checkin || {};
    const arrowIcon = design.controls?.arrowIcon || "";
    const description = event.description || "Главная клубная ночь: музыка, DJ и свободный вход.";
    return `<section class="bali-home-reference-event">
      <div class="bali-home-event-grid">
        <div class="bali-home-event-poster"><img src="${esc(poster)}" alt="${esc(event.title)}"><button class="bali-home-event-poster-hit" type="button" data-home-open-event="${esc(event.id)}" aria-label="Открыть ${esc(event.title)}"></button></div>
        <div class="bali-home-event-main">
          <div class="bali-home-event-head">
            <span class="bali-home-event-kicker">${esc(eventUi.kicker || "БЛИЖАЙШЕЕ СОБЫТИЕ")} · ${esc(dateText(event.event_date))} · ${esc(event.event_time || "23:00")}</span>
            <button class="bali-home-all-events" type="button" data-page="events">${esc(eventUi.allEvents || "Посмотреть все мероприятия")} ${inlineIcon("arrow", arrowIcon)}</button>
          </div>
          <h2 class="bali-home-event-title">${esc(event.title || "BALI Night")}</h2>
          <p class="bali-home-event-description">${esc(description)}</p>
          <div class="bali-home-event-counts">
            <button class="bali-home-count" type="button" data-home-list="participants">${inlineIcon("people", eventUi.participantsIcon)}${number(total)} ${esc(eventUi.participants || "участников")}</button>
            <button class="bali-home-count" type="button" data-home-list="friends">${inlineIcon("people", eventUi.friendsIcon)}${number(state.friends.length)} ${esc(eventUi.friends || "друзей")}</button>
            <button class="bali-home-count" type="button" data-home-list="clans">${inlineIcon("clan", eventUi.clansIcon)}${number(state.eventClans.length)} ${esc(eventUi.clans || "клана")}</button>
          </div>
          <div class="bali-home-event-actions">
            <button class="bali-home-join" type="button" data-home-join="${esc(event.id)}">${eventUi.joinIcon ? inlineIcon("arrow", eventUi.joinIcon, "bali-home-action-leading") : ""}${esc(eventUi.join || "Я иду")} ${inlineIcon("arrow", arrowIcon, "bali-home-action-arrow")}</button>
            <button class="bali-home-book" type="button" data-home-book="${esc(event.id)}">${eventUi.bookIcon ? inlineIcon("calendar", eventUi.bookIcon, "bali-home-action-leading") : ""}${esc(eventUi.book || "Забронировать")}</button>
          </div>
          <section class="bali-home-reference-checkin">
            <div class="bali-home-checkin-copy"><span class="eyebrow">${esc(checkin.eyebrow || "Я УЖЕ В BALI")}</span><h3>${esc(checkin.title || "Подтвердить вход")}</h3><p>${esc(checkin.text || "Отсканируйте QR-код события, чтобы посещение попало в профиль и рейтинг.")}</p></div>
            ${iconHtml("qr", "bali-home-checkin-qr", checkin.icon)}
            <button class="bali-home-scan" type="button" data-open-event-qr>${esc(checkin.button || "Сканировать QR-код")}</button>
          </section>
        </div>
        <button class="bali-home-people-link" type="button" data-home-list="participants">${inlineIcon("people", eventUi.peopleIcon)}${esc(eventUi.people || "Посмотреть людей и кланы")}</button>
      </div>
    </section>`;
  }

  function renderBooking(design) {
    const config = design.booking || {};
    const booking = state.booking;
    if (!booking) {
      return `<section class="bali-home-booking-strip">
        ${iconHtml("calendar", "bali-home-strip-icon", config.icon)}
        <div class="bali-home-booking-copy"><small>${esc(config.title || "Ближайшее бронирование")}</small><strong>${esc(config.empty || "У вас пока нет активной брони")}</strong></div>
        <button class="bali-home-booking-open" type="button" data-home-book="${esc(state.event?.id || "")}">${esc(config.choose || "Выбрать")}</button>
      </section>`;
    }
    return `<section class="bali-home-booking-strip">
      ${iconHtml("calendar", "bali-home-strip-icon", config.icon)}
      <div class="bali-home-booking-copy"><small>${esc(config.title || "Ближайшее бронирование")}</small><strong>${esc(bookingDateText(booking.booking_date))} · ${esc(booking.booking_time || "23:00")} · ${esc(booking.table_name || "Стол")}</strong></div>
      <button class="bali-home-booking-open" type="button" data-page="profile">${esc(config.open || "Открыть")}</button>
    </section>`;
  }

  function renderSocial(design) {
    const contacts = design.contacts || {};
    const arrowIcon = design.controls?.arrowIcon || "";
    const links = [
      { title:contacts.instagram?.title || "Instagram", subtitle:contacts.instagram?.subtitle || "Новости и атмосфера", href:externalHref(contacts.instagram?.href, "https://www.instagram.com/bali.minsk/"), icon:"contact", custom:contacts.instagram?.icon },
      { title:contacts.telegram?.title || "Telegram-канал", subtitle:contacts.telegram?.subtitle || "Сообщество, афиши и новости", href:externalHref(contacts.telegram?.href, "https://t.me/bali_minsk"), icon:"contact", custom:contacts.telegram?.icon },
      { title:contacts.tiktok?.title || "TikTok", subtitle:contacts.tiktok?.subtitle || "Видео из BALI", href:externalHref(contacts.tiktok?.href, "https://www.tiktok.com/"), icon:"game", custom:contacts.tiktok?.icon }
    ];
    return `<section class="bali-home-reference-social">
      <h3 class="bali-home-section-label">${esc(design.social?.heading || "СОЦСЕТИ")}</h3>
      <div class="bali-home-social-grid">${links.map(row => `<a class="bali-home-social-link" href="${esc(row.href)}" target="_blank" rel="noopener noreferrer">
        ${iconHtml(row.icon, "bali-home-link-icon", row.custom)}
        <span><strong>${esc(row.title)}</strong><small>${esc(row.subtitle)}</small></span>
        ${inlineIcon("arrow", arrowIcon)}
      </a>`).join("")}</div>
    </section>`;
  }

  function renderBottom(design) {
    const contacts = design.contacts || {};
    const about = design.about || {};
    const arrowIcon = design.controls?.arrowIcon || "";
    const phoneText = contacts.phone?.subtitle || window.BALI_CONFIG?.venuePhone || "+375 29 670-03-00";
    const phoneHref = String(contacts.phone?.href || window.BALI_CONFIG?.venuePhone || phoneText).replace(/[^+\d]/g, "");
    const mapHref = externalHref(contacts.map?.href, "https://yandex.by/maps/?text=%D0%9A%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%2013%20%D0%9C%D0%B8%D0%BD%D1%81%D0%BA");
    const managerHref = externalHref(contacts.manager?.href, "https://t.me/bali_minsk");
    return `<section class="bali-home-bottom-grid">
      <a class="bali-home-bottom-card bali-home-reference-map" href="${esc(mapHref)}" target="_blank" rel="noopener noreferrer">
        <h3 class="bali-home-section-label">${esc(contacts.map?.heading || "КАК НАС НАЙТИ")}</h3>
        ${iconHtml("map", "bali-home-link-icon", contacts.map?.icon)}
        <span><strong>${esc(contacts.map?.title || "Клуб BALI")}</strong><small>${esc(contacts.map?.subtitle || "Кирова, 13, Минск")}</small></span>
        ${inlineIcon("arrow", arrowIcon)}
      </a>
      <a class="bali-home-bottom-card bali-home-reference-contact" href="${esc(managerHref)}" target="_blank" rel="noopener noreferrer">
        <h3 class="bali-home-section-label">${esc(contacts.manager?.heading || "СВЯЗАТЬСЯ С BALI")}</h3>
        ${iconHtml("contact", "bali-home-link-icon", contacts.manager?.icon)}
        <span><strong>${esc(contacts.manager?.title || "Связаться с менеджером")}</strong><small>${esc(contacts.manager?.subtitle || "Личный чат в Telegram")}</small></span>
        ${inlineIcon("arrow", arrowIcon)}
      </a>
      <a class="bali-home-bottom-card bali-home-reference-phone" href="tel:${esc(phoneHref)}">
        <h3 class="bali-home-section-label">${esc(contacts.phone?.heading || "ТЕЛЕФОН")}</h3>
        ${iconHtml("phone", "bali-home-link-icon", contacts.phone?.icon)}
        <span><strong>${esc(contacts.phone?.title || "Позвонить")}</strong><small>${esc(phoneText)}</small></span>
        ${inlineIcon("arrow", arrowIcon)}
      </a>
      <button class="bali-home-bottom-card bali-home-reference-about" type="button" data-open-venue-details>
        <h3 class="bali-home-section-label">${esc(about.heading || "О ЗАВЕДЕНИИ")}</h3>
        ${iconHtml("venue", "bali-home-link-icon", about.icon)}
        <span><strong class="bali-home-about-title">${esc(about.title || "О клубе BALI")}</strong><small>${esc(about.text || "Подробнее о заведении, фотографии и видео")}</small></span>
        ${inlineIcon("arrow", arrowIcon)}
      </button>
    </section>`;
  }

  function ensureDialog() {
    let dialog = document.getElementById("baliHomeListDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "baliHomeListDialog";
    dialog.className = "bali-home-list-dialog";
    dialog.innerHTML = `<div class="bali-home-list-sheet">
      <header class="bali-home-list-head"><div><small id="baliHomeListEyebrow"></small><h2 id="baliHomeListTitle"></h2></div><button class="bali-home-list-close" type="button" data-home-list-close aria-label="Закрыть">×</button></header>
      <div class="bali-home-list-body" id="baliHomeListBody"></div>
    </div>`;
    document.body.appendChild(dialog);
    return dialog;
  }

  function participantRow(row) {
    const profileId = socialPeople().find(person => String(person.name || "").toLowerCase() === String(row.name || "").toLowerCase())?.id || row.id;
    const tag = profileId ? "button" : "article";
    const profileAttr = profileId ? ` type="button" data-person-profile="${esc(profileId)}"` : "";
    return `<${tag} class="bali-home-list-row"${profileAttr}>
      ${avatarHtml(row)}
      <span><strong>${esc(row.name || "Гость BALI")}</strong><small>${esc(row.detail || "Участник события")}</small></span>
      <span class="bali-home-list-meta">${Number(row.partySize || 1) > 1 ? `+${number(Number(row.partySize) - 1)}` : "BALI"}</span>
    </${tag}>`;
  }

  function clanRow(row) {
    return `<article class="bali-home-list-row">
      <span class="bali-home-list-avatar">${esc(initials(row.name))}</span>
      <span><strong>${esc(row.name)}</strong><small>${esc(row.type)} · ${number(row.memberCount)} участников</small></span>
      <span class="bali-home-list-meta">${number(row.rating)} очков</span>
    </article>`;
  }

  function openList(type) {
    const meta = LIST_META[type] || LIST_META.participants;
    const rows = type === "friends" ? state.friends : type === "clans" ? state.eventClans : state.participants;
    const dialog = ensureDialog();
    document.getElementById("baliHomeListEyebrow").textContent = meta.eyebrow;
    document.getElementById("baliHomeListTitle").textContent = `${meta.title} · ${type === "participants" ? number(participantTotal(state.event, state.participants)) : number(rows.length)}`;
    document.getElementById("baliHomeListBody").innerHTML = rows.length
      ? rows.map(row => type === "clans" ? clanRow(row) : participantRow(row)).join("")
      : `<div class="empty">Список пока пуст</div>`;
    if (!dialog.open) dialog.showModal();
  }

  function toast(message) {
    const node = document.getElementById("toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2200);
  }

  function joinEvent(eventId) {
    if (!eventId) return;
    const profile = game.profile();
    const all = read("bali_event_rsvps_v1", {});
    all[eventId] ||= {};
    const current = all[eventId][profile.id];
    if (current?.status === "checked_in") {
      toast("Ваш вход на это событие уже подтверждён");
      return;
    }
    all[eventId][profile.id] = {
      user_key:profile.id,
      name:profile.name,
      status:"going",
      attendance_mode:"general_admission",
      updated_at:new Date().toISOString()
    };
    localStorage.setItem("bali_event_rsvps_v1", JSON.stringify(all));
    window.dispatchEvent(new CustomEvent("bali:rsvp-changed", { detail:{ eventId } }));
    toast("Готово: вы идёте на событие");
  }

  function openEvent(eventId, booking = false) {
    if (!eventId) return;
    window.BaliFastEventDialog?.openEvent?.(eventId);
    if (booking) {
      setTimeout(() => window.BaliFastEventVisuals?.renderHallMap?.(), 40);
      setTimeout(() => {
        window.BaliFastEventVisuals?.renderHallMap?.();
        document.getElementById("bookingForm")?.scrollIntoView({ behavior:"smooth", block:"start" });
      }, 180);
    }
  }

  async function render() {
    const token = ++state.renderToken;
    const inner = document.querySelector('[data-screen="home"] .inner');
    if (!inner) return false;
    const design = window.BaliHomeDesign?.read?.() || { brand:{}, hero:{}, checkin:{}, contacts:{}, global:{} };
    const [events, bookings] = await Promise.all([store.list("events"), store.list("bookings")]);
    if (token !== state.renderToken) return false;
    const event = events.filter(eventIsActive).sort((left, right) => eventDateTime(left) - eventDateTime(right))[0]
      || events.filter(row => row.active !== false).sort((left, right) => eventDateTime(left) - eventDateTime(right))[0]
      || null;
    state.event = event;
    state.participants = eventParticipants(event, bookings);
    state.friends = friendParticipants(state.participants);
    state.eventClans = currentEventClans();
    state.booking = findBooking(bookings);
    const rankings = rankingData();
    const total = participantTotal(event, state.participants);
    const heroImage = design.hero?.backgroundImage || "./assets/bali-temple/hero-stone-face.webp";
    let root = inner.querySelector(":scope > .bali-home-reference");
    if (!root) {
      root = document.createElement("div");
      root.className = "bali-home-reference";
      inner.prepend(root);
    }
    root.style.setProperty("--bali-home-hero-image", `url("${String(heroImage).replaceAll('"', '\\"')}")`);
    root.style.setProperty("--bali-home-lime", design.global?.accent || "#c6ff00");
    root.style.color = design.global?.text || "#f5f7f5";
    root.closest('[data-screen="home"]')?.style.setProperty("background", design.global?.pageBackground || "#060707");
    root.innerHTML = `<section class="bali-home-reference-hero">
      <span class="eyebrow">${esc(design.hero?.eyebrow || "ЕДИНОЕ ПРИЛОЖЕНИЕ БАЛИ")}</span>
      <h1>${esc(design.hero?.title || "BALI")}</h1>
      <p>${esc(design.hero?.text || "BALI — приложение ночного клуба и комьюнити людей, объединённых музыкой, любимыми диджеями, артистами и яркими вечеринками.")}</p>
    </section>
    <section class="bali-home-reference-stats">${renderStats(rankings, design)}</section>
    ${renderEvent(event, total, design)}
    ${renderBooking(design)}
    ${renderSocial(design)}
    ${renderBottom(design)}`;
    applyBlockStyle(root, ".bali-home-reference-hero", design.hero);
    applyBlockStyle(root, ".bali-home-reference-checkin", design.checkin);
    applyBlockStyle(root, ".bali-home-reference-social", design.contacts);
    applyBlockStyle(root, ".bali-home-reference-map", design.contacts);
    applyBlockStyle(root, ".bali-home-reference-contact", design.contacts);
    applyBlockStyle(root, ".bali-home-reference-phone", design.contacts);
    applyBlockStyle(root, ".bali-home-reference-about", design.about);
    inner.classList.add("bali-home-reference-active");
    inner.querySelector(":scope > #clubLinks")?.remove();
    applyBrand(design);
    window.BaliVisualBlocks?.applyAll?.();
    return true;
  }

  document.addEventListener("click", event => {
    const list = event.target.closest("[data-home-list]");
    if (list) {
      event.preventDefault();
      event.stopPropagation();
      openList(list.dataset.homeList);
      return;
    }
    if (event.target.closest("[data-home-list-close]")) {
      event.preventDefault();
      document.getElementById("baliHomeListDialog")?.close();
      return;
    }
    const open = event.target.closest("[data-home-open-event]");
    if (open) {
      event.preventDefault();
      event.stopPropagation();
      openEvent(open.dataset.homeOpenEvent);
      return;
    }
    const join = event.target.closest("[data-home-join]");
    if (join) {
      event.preventDefault();
      event.stopPropagation();
      joinEvent(join.dataset.homeJoin);
      return;
    }
    const book = event.target.closest("[data-home-book]");
    if (book) {
      event.preventDefault();
      event.stopPropagation();
      openEvent(book.dataset.homeBook || state.event?.id, true);
    }
  }, true);

  let refreshTimer = 0;
  const schedule = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(render, 60);
  };
  [
    "bali:full-demo-enhancements-ready",
    "bali:data-changed",
    "bali:beta4-changed",
    "bali:points-changed",
    "bali:home-design-changed",
    "bali:social-changed",
    "bali:clans-changed",
    "bali:rsvp-changed",
    "bali:checkin-complete",
    "bali:demo-user-changed"
  ].forEach(name => window.addEventListener(name, schedule));
  window.addEventListener("storage", event => {
    if (["bali_event_rsvps_v1", "bali_event_checkins_v1", "bali_bookings_v2", "bali_clans_integrated_demo_v1"].includes(event.key)) schedule();
  });

  ensureDialog();
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    render().then(ready => {
      if (ready || attempts > 80) clearInterval(timer);
    });
  }, 80);

  window.BaliHomeReferencePage = { render, openList, state };
})();
