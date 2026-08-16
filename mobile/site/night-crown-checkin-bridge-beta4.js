(() => {
  if(window.__BALI_NIGHT_CROWN_CHECKIN_BRIDGE__)return;window.__BALI_NIGHT_CROWN_CHECKIN_BRIDGE__=true;
  const attendance=window.BaliEventQrAttendance;if(!attendance?.checkIn)return;
  const base=attendance.checkIn.bind(attendance);
  attendance.checkIn=async function(...args){const result=await base(...args);if(result?.ok)window.dispatchEvent(new CustomEvent("bali:checkin-complete",{detail:result}));return result};
})();