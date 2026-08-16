(() => {
  if (window.__BALI_ADMIN_EVENT_TIME_FIELDS__) return;
  window.__BALI_ADMIN_EVENT_TIME_FIELDS__ = true;
  try {
    if (typeof editorDefinitions === "undefined" || !editorDefinitions.events?.fields) return;
    const fields = editorDefinitions.events.fields;
    if (!fields.some(field => field[0] === "event_end_time")) {
      const timeIndex = fields.findIndex(field => field[0] === "event_time");
      fields.splice(timeIndex + 1, 0,
        ["event_end_date", "Дата окончания, если отличается", "date"],
        ["event_end_time", "Время окончания", "time", false]
      );
    }
    const originalOpenEditor = typeof openEditor === "function" ? openEditor : null;
    if (originalOpenEditor) {
      openEditor = async function(type, row = null) {
        const result = await originalOpenEditor(type, row);
        if (type === "events") {
          const endTime = document.querySelector('#editorFields [name="event_end_time"]');
          if (endTime && !endTime.value) endTime.value = "06:00";
        }
        return result;
      };
    }
  } catch (error) {
    console.warn("Не удалось добавить время окончания события", error);
  }
})();