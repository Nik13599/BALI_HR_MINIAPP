(() => {
  function patchLabels(root = document) {
    root.querySelectorAll(".event-admin-chip").forEach((chip) => {
      if (chip.textContent.trim().startsWith("Точно:")) chip.textContent = chip.textContent.replace(/^Точно:/, "Без стола:");
    });
    root.querySelectorAll(".event-attendees-summary span").forEach((label) => {
      if (label.textContent.trim() === "ТОЧНО ПРИДУТ") label.textContent = "БЕЗ БРОНИ";
    });
    root.querySelectorAll(".event-attendee-group h3").forEach((title) => {
      if (title.textContent.trim() === "Точно придёт") title.textContent = "Придут без брони / контактный бар";
    });
    root.querySelectorAll(".event-attendee-row strong").forEach((label) => {
      if (label.textContent.trim() === "Точно придёт") label.textContent = "Придёт без брони";
    });
    const note = root.querySelector(".event-attendees-note");
    if (note && !note.dataset.modeNote) {
      note.dataset.modeNote = "true";
      note.insertAdjacentText("beforeend", " Гости без брони не занимают стол: они планируют клубный формат, танцпол и контактный бар. Брони столов считаются отдельно.");
    }
  }

  const observer = new MutationObserver(() => patchLabels());
  observer.observe(document.body, { childList: true, subtree: true });
  patchLabels();
})();