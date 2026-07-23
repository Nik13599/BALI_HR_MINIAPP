(() => {
  if (window.BaliEventLifecycle || !window.BaliStore) return;
  const store = window.BaliStore;
  const originalList = store.list.bind(store);

  const dateAt = (date, time = "00:00") => {
    if (!date) return null;
    const value = new Date(`${String(date).slice(0, 10)}T${String(time || "00:00").slice(0, 5)}:00`);
    return Number.isNaN(value.getTime()) ? null : value;
  };

  function endAt(event = {}) {
    const startDate = event.event_date || event.eventDate || "";
    const startTime = event.event_time || event.eventTime || "23:00";
    const endTime = event.event_end_time || event.eventEndTime || event.end_time || "06:00";
    let endDate = event.event_end_date || event.eventEndDate || event.end_date || startDate;
    if (!endDate) return null;
    if (!event.event_end_date && !event.eventEndDate && !event.end_date && String(endTime) <= String(startTime)) {
      const next = dateAt(startDate, "12:00");
      if (next) {
        next.setDate(next.getDate() + 1);
        endDate = next.toISOString().slice(0, 10);
      }
    }
    return dateAt(endDate, endTime);
  }

  const isCompleted = event => {
    const end = endAt(event);
    return Boolean(end && end.getTime() <= Date.now());
  };
  const isVisible = event => event?.active !== false && !isCompleted(event);

  store.listAll = originalList;
  store.list = async function(table, options = {}) {
    const rows = await originalList(table, options);
    if (table !== "events" || document.getElementById("adminNav") || options.includeCompleted === true) return rows;
    return rows.filter(isVisible);
  };

  window.BaliEventLifecycle = { endAt, isCompleted, isVisible, listAll: (...args) => originalList(...args) };
})();