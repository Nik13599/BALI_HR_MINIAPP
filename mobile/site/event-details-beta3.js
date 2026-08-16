(() => {
  const tableLabel = (name = "") => String(name).replace(/^Стол\s*/i, "").replace(/^VIP\s*/i, "VIP ");

  function ensureDialog() {
    if (document.getElementById("eventDetailsDialog")) return;
    document.body.insertAdjacentHTML("beforeend", '<dialog class="event-details-dialog" id="eventDetailsDialog"><div class="event-details-sheet" id="eventDetailsSheet"></div></dialog>');
  }

  function setHallBackground(node, layout) {
    const image = layout?.background || "";
    if (!node || !image) return;
    const safe = String(image).replace(/\\/g, "\\\\").replace(/'/g, "%27");
    node.style.backgroundImage = `radial-gradient(circle at 50% 42%,rgba(200,255,61,.09),transparent 34%),linear-gradient(145deg,rgba(18,18,16,.82),rgba(8,10,9,.91)),url('${safe}')`;
    node.style.backgroundSize = "auto,auto,contain";
    node.style.backgroundPosition = "center,center,center";
    node.style.backgroundRepeat = "no-repeat,no-repeat,no-repeat";
  }

  async function chooseTable(eventDate, tableId = "") {
    document.getElementById("eventDetailsDialog")?.close();
    const dateInput = document.getElementById("bookingDate");
    dateInput.value = eventDate;
    state.selectedTable = tableId || null;
    await loadAvailability();
    if (tableId && state.availability.some((table) => table.id === tableId && table.available)) {
      state.selectedTable = tableId;
      renderHall();
    }
    document.getElementById("booking")?.scrollIntoView({ behavior: "smooth", block: "start" });
    haptic("medium");
  }

  async function openEvent(eventId) {
    const event = state.events.find((item) => item.id === eventId);
    if (!event) return;
    ensureDialog();
    const layout = await window.BaliEventLayouts?.getForEvent?.(event);
    const availability = (await store.getAvailability(event.event_date, event.id)).sort((a, b) => String(a.name).localeCompare(String(b.name), "ru", { numeric: true }));
    const free = availability.filter((table) => table.available);
    const imageStyle = event.image_url ? `background-image:url('${esc(event.image_url)}')` : "";
    const sheet = document.getElementById("eventDetailsSheet");
    sheet.innerHTML = `<button class="event-details-close" type="button" data-event-close>×</button>
      <section class="event-details-hero" style="${imageStyle}"></section>
      <div class="event-details-body">
        <section class="event-details-heading"><span class="eyebrow">BALI · ${formatDate(event.event_date)} · ${esc(event.event_time || "23:00")}</span><h2>${esc(event.title)}</h2><p>${free.length ? `${free.length} свободных столов из ${availability.length}` : "Свободных столов сейчас нет"}</p></section>
        <section class="event-description"><h3>О мероприятии</h3><p>${esc(event.description || "Специальная клубная ночь BALI с музыкой, баром и атмосферой до утра.")}</p></section>
        <section class="event-club-format"><h3>Клубный формат BALI</h3><p>Бронь столика — только один из вариантов отдыха. В BALI работает контактный бар: можно знакомиться, общаться, танцевать и провести яркую ночь даже без отдельного столика. Если столы заняты, клубный формат всё равно остаётся доступным.</p></section>
        <section class="event-availability"><div class="event-availability-head"><div><span class="eyebrow">РАССАДКА НА ${formatDate(event.event_date).toUpperCase()}</span><h3>Свободные места</h3></div><span>${free.length}/${availability.length} свободно</span></div>
          ${layout?.ready && availability.length ? `<div class="event-hall-map" id="eventHallMap">${availability.map((table) => `<button type="button" class="event-table ${esc(table.shape || "round")} ${table.available ? "free" : "booked"}" style="left:${Number(table.x)}%;top:${Number(table.y)}%" data-event-table="${table.id}" ${table.available ? "" : "disabled"}><b>${esc(tableLabel(table.name))}</b><small>${table.available ? "свободен" : "занят"}</small></button>`).join("")}</div>` : '<div class="event-no-tables">Индивидуальная схема мероприятия пока не опубликована.</div>'}
          <small class="event-format-note">Нажмите на свободный стол, чтобы сразу выбрать его в форме бронирования.</small></section>
        <div class="event-details-actions"><button class="primary" type="button" data-event-book>Перейти к бронированию</button><button class="secondary" type="button" data-event-close>Закрыть</button></div>
      </div>`;
    setHallBackground(document.getElementById("eventHallMap"), layout);
    sheet.querySelectorAll("[data-event-close]").forEach((button) => button.addEventListener("click", () => document.getElementById("eventDetailsDialog").close()));
    sheet.querySelector("[data-event-book]")?.addEventListener("click", () => chooseTable(event.event_date));
    sheet.querySelectorAll("[data-event-table]").forEach((button) => button.addEventListener("click", () => chooseTable(event.event_date, button.dataset.eventTable)));
    document.getElementById("eventDetailsDialog").showModal();
  }

  ensureDialog();
  document.getElementById("eventTrack")?.addEventListener("click", (event) => {
    if (event.target.closest("button,a")) return;
    const poster = event.target.closest("[data-event]");
    if (poster) openEvent(poster.dataset.event).catch((error) => toast(error.message || "Не удалось открыть событие"));
  });
})();