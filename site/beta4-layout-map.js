(() => {
  if (window.__BALI_BETA4_MAP__) return;
  window.__BALI_BETA4_MAP__ = true;
  const store = window.BaliStore;
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const esc = (v = "") => String(v).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const clamp = value => Math.max(3, Math.min(97, Number(value ?? 50)));
  let busy = false;
  function applyBackground(map, source) {
    if (!map || !source) return;
    map.classList.add("has-background");
    map.style.backgroundImage = `url("${String(source).replace(/"/g, "%22")}")`;
    const image = new Image();
    image.onload = () => { if (image.naturalWidth && image.naturalHeight) map.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`; };
    image.src = source;
  }
  async function draw(force = false) {
    const root = document.getElementById("tableChoices"), form = document.getElementById("bookingForm");
    if (!root || !form || (!force && root.querySelector(".booking-layout-map")) || busy) return;
    const eventId = form.elements.event_id?.value, date = form.elements.booking_date?.value;
    if (!eventId || !date) return;
    busy = true;
    try {
      const layouts = read("bali_event_layouts_v1", {}), eventLayout = layouts[eventId] || {}, baseLayout = read("bali_hall_layout_config_v1", {});
      const sourceTables = eventLayout.tables?.length ? eventLayout.tables : await store.list("hall_tables");
      const bookings = (await store.list("bookings")).filter(row => !["cancelled","completed"].includes(row.status) && (row.event_id === eventId || (!row.event_id && row.booking_date === date)));
      const occupied = new Set(bookings.map(row => String(row.table_id))), selectedId = form.elements.table_id?.value || "";
      const tables = sourceTables.filter(row => row.active !== false).map(row => ({ ...row, available: !occupied.has(String(row.id)) }));
      const selected = tables.find(row => String(row.id) === String(selectedId));
      const buttons = tables.map(row => { const shape = ["round","square","vip"].includes(row.shape) ? row.shape : "round"; return `<button type="button" class="booking-map-table ${shape} ${String(row.id)===String(selectedId)?"selected":""}" style="left:${clamp(row.x)}%;top:${clamp(row.y)}%" data-table="${esc(row.id)}" ${row.available?"":"disabled"}><strong>${esc(row.name||row.id)}</strong><small>${Number(row.seats||4)} мест</small></button>`; }).join("");
      root.innerHTML = `<div class="booking-layout-shell"><div class="booking-layout-scroll"><div class="booking-layout-map" id="bookingLayoutMap">${buttons||'<div class="booking-layout-empty">Раскладка этого мероприятия ещё не настроена.</div>'}</div></div><div class="booking-layout-legend"><span><i></i>Свободен</span><span><i class="busy"></i>Занят</span><span><i class="vip"></i>VIP</span></div><div class="booking-layout-selected">${selected?`Выбран: <strong>${esc(selected.name||selected.id)}</strong> · ${Number(selected.seats||4)} мест`:"Нажмите на свободный стол прямо на схеме"}</div></div>`;
      applyBackground(document.getElementById("bookingLayoutMap"), eventLayout.background || baseLayout.image || "");
      const title = root.closest("label")?.querySelector(":scope > span");
      if (title) title.textContent = "Выберите стол на схеме";
    } finally { busy = false; }
  }
  document.addEventListener("click", event => {
    if (event.target.closest("[data-event]")) { setTimeout(()=>draw(true),80); setTimeout(()=>draw(true),260); }
    if (event.target.closest("#tableChoices [data-table]")) setTimeout(()=>draw(true),0);
  });
  window.addEventListener("bali:data-changed",()=>setTimeout(()=>draw(true),80));
})();