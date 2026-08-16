(() => {
  const store = window.BaliStore;
  if (!store) return;
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const ownerKey = () => tgUser?.id ? `tg:${tgUser.id}` : (localStorage.getItem("bali_guest_booking_owner_v1") || "");
  const isActive = (row) => !["cancelled", "completed"].includes(row.status);
  const statusName = (status) => ({ pending: "Ожидает подтверждения", confirmed: "Подтверждено", seated: "Гости в клубе" })[status] || status || "Ожидает";

  function injectStyles() {
    if (document.getElementById("upcomingBookingStyle")) return;
    const style = document.createElement("style");
    style.id = "upcomingBookingStyle";
    style.textContent = `.next-booking-card{margin:18px 0 14px;padding:17px;border:1px solid rgba(200,255,61,.28);border-radius:19px;background:linear-gradient(135deg,rgba(200,255,61,.11),rgba(255,255,255,.025))}.next-booking-card>span{display:block;color:var(--lime);font-size:9px;font-weight:900;letter-spacing:.12em}.next-booking-card h3{margin:8px 0 4px;font-size:19px}.next-booking-card p{margin:0;color:var(--muted);font-size:11px;line-height:1.55}.next-booking-meta{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}.next-booking-meta b{padding:7px 9px;border-radius:999px;background:rgba(255,255,255,.06);font-size:9px}.next-booking-empty{margin:18px 0 14px;padding:14px;border:1px dashed rgba(255,255,255,.12);border-radius:16px;color:var(--muted);font-size:11px}`;
    document.head.appendChild(style);
  }

  async function render() {
    const host = document.querySelector("#myBookings .my-bookings-card");
    if (!host) return;
    host.querySelector("[data-next-booking]")?.remove();
    const key = ownerKey();
    if (!key) {
      host.querySelector(".my-bookings-list")?.insertAdjacentHTML("beforebegin", '<div class="next-booking-empty" data-next-booking>После первой брони здесь появится ближайшее посещение.</div>');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const rows = (await store.list("bookings"))
      .filter((row) => row.owner_key === key && row.booking_date >= today && isActive(row))
      .sort((a, b) => `${a.booking_date}T${a.booking_time || "23:00"}`.localeCompare(`${b.booking_date}T${b.booking_time || "23:00"}`));
    const booking = rows[0];
    const list = host.querySelector(".my-bookings-list");
    if (!booking) {
      list?.insertAdjacentHTML("beforebegin", '<div class="next-booking-empty" data-next-booking>Ближайших бронирований пока нет.</div>');
      return;
    }
    const tables = await store.list("hall_tables");
    const table = tables.find((item) => item.id === booking.table_id);
    const tableName = booking.table_name || table?.name || booking.table_id || "Стол";
    list?.insertAdjacentHTML("beforebegin", `<article class="next-booking-card" data-next-booking><span>БЛИЖАЙШЕЕ БРОНИРОВАНИЕ</span><h3>${esc(tableName)}</h3><p>${formatDate(booking.booking_date)} · ${esc(booking.booking_time || "23:00")} · ${Number(booking.guests || 0)} гостей</p><div class="next-booking-meta"><b>${esc(statusName(booking.status))}</b>${booking.booking_reference ? `<b>${esc(booking.booking_reference)}</b>` : ""}</div></article>`);
  }

  injectStyles();
  const wait = () => document.getElementById("myBookingsList") ? render() : setTimeout(wait, 100);
  wait();
  window.addEventListener("bali:data-changed", (event) => { if (!event.detail?.table || event.detail.table === "bookings") render(); });
  window.addEventListener("bali:customer-session", render);
})();