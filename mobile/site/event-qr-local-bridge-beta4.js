(() => {
  const attendance = window.BaliEventQrAttendance;
  const store = window.BaliStore;
  if (!attendance || !store || store.cloudEnabled || attendance.__localBridge) return;
  attendance.__localBridge = true;
  const baseCheckIn = attendance.checkIn.bind(attendance);
  attendance.checkIn = async raw => {
    let result = await baseCheckIn(raw);
    const recoverable = /Мероприятие не найдено|другой версии мероприятия|не принадлежит активному мероприятию/.test(String(result.message || ""));
    if (result.ok || result.duplicate || !recoverable) return result;
    try {
      const parsed = attendance.parse(raw);
      const events = await store.list("events");
      const current = events.find(event => String(event.id) === String(parsed.eventId));
      await store.save("events", {
        ...(current || {}),
        id: parsed.eventId,
        title: parsed.title || current?.title || "Мероприятие BALI",
        description: current?.description || "Посещение подтверждено по QR-коду BALI",
        event_date: parsed.date || current?.event_date || new Date().toISOString().slice(0, 10),
        event_time: parsed.time || current?.event_time || "23:00",
        active: true,
        qr_token: parsed.token,
        qr_created_at: new Date().toISOString()
      });
      localStorage.removeItem("bali_event_qr_trust_v2");
      result = await baseCheckIn(raw);
    } catch {}
    return result;
  };
})();