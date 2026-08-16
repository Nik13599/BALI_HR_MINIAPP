const HALL_LAYOUT_STORAGE_KEY = "bali_hall_layout_config_v1";
const DEFAULT_HALL_LAYOUT = { image: "", imageName: "", updatedAt: null };
const compactTableName = (name = "") => String(name).replace(/^Стол\s*/i, "").replace(/^VIP\s*/i, "VIP ");

function ensureHallEditorStyles() {
  if (document.querySelector('link[data-hall-editor-style]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./hall-editor.css";
  link.dataset.hallEditorStyle = "true";
  document.head.appendChild(link);
}

function readHallLayoutConfig() {
  try {
    const raw = localStorage.getItem(HALL_LAYOUT_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_HALL_LAYOUT };
    return { ...DEFAULT_HALL_LAYOUT, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_HALL_LAYOUT };
  }
}

function writeHallLayoutConfig(next = {}) {
  const config = { ...DEFAULT_HALL_LAYOUT, ...(next || {}) };
  localStorage.setItem(HALL_LAYOUT_STORAGE_KEY, JSON.stringify(config));
  window.dispatchEvent(new CustomEvent("bali:data-changed", { detail: { table: "hall_layout" } }));
  return config;
}

function clearHallLayoutConfig() {
  localStorage.removeItem(HALL_LAYOUT_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("bali:data-changed", { detail: { table: "hall_layout" } }));
  return { ...DEFAULT_HALL_LAYOUT };
}

function toCssUrl(value = "") {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "%27");
}

function buildHallBackground(config) {
  if (!config?.image) return "";
  const safe = toCssUrl(config.image);
  return `radial-gradient(circle at 50% 42%, rgba(200,255,61,.08), transparent 32%), linear-gradient(145deg, rgba(19,23,22,.90), rgba(11,13,13,.94)), url('${safe}')`;
}

function formatHallLayoutCaption(config) {
  if (!config?.image) return "Стандартный фон схемы";
  const updated = config.updatedAt ? new Date(config.updatedAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
  return `${config.imageName || "Загруженная схема"} · ${updated}`;
}

async function addHallTableAt(root, x = 50, y = 50) {
  const tables = await store.list("hall_tables");
  const maxNumber = tables.reduce((max, table) => {
    const match = String(table.name || "").match(/(\d+)/);
    return Math.max(max, Number(match?.[1] || 0));
  }, 0);
  const nextTable = await store.save("hall_tables", {
    name: `Стол ${maxNumber + 1}`,
    seats: 4,
    x: Number(x.toFixed(1)),
    y: Number(y.toFixed(1)),
    shape: "round",
    active: true
  });
  state.hallAddMode = false;
  toast(`Стол ${maxNumber + 1} добавлен`);
  await renderHall(root);
  openEditor("hall_tables", nextTable);
}

ensureHallEditorStyles();
if (typeof state.hallEditMode === "undefined") state.hallEditMode = true;
if (typeof state.hallAddMode === "undefined") state.hallAddMode = false;

renderHall = async function(root) {
  const config = readHallLayoutConfig();
  const availability = await store.getAvailability(state.hallDate);
  availability.sort((a, b) => Number(compactTableName(a.name)) - Number(compactTableName(b.name)));

  root.innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h3>Схема зала</h3>
          <small>Загрузите новое изображение схемы, двигайте столы и сохраняйте изменения прямо на ходу.</small>
        </div>
        <div class="filter-bar">
          <input id="hallDate" type="date" value="${state.hallDate}"/>
          <button class="ghost ${state.hallEditMode ? "active" : ""}" id="hallEditToggle" type="button" aria-pressed="${state.hallEditMode ? "true" : "false"}">${state.hallEditMode ? "✏ Редактирование" : "👁 Просмотр"}</button>
          <button class="ghost" id="hallUploadButton" type="button">🖼 Загрузить схему</button>
          <button class="ghost" id="hallAddTableButton" type="button">➕ Добавить стол</button>
          <button class="ghost" id="hallResetButton" type="button">↺ Сбросить фон</button>
        </div>
      </div>
      <div class="panel-body hall-editor-body">
        <div class="hall-editor-meta">
          <span><strong>${state.hallEditMode ? "Редактирование" : "Просмотр"}</strong> — изменения видны сразу в бете</span>
          <span>${formatHallLayoutCaption(config)}</span>
        </div>
        <input class="hall-upload-input" id="hallUploadInput" type="file" accept="image/*" />
        <div class="hall-hint">Загрузите схему зала в PNG, JPG или WEBP. После этого можно двигать столы, менять их параметры и сразу видеть результат в гостевой части.</div>
        <div id="hallLayout" class="hall-layout ${config.image ? "has-background" : ""} ${state.hallEditMode ? "editing" : ""} ${state.hallAddMode ? "add-mode" : ""}">
          ${availability.map((table) => `
            <button
              class="table-node ${esc(table.shape || "round")} ${table.available ? "" : "booked"} ${state.hallEditMode ? "editable" : ""}"
              style="left:${Number(table.x)}%;top:${Number(table.y)}%"
              data-table-id="${table.id}"
              title="${table.booking ? `${esc(table.booking.customer_name || "Забронирован")} · ${esc(table.booking.phone || "")}` : `${esc(table.name)} · свободен`}">
              <b>${esc(compactTableName(table.name))}</b>
              <small>${table.seats} мест<br>${table.available ? "свободен" : "занят"}</small>
            </button>`).join("")}
        </div>
        <div class="hall-legend">
          <span><i class="legend-dot"></i>Свободен</span>
          <span><i class="legend-dot red"></i>Забронирован</span>
          <span><i class="legend-dot gold"></i>VIP</span>
          <span>В режиме редактирования клик по пустой зоне добавляет новый стол</span>
        </div>
      </div>
    </section>`;

  const layout = $("#hallLayout");
  if (config.image) {
    layout.style.backgroundImage = buildHallBackground(config);
    layout.style.backgroundSize = "auto, auto, cover";
    layout.style.backgroundPosition = "center, center, center";
    layout.style.backgroundRepeat = "no-repeat, no-repeat, no-repeat";
  } else {
    layout.style.removeProperty("background-image");
    layout.style.removeProperty("background-size");
    layout.style.removeProperty("background-position");
    layout.style.removeProperty("background-repeat");
  }

  $("#hallDate").addEventListener("change", (event) => {
    state.hallDate = event.target.value;
    renderHall(root);
  });

  $("#hallEditToggle").addEventListener("click", () => {
    state.hallEditMode = !state.hallEditMode;
    state.hallAddMode = false;
    renderHall(root);
  });

  $("#hallUploadButton").addEventListener("click", () => $("#hallUploadInput").click());
  $("#hallUploadInput").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      await writeHallLayoutConfig({ image: String(reader.result || ""), imageName: file.name, updatedAt: new Date().toISOString() });
      toast("Схема зала обновлена");
      await renderHall(root);
    };
    reader.readAsDataURL(file);
  });

  $("#hallResetButton").addEventListener("click", async () => {
    clearHallLayoutConfig();
    toast("Фон схемы сброшен");
    await renderHall(root);
  });

  $("#hallAddTableButton").addEventListener("click", () => {
    if (!state.hallEditMode) {
      state.hallEditMode = true;
      renderHall(root);
      return;
    }
    state.hallAddMode = true;
    toast("Нажмите на свободное место на схеме, чтобы добавить стол");
    renderHall(root);
  });

  layout.addEventListener("click", async (event) => {
    const tableNode = event.target.closest(".table-node");
    if (tableNode) return;
    if (!state.hallEditMode || !state.hallAddMode) return;
    const rect = layout.getBoundingClientRect();
    const x = Math.max(4, Math.min(96, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(8, Math.min(94, ((event.clientY - rect.top) / rect.height) * 100));
    await addHallTableAt(root, x, y);
  });

  enableHallDragging(root);
};

enableHallDragging = function(root) {
  const layout = $("#hallLayout", root);
  if (!layout) return;
  $$(".table-node", layout).forEach((node) => {
    let dragging = false;
    let moved = false;

    node.addEventListener("pointerdown", (event) => {
      if (!state.hallEditMode) return;
      dragging = true;
      moved = false;
      node.classList.add("is-dragging");
      node.setPointerCapture(event.pointerId);
    });

    node.addEventListener("pointermove", (event) => {
      if (!dragging || !state.hallEditMode) return;
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
      node.classList.remove("is-dragging");
      if (!moved) {
        const tables = await store.list("hall_tables");
        const table = tables.find((item) => item.id === node.dataset.tableId);
        if (!table) return;
        if (state.hallEditMode) {
          openEditor("hall_tables", table);
          return;
        }
        if (node.classList.contains("booked")) return;
        openEditor("bookings", {
          booking_date: state.hallDate,
          table_id: node.dataset.tableId,
          status: "confirmed",
          booking_time: "23:00",
          guests: 2
        });
        return;
      }
      const tables = await store.list("hall_tables");
      const table = tables.find((item) => item.id === node.dataset.tableId);
      if (table) {
        await store.save("hall_tables", {
          ...table,
          x: parseFloat(node.style.left),
          y: parseFloat(node.style.top)
        });
        toast("Положение стола сохранено");
        if (state.view === "hall") render();
      }
    });

    node.addEventListener("dblclick", async () => {
      const tables = await store.list("hall_tables");
      openEditor("hall_tables", tables.find((item) => item.id === node.dataset.tableId));
    });

    node.addEventListener("click", async () => {
      if (moved) return;
      if (state.hallEditMode) return;
      if (node.classList.contains("booked")) return;
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