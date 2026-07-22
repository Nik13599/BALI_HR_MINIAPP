(() => {
  if (window.__BALI_PROFILE_INVITATIONS_SPLIT__) return;
  window.__BALI_PROFILE_INVITATIONS_SPLIT__ = true;
  const social = window.BaliBeta4Social;
  if (!social) return;
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const fmt = value => value ? new Date(value).toLocaleString("ru-RU", {day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—";
  const fmtEvent = row => {
    const date = row.eventDate ? new Date(`${row.eventDate}T12:00:00`).toLocaleDateString("ru-RU", {day:"2-digit",month:"long",year:"numeric"}) : "Дата не указана";
    return `${date}${row.eventTime ? ` · ${row.eventTime}` : ""}`;
  };
  let tab = "outgoing";
  function style() {
    if (document.getElementById("profileInvitationSplitStyle")) return;
    const s = document.createElement("style");
    s.id = "profileInvitationSplitStyle";
    s.textContent = `.profile-invite-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px}.profile-invite-tabs button{min-height:44px;border:1px solid var(--line);border-radius:13px;background:#ffffff07;color:var(--muted);font-size:9px;font-weight:900}.profile-invite-tabs button.active{border-color:var(--lime);background:#c8ff3d15;color:var(--lime)}.profile-invite-summary{display:flex;justify-content:space-between;gap:8px;padding:10px 12px;border:1px solid var(--line);border-radius:13px;background:#ffffff04;color:var(--muted);font-size:8px}.profile-invite-outgoing .profile-invite-actions{display:none}`;
    document.head.appendChild(s);
  }
  function status(row) {
    return row.status === "accepted" ? ["Принято","accepted"] : row.status === "declined" ? ["Отклонено","declined"] : ["Без ответа","pending"];
  }
  function card(row, outgoing) {
    const [label, cls] = status(row);
    const person = outgoing ? row.toName : row.fromName;
    return `<article class="profile-invite-card ${outgoing ? "profile-invite-outgoing" : ""}"><header><div><h3>${esc(row.eventTitle || "Мероприятие BALI")}</h3><p>${outgoing ? "Кого пригласил: " : "Кто пригласил: "}<strong>${esc(person || "Пользователь BALI")}</strong></p></div><span class="${cls}">${label}</span></header><p>${esc(fmtEvent(row))}<br>Доступно до ${esc(fmt(social.requestEndAt(row)))}</p>${outgoing ? "" : `<div class="profile-invite-actions"><button type="button" class="secondary accept ${row.status === "accepted" ? "active" : ""}" data-profile-invite-response="${esc(row.id)}:accepted">Принять</button><button type="button" class="secondary decline ${row.status === "declined" ? "active" : ""}" data-profile-invite-response="${esc(row.id)}:declined">Отклонить</button></div>`}</article>`;
  }
  function render() {
    const root = document.getElementById("profileInvitationsBody");
    if (!root) return false;
    const incoming = social.activeIncomingRequests?.() || [];
    const outgoing = social.activeOutgoingRequests?.() || [];
    const rows = tab === "outgoing" ? outgoing : incoming;
    root.innerHTML = `<div class="profile-invite-tabs"><button type="button" class="${tab === "outgoing" ? "active" : ""}" data-profile-invite-tab="outgoing">Кого пригласил я · ${outgoing.length}</button><button type="button" class="${tab === "incoming" ? "active" : ""}" data-profile-invite-tab="incoming">Кто пригласил меня · ${incoming.length}</button></div><div class="profile-invite-summary"><span>${tab === "outgoing" ? "Здесь видно, кто согласился или отказался" : "Ответ можно изменить до завершения события"}</span><b>${rows.filter(x => x.status === "pending").length} без ответа</b></div><div class="profile-v2-list">${rows.length ? rows.map(row => card(row, tab === "outgoing")).join("") : `<div class="empty">${tab === "outgoing" ? "Вы пока никого не приглашали на актуальные мероприятия" : "Актуальных входящих приглашений пока нет"}</div>`}</div>`;
    return true;
  }
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-profile-invite-tab]");
    if (t) { tab = t.dataset.profileInviteTab; render(); }
    if (e.target.closest("[data-open-profile-invitations]")) setTimeout(render, 0);
    const response = e.target.closest("[data-profile-invite-response]");
    if (response) setTimeout(render, 0);
  }, true);
  window.addEventListener("bali:social-changed", () => document.getElementById("profileInvitationsDialog")?.open && render());
  style();
  window.BaliProfileInvitationsSplit = { render };
})();