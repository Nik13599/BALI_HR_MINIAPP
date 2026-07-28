(() => {
  if (window.__BALI_HOME_BOOKING_CONTROLS__) return;
  window.__BALI_HOME_BOOKING_CONTROLS__ = true;

  const store = window.BaliStore;
  const game = window.BaliBeta4Game;
  if (!store || !game) {
    console.warn("[BALI booking] Store or profile core is not ready");
    return;
  }

  const COPY = "BALI — приложение ночного клуба и комьюнити людей, объединённых музыкой, любимыми диджеями, артистами и яркими вечеринками.";
  const esc = (v = "") => String(v).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const fmt = v => v ? new Date(`${v}T12:00:00`).toLocaleDateString("ru-RU", { day:"2-digit", month:"long", year:"numeric" }) : "—";
  const statusLabel = value => ({ pending:"Ожидает подтверждения", confirmed:"Подтверждено", seated:"Гость пришёл" })[value] || value || "Активно";
  const toast = message => {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 2400);
  };

  let renderPending = false;

  function scheduleRender() {
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(async () => {
      renderPending = false;
      applyHomeCopy();
      await renderBooking();
    });
  }

  function applyHomeCopy() {
    const hero = document.querySelector('[data-screen="home"] .hero');
    if (!hero) return;
    const h = hero.querySelector("h1");
    if (h && h.textContent.trim() !== "BALI") h.textContent = "BALI";
    const p = hero.querySelector(":scope > p");
    if (p && p.textContent.trim() !== COPY) p.textContent = COPY;
  }

  function myKeys() {
    const profile = game.profile();
    return { profile, keys:new Set(game.identityKeys(profile)) };
  }

  async function myUpcoming() {
    const { profile, keys } = myKeys();
    const today = new Date().toISOString().slice(0, 10);
    return (await store.list("bookings"))
      .filter(booking => String(booking.booking_date || "") >= today && !["cancelled", "completed"].includes(booking.status) && (
        keys.has(String(booking.owner_key || "")) ||
        String(booking.telegram_id || "") === String(profile.telegramId || "") ||
        (profile.phone && String(booking.phone || "").replace(/\D/g, "") === String(profile.phone).replace(/\D/g, ""))
      ))
      .sort((a, b) => `${a.booking_date || ""}${a.booking_time || ""}`.localeCompare(`${b.booking_date || ""}${b.booking_time || ""}`));
  }

  function ensureDialogs() {
    if (!document.getElementById("userBookingDetailsDialog")) {
      document.body.insertAdjacentHTML("beforeend", '<dialog id="userBookingDetailsDialog" class="dialog"><div class="sheet"><button class="close" type="button" data-user-booking-details-close>×</button><div id="userBookingDetailsBody"></div></div></dialog>');
    }
    if (!document.getElementById("userBookingEditDialog")) {
      document.body.insertAdjacentHTML("beforeend", '<dialog id="userBookingEditDialog" class="dialog"><div class="sheet"><button class="close" type="button" data-user-booking-close>×</button><div class="dialog-content"><span class="eyebrow">МОЁ БРОНИРОВАНИЕ</span><h2>Изменить бронь</h2><form class="booking" id="userBookingEditForm"><input name="id" type="hidden"><label><span>Дата</span><input name="booking_date" type="date" required></label><label><span>Время</span><input name="booking_time" type="time" required></label><label><span>Количество гостей</span><input name="guests" type="number" min="1" max="30" required></label><label><span>Комментарий</span><textarea name="comment"></textarea></label><button class="primary full">Сохранить изменения</button></form></div></div></dialog>');
    }
  }

  async function findBooking(id) {
    return (await store.list("bookings")).find(row => String(row.id) === String(id)) || null;
  }

  async function eventForBooking(booking) {
    const events = await store.list("events");
    return events.find(event => String(event.id) === String(booking.event_id || "")) ||
      events.find(event => String(event.event_date || "") === String(booking.booking_date || "")) || null;
  }

  async function openDetails(id) {
    ensureDialogs();
    const booking = await findBooking(id);
    if (!booking) return toast("Бронирование не найдено");
    const event = await eventForBooking(booking);
    const image = event?.image_url ? `<div class="dialog-media"><img src="${esc(event.image_url)}" alt="${esc(event.title || "Афиша BALI")}"></div>` : "";
    const title = event?.title || booking.event_title || "Бронирование BALI";
    const description = event?.details_description || event?.description || "Подробная информация о мероприятии появится здесь.";
    const body = document.getElementById("userBookingDetailsBody");
    body.innerHTML = `${image}<div class="dialog-content"><span class="eyebrow">МОЁ БЛИЖАЙШЕЕ БРОНИРОВАНИЕ</span><h2>${esc(title)}</h2><p class="detail-copy">${esc(description)}</p><section class="card"><div class="card-head"><h3>Данные бронирования</h3><span class="count">${esc(statusLabel(booking.status))}</span></div><p class="muted" style="line-height:1.8"><strong>Дата:</strong> ${fmt(booking.booking_date)}<br><strong>Время:</strong> ${esc(booking.booking_time || "23:00")}<br><strong>Стол:</strong> ${esc(booking.table_name || booking.table_id || "Не указан")}<br><strong>Гостей:</strong> ${Number(booking.guests || 0)}${booking.comment ? `<br><strong>Комментарий:</strong> ${esc(booking.comment)}` : ""}</p></section><div class="actions"><button class="primary" type="button" data-user-booking-edit="${esc(booking.id)}">Редактировать бронь</button><button class="secondary" type="button" data-user-booking-cancel="${esc(booking.id)}">Отменить бронь</button></div></div>`;
    document.getElementById("userBookingDetailsDialog").showModal();
  }

  async function renderBooking() {
    const stats = document.getElementById("profileStats");
    if (!stats) return;
    let card = document.getElementById("nextBookingCard");
    if (!card) {
      card = document.createElement("section");
      card.id = "nextBookingCard";
      card.className = "card";
      stats.insertAdjacentElement("afterend", card);
    }
    const booking = (await myUpcoming())[0];
    const nextHtml = booking ? `<div class="card-head"><h3>Ближайшее бронирование</h3><span class="count">${esc(statusLabel(booking.status))}</span></div><button class="compact-event" type="button" data-user-booking-open="${esc(booking.id)}" style="width:100%;text-align:left;border:0;color:inherit;cursor:pointer"><div class="placeholder">${esc(String(booking.table_name || booking.table_id || "B").replace(/^Стол\s*/i, ""))}</div><div><h3>${esc(booking.event_title || booking.table_name || booking.table_id || "Бронирование BALI")}</h3><p>${fmt(booking.booking_date)} · ${esc(booking.booking_time || "23:00")} · ${Number(booking.guests || 0)} гостей</p><small>Открыть подробности бронирования</small></div><span>→</span></button>` : '<div class="card-head"><h3>Ближайшее бронирование</h3></div><div class="empty">Активных бронирований пока нет</div>';
    if (card.innerHTML !== nextHtml) card.innerHTML = nextHtml;
  }

  async function openEdit(id) {
    ensureDialogs();
    const booking = await findBooking(id);
    if (!booking) return toast("Бронирование не найдено");
    document.getElementById("userBookingDetailsDialog")?.close();
    const form = document.getElementById("userBookingEditForm");
    form.elements.namedItem("id").value = booking.id;
    form.booking_date.value = booking.booking_date || "";
    form.booking_time.value = booking.booking_time || "23:00";
    form.guests.value = Number(booking.guests || 2);
    form.comment.value = booking.comment || "";
    document.getElementById("userBookingEditDialog").showModal();
  }

  async function cancel(id) {
    if (!confirm("Отменить это бронирование?")) return;
    const booking = await findBooking(id);
    if (!booking) return;
    await store.save("bookings", { ...booking, status:"cancelled", cancelled_at:new Date().toISOString(), cancelled_by:"user" });
    document.getElementById("userBookingDetailsDialog")?.close();
    toast("Бронирование отменено");
    scheduleRender();
  }

  document.addEventListener("click", event => {
    const open = event.target.closest("[data-user-booking-open]");
    if (open) { event.preventDefault(); event.stopImmediatePropagation(); openDetails(open.dataset.userBookingOpen); return; }
    const edit = event.target.closest("[data-user-booking-edit]");
    if (edit) { event.preventDefault(); event.stopImmediatePropagation(); openEdit(edit.dataset.userBookingEdit); return; }
    const cancelButton = event.target.closest("[data-user-booking-cancel]");
    if (cancelButton) { event.preventDefault(); event.stopImmediatePropagation(); cancel(cancelButton.dataset.userBookingCancel); return; }
    if (event.target.closest("[data-user-booking-close]")) document.getElementById("userBookingEditDialog")?.close();
    if (event.target.closest("[data-user-booking-details-close]")) document.getElementById("userBookingDetailsDialog")?.close();
    if (event.target.closest('[data-page="profile"]')) setTimeout(scheduleRender, 0);
  }, true);

  document.addEventListener("submit", async event => {
    if (event.target.id !== "userBookingEditForm") return;
    event.preventDefault();
    const form = event.target;
    const rows = await store.list("bookings");
    const booking = rows.find(row => String(row.id) === String(form.elements.namedItem("id").value));
    if (!booking) return;
    const conflict = rows.some(row => String(row.id) !== String(booking.id) && String(row.booking_date) === String(form.booking_date.value) && String(row.table_id) === String(booking.table_id) && !["cancelled", "completed"].includes(row.status));
    if (conflict) return toast("Этот стол уже занят на выбранную дату");
    await store.save("bookings", { ...booking, booking_date:form.booking_date.value, booking_time:form.booking_time.value, guests:Number(form.guests.value || 1), comment:form.comment.value, updated_at:new Date().toISOString(), updated_by:"user" });
    document.getElementById("userBookingEditDialog")?.close();
    toast("Бронирование обновлено");
    scheduleRender();
  }, true);

  ["bali:data-changed", "bali:beta4-changed", "bali:full-demo-ready", "bali:full-demo-enhancements-ready"]
    .forEach(name => window.addEventListener(name, scheduleRender));

  ensureDialogs();
  scheduleRender();
  window.BaliHomeBookingControls = { applyHomeCopy, renderBooking, openDetails };
})();