(() => {
  if (window.__BALI_EVENT_QR_SAFETY_PRODUCTION__) return;
  window.__BALI_EVENT_QR_SAFETY_PRODUCTION__ = true;

  const attendance = window.BaliEventQrAttendance;
  if (!attendance) return;

  const baseCheckIn = attendance.checkIn?.bind(attendance);
  const baseLeave = attendance.leave?.bind(attendance);
  const baseList = attendance.listCheckins?.bind(attendance);
  const baseEnsure = attendance.ensureAllEvents?.bind(attendance);

  function capture(error, action) {
    window.BaliErrorBoundary?.capture?.(error, { module:"event-qr", action });
    console.warn(`[BALI QR ${action}]`, error?.message || error);
  }

  if (baseCheckIn) {
    attendance.checkIn = async raw => {
      try {
        const result = await baseCheckIn(raw);
        return result && typeof result === "object" ? result : { ok:false, message:"QR-код не обработан" };
      } catch (error) {
        capture(error, "check-in");
        return { ok:false, message:error?.message || "Не удалось подтвердить вход. Повторите сканирование." };
      }
    };
  }

  if (baseLeave) {
    attendance.leave = async eventId => {
      try {
        const result = await baseLeave(eventId);
        return result && typeof result === "object" ? result : { ok:false, message:"Не удалось завершить посещение" };
      } catch (error) {
        capture(error, "leave");
        return { ok:false, message:error?.message || "Не удалось завершить посещение" };
      }
    };
  }

  if (baseList) {
    attendance.listCheckins = async eventId => {
      try {
        const rows = await baseList(eventId);
        return Array.isArray(rows) ? rows : [];
      } catch (error) {
        capture(error, "list");
        return [];
      }
    };
  }

  if (baseEnsure) {
    attendance.ensureAllEvents = async () => {
      try {
        const rows = await baseEnsure();
        return Array.isArray(rows) ? rows : [];
      } catch (error) {
        capture(error, "ensure-events");
        return [];
      }
    };
  }
})();