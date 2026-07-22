(() => {
  if (window.__BALI_EVENT_STABILITY_FINAL__) return;
  window.__BALI_EVENT_STABILITY_FINAL__ = true;
  let activeEventId = "";
  const eventDialog = () => document.getElementById("eventDialog");
  const detailsDialog = () => document.getElementById("eventDetailsLineupDialog");
  function cleanButtons() {
    const dialog = eventDialog();
    if (!dialog) return;
    const buttons = [...dialog.querySelectorAll("#eventMoreDetailsButton,[data-open-event-details]")];
    buttons.slice(1).forEach(node => node.remove());
    const first = buttons[0];
    if (first) {
      first.id = "eventMoreDetailsButton";
      first.dataset.openEventDetails = "";
      first.textContent = "Подробнее о событии";
    }
  }
  function syncEvent(target) {
    const eventId = target?.closest?.("[data-event]")?.dataset?.event;
    if (eventId) activeEventId = eventId;
    cleanButtons();
  }
  function closeDetails() {
    const dialog = detailsDialog();
    if (dialog?.open) {
      try { dialog.close(); } catch { dialog.removeAttribute("open"); }
    }
  }
  function goBooking() {
    closeDetails();
    const dialog = eventDialog();
    if (!dialog?.open) return;
    requestAnimationFrame(() => {
      const form = document.getElementById("bookingForm");
      form?.scrollIntoView({ behavior: "smooth", block: "start" });
      form?.querySelector("button,input,select")?.focus?.({ preventScroll: true });
    });
  }
  document.addEventListener("click", event => {
    const eventCard = event.target.closest("[data-event]");
    if (eventCard) {
      syncEvent(eventCard);
      setTimeout(cleanButtons, 30);
      setTimeout(cleanButtons, 180);
    }
    if (event.target.closest("[data-event-details-booking]")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      goBooking();
    }
    if (event.target.closest("[data-close-event-details]")) {
      event.preventDefault();
      closeDetails();
    }
  }, true);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && detailsDialog()?.open) {
      event.preventDefault();
      closeDetails();
    }
  }, true);
  eventDialog()?.addEventListener("close", () => {
    closeDetails();
    activeEventId = "";
    document.querySelector(".booking-data-overlay")?.classList.remove("open");
  });
  const observer = new MutationObserver(records => {
    if (records.some(record => [...record.addedNodes].some(node => node.nodeType === 1 && (node.id === "eventMoreDetailsButton" || node.querySelector?.("#eventMoreDetailsButton"))))) requestAnimationFrame(cleanButtons);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.BaliEventStabilityFinal = { cleanButtons, goBooking, get activeEventId(){ return activeEventId; } };
})();