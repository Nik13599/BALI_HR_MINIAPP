(() => {
  if (window.__BALI_ADMIN_USER_CARD_LINKS__) return;
  window.__BALI_ADMIN_USER_CARD_LINKS__ = true;

  const dossier = window.BaliAdminCustomerDossier;
  const store = window.BaliStore;
  const chipRequests = window.BaliChipRequests;
  if (!dossier || !store) return;

  const selectors = [
    ".bonus-pending-user strong",
    ".admin-chip-user strong",
    ".manager-guest h4",
    ".points-user-row strong",
    ".bonus-user-row strong",
    ".crown-person h4",
    ".vip-gift-list strong",
    ".vip-user-row strong",
    "#customerTable tbody td strong",
    ".event-attendee-row strong",
    ".attendee-user strong"
  ];

  const cleanName = value => String(value || "").split("·")[0].trim();
  const digits = value => String(value || "").replace(/\D/g, "");
  const telegram = value => (String(value || "").match(/@[A-Za-z0-9_]{3,}/)?.[0] || "").replace(/^@/, "");
  const phone = value => {
    const match = String(value || "").match(/(?:\+?\d[\d\s()\-]{7,}\d)/);
    return match ? digits(match[0]) : "";
  };

  function decorate(root = document) {
    root.querySelectorAll?.(selectors.join(",")).forEach(node => {
      if (node.dataset.adminUserLink === "1") return;
      node.dataset.adminUserLink = "1";
      node.classList.add("admin-user-link");
      node.setAttribute("role", "button");
      node.setAttribute("tabindex", "0");
      node.setAttribute("title", "Открыть полную карточку пользователя");
    });
  }

  async function referenceFor(node) {
    const row = node.closest("[data-manager-booking-row]");
    if (row) {
      const booking = (await store.list("bookings")).find(item => String(item.id) === String(row.dataset.managerBookingRow));
      if (booking) return booking;
    }

    const chipRow = node.closest(".bonus-pending-row,.admin-chip-row");
    if (chipRow && chipRequests?.list) {
      const id = chipRow.querySelector("[data-final-chip-fulfill],[data-final-chip-cancel],[data-chip-request-fulfill],[data-chip-request-cancel]")?.dataset.finalChipFulfill
        || chipRow.querySelector("[data-final-chip-cancel]")?.dataset.finalChipCancel
        || chipRow.querySelector("[data-chip-request-fulfill]")?.dataset.chipRequestFulfill
        || chipRow.querySelector("[data-chip-request-cancel]")?.dataset.chipRequestCancel;
      if (id) {
        const request = (await chipRequests.list()).find(item => String(item.id) === String(id));
        if (request) return request;
      }
    }

    const customerRow = node.closest("tr[data-customer-dossier]");
    if (customerRow) return { id: customerRow.dataset.customerDossier };

    const text = node.closest("article,tr,.panel,.manager-booking")?.textContent || node.parentElement?.textContent || node.textContent;
    return {
      name: cleanName(node.textContent),
      phone: phone(text),
      telegram: telegram(text),
      user_key: node.closest("[data-user-key]")?.dataset.userKey || ""
    };
  }

  async function open(node) {
    const ref = await referenceFor(node);
    dossier.open(ref);
  }

  document.addEventListener("click", event => {
    const node = event.target.closest('[data-admin-user-link="1"]');
    if (!node) return;
    event.preventDefault();
    event.stopPropagation();
    open(node);
  }, true);

  document.addEventListener("keydown", event => {
    if (!['Enter', ' '].includes(event.key)) return;
    const node = event.target.closest('[data-admin-user-link="1"]');
    if (!node) return;
    event.preventDefault();
    open(node);
  }, true);

  const observer = new MutationObserver(records => {
    if (records.some(record => record.addedNodes.length)) requestAnimationFrame(() => decorate());
  });
  observer.observe(document.body, { childList: true, subtree: true });
  decorate();
})();