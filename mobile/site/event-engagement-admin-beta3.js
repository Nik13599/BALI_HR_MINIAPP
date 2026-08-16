(() => {
  const store = window.BaliStore;
  const points = window.BaliPoints;
  if (!store) return;

  const RSVP_KEY = "bali_event_rsvps_v1";
  const QR_KEY = "bali_event_qr_v1";
  const CHECKIN_KEY = "bali_event_checkins_v1";
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const write = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("bali:event-engagement-changed", { detail: { key } }));
    return value;
  };

  function qrCodes() { return read(QR_KEY, {}); }
  function ensureQr(event) {
    const all = qrCodes();
    if (!all[event.id]) {
      const token = Array.from(crypto.getRandomValues(new Uint8Array(8))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
      all[event.id] = {
        event_id: event.id,
        event_title: event.title,
        event_date: event.event_date,
        token,
        reward: Number(points?.settings?.()?.attendance || 100),
        created_at: new Date().toISOString()
      };
      write(QR_KEY, all);
    } else {
      all[event.id] = { ...all[event.id], event_title: event.title, event_date: event.event_date };
      write(QR_KEY, all);
    }
    return all[event.id];
  }

  function deepLink(event, config = ensureQr(event)) {
    const username = String(window.BALI_CONFIG?.telegramUsername || "BALI_MINSK").replace(/^@/, "");
    const payload = `att_${event.id}_${config.token}`;
    return `https://t.me/${username}?startapp=${encodeURIComponent(payload)}`;
  }

  async function counts(eventId) {
    const rsvpRows = Object.values(read(RSVP_KEY, {})?.[eventId] || {});
    const bookings = (await store.list("bookings")).filter((booking) => booking.event_id === eventId && !["cancelled", "completed"].includes(booking.status));
    const bookedUsers = new Set(bookings.map((booking) => booking.owner_key || booking.client_key || booking.telegram_id || booking.customer_id || booking.id));
    const checkins = Object.values(read(CHECKIN_KEY, {})).filter((row) => row.event_id === eventId);
    return {
      interested: rsvpRows.filter((row) => row.status === "interested").length,
      going: rsvpRows.filter((row) => row.status === "going").length,
      booked: bookedUsers.size,
      bookedGuests: bookings.reduce((sum, booking) => sum + Number(booking.guests || 0), 0),
      checkedIn: checkins.length
    };
  }

  function loadQrLibrary() {
    if (window.QRCode?.toCanvas) return Promise.resolve(window.QRCode);
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-bali-qrcode]');
      if (existing) {
        existing.addEventListener("load", () => resolve(window.QRCode), { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js";
      script.dataset.baliQrcode = "true";
      script.onload = () => resolve(window.QRCode);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function wrapText(ctx, text, maxWidth) {
    const words = String(text || "").split(/\s+/);
    const lines = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  async function downloadQr(event) {
    const config = ensureQr(event);
    const link = deepLink(event, config);
    const QR = await loadQrLibrary();
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1600;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#080a0a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#c8ff3d";
    ctx.font = "700 54px Arial";
    ctx.textAlign = "center";
    ctx.fillText("BALI MINSK", 600, 120);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 72px Arial";
    const titleLines = wrapText(ctx, event.title, 980).slice(0, 3);
    titleLines.forEach((line, index) => ctx.fillText(line, 600, 235 + index * 82));
    const titleBottom = 235 + titleLines.length * 82;
    ctx.fillStyle = "#c8ff3d";
    ctx.font = "700 38px Arial";
    ctx.fillText(`${formatDate(event.event_date)} · ${event.event_time || "23:00"}`, 600, titleBottom + 35);

    const qrCanvas = document.createElement("canvas");
    await QR.toCanvas(qrCanvas, link, { width: 720, margin: 3, errorCorrectionLevel: "H", color: { dark: "#080a0a", light: "#ffffff" } });
    const qrX = 240;
    const qrY = titleBottom + 95;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(qrX - 25, qrY - 25, 770, 770);
    ctx.drawImage(qrCanvas, qrX, qrY, 720, 720);

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 47px Arial";
    ctx.fillText("СКАНИРУЙ ПРИ ВХОДЕ", 600, qrY + 830);
    ctx.fillStyle = "#c8ff3d";
    ctx.font = "700 38px Arial";
    ctx.fillText(`+${Number(config.reward || 0)} BALI-БАЛЛОВ`, 600, qrY + 890);
    ctx.fillStyle = "#aeb4ae";
    ctx.font = "28px Arial";
    ctx.fillText("Один пользователь — одно начисление за мероприятие", 600, qrY + 950);
    ctx.fillText("Открой QR через Telegram и подтверди посещение", 600, qrY + 995);

    const anchor = document.createElement("a");
    anchor.href = canvas.toDataURL("image/png");
    anchor.download = `BALI_QR_${event.event_date}_${String(event.title).replace(/[^a-zA-Zа-яА-Я0-9]+/g, "_").slice(0, 40)}.png`;
    anchor.click();
  }

  async function decorateEventCards(root) {
    const events = await store.list("events");
    for (const event of events) {
      ensureQr(event);
      const trigger = root.querySelector(`[data-event-layout="${CSS.escape(event.id)}"]`);
      const card = trigger?.closest(".event-admin-card");
      if (!card || card.querySelector(`[data-event-engagement-admin="${CSS.escape(event.id)}"]`)) continue;
      const totals = await counts(event.id);
      const config = qrCodes()[event.id];
      const chips = card.querySelector(".event-admin-chips");
      chips?.insertAdjacentHTML("beforeend", `<span class="event-admin-chip" data-event-engagement-admin="${event.id}">Хочу: ${totals.interested}</span><span class="event-admin-chip ready">Точно: ${totals.going}</span><span class="event-admin-chip ready">За столами: ${totals.bookedGuests || totals.booked}</span><span class="event-admin-chip">Пришли: ${totals.checkedIn}</span>`);
      const actions = card.querySelector(".event-admin-actions");
      actions?.insertAdjacentHTML("beforeend", `<button class="ghost" type="button" data-download-event-qr="${event.id}">QR входа · +${Number(config.reward || 0)}</button><button class="ghost" type="button" data-edit-event-qr="${event.id}">Настроить QR</button>`);
    }

    root.querySelectorAll("[data-download-event-qr]").forEach((button) => button.addEventListener("click", async () => {
      const event = events.find((item) => item.id === button.dataset.downloadEventQr);
      try {
        button.disabled = true;
        button.textContent = "Создаю QR…";
        await downloadQr(event);
        toast("QR-код мероприятия скачан");
      } catch (error) {
        toast(error.message || "Не удалось создать QR-код");
      } finally {
        button.disabled = false;
        button.textContent = `QR входа · +${Number(qrCodes()[event.id]?.reward || 0)}`;
      }
    }));

    root.querySelectorAll("[data-edit-event-qr]").forEach((button) => button.addEventListener("click", () => {
      const event = events.find((item) => item.id === button.dataset.editEventQr);
      const all = qrCodes();
      const config = ensureQr(event);
      const value = prompt(`Баллы за посещение «${event.title}»`, String(config.reward || 0));
      if (value === null) return;
      all[event.id] = { ...config, reward: Math.max(0, Number(value || 0)), updated_at: new Date().toISOString() };
      write(QR_KEY, all);
      toast("Настройки QR сохранены");
      render();
    }));
  }

  const baseRenderEvents = renderEvents;
  renderEvents = async function(root) {
    await baseRenderEvents(root);
    await decorateEventCards(root);
  };

  window.addEventListener("bali:event-engagement-changed", () => { if (state.view === "events") render(); });
  if (state.view === "events") render();
})();