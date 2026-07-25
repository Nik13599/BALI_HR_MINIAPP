(() => {
  if (window.__BALI_FULL_DEMO_REVIEW_WINDOW__) return;
  window.__BALI_FULL_DEMO_REVIEW_WINDOW__ = true;

  const game = window.BaliBeta4Game;
  if (!game) return;
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const TWELVE_HOURS = 12 * 60 * 60 * 1000;
  let activeEligibility = null;

  function identityKeys() {
    const profile = game.profile();
    return new Set(game.identityKeys(profile).map(String));
  }
  function eventEnd(event) {
    return window.BaliFullDemoEvents?.eventEnd?.(event) || new Date(`${event.event_date}T${event.event_end_time || "06:00"}:00`);
  }
  function alreadyReviewed(eventId) {
    const keys = identityKeys();
    return read("bali_reviews_v1", []).some(row => String(row.event_id || "") === String(eventId) && keys.has(String(row.user_key || "")) && row.type === "event");
  }
  function eligibleEvents() {
    const keys = identityKeys(), events = read("bali_events_v2", []), now = Date.now();
    const checkins = Object.values(read("bali_event_checkins_v1", {})).filter(row => keys.has(String(row.user_key || "")));
    return checkins.map(row => {
      const event = events.find(item => String(item.id) === String(row.event_id)) || { id:row.event_id,title:row.event_title,event_date:row.event_date,event_time:row.event_time,event_end_time:"06:00" };
      const end = eventEnd(event);
      return { row, event, end, expiresAt:new Date(end.getTime() + TWELVE_HOURS) };
    }).filter(item => new Date(item.row.checked_in_at || 0).getTime() <= now && item.expiresAt.getTime() >= now && !alreadyReviewed(item.event.id))
      .sort((a,b)=>b.expiresAt-a.expiresAt);
  }

  function mount() {
    const button = document.querySelector("[data-open-venue-review]");
    if (!button) return false;
    activeEligibility = eligibleEvents()[0] || null;
    button.hidden = !activeEligibility;
    button.disabled = !activeEligibility;
    button.classList.toggle("review-window-active", Boolean(activeEligibility));
    if (activeEligibility) {
      const hours = Math.max(1, Math.ceil((activeEligibility.expiresAt.getTime() - Date.now()) / 3600000));
      button.textContent = `Оставить отзыв · ${activeEligibility.event.title} · ещё ${hours} ч.`;
      button.title = "Доступно после QR-входа и в течение 12 часов после завершения события";
    }
    return true;
  }

  async function openEligibleReview() {
    activeEligibility = eligibleEvents()[0] || null;
    if (!activeEligibility) return;
    await window.BaliVenueReviewsUser?.openReview?.();
    const select = document.getElementById("reviewEventSelect");
    if (select) {
      select.innerHTML = `<option value="${esc(activeEligibility.event.id)}">${esc(activeEligibility.event.title)} · посещение подтверждено QR</option>`;
      select.value = String(activeEligibility.event.id);
    }
    const type = document.querySelector('#venueReviewForm [name="type"]');
    if (type) type.value = "event";
    const note = document.querySelector("#venueReviewDialog .review-note");
    if (note) note.textContent = `Отзыв доступен до ${activeEligibility.expiresAt.toLocaleString("ru-RU", {day:"2-digit",month:"long",hour:"2-digit",minute:"2-digit"})}. После этого окно автоматически закроется.`;
  }

  function toast(message) {
    const node = document.getElementById("toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2400);
  }

  document.addEventListener("click", event => {
    if (!event.target.closest("[data-open-venue-review]")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    activeEligibility = eligibleEvents()[0] || null;
    if (!activeEligibility) return toast("Отзыв доступен только после QR-входа и до 12 часов после завершения мероприятия");
    openEligibleReview();
  }, true);

  document.addEventListener("submit", event => {
    if (event.target.id !== "venueReviewForm") return;
    const eligible = eligibleEvents().find(item => String(item.event.id) === String(event.target.elements.event_id?.value));
    if (!eligible) {
      event.preventDefault();
      event.stopImmediatePropagation();
      toast("Срок отправки отзыва закончился или QR-вход не подтверждён");
      document.getElementById("venueReviewDialog")?.close();
      mount();
    }
  }, true);

  const refresh = () => requestAnimationFrame(mount);
  new MutationObserver(refresh).observe(document.documentElement, {childList:true,subtree:true});
  ["bali:checkin-complete","bali:checkin-left","bali:data-changed"].forEach(name => window.addEventListener(name, refresh));
  setInterval(mount, 60000);
  refresh();
  window.BaliFullDemoReviewWindow = { eligibleEvents, mount, openEligibleReview };
})();