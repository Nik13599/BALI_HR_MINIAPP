(() => {
  if (window.__BALI_EVENT_QR_UI__) return;
  window.__BALI_EVENT_QR_UI__ = true;
  const attendance = window.BaliEventQrAttendance;
  const store = window.BaliStore;
  const game = window.BaliBeta4Game;
  const points = window.BaliPoints;
  if (!attendance || !store) return;
  let scanner = null;
  let handling = false;
  let expiryTimer = 0;
  const SCRIPT_URL = "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js";

  function toast(message) {
    const node = document.getElementById("toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2600);
  }

  function styles() {
    if (document.getElementById("eventQrCheckinStyle")) return;
    const style = document.createElement("style");
    style.id = "eventQrCheckinStyle";
    style.textContent = `.event-checkin-card{position:relative;overflow:hidden;padding:17px;border:1px solid rgba(200,255,61,.26);border-radius:21px;background:radial-gradient(circle at 90% 0,rgba(200,255,61,.17),transparent 42%),linear-gradient(145deg,#171d19,#0b0e0c)}.event-checkin-card:after{content:"⌗";position:absolute;right:14px;top:5px;color:rgba(200,255,61,.12);font:600 72px Unbounded}.event-checkin-card>*{position:relative;z-index:1}.event-checkin-card h3{margin:5px 0 7px;font:600 18px Unbounded}.event-checkin-card p{max-width:390px;margin:0 0 13px;color:var(--muted);font-size:10px;line-height:1.55}.event-checkin-card button{width:100%;min-height:49px}.event-checkin-card.active-event{border-color:rgba(200,255,61,.48);background:radial-gradient(circle at 92% 0,rgba(200,255,61,.28),transparent 44%),linear-gradient(145deg,#1d281d,#0d120e)}.event-checkin-card.active-event:after{content:"✓";top:9px;right:17px;color:rgba(200,255,61,.17);font-size:66px}.event-live-badge{display:inline-flex;align-items:center;gap:7px;min-height:29px;padding:0 10px;border:1px solid rgba(200,255,61,.35);border-radius:999px;background:rgba(200,255,61,.1);color:var(--lime);font-size:8px;font-weight:900;letter-spacing:.08em}.event-live-badge:before{content:"";width:7px;height:7px;border-radius:50%;background:var(--lime);box-shadow:0 0 12px rgba(200,255,61,.8)}.event-active-until{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:13px;padding:11px 12px;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(255,255,255,.04)}.event-active-until span{color:var(--muted);font-size:8px}.event-active-until strong{font-size:10px}.event-qr-dialog{width:min(520px,calc(100% - 14px));max-height:96dvh;padding:0;border:1px solid var(--line);border-radius:23px;background:#0b0e0d;color:#fff;overflow:hidden}.event-qr-dialog::backdrop{background:rgba(0,0,0,.9);backdrop-filter:blur(6px)}.event-qr-sheet{max-height:96dvh;overflow:auto}.event-qr-head{display:flex;justify-content:space-between;align-items:center;padding:16px;border-bottom:1px solid var(--line)}.event-qr-head h2{margin:4px 0 0;font-size:18px}.event-qr-close{width:42px;height:42px;border:1px solid var(--line);border-radius:50%;background:rgba(255,255,255,.04);color:#fff;font-size:25px}.event-qr-body{display:grid;gap:12px;padding:15px}.event-qr-reader{min-height:290px;overflow:hidden;border:1px solid rgba(200,255,61,.2);border-radius:18px;background:#050706}.event-qr-reader video{border-radius:17px}.event-qr-help{color:var(--muted);font-size:9px;line-height:1.55;text-align:center}.event-qr-file{display:grid;gap:7px}.event-qr-file input{display:none}.event-qr-status{display:none;padding:18px;border:1px solid rgba(200,255,61,.23);border-radius:18px;background:rgba(200,255,61,.06);text-align:center}.event-qr-status.show{display:grid;gap:9px}.event-qr-status i{font-style:normal;font-size:42px}.event-qr-status h3{margin:0;font:600 17px Unbounded}.event-qr-status p{margin:0;color:var(--muted);font-size:10px;line-height:1.55}.event-qr-rewards{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.event-qr-rewards span{padding:10px 5px;border:1px solid var(--line);border-radius:12px;font-size:8px}.event-qr-rewards strong{display:block;margin-bottom:4px;color:var(--lime);font:600 15px Unbounded}@media(max-width:360px){.event-qr-rewards{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
  }

  function ensureDialog() {
    let dialog = document.getElementById("eventQrDialog");
    if (dialog) return dialog;
    document.body.insertAdjacentHTML("beforeend", `<dialog class="event-qr-dialog" id="eventQrDialog"><div class="event-qr-sheet"><div class="event-qr-head"><div><span class="eyebrow">ВХОД НА МЕРОПРИЯТИЕ</span><h2>Сканировать QR-код</h2></div><button class="event-qr-close" type="button" data-close-event-qr>×</button></div><div class="event-qr-body"><div class="event-qr-reader" id="eventQrReader"></div><p class="event-qr-help">Наведите камеру на QR-код мероприятия возле хостес. Одно мероприятие можно подтвердить только один раз.</p><label class="event-qr-file"><input id="eventQrFile" type="file" accept="image/*" capture="environment"><button class="secondary full" type="button" data-pick-qr-image>Выбрать фото QR-кода</button></label><div class="event-qr-status" id="eventQrStatus"></div></div></div></dialog>`);
    dialog = document.getElementById("eventQrDialog");
    dialog.addEventListener("close", stopScanner);
    return dialog;
  }

  function dateAt(date, time = "00:00") {
    const value = new Date(`${String(date || "").slice(0, 10)}T${time || "00:00"}:00`);
    return Number.isNaN(value.getTime()) ? null : value;
  }

  function eventEnd(event, checkin = {}) {
    const startDate = event?.event_date || checkin.event_date || "";
    const startTime = event?.event_time || checkin.event_time || "23:00";
    const endTime = event?.event_end_time || event?.end_time || "06:00";
    let endDate = event?.event_end_date || event?.end_date || startDate;
    if (!event?.event_end_date && !event?.end_date && endTime <= startTime) {
      const date = dateAt(startDate, "12:00");
      if (date) {
        date.setDate(date.getDate() + 1);
        endDate = date.toISOString().slice(0, 10);
      }
    }
    return dateAt(endDate, endTime);
  }

  function myIdentityKeys() {
    const values = new Set();
    const profiles = [game?.profile?.() || {}, points?.profile?.() || {}];
    profiles.forEach(profile => {
      if (game?.identityKeys) game.identityKeys(profile).forEach(value => values.add(String(value)));
      [profile.id, profile.userKey, profile.ownerKey, profile.code].filter(Boolean).forEach(value => values.add(String(value)));
      if (profile.telegramId) values.add(`tg:${profile.telegramId}`);
    });
    return values;
  }

  function isMine(row, keys, telegramId) {
    return keys.has(String(row.user_key || "")) || (telegramId && String(row.telegram_id || "") === telegramId);
  }

  async function activeVisit() {
    const [checkins, events] = await Promise.all([attendance.listCheckins(), store.list("events")]);
    const keys = myIdentityKeys();
    const telegramId = String(game?.profile?.()?.telegramId || points?.profile?.()?.telegramId || "");
    const mine = checkins.filter(row => isMine(row, keys, telegramId)).sort((a, b) => String(b.checked_in_at || "").localeCompare(String(a.checked_in_at || "")));
    for (const row of mine) {
      const event = events.find(item => String(item.id) === String(row.event_id)) || {
        id: row.event_id,
        title: row.event_title,
        event_date: row.event_date,
        event_time: row.event_time
      };
      const end = eventEnd(event, row);
      if (end && end.getTime() > Date.now()) return { row, event, end };
    }
    return null;
  }

  function formatEnd(date) {
    return date.toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  }

  function scannerCardHtml() {
    return `<span class="eyebrow">Я УЖЕ В BALI</span><h3>Подтвердить вход</h3><p>Отсканируйте QR-код мероприятия у хостес, чтобы посещение попало в профиль, рейтинг и систему наград.</p><button class="primary" type="button" data-open-event-qr>Сканировать QR-код</button>`;
  }

  function activeCardHtml(active) {
    return `<span class="event-live-badge">ВЫ НА МЕРОПРИЯТИИ</span><h3>${String(active.event.title || active.row.event_title || "Мероприятие BALI")}</h3><p>Вход подтверждён. Ваше посещение активно, а функции текущего мероприятия доступны до его завершения.</p><div class="event-active-until"><span>СТАТУС АКТИВЕН ДО</span><strong>${formatEnd(active.end)}</strong></div>`;
  }

  async function refreshHomeCard() {
    const card = document.getElementById("eventQrHomeCard");
    if (!card) return;
    let active = null;
    try { active = await activeVisit(); } catch {}
    card.classList.toggle("active-event", Boolean(active));
    card.innerHTML = active ? activeCardHtml(active) : scannerCardHtml();
    clearTimeout(expiryTimer);
    if (active) expiryTimer = setTimeout(refreshHomeCard, Math.min(2147483000, Math.max(500, active.end.getTime() - Date.now() + 500)));
  }

  function mount() {
    const inner = document.querySelector('[data-screen="home"] .inner');
    if (!inner) return;
    let card = document.getElementById("eventQrHomeCard");
    if (!card) {
      const actions = inner.querySelector(".actions");
      card = document.createElement("section");
      card.id = "eventQrHomeCard";
      card.className = "event-checkin-card";
      card.innerHTML = scannerCardHtml();
      actions?.insertAdjacentElement("afterend", card);
    }
    ensureDialog();
    refreshHomeCard();
  }

  function loadScannerLibrary() {
    if (window.Html5Qrcode) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`);
      if (existing) { existing.addEventListener("load", resolve, { once: true }); existing.addEventListener("error", reject, { once: true }); return; }
      const script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Не удалось загрузить сканер QR-кодов"));
      document.head.appendChild(script);
    });
  }

  async function stopScanner() {
    const current = scanner;
    scanner = null;
    if (!current) return;
    try { if (current.isScanning) await current.stop(); } catch {}
    try { current.clear(); } catch {}
  }

  function renderResult(result) {
    const node = document.getElementById("eventQrStatus");
    if (!node) return;
    node.classList.add("show");
    if (!result.ok) {
      node.innerHTML = `<i>${result.duplicate ? "✓" : "⚠️"}</i><h3>${result.duplicate ? "Вход уже подтверждён" : "Не удалось подтвердить вход"}</h3><p>${result.message}</p><button class="secondary full" type="button" data-restart-event-qr>Сканировать ещё раз</button>`;
      return;
    }
    node.innerHTML = `<i>✅</i><h3>${result.event.title}</h3><p>Посещение успешно записано. До окончания мероприятия на главной странице будет отображаться активный статус.</p><div class="event-qr-rewards"><span><strong>+${Number(result.points || 0)}</strong>баллов</span><span><strong>+${Number(result.xp || 0)}</strong>XP</span><span><strong>${Number(result.visits || 0)}</strong>посещений</span></div><p>Текущий уровень: <b>${result.level}</b></p><button class="primary full" type="button" data-close-event-qr>Готово</button>`;
  }

  async function afterCheckIn(result) {
    await refreshHomeCard();
    if (result?.ok || result?.duplicate) window.dispatchEvent(new CustomEvent("bali:checkin-complete", { detail: { event: result.event || result.row || null, result } }));
  }

  async function handleCode(code) {
    if (handling) return;
    handling = true;
    await stopScanner();
    const reader = document.getElementById("eventQrReader");
    if (reader) reader.style.display = "none";
    const result = await attendance.checkIn(code);
    renderResult(result);
    await afterCheckIn(result);
    try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(result.ok ? "success" : "error"); } catch {}
    handling = false;
  }

  async function startScanner() {
    const dialog = ensureDialog();
    const status = document.getElementById("eventQrStatus");
    const reader = document.getElementById("eventQrReader");
    status.classList.remove("show");
    status.innerHTML = "";
    reader.style.display = "block";
    reader.innerHTML = "";
    if (!dialog.open) dialog.showModal();
    try {
      await loadScannerLibrary();
      scanner = new Html5Qrcode("eventQrReader");
      const size = Math.max(190, Math.min(260, window.innerWidth - 90));
      await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: size, height: size }, aspectRatio: 1 }, handleCode, () => {});
    } catch (error) {
      await stopScanner();
      reader.innerHTML = `<div style="min-height:290px;display:grid;place-items:center;padding:22px;color:#aeb5b0;text-align:center;font-size:10px;line-height:1.6">Камера недоступна.<br>Разрешите доступ к камере или выберите фотографию QR-кода.</div>`;
      toast(error.message || "Не удалось открыть камеру");
    }
  }

  async function scanFile(file) {
    if (!file) return;
    try {
      await stopScanner();
      await loadScannerLibrary();
      const fileScanner = new Html5Qrcode("eventQrReader");
      const result = await fileScanner.scanFile(file, true);
      try { fileScanner.clear(); } catch {}
      await handleCode(result);
    } catch { toast("QR-код на изображении не найден"); }
  }

  async function processQuery() {
    const url = new URL(location.href);
    const code = url.searchParams.get("checkin");
    if (!code) return;
    const key = `bali-auto-checkin:${code}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    mount();
    const dialog = ensureDialog();
    dialog.showModal();
    document.getElementById("eventQrReader").style.display = "none";
    const result = await attendance.checkIn(code);
    renderResult(result);
    await afterCheckIn(result);
    url.searchParams.delete("checkin");
    history.replaceState({}, "", url.toString());
  }

  document.addEventListener("click", event => {
    if (event.target.closest("[data-open-event-qr]")) { event.preventDefault(); startScanner(); }
    if (event.target.closest("[data-close-event-qr]")) { event.preventDefault(); stopScanner(); document.getElementById("eventQrDialog")?.close(); refreshHomeCard(); }
    if (event.target.closest("[data-restart-event-qr]")) { event.preventDefault(); startScanner(); }
    if (event.target.closest("[data-pick-qr-image]")) { event.preventDefault(); document.getElementById("eventQrFile")?.click(); }
  }, true);
  document.addEventListener("change", event => { if (event.target.id === "eventQrFile") scanFile(event.target.files?.[0]); }, true);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshHomeCard(); });
  ["bali:data-changed", "bali:beta4-changed", "bali:points-changed"].forEach(name => window.addEventListener(name, () => setTimeout(refreshHomeCard, 0)));

  styles();
  mount();
  setTimeout(mount, 150);
  setInterval(refreshHomeCard, 60000);
  setTimeout(processQuery, 250);
  window.BaliEventQrUi = { refreshActiveEvent: refreshHomeCard };
})();