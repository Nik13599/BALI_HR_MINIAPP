(() => {
  if (window.__BALI_SOCIAL_PAGE__ || !window.BaliBeta4Social) return;
  window.__BALI_SOCIAL_PAGE__ = true;

  const social = window.BaliBeta4Social;
  const store = window.BaliStore;
  const tg = window.Telegram?.WebApp;
  const attendance = window.BaliEventQrAttendance;
  let tab = "all";
  let activePerson = "";
  let events = [];

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
  const initials = name => String(name || "B").trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const statusName = id => social.STATUSES.find(row => row[0] === id)?.[1] || "Открыт(а) к общению";
  const toast = message => {
    const node = document.getElementById("toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2300);
  };

  function styles() {
    if (document.getElementById("socialV2Style")) return;
    const style = document.createElement("style");
    style.id = "socialV2Style";
    style.textContent = `
      .social-tabs-v2{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:12px}
      .social-tabs-v2 button{min-height:42px;padding:0 6px;border:1px solid var(--line);border-radius:13px;background:#ffffff08;color:var(--muted);font-size:8px;line-height:1.2}
      .social-tabs-v2 button.active{background:var(--lime);color:#090b08}
      .people-v2-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .person-v2{overflow:hidden;border:1px solid var(--line);border-radius:18px;background:#111413}
      .person-v2-photo{position:relative;aspect-ratio:4/5;overflow:hidden;background:#1a1e1b}
      .person-v2-photo img{width:100%;height:100%;object-fit:cover}
      .person-v2-photo.is-locked img,.person-v2-photo.is-locked .person-v2-placeholder{filter:blur(12px);transform:scale(1.08)}
      .person-v2-placeholder{height:100%;display:grid;place-items:center;font:600 36px Unbounded;color:var(--lime)}
      .person-v2-lock{position:absolute;inset:0;display:grid;place-items:center;padding:18px;text-align:center;color:#fff;font-size:9px;line-height:1.5;background:#0004}
      .person-v2-status{position:absolute;left:8px;right:8px;bottom:8px;padding:6px 8px;border-radius:999px;background:#080a0acc;color:#fff;font-size:8px;text-align:center}
      .person-v2-body{padding:10px}.person-v2-body h3{margin:0 0 4px;font-size:13px}.person-v2-body p{margin:0;color:var(--muted);font-size:9px;line-height:1.4}
      .person-v2-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:9px}.person-v2-actions button{min-height:38px;padding:0;border-radius:11px;font-size:18px}.person-v2-actions button.active{background:var(--lime);color:#090b08}
      .social-v2-dialog{width:min(520px,calc(100% - 16px));max-height:94dvh;padding:0;border:1px solid var(--line);border-radius:23px;background:#0c0f0e;color:#fff;overflow:hidden}.social-v2-dialog::backdrop{background:#000d;backdrop-filter:blur(5px)}
      .social-v2-sheet{max-height:94dvh;overflow:auto}.social-v2-head{display:flex;justify-content:space-between;align-items:center;padding:15px;border-bottom:1px solid var(--line)}
      .social-v2-close{width:41px;height:41px;border:1px solid var(--line);border-radius:50%;background:#ffffff08;color:#fff;font-size:23px}
      .social-v2-profile{padding:14px}.social-v2-profile .person-v2-photo{border-radius:18px}.social-v2-profile h2{margin:12px 0 5px}.social-v2-profile>p{color:var(--muted);font-size:10px;line-height:1.55}.social-v2-profile .person-v2-actions{margin-top:13px}
      .social-v2-options{display:grid;gap:9px;padding:14px}.social-v2-options select{width:100%;min-height:46px;padding:0 11px;border:1px solid var(--line);border-radius:13px;background:#171b19;color:#fff}
      .social-v2-gifts{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.social-v2-gifts button{display:grid;gap:4px;padding:14px;border:1px solid var(--line);border-radius:14px;background:#ffffff08;color:#fff}.social-v2-gifts i{font-style:normal;font-size:28px}
      .social-v2-empty{padding:28px 14px;border:1px dashed var(--line);border-radius:18px;color:var(--muted);text-align:center;font-size:10px;line-height:1.6}
      @media(max-width:360px){.people-v2-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function mount() {
    const pages = document.querySelector(".pages");
    const nav = document.querySelector(".nav");
    if (!pages || !nav) return false;
    if (!document.querySelector('[data-screen="dating"]')) {
      pages.insertAdjacentHTML("beforeend", `
        <section class="page" data-screen="dating"><div class="inner">
          <div class="head"><div><span class="eyebrow">BALI PEOPLE · 18+</span><h2>Люди BALI</h2></div><span class="count">BETA</span></div>
          <div class="social-tabs-v2">
            <button class="active" data-social-v2-tab="all">Все</button>
            <button data-social-v2-tab="inside">Пришёл на мероприятие</button>
            <button data-social-v2-tab="thumbs">👍 Лайки</button>
          </div>
          <div id="socialV2Content"></div>
        </div></section>`);
    }
    if (!nav.querySelector('[data-page="dating"]')) {
      nav.classList.add("social-six");
      const button = document.createElement("button");
      button.dataset.page = "dating";
      button.innerHTML = "<i>🌴</i><span>BALI PEOPLE</span>";
      nav.insertBefore(button, nav.querySelector('[data-page="profile"]'));
    }
    ensureDialogs();
    render();
    return true;
  }

  function ensureDialogs() {
    if (document.getElementById("socialPersonDialog")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <dialog class="social-v2-dialog" id="socialPersonDialog"><div class="social-v2-sheet"><div class="social-v2-head"><strong>Профиль</strong><button class="social-v2-close" type="button" data-social-v2-close>×</button></div><div class="social-v2-profile" id="socialPersonBody"></div></div></dialog>
      <dialog class="social-v2-dialog" id="socialInviteV2"><div class="social-v2-sheet"><div class="social-v2-head"><strong>Пригласить</strong><button class="social-v2-close" type="button" data-social-v2-close>×</button></div><div class="social-v2-options"><select id="socialInviteEvent"></select><button class="secondary full" data-send-social-invite="table">🪑 Пригласить за столик</button><button class="secondary full" data-send-social-invite="event">◫ Пригласить на мероприятие</button><button class="primary full" data-send-social-invite="dance">♫ Пригласить потанцевать</button></div></div></dialog>
      <dialog class="social-v2-dialog" id="socialGiftV2"><div class="social-v2-sheet"><div class="social-v2-head"><strong>Подарок</strong><button class="social-v2-close" type="button" data-social-v2-close>×</button></div><div class="social-v2-options"><div class="social-v2-gifts">${social.GIFT_CATALOG.map(gift => `<button type="button" data-send-social-gift="${esc(gift.id)}"><i>${gift.icon}</i><strong>${esc(gift.name)}</strong><small>⭐ ${gift.stars}</small></button>`).join("")}</div></div></div></dialog>`);
  }

  function photo(person) {
    const connected = social.isConnection(person.id);
    return `<div class="person-v2-photo ${connected ? "" : "is-locked"}">${person.photo ? `<img src="${esc(person.photo)}" alt="${esc(person.name)}" style="object-position:${Number(person.cropX ?? 50)}% ${Number(person.cropY ?? 40)}%">` : `<div class="person-v2-placeholder">${esc(initials(person.name))}</div>`}${connected ? "" : '<div class="person-v2-lock">Фото откроется полностью при взаимном 👍</div>'}<span class="person-v2-status">${esc(statusName(person.status))}</span></div>`;
  }

  function card(person) {
    const mine = social.hasThumb(social.myId(), person.id);
    return `<article class="person-v2" data-open-social-person="${esc(person.id)}">${photo(person)}<div class="person-v2-body"><h3>${esc(person.name)}</h3><p>${esc(person.bio || statusName(person.status))}</p><div class="person-v2-actions"><button type="button" title="Пригласить" data-person-invite="${esc(person.id)}">＋</button><button type="button" title="Подарок" data-person-gift="${esc(person.id)}">🎁</button><button type="button" title="Палец вверх" class="${mine ? "active" : ""}" data-person-thumb="${esc(person.id)}">👍</button></div></div></article>`;
  }

  function dateAt(date, time = "00:00") {
    const value = new Date(`${String(date || "").slice(0, 10)}T${time || "00:00"}:00`);
    return Number.isNaN(value.getTime()) ? null : value;
  }

  function eventEnd(event, row = {}) {
    const startDate = event?.event_date || row.event_date || "";
    const startTime = event?.event_time || row.event_time || "23:00";
    const endTime = event?.event_end_time || event?.end_time || "06:00";
    let endDate = event?.event_end_date || event?.end_date || startDate;
    if (!event?.event_end_date && !event?.end_date && endTime <= startTime) {
      const date = dateAt(startDate, "12:00");
      if (date) {
        date.setDate(date.getDate() + 1);
        endDate = date.toISOString().slice(0, 10);
      }
    }
    return dateAt(endDate, endTime);
  }

  async function insideIds() {
    let checkins = [];
    let eventRows = [];
    try {
      [checkins, eventRows] = await Promise.all([
        attendance ? attendance.listCheckins() : Promise.resolve(Object.values(JSON.parse(localStorage.getItem("bali_event_checkins_v1") || "{}"))),
        store.list("events")
      ]);
    } catch {}
    const ids = new Set();
    checkins.filter(row => {
      if (row.left_at || row.presence_status === "left") return false;
      const event = eventRows.find(item => String(item.id) === String(row.event_id));
      const end = eventEnd(event, row);
      return Boolean(end && end.getTime() > Date.now());
    }).forEach(row => {
      if (row.user_key) ids.add(String(row.user_key));
      if (row.telegram_id) ids.add(`tg:${row.telegram_id}`);
    });
    return ids;
  }

  async function render() {
    const root = document.getElementById("socialV2Content");
    if (!root) return;
    document.querySelectorAll("[data-social-v2-tab]").forEach(button => button.classList.toggle("active", button.dataset.socialV2Tab === tab));
    const me = social.profile();
    if (!me.active || me.status === "closed") {
      root.innerHTML = '<div class="social-v2-empty">Включите BALI PEOPLE в настройках профиля и выберите статус.</div>';
      return;
    }
    let rows = social.visiblePeople();
    if (tab === "inside") {
      const ids = await insideIds();
      rows = rows.filter(person => ids.has(String(person.id)) || (person.telegramId && ids.has(`tg:${person.telegramId}`)) || (person.userKey && ids.has(String(person.userKey))));
    }
    if (tab === "thumbs") rows = social.incomingThumbs();
    root.innerHTML = rows.length
      ? `<div class="people-v2-grid">${rows.map(card).join("")}</div>`
      : `<div class="social-v2-empty">${tab === "inside" ? "Пока никто не подтвердил вход на активное мероприятие через QR-код." : tab === "thumbs" ? "Никто ещё не поставил вам 👍." : "Пользователей пока нет."}</div>`;
  }

  function person(id) {
    return social.visiblePeople().find(row => String(row.id) === String(id));
  }

  function openPerson(id) {
    const personRow = person(id);
    if (!personRow) return;
    activePerson = personRow.id;
    document.getElementById("socialPersonBody").innerHTML = `${photo(personRow)}<h2>${esc(personRow.name)}</h2><p>${esc(personRow.bio || statusName(personRow.status))}</p><div class="person-v2-actions"><button type="button" data-person-invite="${esc(personRow.id)}">＋</button><button type="button" data-person-gift="${esc(personRow.id)}">🎁</button><button type="button" class="${social.hasThumb(social.myId(), personRow.id) ? "active" : ""}" data-person-thumb="${esc(personRow.id)}">👍</button></div>`;
    document.getElementById("socialPersonDialog").showModal();
  }

  async function openInvite(id) {
    activePerson = id || activePerson;
    events = (await store.list("events")).filter(item => item.active !== false).sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)));
    document.getElementById("socialInviteEvent").innerHTML = events.map(event => `<option value="${esc(event.id)}">${esc(event.title)} · ${esc(event.event_date || "")}</option>`).join("");
    document.getElementById("socialInviteV2").showModal();
  }

  function openGift(id) {
    activePerson = id || activePerson;
    document.getElementById("socialGiftV2").showModal();
  }

  function thumb(id) {
    const result = social.toggleThumb(id);
    toast(result.connected ? "Взаимный 👍 — фото открыто" : "Отметка 👍 сохранена");
    render();
    if (document.getElementById("socialPersonDialog")?.open) openPerson(id);
  }

  async function sendGift(giftId) {
    const gift = social.GIFT_CATALOG.find(row => row.id === giftId);
    if (!gift || !activePerson) return;
    const endpoint = window.BALI_CONFIG?.socialGiftInvoiceEndpoint;
    if (endpoint && tg?.openInvoice) {
      try {
        const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ giftId, targetId: activePerson, initData: tg.initData }) });
        const data = await response.json();
        if (!data.invoiceUrl) throw new Error("Счёт не создан");
        tg.openInvoice(data.invoiceUrl, status => {
          if (status === "paid") {
            social.recordGift(activePerson, giftId, "telegram_stars");
            toast("Подарок отправлен");
          }
        });
        return;
      } catch (error) {
        toast(error.message || "Не удалось открыть оплату");
        return;
      }
    }
    if (confirm(`Отправить ${gift.icon} ${gift.name} за ${gift.stars} Stars в тестовом режиме?`)) {
      social.recordGift(activePerson, giftId, "beta_demo");
      toast("Подарок отправлен");
      document.getElementById("socialGiftV2").close();
    }
  }

  document.addEventListener("click", async event => {
    if (event.target.closest('[data-page="dating"]')) setTimeout(render, 0);
    const tabButton = event.target.closest("[data-social-v2-tab]");
    if (tabButton) {
      tab = tabButton.dataset.socialV2Tab;
      return render();
    }
    const open = event.target.closest("[data-open-social-person]");
    if (open && !event.target.closest("button")) return openPerson(open.dataset.openSocialPerson);
    const invite = event.target.closest("[data-person-invite]");
    if (invite) { event.preventDefault(); event.stopPropagation(); return openInvite(invite.dataset.personInvite); }
    const gift = event.target.closest("[data-person-gift]");
    if (gift) { event.preventDefault(); event.stopPropagation(); return openGift(gift.dataset.personGift); }
    const like = event.target.closest("[data-person-thumb]");
    if (like) { event.preventDefault(); event.stopPropagation(); return thumb(like.dataset.personThumb); }
    const send = event.target.closest("[data-send-social-invite]");
    if (send) {
      const type = send.dataset.sendSocialInvite;
      const selectedEvent = events.find(row => row.id === document.getElementById("socialInviteEvent").value);
      const result = social.sendRequest(activePerson, type, type === "event" ? selectedEvent : null);
      toast(result.ok ? "Приглашение отправлено" : result.message);
      document.getElementById("socialInviteV2").close();
    }
    const sendGiftButton = event.target.closest("[data-send-social-gift]");
    if (sendGiftButton) return sendGift(sendGiftButton.dataset.sendSocialGift);
    if (event.target.closest("[data-social-v2-close]")) event.target.closest("dialog")?.close();
  }, true);

  window.addEventListener("bali:social-changed", () => requestAnimationFrame(render));
  ["bali:data-changed", "bali:checkin-complete", "bali:checkin-left"].forEach(name => window.addEventListener(name, () => tab === "inside" && requestAnimationFrame(render)));
  styles();
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (mount() || attempts > 30) clearInterval(timer);
  }, 100);
})();