(() => {
  if (window.__BALI_HOME_STATIC_TITLES_PRODUCTION__) return;
  window.__BALI_HOME_STATIC_TITLES_PRODUCTION__ = true;

  const definitions = [
    { cardId:"homeEventsCard", key:"events", label:"Ближайшие события" },
    { cardId:"homeAboutCard", key:"about", label:"О клубе" }
  ];

  const style = document.createElement("style");
  style.id = "baliHomeStaticTitlesStyle";
  style.textContent = `
    #homeEventsCard .card-head > h3,
    #homeAboutCard .card-head > h3 {
      display:none!important;
      visibility:hidden!important;
      position:absolute!important;
      inline-size:1px!important;
      block-size:1px!important;
      overflow:hidden!important;
      pointer-events:none!important;
    }
    .bali-home-static-title {
      display:block;
      margin:0;
      color:inherit;
      font:700 16px/1.25 inherit;
      letter-spacing:normal;
      white-space:normal;
    }
  `;
  document.head.appendChild(style);

  function install({ cardId, key, label }) {
    const head = document.querySelector(`#${cardId} .card-head`);
    if (!head) return false;

    const legacy = head.querySelector(":scope > h3");
    if (legacy) {
      legacy.hidden = true;
      legacy.setAttribute("aria-hidden", "true");
      legacy.tabIndex = -1;
    }

    let title = head.querySelector(`:scope > [data-bali-static-title="${key}"]`);
    if (!title) {
      title = document.createElement("span");
      title.className = "bali-home-static-title";
      title.dataset.baliStaticTitle = key;
      const action = head.querySelector(":scope > button, :scope > a");
      head.insertBefore(title, action || head.firstChild);
    }

    title.textContent = label;
    title.setAttribute("role", "heading");
    title.setAttribute("aria-level", "3");
    return true;
  }

  function apply() {
    return definitions.every(install);
  }

  window.addEventListener("bali:app-mounted", apply, { once:true });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply, { once:true });
  }

  window.BaliHomeStaticTitles = { apply };
})();
