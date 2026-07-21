(() => {
  if (window.__BALI_ADMIN_EVENT_QR__) return;
  window.__BALI_ADMIN_EVENT_QR__ = true;
  const attendance = window.BaliEventQrAttendance;
  const store = window.BaliStore;
  if (!attendance || !store) return;
  const QR_SCRIPT = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
  let activeEvent = null;
  let activeImage = "";

  function loadQrLibrary() {
    if (window.QRCode) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${QR_SCRIPT}"]`);
      if (existing) { existing.addEventListener("load", resolve, { once: true }); existing.addEventListener("error", reject, { once: true }); return; }
      const script = document.createElement("script");
      script.src = QR_SCRIPT;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Не удалось загрузить генератор QR"));
      document.head.appendChild(script);
    });
  }

  function styles() {
    if (document.getElementById("adminEventQrStyle")) return;
    const style = document.createElement("style");
    style.id = "adminEventQrStyle";
    style.textContent = `.event-qr-admin-dialog{width:min(620px,calc(100% - 18px));max-height:94dvh;padding:0;border:1px solid var(--line);border-radius:24px;background:#0b0e0d;color:#fff;overflow:hidden}.event-qr-admin-dialog::backdrop{background:rgba(0,0,0,.86);backdrop-filter:blur(7px)}.event-qr-admin-sheet{max-height:94dvh;overflow:auto}.event-qr-admin-head{display:flex;justify-content:space-between;align-items:center;padding:16px 18px;border-bottom:1px solid var(--line)}.event-qr-admin-head h2{margin:4px 0 0}.event-qr-admin-close{width:42px;height:42px;border:1px solid var(--line);border-radius:50%;background:rgba(255,255,255,.04);color:#fff;font-size:25px}.event-qr-admin-body{display:grid;gap:13px;padding:17px}.event-qr-print-card{display:grid;justify-items:center;gap:10px;padding:20px;border-radius:20px;background:#fff;color:#090b0a;text-align:center}.event-qr-print-card img{width:min(100%,360px);aspect-ratio:1;object-fit:contain}.event-qr-print-card h3{margin:0;font:700 20px Unbounded}.event-qr-print-card p{margin:0;color:#4e554f;font-size:11px;line-height:1.5}.event-qr-admin-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px}.event-qr-admin-stats article{padding:12px;border:1px solid var(--line);border-radius:14px}.event-qr-admin-stats span{display:block;color:var(--muted);font-size:8px}.event-qr-admin-stats strong{display:block;margin-top:5px;color:var(--lime);font:600 18px Unbounded}.event-qr-admin-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.event-qr-admin-actions .wide{grid-column:1/-1}.event-qr-admin-note{padding:11px;border:1px solid rgba(255,200,87,.2);border-radius:13px;background:rgba(255,200,87,.06);color:#dec77f;font-size:9px;line-height:1.5}@media(max-width:430px){.event-qr-admin-actions,.event-qr-admin-stats{grid-template-columns:1fr}.event-qr-admin-actions .wide{grid-column:auto}}`;
    document.head.appendChild(style);
  }

  function ensureDialog() {
    let dialog = document.getElementById("eventQrAdminDialog");
    if (dialog) return dialog;
    document.body.insertAdjacentHTML("beforeend", `<dialog class="event-qr-admin-dialog" id="eventQrAdminDialog"><div class="event-qr-admin-sheet"><div class="event-qr-admin-head"><div><span class="eyebrow">ВХОД ПО QR</span><h2>QR мероприятия</h2></div><button class="event-qr-admin-close" type="button" data-close-admin-event-qr>×</button></div><div class="event-qr-admin-body"><div class="event-qr-print-card"><img id="eventQrAdminImage" alt="QR-код мероприятия"><h3 id="eventQrAdminEvent"></h3><p id="eventQrAdminDate"></p><p>Отсканируйте в приложении BALI, чтобы подтвердить вход</p></div><div class="event-qr-admin-stats"><article><span>ОТМЕТИЛИСЬ ПО QR</span><strong id="eventQrAdminCount">0</strong></article><article><span>СТАТУС QR</span><strong>АКТИВЕН</strong></article></div><div class="event-qr-admin-actions"><button class="primary" type="button" data-download-event-qr>Скачать PNG</button><button class="secondary" type="button" data-print-event-qr>Печать</button><button class="danger wide" type="button" data-regenerate-event-qr>Создать новый QR</button></div><div class="event-qr-admin-note">После создания нового QR ранее распечатанный код перестанет работать. Используйте эту кнопку только при необходимости заменить код.</div></div></div></dialog>`);
    dialog = document.getElementById("eventQrAdminDialog");
    dialog.querySelector("[data-close-admin-event-qr]").onclick = () => dialog.close();
    return dialog;
  }

  async function qrDataUrl(event) {
    await loadQrLibrary();
    const holder = document.createElement("div");
    holder.style.position = "fixed";
    holder.style.left = "-9999px";
    document.body.appendChild(holder);
    new QRCode(holder, { text: attendance.payloadUrl(event), width: 1024, height: 1024, colorDark: "#090b0a", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });
    await new Promise(resolve => setTimeout(resolve, 40));
    const canvas = holder.querySelector("canvas");
    const image = holder.querySelector("img");
    const result = canvas?.toDataURL("image/png") || image?.src || "";
    holder.remove();
    if (!result) throw new Error("QR-код не сформирован");
    return result;
  }

  async function posterDataUrl(event, qrUrl) {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1500;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#090b0a";
    ctx.textAlign = "center";
    ctx.font = "700 48px Arial";
    ctx.fillText("BALI · ПОДТВЕРЖДЕНИЕ ВХОДА", 600, 90);
    ctx.font = "700 58px Arial";
    const title = String(event.title || "Мероприятие BALI");
    const lines = [];
    let line = "";
    for (const word of title.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > 1030 && line) { lines.push(line); line = word; } else line = test;
    }
    if (line) lines.push(line);
    lines.slice(0, 2).forEach((text, index) => ctx.fillText(text, 600, 175 + index * 70));
    ctx.font = "400 35px Arial";
    ctx.fillStyle = "#4b514c";
    ctx.fillText(`${event.event_date || ""} · ${event.event_time || "23:00"}`, 600, 330);
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = qrUrl; });
    ctx.drawImage(image, 150, 390, 900, 900);
    ctx.fillStyle = "#090b0a";
    ctx.font = "700 38px Arial";
    ctx.fillText("ОТСКАНИРУЙТЕ В ПРИЛОЖЕНИИ BALI", 600, 1360);
    ctx.font = "400 28px Arial";
    ctx.fillStyle = "#4b514c";
    ctx.fillText("Посещение, баллы, XP и награды начислятся автоматически", 600, 1415);
    return canvas.toDataURL("image/png");
  }

  async function openQr(eventId) {
    const events = await store.list("events");
    let event = events.find(item => String(item.id) === String(eventId));
    if (!event) return toast("Мероприятие не найдено");
    event = await attendance.ensureEvent(event);
    activeEvent = event;
    const dialog = ensureDialog();
    document.getElementById("eventQrAdminEvent").textContent = event.title;
    document.getElementById("eventQrAdminDate").textContent = `${formatDate(event.event_date)} · ${event.event_time || "23:00"}`;
    document.getElementById("eventQrAdminImage").removeAttribute("src");
    document.getElementById("eventQrAdminCount").textContent = (await attendance.listCheckins(event.id)).length;
    dialog.showModal();
    try { activeImage = await qrDataUrl(event); document.getElementById("eventQrAdminImage").src = activeImage; }
    catch (error) { toast(error.message || "Не удалось создать QR-код"); }
  }

  async function downloadQr() {
    if (!activeEvent || !activeImage) return;
    const poster = await posterDataUrl(activeEvent, activeImage);
    const link = document.createElement("a");
    link.href = poster;
    link.download = `BALI_QR_${String(activeEvent.title || activeEvent.id).replace(/[^a-zA-Zа-яА-Я0-9_-]+/g, "_")}.png`;
    link.click();
  }

  function printQr() {
    if (!activeEvent || !activeImage) return;
    const print = window.open("", "_blank", "width=900,height=1100");
    if (!print) return toast("Разрешите открытие окна печати");
    print.document.write(`<!doctype html><html><head><meta charset="UTF-8"><title>QR ${activeEvent.title}</title><style>@page{size:A4;margin:14mm}body{margin:0;font-family:Arial;text-align:center;color:#090b0a}.card{display:grid;justify-items:center;gap:12px;padding:20px;border:2px solid #111;border-radius:22px}img{width:150mm;max-width:100%}h1{font-size:28px;margin:0}h2{font-size:22px;margin:0}.hint{font-size:17px;font-weight:700}.small{font-size:12px;color:#555}</style></head><body><div class="card"><h2>BALI · ПОДТВЕРЖДЕНИЕ ВХОДА</h2><h1>${String(activeEvent.title).replace(/[<>&]/g, "")}</h1><p>${activeEvent.event_date || ""} · ${activeEvent.event_time || "23:00"}</p><img src="${activeImage}"><p class="hint">ОТСКАНИРУЙТЕ В ПРИЛОЖЕНИИ BALI</p><p class="small">Посещение, баллы, XP и награды начислятся автоматически</p></div><script>onload=()=>setTimeout(()=>print(),250)<\/script></body></html>`);
    print.document.close();
  }

  async function regenerate() {
    if (!activeEvent || !confirm(`Создать новый QR для «${activeEvent.title}»? Старый код перестанет работать.`)) return;
    activeEvent = await store.save("events", { ...activeEvent, qr_token: Array.from(crypto.getRandomValues(new Uint8Array(18))).map(byte => byte.toString(16).padStart(2, "0")).join(""), qr_created_at: new Date().toISOString() });
    activeImage = await qrDataUrl(activeEvent);
    document.getElementById("eventQrAdminImage").src = activeImage;
    toast("Новый QR-код создан");
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-event-qr]");
    if (button) { event.preventDefault(); event.stopPropagation(); openQr(button.dataset.eventQr); }
    if (event.target.closest("[data-download-event-qr]")) { event.preventDefault(); downloadQr(); }
    if (event.target.closest("[data-print-event-qr]")) { event.preventDefault(); printQr(); }
    if (event.target.closest("[data-regenerate-event-qr]")) { event.preventDefault(); regenerate(); }
  }, true);

  styles();
  ensureDialog();
  const baseRenderEvents = window.renderEvents;
  window.renderEvents = async function(root) { await attendance.ensureAllEvents(); await baseRenderEvents(root); };
  window.BaliAdminEventQr = { openQr };
  if (typeof state !== "undefined" && state.view === "events") window.render?.();
})();