(() => {
  const OWNER_KEY = "bali_guest_booking_owner_v1";
  const phoneKey = (value = "") => String(value).replace(/\D/g, "");
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const savedOwner = () => localStorage.getItem(OWNER_KEY) || "";
  const ownerFrom = (data = {}) => tgUser?.id ? `tg:${tgUser.id}` : (phoneKey(data.phone) ? `phone:${phoneKey(data.phone)}` : savedOwner());
  const activeStatus = (status) => !["cancelled", "completed"].includes(status);
  const statusName = (status) => ({ pending: "Ожидает подтверждения", confirmed: "Подтверждено", seated: "Гости в клубе", completed: "Завершено", cancelled: "Отменено" })[status] || status;

  function injectStyles() {
    if (document.getElementById("myBookingsBeta3Style")) return;
    const style = document.createElement("style");
    style.id = "myBookingsBeta3Style";
    style.textContent = `.my-bookings-card{padding:25px 20px;border:1px solid var(--line);border-radius:28px;background:linear-gradient(145deg,#151917,#0d0f0f)}.my-bookings-card h2{margin:8px 0 6px;font-size:clamp(28px,8vw,44px)}.my-bookings-card>p{color:var(--muted);line-height:1.55}.my-bookings-list{display:grid;gap:10px;margin-top:18px}.my-booking-item{display:grid;grid-template-columns:1fr auto;gap:12px;padding:15px;border:1px solid rgba(255,255,255,.08);border-radius:18px;background:rgba(255,255,255,.025)}.my-booking-item header{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.my-booking-item header strong{font-size:14px}.my-booking-item header span{padding:5px 8px;border-radius:999px;background:rgba(200,255,61,.08);color:var(--lime);font-size:9px;font-weight:800}.my-booking-item p{margin:7px 0 0;color:var(--muted);font-size:11px;line-height:1.5}.my-booking-actions{display:flex;gap:6px;align-items:start}.my-booking-actions button{min-height:38px;padding:0 11px;border:1px solid var(--line);border-radius:11px;background:rgba(255,255,255,.04);color:#fff;font-weight:800}.my-booking-actions .cancel{color:#ff9696;border-color:rgba(255,112,112,.3)}.my-bookings-empty{padding:18px;border:1px dashed var(--line);border-radius:16px;color:var(--muted);font-size:12px;text-align:center}.my-booking-dialog .sheet{display:grid;gap:14px}.my-booking-dialog label{display:grid;gap:6px;color:var(--muted);font-size:11px;font-weight:700}.my-booking-dialog input,.my-booking-dialog select,.my-booking-dialog textarea{width:100%;min-height:49px;padding:0 13px;border:1px solid var(--line);border-radius:13px;background:rgba(255,255,255,.045);color:var(--text)}.my-booking-dialog textarea{min-height:80px;padding-top:12px}.my-booking-dialog .row{display:grid;grid-template-columns:1fr 1fr;gap:9px}@media(max-width:540px){.my-booking-item{grid-template-columns:1fr}.my-booking-actions{width:100%}.my-booking-actions button{flex:1}.my-booking-dialog .row{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
  }

  function ensureUi() {
    if (document.getElementById("myBookings")) return;
    const bookingSection = document.getElementById("booking");
    bookingSection.insertAdjacentHTML("afterend", `<section class="section" id="myBookings"><div class="my-bookings-card"><span class="eyebrow">ЛИЧНЫЙ КАБИНЕТ</span><h2>Мои брони</h2><p>Здесь можно изменить дату, время, стол, количество гостей или отменить свою бронь.</p><div class="my-bookings-list" id="myBookingsList"></div></div></section>`);
    document.body.insertAdjacentHTML("beforeend", `<dialog id="myBookingDialog" class="my-booking-dialog"><button class="close" type="button" data-my-close>×</button><form class="sheet" id="myBookingForm"><span class="eyebrow">РЕДАКТИРОВАНИЕ БРОНИ</span><h2>Изменить бронь</h2><input name="id" type="hidden"/><div class="row"><label><span>Дата</span><input name="booking_date" type="date" required/></label><label><span>Время</span><input name="booking_time" type="time" required/></label></div><label><span>Стол</span><select name="table_id" required></select></label><label><span>Количество гостей</span><input name="guests" type="number" min="1" max="30" required/></label><label><span>Комментарий</span><textarea name="comment"></textarea></label><button class="primary full" type="submit">Сохранить изменения</button></form></dialog>`);
    document.querySelector("[data-my-close]").addEventListener("click", () => document.getElementById("myBookingDialog").close());
    document.getElementById("myBookingForm").addEventListener("submit", saveEdit);
    document.getElementById("myBookingsList").addEventListener("click", handleActions);
  }

  const originalCreateBooking = store.createBooking.bind(store);
  store.createBooking = async function(data) {
    const ownerKey = ownerFrom(data);
    if (ownerKey) localStorage.setItem(OWNER_KEY, ownerKey);
    const booking = await originalCreateBooking(data);
    if (booking?.id) {
      await store.save("bookings", {
        ...booking,
        owner_key: ownerKey,
        booking_reference: booking.booking_reference || `BALI-${String(booking.id).slice(-6).toUpperCase()}`,
        telegram: data.telegram || booking.telegram || ""
      });
    }
    if (window.BaliPoints?.linkIdentity) window.BaliPoints.linkIdentity({ name: data.name, phone: data.phone, telegram: data.telegram, ownerKey });
    setTimeout(renderMyBookings, 0);
    return booking;
  };

  async function ownRows() {
    const key = ownerFrom();
    if (!key) return [];
    const rows = await store.list("bookings");
    return rows.filter((row) => row.owner_key === key).sort((a, b) => `${b.booking_date}${b.booking_time}`.localeCompare(`${a.booking_date}${a.booking_time}`));
  }

  async function renderMyBookings() {
    ensureUi();
    const rows = await ownRows();
    const root = document.getElementById("myBookingsList");
    root.innerHTML = rows.length ? rows.map((row) => `<article class="my-booking-item"><div><header><strong>${esc(row.table_name || row.table_id || "Стол")}</strong><span>${esc(statusName(row.status))}</span></header><p>${formatDate(row.booking_date)} · ${esc(row.booking_time || "23:00")} · ${Number(row.guests || 0)} гостей${row.booking_reference ? `<br>Номер: ${esc(row.booking_reference)}` : ""}</p></div><div class="my-booking-actions">${activeStatus(row.status) ? `<button type="button" data-my-edit="${row.id}">Изменить</button><button type="button" class="cancel" data-my-cancel="${row.id}">Отменить</button>` : ""}</div></article>`).join("") : '<div class="my-bookings-empty">После первой брони она появится здесь.</div>';
  }

  async function handleActions(event) {
    const edit = event.target.closest("[data-my-edit]");
    const cancel = event.target.closest("[data-my-cancel]");
    if (edit) return openEdit(edit.dataset.myEdit);
    if (cancel) {
      if (!confirm("Отменить бронирование?")) return;
      const rows = await ownRows();
      const row = rows.find((item) => item.id === cancel.dataset.myCancel);
      if (!row) return;
      await store.save("bookings", { ...row, status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by: "guest" });
      toast("Бронирование отменено");
      await loadAvailability();
      renderMyBookings();
    }
  }

  async function openEdit(id) {
    const rows = await ownRows();
    const row = rows.find((item) => item.id === id);
    if (!row) return;
    const tables = (await store.list("hall_tables")).filter((table) => table.active !== false);
    const form = document.getElementById("myBookingForm");
    form.elements.id.value = row.id;
    form.elements.booking_date.value = row.booking_date;
    form.elements.booking_time.value = row.booking_time || "23:00";
    form.elements.guests.value = Number(row.guests || 2);
    form.elements.comment.value = row.comment || "";
    form.elements.table_id.innerHTML = tables.map((table) => `<option value="${table.id}" ${table.id === row.table_id ? "selected" : ""}>${esc(table.name)} · ${Number(table.seats || 0)} мест</option>`).join("");
    document.getElementById("myBookingDialog").showModal();
  }

  async function saveEdit(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const rows = await ownRows();
    const row = rows.find((item) => item.id === data.id);
    if (!row) return;
    const all = await store.list("bookings");
    const occupied = all.some((item) => item.id !== row.id && item.booking_date === data.booking_date && item.table_id === data.table_id && activeStatus(item.status));
    if (occupied) return toast("Этот стол уже занят на выбранную дату");
    const tables = await store.list("hall_tables");
    const table = tables.find((item) => item.id === data.table_id);
    await store.save("bookings", { ...row, booking_date: data.booking_date, booking_time: data.booking_time, table_id: data.table_id, table_name: table?.name || data.table_id, guests: Number(data.guests || 1), comment: data.comment || "", updated_at: new Date().toISOString(), updated_by: "guest" });
    document.getElementById("myBookingDialog").close();
    toast("Бронирование изменено");
    await loadAvailability();
    renderMyBookings();
  }

  injectStyles();
  ensureUi();
  window.addEventListener("bali:data-changed", (event) => { if (!event.detail?.table || event.detail.table === "bookings") renderMyBookings(); });
  renderMyBookings();
})();