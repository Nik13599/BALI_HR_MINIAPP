(() => {
  const attendance = window.BaliEventQrAttendance;
  const store = window.BaliStore;
  if (!attendance || !store || store.cloudEnabled || attendance.__localBridge) return;
  attendance.__localBridge = true;
  const baseCheckIn = attendance.checkIn.bind(attendance);
  attendance.checkIn = async raw => {
    let result = await baseCheckIn(raw);
    if (result.ok || result.duplicate || !/Мероприятие не найдено/.test(String(result.message || ""))) return result;
    try {
      const parsed = attendance.parse(raw);
      const events = await store.list("events");
      if (!events.some(event => String(event.id) === String(parsed.eventId))) {
        await store.save("events", {
          id: parsed.eventId,
          title: parsed.title || "Мероприятие BALI",
          description: "Посещение подтверждено по QR-коду BALI",
          event_date: parsed.date || new Date().toISOString().slice(0, 10),
          event_time: parsed.time || "23:00",
          active: true,
          qr_token: parsed.token,
          qr_created_at: new Date().toISOString()
        });
      }
      result = await baseCheckIn(raw);
    } catch {}
    return result;
  };
})();