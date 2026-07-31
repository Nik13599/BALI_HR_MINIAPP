(() => {
  "use strict";
  if (window.__BALI_PRODUCTION_BOOKING_QR__) return;
  window.__BALI_PRODUCTION_BOOKING_QR__ = true;

  const production = window.BaliProduction;
  if (!production) return;

  function activeBooking() {
    const today = new Date().toISOString().slice(0, 10);
    return production.state.bookings
      .filter(row =>
        row.booking_date >= today &&
        ["new", "pending", "confirmed"].includes(String(row.status))
      )
      .sort((left, right) =>
        `${left.booking_date}${left.booking_time || ""}`.localeCompare(
          `${right.booking_date}${right.booking_time || ""}`
        )
      )[0] || null;
  }

  function ensureDialog() {
    let dialog = document.getElementById("productionBookingQrDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "productionBookingQrDialog";
    dialog.className = "dialog production-qr-dialog";
    dialog.innerHTML = `
      <div class="sheet">
        <button class="close" type="button" data-close-production-qr>×</button>
        <div class="dialog-content">
          <span class="eyebrow">ОДНОКРАТНЫЙ QR-CHECK-IN</span>
          <h2>Покажите код сотруднику BALI</h2>
          <div class="production-qr-image" id="productionBookingQrImage"></div>
          <p class="detail-copy" id="productionBookingQrMeta"></p>
          <p class="muted">Новый код отменяет предыдущий. После check-in повторное использование невозможно.</p>
        </div>
      </div>`;
    document.body.appendChild(dialog);
    return dialog;
  }

  function decorate() {
    const card = document.getElementById("nextBookingCard");
    const booking = activeBooking();
    if (!card || !booking) return;
    let button = card.querySelector("[data-production-booking-qr]");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "primary full";
      button.dataset.productionBookingQr = "";
      button.textContent = "Показать QR для входа";
      card.appendChild(button);
    }
    button.dataset.bookingId = booking.id;
  }

  async function showQr(bookingId, button) {
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Создаём защищённый QR…";
    try {
      const result = await production.api(`/api/v1/bookings/${encodeURIComponent(bookingId)}/qr`, {
        method: "POST",
        body: "{}",
      });
      const booking = production.state.bookings.find(row => row.id === bookingId);
      const dialog = ensureDialog();
      const image = document.createElement("img");
      image.src = result.qrDataUrl;
      image.alt = "QR-код бронирования BALI";
      document.getElementById("productionBookingQrImage").replaceChildren(image);
      document.getElementById("productionBookingQrMeta").textContent =
        `${booking?.event_title || "Мероприятие BALI"} · ${booking?.table_name || "стол"} · действует до ${new Date(result.qr.expires_at).toLocaleString("ru-RU")}`;
      if (!dialog.open) dialog.showModal();
    } catch (error) {
      window.alert(error.message || "Не удалось создать QR-код");
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-production-booking-qr]");
    if (button) {
      event.preventDefault();
      showQr(button.dataset.bookingId, button);
      return;
    }
    if (event.target.closest("[data-close-production-qr]")) {
      document.getElementById("productionBookingQrDialog")?.close();
    }
  });
  window.addEventListener("bali:production-refreshed", () => requestAnimationFrame(decorate));
  window.addEventListener("bali:beta4-changed", () => requestAnimationFrame(decorate));
  new MutationObserver(decorate).observe(document.body, { childList: true, subtree: true });
  requestAnimationFrame(decorate);
})();
