(() => {
  if (window.__BALI_MENU_CATEGORIES_GUEST__) return;
  window.__BALI_MENU_CATEGORIES_GUEST__ = true;

  const KEY = "bali_menu_categories_v1";
  let selected = "Все";
  let patching = false;

  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  };

  function categoriesFromDom() {
    return [...document.querySelectorAll("#menuTabs [data-category]")]
      .map((button) => String(button.dataset.category || "").trim())
      .filter((name) => name && name !== "Все");
  }

  function ensureRegistry() {
    let rows = read();
    const domNames = categoriesFromDom();
    if (!rows.length && domNames.length) {
      rows = domNames.map((name, index) => ({ id: `category-${index + 1}`, name, sort_order: index + 1, active: true }));
      localStorage.setItem(KEY, JSON.stringify(rows));
    }
    return rows
      .filter((row) => row.active !== false && String(row.name || "").trim())
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  }

  function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function patchTabs() {
    const root = document.getElementById("menuTabs");
    if (!root || patching) return;
    const rows = ensureRegistry();
    if (!rows.length) return;
    const names = rows.map((row) => row.name);
    const currentActive = root.querySelector("[data-category].active")?.dataset.category;
    if (currentActive) selected = currentActive;
    if (selected !== "Все" && !names.includes(selected)) selected = "Все";

    const expected = ["Все", ...names];
    const buttons = [...root.querySelectorAll("[data-category]")];
    const current = buttons.map((button) => button.dataset.category);
    const selectedButton = buttons.find((button) => button.dataset.category === selected);
    if (JSON.stringify(current) === JSON.stringify(expected) && selectedButton?.classList.contains("active")) return;

    patching = true;
    root.innerHTML = expected.map((name) => `<button class="${name === selected ? "active" : ""}" data-category="${escapeHtml(name)}">${escapeHtml(name)}</button>`).join("");
    patching = false;
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("#menuTabs [data-category]");
    if (!button) return;
    selected = button.dataset.category || "Все";
    setTimeout(patchTabs, 0);
  }, true);

  const observer = new MutationObserver(() => requestAnimationFrame(patchTabs));
  observer.observe(document.documentElement, { subtree: true, childList: true });
  window.addEventListener("bali:menu-categories-changed", patchTabs);
  window.addEventListener("storage", (event) => {
    if (event.key === KEY) patchTabs();
    if (event.key === "bali_menu_v2") location.reload();
  });
  window.addEventListener("focus", patchTabs);
  setTimeout(patchTabs, 0);
})();
