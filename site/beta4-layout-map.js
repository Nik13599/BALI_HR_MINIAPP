(() => {
  if (window.__BALI_BETA4_MAP__) return;
  window.__BALI_BETA4_MAP__ = true;
  const store = window.BaliStore;
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const esc = (v = "") => String(v).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const clamp = v => Math.max(3, Math.min(97, Number(v ?? 50)));
  let busy = false;

  function applyBackground(map, source) {
    if (!map || !source) return;
    map.classList.add("has-background");
    map.style.backgroundImage = `url("${String(source).replace(/"/g, "%22")}")`;
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth && image.naturalHeight) map.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
    };
    image.src = source;
  }

  async function draw() {
    const root = document.getElementById("tableChoices");
    const form = document.getElementById("bookingForm");
    if (!root || !form || root.querySelector(".booking-layout-map") || busy) return;
    const eventId = form.elements.event_id?.value;
    const date = form.elements.booking_date?.value;
    if (!eventId || !date) return;
    busy = true;
    try {
      const layouts = read("bali_event_layouts_v1", {});
      const eventLayout = layouts[eventId] || {};
      const baseLayout = read("bali_hall_layout_config_v1", {});
      const sourceTables = eventLayout.tables?.length ? eventLayout.tables : await store.list("hall_tables");
      const bookings = (await store.list("bookings")).filter(b => !["cancelled","completed"].includes(b.status) && (b.event_id === eventId || (!b.event_id && b.booking_date === date)));
      const occupied = new Set(bookings.map(b => String(b.table_id)));
      const selectedId = form.elements.table_id?.value || "";
      const tables = sourceTables.filter(t => t.active !== false).map(t => ({...t, available: !occupied.has(String(t.id))}));
      const selected = tables.find(t => String(t.id) === String(selectedId));
      const buttons = tables.map(t => {
        const shape = ["round","square","vip"].includes(t.shape) ? t.shape : "round";
        return `<button type="button" class="booking-map-table ${shape} ${String(t.id)===String(selectedId)?"selected":""}" style="left:${clamp(t.x)}%;top:${clamp(t.y)}%" data-table="${esc(t.id)}" ${t.available?"":"disabled"}><strong>${esc(t.name || t.id)}</strong><small>${Number(t.seats || 4)} мест</small></button>`;
      }).join("");
      root.innerHTML = `<div class="booking-layout-shell"><div class="booking-layout-scroll"><div class="booking-layout-map" id="bookingLayoutMap">${buttons || '<div class="booking-layout-empty">Раскладка этого мероприятия ещё не настроена.</div>'}</div></div><div class="booking-layout-legend"><span><i></i>Свободен</span><span><i class="busy"></i>Занят</span><span><i class="vip"></i>VIP</span></div><div class="booking-layout-selected">${selected?`Выбран: <strong>${esc(selected.name || selected.id)}</strong> · ${Number(selected.seats || 4)} мест`:"Нажмите на свободный стол прямо на схеме"}</div><div class="booking-layout-hint">Показано реальное расположение столов для выбранного мероприятия.</div></div>`;
      applyBackground(document.getElementById("bookingLayoutMap"), eventLayout.background || baseLayout.image || "");
      const title = root.closest("label")?.querySelector(":scope > span");
      if (title) title.textContent = "Выберите стол на схеме";
    } finally { busy = false; }
  }

  const observer = new MutationObserver(() => requestAnimationFrame(draw));
  observer.observe(document.documentElement, {subtree:true, childList:true});
  document.addEventListener("click", e => {
    if (e.target.closest("#tableChoices [data-table]")) setTimeout(draw, 0);
  });
  window.addEventListener("bali:data-changed", () => setTimeout(draw, 0));
  setTimeout(draw, 0);
})();