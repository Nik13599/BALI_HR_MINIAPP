(() => {
  if (window.__BALI_FIXED_LABELS_PRODUCTION__) return;
  window.__BALI_FIXED_LABELS_PRODUCTION__ = true;

  const style = document.createElement("style");
  style.id = "baliFixedLabelsProductionStyle";
  style.textContent = `
    #homeEventsCard .card-head h3,
    #homeAboutCard .card-head h3 {
      font-size: 0 !important;
      line-height: 0 !important;
      min-height: 1.25rem;
    }
    #homeEventsCard .card-head h3::after,
    #homeAboutCard .card-head h3::after {
      display: inline-block;
      font-size: 16px;
      line-height: 1.25;
      font-weight: 700;
      color: inherit;
      white-space: normal;
    }
    #homeEventsCard .card-head h3::after { content: "Ближайшие события"; }
    #homeAboutCard .card-head h3::after { content: "О клубе"; }
  `;
  document.head.appendChild(style);

  function apply() {
    const events = document.querySelector("#homeEventsCard .card-head h3");
    const about = document.querySelector("#homeAboutCard .card-head h3");
    if (events) {
      events.textContent = "";
      events.setAttribute("aria-label", "Ближайшие события");
      events.dataset.fixedLabel = "events";
    }
    if (about) {
      about.textContent = "";
      about.setAttribute("aria-label", "О клубе");
      about.dataset.fixedLabel = "about";
    }
  }

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      apply();
    });
  };

  new MutationObserver(records => {
    if (records.some(record => record.type === "childList" || record.type === "characterData")) schedule();
  }).observe(document.documentElement, { childList:true, subtree:true, characterData:true });

  [0, 30, 120, 400, 1200].forEach(delay => setTimeout(apply, delay));
  window.BaliFixedLabels = { apply };
})();