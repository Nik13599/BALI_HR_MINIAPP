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

  function setBackground(map, source, fullscreen = false) {
    if (!map || !source) return;
    map.classList.add("has-background");
    map.style.backgroundImage = `url("${String(source).replace(/"/g, "%22")}")`;
    map.style.backgroundPosition = "center";
    map.style.backgroundRepeat = "no-repeat";
    map.style.backgroundSize = "100% 100%";

    const image = new Image();
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) return;
      const ratio = image.naturalWidth / image.naturalHeight;
      map.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
      if (!fullscreen) return;

      const maxWidth = Math.max(280, window.innerWidth - 8);
      const maxHeight = Math.max(260, window.innerHeight - 124);
      let width = maxWidth;
      let height = width / ratio;
      if (height > maxHeight) {
        height = maxHeight;
        width = height * ratio;
      }
      map.style.width = `${Math.floor(width)}px`;
      map.style.height = `${Math.floor(height)}px`;
    };
    image.src = source;
  }

  function buttons(tables, selectedId) {
    return tables.map(table => {
      const shape = ["round", "square", "vip"].includes(table.shape) ? table.shape : "round";
      const selected = String(table.id) === String(selectedId);
      return `<button type="button" class="booking-map-table ${shape} ${selected ? "selected" : ""}" style="left:${clamp(table.x)}%;top:${clamp(table.y)}%" data-table="${esc(table.id)}" ${table.available ? "" : "disabled"}><strong>${esc(table.name || table.id)}</strong><small>${Number(table.seats || 4)} мест</small></button>`;
    }).join("");
  }

  function closeFullMap() {
    const dialog = document.getElementById("bookingLayoutFullDialog");
    if (!dialog) return;
    try { dialog.close(); } catch {}
    dialog.remove();
  }

  function openFullMap() {
    if (!currentLayout) return;
    closeFullMap();

    const selectedId = document.getElementById("bookingForm")?.elements.table_id?.value || currentLayout.selectedId || "";
    const dialog = document.createElement("dialog");
    dialog.id = "bookingLayoutFullDialog";
    dialog.style.cssText = "width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;border-radius:0;background:#050706;color:#fff;overflow:hidden";
    dialog.innerHTML = `<div style="height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto"><header style="display:flex;align-items:center;justify-content:space-between;padding:calc(10px + env(safe-area-inset-top,0px)) 12px 10px;border-bottom:1px solid rgba(255,255,255,.1);background:#080a09"><div><span style="display:block;color:#c8ff3d;font-size:8px;font-weight:900;letter-spacing:.14em">СХЕМА МЕРОПРИЯТИЯ</span><strong style="display:block;margin-top:3px;font:600 17px Unbounded">Выберите стол</strong></div><button type="button" data-close-full-map style="width:44px;height:44px;border:1px solid rgba(255,255,255,.14);border-radius:50%;background:#171c1a;color:#fff;font-size:27px">×</button></header><div style="min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:4px"><div class="booking-layout-map" id="bookingLayoutMapFull" style="flex:0 0 auto;max-width:100%;max-height:100%">${buttons(currentLayout.tables, selectedId) || '<div class="booking-layout-empty">Раскладка ещё не настроена.</div>'}</div></div><footer style="padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));border-top:1px solid rgba(255,255,255,.1);background:#080a09"><div class="booking-layout-legend"><span><i></i>Свободен</span><span><i class="busy"></i>Занят</span><span><i class="vip"></i>VIP</span></div><p style="margin:7px 0 0;color:#aeb5b0;font-size:9px">Схема показана полностью, без обрезки.</p></footer></div>`;
    document.body.appendChild(dialog);
    dialog.showModal();
    setBackground(document.getElementById("bookingLayoutMapFull"), currentLayout.background, true);
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

      currentLayout = { tables, selectedId, background };
      root.innerHTML = `<div class="booking-layout-shell" style="width:calc(100vw - 4px);margin-left:calc(50% - 50vw + 2px)"><button type="button" data-open-full-map style="width:calc(100% - 20px);min-height:46px;margin:0 10px;border:1px solid rgba(200,255,61,.3);border-radius:14px;background:rgba(200,255,61,.09);color:#c8ff3d;font-weight:900">⛶ Открыть схему на весь экран</button><div class="booking-layout-scroll" data-open-full-map style="width:100%;border-radius:0;border-left:0;border-right:0"><div class="booking-layout-map" id="bookingLayoutMap">${buttons(tables, selectedId) || '<div class="booking-layout-empty">Раскладка этого мероприятия ещё не настроена.</div>'}</div></div><div class="booking-layout-legend" style="padding:0 10px"><span><i></i>Свободен</span><span><i class="busy"></i>Занят</span><span><i class="vip"></i>VIP</span></div><div class="booking-layout-selected" style="margin:0 10px">${selected ? `Выбран: <strong>${esc(selected.name || selected.id)}</strong> · ${Number(selected.seats || 4)} мест` : "Нажмите на схему, чтобы открыть её на весь экран"}</div></div>`;
      setBackground(document.getElementById("bookingLayoutMap"), background, false);

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
    if (event.target.closest("[data-open-full-map]")) {
      event.preventDefault();
      openFullMap();
      return;
    }
    if (event.target.closest("[data-close-full-map]")) {
      event.preventDefault();
      closeFullMap();
      return;
    }
    const table = event.target.closest("#bookingLayoutFullDialog [data-table]");
    if (table && !table.disabled) {
      setTimeout(() => {
        closeFullMap();
        draw(true);
      }, 80);
      return;
    }
    if (event.target.closest("#tableChoices [data-table]")) setTimeout(() => draw(true), 0);
  });

  window.addEventListener("bali:data-changed", () => setTimeout(() => draw(true), 80));
})();