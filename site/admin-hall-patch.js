const compactTableName = (name = "") => String(name).replace(/^Стол\s*/i, "").replace(/^VIP\s*/i, "VIP ");

renderHall = async function(root) {
  const availability = await store.getAvailability(state.hallDate);
  availability.sort((a, b) => Number(compactTableName(a.name)) - Number(compactTableName(b.name)));
  root.innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <div><h3>Схема зала</h3><small>Реальная раскладка столов BALI. Нажмите на свободный стол для создания брони.</small></div>
        <div class="filter-bar">
          <input id="hallDate" type="date" value="${state.hallDate}"/>
          <button class="ghost" data-new="bookings">Создать бронь</button>
        </div>
      </div>
      <div class="panel-body">
        <div id="hallLayout" class="hall-layout">
          ${availability.map((table) => `
            <button
              class="table-node ${esc(table.shape || "round")} ${table.available ? "" : "booked"}"
              style="left:${Number(table.x)}%;top:${Number(table.y)}%"
              data-table-id="${table.id}"
              title="${table.booking ? `${esc(table.booking.customer_name || "Забронирован")} · ${esc(table.booking.phone || "")}` : `${esc(table.name)} · свободен`}">
              <b>${esc(compactTableName(table.name))}</b>
              <small>${table.seats} мест</small>
            </button>`).join("")}
        </div>
        <div class="hall-legend">
          <span><i class="legend-dot"></i>Свободен</span>
          <span><i class="legend-dot red"></i>Забронирован</span>
          <span><i class="legend-dot gold"></i>VIP</span>
          <span>Клик — бронь, двойной клик — параметры стола, перетаскивание — изменить положение</span>
        </div>
      </div>
    </section>`;
  $("#hallDate").addEventListener("change", (event) => {
    state.hallDate = event.target.value;
    renderHall(root);
  });
  enableHallDragging();
};

enableHallDragging = function() {
  const layout = $("#hallLayout");
  $$(".table-node", layout).forEach((node) => {
    let dragging = false;
    let moved = false;
    node.addEventListener("pointerdown", (event) => {
      dragging = true;
      moved = false;
      node.setPointerCapture(event.pointerId);
    });
    node.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      moved = true;
      const rect = layout.getBoundingClientRect();
      const x = Math.max(3, Math.min(97, ((event.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(3, Math.min(97, ((event.clientY - rect.top) / rect.height) * 100));
      node.style.left = `${x}%`;
      node.style.top = `${y}%`;
    });
    node.addEventListener("pointerup", async () => {
      if (!dragging) return;
      dragging = false;
      if (!moved) return;
      const tables = await store.list("hall_tables");
      const table = tables.find((item) => item.id === node.dataset.tableId);
      if (table) {
        await store.save("hall_tables", {
          ...table,
          x: parseFloat(node.style.left),
          y: parseFloat(node.style.top)
        });
        toast("Положение стола сохранено");
      }
    });
    node.addEventListener("dblclick", async () => {
      const tables = await store.list("hall_tables");
      openEditor("hall_tables", tables.find((item) => item.id === node.dataset.tableId));
    });
    node.addEventListener("click", () => {
      if (moved || node.classList.contains("booked")) return;
      openEditor("bookings", {
        booking_date: state.hallDate,
        table_id: node.dataset.tableId,
        status: "confirmed",
        booking_time: "23:00",
        guests: 2
      });
    });
  });
};
