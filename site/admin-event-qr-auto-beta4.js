(() => {
  if (window.__BALI_ADMIN_EVENT_QR_AUTO__) return;
  window.__BALI_ADMIN_EVENT_QR_AUTO__ = true;

  const store = window.BaliStore;
  const attendance = window.BaliEventQrAttendance;
  if (!store) return;
  const QR_LIB = "https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js";
  let activeEvent = null;

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  function toast(message) { window.toast?.(message); }

  function styles() {
    if (document.getElementById("adminEventQrAutoStyle")) return;
    const style = document.createElement("style");
    style.id = "adminEventQrAutoStyle";
    style.textContent = `
      .admin-event-qr-dialog{width:min(520px,calc(100% - 14px));max-height:95dvh;padding:0;border:1px solid var(--line);border-radius:22px;background:#090c0b;color:#fff;overflow:hidden}.admin-event-qr-dialog::backdrop{background:#000e;backdrop-filter:blur(6px)}.admin-event-qr-sheet{max-height:95dvh;overflow:auto}.admin-event-qr-head{display:flex;align-items:center;justify-content:space-between;padding:15px 16px;border-bottom:1px solid var(--line)}.admin-event-qr-head h2{margin:4px 0 0;font-size:18px}.admin-event-qr-close{width:41px;height:41px;border:1px solid var(--line);border-radius:50%;background:#ffffff08;color:#fff;font-size:23px}.admin-event-qr-body{display:grid;gap:12px;padding:15px}.admin-event-qr-canvas{display:grid;place-items:center;min-height:300px;padding:20px;border-radius:18px;background:#fff}.admin-event-qr-canvas img,.admin-event-qr-canvas canvas{max-width:100%;height:auto}.admin-event-qr-info{padding:12px;border:1px solid var(--line);border-radius:14px;background:#ffffff05;color:var(--muted);font-size:9px;line-height:1.55;word-break:break-all}.admin-event-qr-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.admin-event-qr-button{color:var(--lime)!important}
    `;
    document.head.appendChild(style);
  }

  function ensureDialog() {
    if (document.getElementById("adminEventQrDialog")) return;
    document.body.insertAdjacentHTML("beforeend", `<dialog id="adminEventQrDialog" class="admin-event-qr-dialog"><div class="admin-event-qr-sheet"><header class="admin-event-qr-head"><div><span class="eyebrow">QR-КОД МЕРОПРИЯТИЯ</span><h2 id="adminEventQrTitle">Событие BALI</h2></div><button class="admin-event-qr-close" type="button" data-close-admin-event-qr>×</button></header><div class="admin-event-qr-body"><div class="admin-event-qr-canvas" id="adminEventQrCanvas"></div><div class="admin-event-qr-info" id="adminEventQrInfo"></div><div class="admin-event-qr-actions"><button class="ghost" type="button" data-copy-admin-event-qr>Копировать ссылку</button><button class="primary" type="button" data-download-admin-event-qr>Скачать QR</button></div></div></div></dialog>`);
  }

  function loadQrLibrary() {
    if (window.QRCode) return Promise.resolve();
    return new Promise((resolve,reject) => {
      const existing = document.querySelector(`script[src="${QR_LIB}"]`);
      if (existing) { existing.addEventListener("load",resolve,{once:true}); existing.addEventListener("error",reject,{once:true}); return; }
      const script = document.createElement("script");
      script.src = QR_LIB;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Не удалось загрузить генератор QR-кода"));
      document.head.appendChild(script);
    });
  }

  async function qrUrl(event) {
    const ensured = attendance?.ensureEvent ? await attendance.ensureEvent(event) : event;
    if (attendance?.payloadUrl) return { event:ensured, url:attendance.payloadUrl(ensured) };
    const url = new URL("./beta4-qr-app.html", location.href);
    url.searchParams.set("event", ensured.id);
    url.searchParams.set("token", ensured.qr_token);
    return { event:ensured, url:url.toString() };
  }

  async function open(eventId) {
    ensureDialog();
    const rows = await store.list("events", { order:"event_date" });
    let event = rows.find(row => String(row.id) === String(eventId));
    if (!event) return toast("Событие не найдено");
    const result = await qrUrl(event);
    activeEvent = { ...result.event, qr_url:result.url };
    document.getElementById("adminEventQrTitle").textContent = activeEvent.title || "Событие BALI";
    document.getElementById("adminEventQrInfo").innerHTML = `<strong>${esc(activeEvent.event_date || "")} · ${esc(activeEvent.event_time || "23:00")}</strong><br>QR создан автоматически при сохранении события.<br>${esc(activeEvent.qr_url)}`;
    const root = document.getElementById("adminEventQrCanvas");
    root.innerHTML = '<span style="color:#111">Создание QR…</span>';
    document.getElementById("adminEventQrDialog").showModal();
    try {
      await loadQrLibrary();
      root.innerHTML = "";
      new QRCode(root, { text:activeEvent.qr_url, width:280, height:280, correctLevel:QRCode.CorrectLevel.H });
    } catch (error) {
      root.innerHTML = `<div style="color:#111;text-align:center">${esc(error.message || "Не удалось создать QR")}<br><small>Ссылку можно скопировать вручную.</small></div>`;
    }
  }

  function decorateRows() {
    document.querySelectorAll('[data-edit="events"]').forEach(edit => {
      const actions = edit.closest(".row-actions");
      if (!actions || actions.querySelector("[data-admin-event-qr]")) return;
      edit.insertAdjacentHTML("beforebegin", `<button class="icon-btn admin-event-qr-button" type="button" title="QR-код события" data-admin-event-qr="${esc(edit.dataset.id)}">⌗</button>`);
    });
  }

  if (typeof window.renderEvents === "function") {
    const originalRenderEvents = window.renderEvents;
    window.renderEvents = async function(root) {
      await originalRenderEvents(root);
      decorateRows();
    };
  }

  document.addEventListener("click", async event => {
    const button = event.target.closest("[data-admin-event-qr]");
    if (button) return open(button.dataset.adminEventQr);
    if (event.target.closest("[data-close-admin-event-qr]")) return document.getElementById("adminEventQrDialog")?.close();
    if (event.target.closest("[data-copy-admin-event-qr]") && activeEvent?.qr_url) {
      await navigator.clipboard?.writeText(activeEvent.qr_url);
      return toast("Ссылка QR скопирована");
    }
    if (event.target.closest("[data-download-admin-event-qr]")) {
      const image = document.querySelector("#adminEventQrCanvas img") || document.querySelector("#adminEventQrCanvas canvas");
      if (!image) return toast("QR-код ещё не создан");
      const url = image.tagName === "CANVAS" ? image.toDataURL("image/png") : image.src;
      const link = document.createElement("a");
      link.href = url;
      link.download = `${String(activeEvent?.title || "bali-event").replace(/[^\p{L}\p{N}]+/gu,"-")}-qr.png`;
      link.click();
    }
  }, true);

  styles();
  ensureDialog();
  new MutationObserver(decorateRows).observe(document.body,{childList:true,subtree:true});
  decorateRows();
  window.BaliAdminEventQr = { open, decorateRows };
})();