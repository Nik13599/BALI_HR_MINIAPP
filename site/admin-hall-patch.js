const compactTableName = (name = "") => String(name).replace(/^Стол\s*/i, "").replace(/^VIP\s*/i, "VIP ");

if (typeof editorDefinitions !== "undefined" && editorDefinitions.hall_tables) {
  editorDefinitions.hall_tables.fields = [
    ["name", "Название / номер", "text", true],
    ["seats", "Количество мест", "number", true],
    ["zone", "Зона", "text"],
    ["deposit", "Минимальный депозит, BYN", "number"],
    ["shape", "Тип", "select", true, "", [["round", "Обычный"], ["square", "Прямоугольный"], ["vip", "VIP"]]],
    ["description", "Описание для гостя", "textarea", false, "full"],
    ["active", "Показывать и использовать", "checkbox"]
  ];
}

const baseOpenEditorForHall = openEditor;
openEditor = function(type, row = null) {
  if (type === "hall_tables" && !row) {
    row = {
      name: "Новый стол",
      seats: 4,
      x: 50,
      y: 50,
      zone: "",
      description: "",
      deposit: 0,
      shape: "round",
      active: true
    };
  }
  return baseOpenEditorForHall(type, row);
};

function hallTableTitle(table) {
  const parts = [
    table.name,
    `${Number(table.seats || 0)} мест`,
    table.zone || "",
    Number(table.deposit || 0) > 0 ? `депозит ${Number(table.deposit).toLocaleString("ru-RU")} BYN` : "",
    table.description || ""
  ].filter(Boolean);
  if (table.booking) {
    parts.push(table.booking.customer_name || "Забронирован");
    if (table.booking.phone) parts.push(table.booking.phone);
  } else {
    parts.push("свободен");
  }
  return parts.join(" · ");
}

renderHall = async function(root) {
  const availability = await store.getAvailability(state.hallDate);
  availability.sort((a, b) => Number(compactTableName(a.name)) - Number(compactTableName(b.name)));
  root.innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h3>Схема зала</h3>
          <small>Загрузите картинку зала, затем добавляйте и перетаскивайте столы поверх неё.</small>
        </div>
        <div class="filter-bar">
          <input id="hallDate" type="date" value="${state.hallDate}"/>
          <button class="ghost" data-new="bookings">Создать бронь</button>
        </div>
      </div>
      <div class="panel-body">
        <div class="hall-plan-tools">
          <label class="ghost hall-plan-upload">
            <input id="hallPlanFile" type="file" accept="image/png,image/jpeg,image/webp"/>
            Загрузить схему зала
          </label>
          <button class="ghost" id="hallPlanUrl" type="button">Вставить ссылку</button>
          <button class="ghost" id="hallPlanReset" type="button">Вернуть стандартную</button>
          <span class="hall-plan-note">JPG, PNG или WEBP. Столы сохраняют положение в процентах и не смещаются на разных экранах.</span>
        </div>
        <div id="hallLayout" class="hall-layout">
          ${availability.map((table) => `
            <button
              class="table-node ${esc(table.shape || "round")} ${table.available ? "" : "booked"}"
              style="left:${Number(table.x)}%;top:${Number(table.y)}%"
              data-table-id="${table.id}"
              title="${esc(hallTableTitle(table))}">
              <b>${esc(compactTableName(table.name))}</b>
              <small>${table.seats} мест</small>
            </button>`).join("")}
        </div>
        <div class="hall-legend">
          <span><i class="legend-dot"></i>Свободен</span>
          <span><i class="legend-dot red"></i>Забронирован</span>
          <span><i class="legend-dot gold"></i>VIP</span>
          <span>Клик — бронь, двойной клик — описание и параметры, перетаскивание — положение</span>
        </div>
      </div>
    </section>`;

  await window.BaliHallPlan?.apply($("#hallLayout"));

  $("#hallDate").addEventListener("change", (event) => {
    state.hallDate = event.target.value;
    renderHall(root);
  });

  $("#hallPlanFile").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      toast("Загружаем схему…");
      await window.BaliHallPlan.uploadFile(file);
      toast("Схема зала обновлена");
      renderHall(root);
    } catch (error) {
      toast(error.message || "Не удалось загрузить схему");
    } finally {
      event.target.value = "";
    }
  });

  $("#hallPlanUrl").addEventListener("click", async () => {
    const url = prompt("Вставьте прямую ссылку на JPG, PNG или WEBP");
    if (!url) return;
    try {
      await window.BaliHallPlan.useUrl(url);
      toast("Схема зала обновлена");
      renderHall(root);
    } catch (error) {
      toast(error.message || "Не удалось использовать ссылку");
    }
  });

  $("#hallPlanReset").addEventListener("click", async () => {
    if (!confirm("Вернуть стандартную схему зала? Положение столов сохранится.")) return;
    try {
      await window.BaliHallPlan.reset();
      toast("Стандартная схема возвращена");
      renderHall(root);
    } catch (error) {
      toast(error.message || "Не удалось вернуть схему");
    }
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
      const x = Math.max(2, Math.min(98, ((event.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(2, Math.min(98, ((event.clientY - rect.top) / rect.height) * 100));
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