(() => {
  if (window.__BALI_EVENT_QR_CHECKIN__) return;
  window.__BALI_EVENT_QR_CHECKIN__ = true;
  const store = window.BaliStore;
  const game = window.BaliBeta4Game;
  if (!store || !game) return;

  const QR_KEY = "bali_event_qr_registry_v1";
  const CHECKIN_KEY = "bali_event_checkins_v1";
  const tg = window.Telegram?.WebApp;
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new CustomEvent("bali:data-changed", { detail: { table: "event_checkins" } })); return value; };
  const toast = (message) => { const el = document.getElementById("toast"); if (!el) return; el.textContent = message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2600); };
  const userKey = () => String(game.profile().id || game.profile().userKey || game.profile().code || "guest");

  function parsePayload(value = "") {
    const text = String(value).trim();
    try {
      const url = new URL(text);
      const eventId = url.searchParams.get("event");
      const token = url.searchParams.get("token");
      if (eventId && token) return { eventId, token };
    } catch {}
    try {
      const data = JSON.parse(text);
      if (data.eventId && data.token) return { eventId: String(data.eventId), token: String(data.token) };
    } catch {}
    const match = text.match(/^BALI-EVENT:([^:]+):(.+)$/);
    return match ? { eventId: match[1], token: match[2] } : null;
  }

  async function registerCheckin(payload) {
    const registry = read(QR_KEY, {});
    const qr = registry[payload.eventId];
    if (!qr || String(qr.token) !== String(payload.token) || qr.active === false) throw new Error("QR-код недействителен");
    const event = (await store.list("events")).find(row => String(row.id) === String(payload.eventId) && row.active !== false);
    if (!event) throw new Error("Мероприятие не найдено или уже закрыто");
    const profile = game.profile();
    const key = `${payload.eventId}:${userKey()}`;
    const rows = read(CHECKIN_KEY, {});
    if (rows[key]) return { duplicate: true, event, checkin: rows[key] };
    const checkin = {
      id: `checkin-${crypto.randomUUID?.() || Date.now()}`,
      event_id: event.id,
      event_title: event.title,
      event_date: event.event_date,
      user_key: userKey(),
      telegram_id: profile.telegramId || null,
      telegram: profile.username || "",
      name: profile.name || "Гость BALI",
      checked_in_at: new Date().toISOString(),
      source: "guest_qr"
    };
    rows[key] = checkin;
    write(CHECKIN_KEY, rows);
    game.recordVisit();
    window.BaliBeta4Loyalty?.evaluateRewards?.(game.profile());
    return { duplicate: false, event, checkin };
  }

  async function handleCode(text) {
    const payload = parsePayload(text);
    if (!payload) throw new Error("Это не QR-код мероприятия BALI");
    const result = await registerCheckin(payload);
    if (result.duplicate) toast(`Посещение «${result.event.title}» уже подтверждено`);
    else {
      toast(`Посещение подтверждено · +250 XP`);
      showSuccess(result.event);
    }
  }

  function showSuccess(event) {
    let dialog = document.getElementById("eventCheckinSuccess");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "eventCheckinSuccess";
      dialog.style.cssText = "width:min(440px,calc(100% - 24px));padding:0;border:1px solid rgba(200,255,61,.24);border-radius:22px;background:#0d100f;color:#fff";
      document.body.appendChild(dialog);
    }
    dialog.innerHTML = `<div style="padding:22px;text-align:center"><div style="font-size:52px">✓</div><span style="color:#c8ff3d;font-size:9px;font-weight:900">ВХОД ПОДТВЕРЖДЁН</span><h3 style="margin:9px 0 5px;font:600 18px Unbounded">${String(event.title || "Мероприятие BALI")}</h3><p style="margin:0;color:#aab0ac;font-size:10px;line-height:1.5">Посещение добавлено в ваш профиль. XP, уровень и доступные награды обновлены.</p><button class="primary" type="button" style="width:100%;margin-top:16px" data-close-checkin>Продолжить</button></div>`;
    dialog.showModal();
  }

  function ensureManualDialog() {
    let dialog = document.getElementById("eventQrManualDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "eventQrManualDialog";
    dialog.style.cssText = "width:min(480px,calc(100% - 20px));padding:0;border:1px solid rgba(255,255,255,.12);border-radius:22px;background:#0d100f;color:#fff";
    dialog.innerHTML = `<form style="display:grid;gap:12px;padding:18px" id="eventQrManualForm"><div style="display:flex;justify-content:space-between;align-items:center"><div><span class="eyebrow">QR-КОД</span><h3 style="margin:4px 0 0">Подтвердить вход</h3></div><button type="button" class="ghost" data-close-qr>×</button></div><p style="color:#9da49f;font-size:9px;line-height:1.5">Камера недоступна. Вставьте текст QR-кода вручную.</p><textarea name="code" style="min-height:100px;padding:11px;border:1px solid rgba(255,255,255,.12);border-radius:13px;background:#171c1a;color:#fff" required></textarea><button class="primary" type="submit">Подтвердить посещение</button></form>`;
    document.body.appendChild(dialog);
    dialog.querySelector("[data-close-qr]").onclick = () => dialog.close();
    dialog.querySelector("form").onsubmit = async event => { event.preventDefault(); try { await handleCode(event.currentTarget.code.value); dialog.close(); } catch (error) { toast(error.message); } };
    return dialog;
  }

  async function scanWithCamera() {
    if (tg?.showScanQrPopup) {
      tg.showScanQrPopup({ text: "Наведите камеру на QR-код мероприятия BALI" }, async text => {
        try { await handleCode(text); tg.closeScanQrPopup?.(); return true; }
        catch (error) { toast(error.message); return false; }
      });
      return;
    }
    if (!window.BarcodeDetector || !navigator.mediaDevices?.getUserMedia) return ensureManualDialog().showModal();
    const dialog = document.createElement("dialog");
    dialog.style.cssText = "width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:#050706;color:#fff";
    dialog.innerHTML = `<div style="height:100%;display:grid;grid-template-rows:auto 1fr auto"><header style="display:flex;justify-content:space-between;align-items:center;padding:14px"><strong>Сканирование QR</strong><button class="ghost" type="button" data-close-camera>×</button></header><video autoplay playsinline style="width:100%;height:100%;object-fit:cover"></video><p style="padding:14px;text-align:center;color:#aab0ac">Наведите камеру на QR-код мероприятия</p></div>`;
    document.body.appendChild(dialog); dialog.showModal();
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    const video = dialog.querySelector("video"); video.srcObject = stream;
    const detector = new BarcodeDetector({ formats: ["qr_code"] }); let stopped = false;
    const close = () => { stopped = true; stream.getTracks().forEach(track => track.stop()); dialog.close(); dialog.remove(); };
    dialog.querySelector("[data-close-camera]").onclick = close;
    const loop = async () => { if (stopped) return; try { const found = await detector.detect(video); if (found[0]?.rawValue) { await handleCode(found[0].rawValue); close(); return; } } catch {} requestAnimationFrame(loop); };
    loop();
  }

  function mount() {
    const home = document.querySelector('[data-screen="home"] .inner');
    if (!home || document.getElementById("eventQrCheckinCard")) return;
    const card = document.createElement("section");
    card.id = "eventQrCheckinCard";
    card.className = "card";
    card.innerHTML = `<div class="card-head"><div><h3>Подтвердить вход</h3><small>Сканируйте QR-код у хостес</small></div><span class="count">QR</span></div><button class="primary full" type="button" data-scan-event-qr style="min-height:52px">▣ Сканировать QR-код мероприятия</button><p style="margin:10px 0 0;color:#9da49f;font-size:9px;line-height:1.5">После проверки посещение появится в профиле, списке участников и будет учтено в XP и наградах.</p>`;
    const actions = home.querySelector(".actions");
    actions?.insertAdjacentElement("afterend", card) || home.prepend(card);
  }

  async function processLinkCheckin() {
    const params = new URLSearchParams(location.search);
    const eventId = params.get("event");
    const token = params.get("token");
    if (!eventId || !token || sessionStorage.getItem(`bali-checkin-link-${eventId}`)) return;
    sessionStorage.setItem(`bali-checkin-link-${eventId}`, "1");
    try { await handleCode(location.href); history.replaceState({}, "", location.pathname); }
    catch (error) { toast(error.message || "Не удалось подтвердить вход"); }
  }

  document.addEventListener("click", event => {
    if (event.target.closest("[data-scan-event-qr]")) scanWithCamera().catch(error => toast(error.message || "Не удалось открыть камеру"));
    if (event.target.closest("[data-close-checkin]")) event.target.closest("dialog")?.close();
  }, true);
  setTimeout(() => { mount(); processLinkCheckin(); }, 0);
  window.BaliEventQrCheckin = { parsePayload, registerCheckin, handleCode };
})();