(() => {
  renderHall = function() {
    const hall = $("#hallMap");
    hall.innerHTML = state.availability.map((table) => {
      const details = [
        table.name,
        `${Number(table.seats || 0)} мест`,
        table.zone || "",
        Number(table.deposit || 0) > 0 ? `депозит ${Number(table.deposit).toLocaleString("ru-RU")} BYN` : "",
        table.available ? "свободен" : "занят"
      ].filter(Boolean).join(" · ");
      return `
        <button
          type="button"
          class="guest-table ${esc(table.shape || "round")} ${table.available ? "free" : "booked"} ${state.selectedTable === table.id ? "selected" : ""}"
          style="left:${Number(table.x)}%;top:${Number(table.y)}%"
          data-table="${table.id}"
          title="${esc(details)}"
          aria-label="${esc(details)}"
          ${table.available ? "" : "disabled"}>
          <b>${esc(tableNumber(table.name))}</b>
          <small>${table.available ? "свободен" : "занят"}</small>
        </button>`;
    }).join("");

    const selected = state.availability.find((table) => table.id === state.selectedTable);
    const selectedBox = $("#selectedTableText");
    if (selected) {
      const meta = [
        `${Number(selected.seats || 0)} мест`,
        selected.zone || "",
        Number(selected.deposit || 0) > 0 ? `минимальный депозит ${Number(selected.deposit).toLocaleString("ru-RU")} BYN` : ""
      ].filter(Boolean);
      selectedBox.innerHTML = `
        <strong>${esc(selected.name)}</strong>
        <span>${esc(meta.join(" · "))}</span>
        ${selected.description ? `<small>${esc(selected.description)}</small>` : ""}`;
    } else {
      selectedBox.textContent = "Выберите свободный стол на схеме";
    }
    $("#selectedTableId").value = selected?.id || "";
    window.BaliHallPlan?.apply(hall).catch(() => {});
  };

  window.addEventListener("bali:hall-plan-changed", () => {
    window.BaliHallPlan?.apply($("#hallMap")).catch(() => {});
  });

  setTimeout(() => {
    if (state.availability.length) renderHall();
    else window.BaliHallPlan?.apply($("#hallMap")).catch(() => {});
  }, 0);
})();