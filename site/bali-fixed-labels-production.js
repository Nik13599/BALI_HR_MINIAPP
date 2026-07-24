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

  const observers = new WeakMap();

  function protect(node, label, key) {
    if (!node) return;
    if (node.textContent !== label) node.textContent = label;
    if (node.getAttribute("aria-label") !== label) node.setAttribute("aria-label", label);
    if (node.dataset.fixedLabel !== key) node.dataset.fixedLabel = key;
    if (observers.has(node)) return;

    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        if (node.textContent !== label) node.textContent = label;
      });
    });
    observer.observe(node, { childList:true, subtree:true, characterData:true });
    observers.set(node, observer);
  }

  function apply() {
    protect(document.querySelector("#homeEventsCard .card-head h3"), "Ближайшие события", "events");
    protect(document.querySelector("#homeAboutCard .card-head h3"), "О клубе", "about");
  }

  [0, 30, 120, 400, 1200].forEach(delay => setTimeout(apply, delay));
  window.BaliFixedLabels = { apply };
})();