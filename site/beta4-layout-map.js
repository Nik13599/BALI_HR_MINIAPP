(() => {
  if (window.__BALI_BETA4_MAP__) return;
  window.__BALI_BETA4_MAP__ = true;

  const store = window.BaliStore;
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[char]));
  const clamp = value => Math.max(3, Math.min(97, Number(value ?? 50)));

  let busy = false;
  let currentLayout = null;

  function fitMapToImage(map, source, fullscreen = false) {
    if (!map || !source) return;
    map.classList.add("has-background");
    map.style.backgroundImage = `url("${String(source).replace(/"/g, "%22")}")`;

    const image = new Image();
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) return;
      const ratio = image.naturalWidth / image.naturalHeight;
      map.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;

      if (fullscreen) {
        const availableWidth = Math.max(280, window.innerWidth - 12);
        const availableHeight = Math.max(280, window.innerHeight - 116);
        let width = availableWidth;
        let height = width / ratio;
        if (height > availableHeight) {
          height = availableHeight;
          width = height * ratio;
        }
        map.style.width = `${Math.floor(width)}px`;
        map.style.height = `${Math.floor(height)}px`;
      }
    };
    image.src = source;
  }

  function tableButtons(tables, selectedId) {
    return tables.map(table => {
      const shape = ["round", "square", "vip"].includes(table.shape) ? table.shape : "round";
      const selected = String(table.id) === String(selectedId);
      return `<button type="button" class="booking-map-table ${shape} ${selected ? "selected" : ""}" style="left:${clamp(table.x)}%;top:${clamp(table.y)}%" data-table="${esc(table.id)}" ${table.available ? "" : "disabled"}><strong>${esc(table.name || table.id)}</strong><small>${Number(table.seats || 4)} мест</small></button>`;
    }).join("");
  }

  function closeFullscreen() {
    document.getElementById("bookingLayoutFullscreen")?.remove();
    document.documentElement.classList.remove("layout-fullscreen-open");
  }

  function openFullscreen() {
    if (!currentLayout) return;
    closeFullscreen();

    const selectedId = document.getElementById("bookingForm")?.elements.table_id?.value || currentLayout.selectedId || "";
    const overlay = document.createElement("section");
    overlay.id = "bookingLayoutFullscreen";
    overlay.className = "booking-layout-fullscreen";
    overlay.innerHTML = `<header class="booking-layout-fullscreen-head"><div><span>СХЕМА МЕРОПРИЯТИЯ</span><strong>Выберите стол</strong></div><button type="button" data-close-full-layout aria-label="Закрыть">×</button></header><div class="booking-layout-fullscreen-stage"><div class="booking-layout-map booking-layout-map-full" id="bookingLayoutMapFull">${tableButtons(currentLayout.tables, selectedId) || '<div class="booking-layout-empty">Раскладка ещё не настроена.</div>'}</div></div><footer class="booking-layout-fullscreen-foot"><div class="booking-layout-legend"><span><i></i>Свободен</span><span><i class="busy"></i>Занят</span><span><i class="vip"></i>VIP</span></div><p>Нажмите на свободный стол. Схема показана полностью, без обрезки.</p></footer>`;
    document.body.appendChild(overlay);
    document.documentElement.classList.add("layout-fullscreen-open");
    fitMapToImage(document.getElementById("bookingLayoutMapFull"), currentLayout.background, true);
  }

  async function draw(force = false) {
    const root = document.getElementById("tableChoices");
    const form = document.getElementById("bookingForm");
    if (!root || !form || (!force && root.querySelector(".booking-layout-map")) || busy) return;

    const eventId = form.elements.event_id?.value;
    const date = form.elements.booking_date?.value;
    if (!eventId || !date) return;

    busy = true;
    try {
      const layouts = read("bali_event_layouts_v1", {});
      const eventLayout = layouts[eventId] || {};
      const baseLayout = read("bali_hall_layout_config_v1", {});
      const sourceTables = eventLayout.tables?.length ? eventLayout.tables : await store.list("hall_tables");
      const bookings = (await store.list("bookings")).filter(row =>
        !["cancelled", "completed"].includes(row.status) &&
        (row.event_id === eventId || (!row.event_id && row.booking_date === date))
      );
      const occupied = new Set(bookings.map(row => String(row.table_id)));
      const selectedId = form.elements.table_id?.value || "";
      const tables = sourceTables
        .filter(row => row.active !== false)
        .map(row => ({ ...row, available: !occupied.has(String(row.id)) }));
      const selected = tables.find(row => String(row.id) === String(selectedId));
      const background = eventLayout.background || baseLayout.image || "";

      currentLayout = { eventId, date, tables, selectedId, background };

      root.innerHTML = `<div class="booking-layout-shell booking-layout-fullbleed"><button type="button" class="booking-layout-expand" data-open-full-layout>⛶ Открыть схему на весь экран</button><div class="booking-layout-scroll" data-open-full-layout><div class="booking-layout-map" id="bookingLayoutMap">${tableButtons(tables, selectedId) || '<div class="booking-layout-empty">Раскладка этого мероприятия ещё не настроена.</div>'}</div></div><div class="booking-layout-legend"><span><i></i>Свободен</span><span><i class="busy"></i>Занят</span><span><i class="vip"></i>VIP</span></div><div class="booking-layout-selected">${selected ? `Выбран: <strong>${esc(selected.name || selected.id)}</strong> · ${Number(selected.seats || 4)} мест` : "Нажмите на схему, чтобы открыть её на весь экран"}</div></div>`;
      fitMapToImage(document.getElementById("bookingLayoutMap"), background, false);

      const title = root.closest("label")?.querySelector(":scope > span");
      if (title) title.textContent = "Полная схема расположения столов";
    } finally {
      busy = false;
    }
  }

  document.addEventListener("click", event => {
    if (event.target.closest("[data-event]")) {
      setTimeout(() => draw(true), 80);
      setTimeout(() => draw(true), 280);
    }
    if (event.target.closest("[data-open-full-layout]")) {
      event.preventDefault();
      openFullscreen();
      return;
    }
    if (event.target.closest("[data-close-full-layout]")) {
      event.preventDefault();
      closeFullscreen();
      return;
    }
    const table = event.target.closest("#bookingLayoutFullscreen [data-table]");
    if (table && !table.disabled) {
      setTimeout(() => {
        closeFullscreen();
        draw(true);
      }, 80);
      return;
    }
    if (event.target.closest("#tableChoices [data-table]")) setTimeout(() => draw(true), 0);
  });

  window.addEventListener("resize", () => {
    if (document.getElementById("bookingLayoutFullscreen")) openFullscreen();
  });
  window.addEventListener("bali:data-changed", () => setTimeout(() => draw(true), 80));
})();