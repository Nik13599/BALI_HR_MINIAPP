(() => {
  if (window.BaliNavIcons) return;

  const KEY = "bali_nav_icons_v1";
  const DEFAULTS = [
    { page: "home", label: "Главная", iconText: "⌂", image: "./assets/bali-temple/nav-home.svg" },
    { page: "events", label: "Афиши", iconText: "◫", image: "./assets/bali-temple/nav-events.svg" },
    { page: "menu", label: "Меню", iconText: "◇", image: "./assets/bali-temple/nav-menu.svg" },
    { page: "dating", label: "BALI PEOPLE", iconText: "●", image: "./assets/bali-temple/nav-people.svg" },
    { page: "crown", label: "Игра", iconText: "◆", image: "./assets/bali-temple/nav-game.svg" },
    { page: "profile", label: "Профиль", iconText: "◎", image: "./assets/bali-temple/nav-profile.svg" },
  ];

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const normalize = (rows) => {
    const saved = new Map((Array.isArray(rows) ? rows : []).map((row) => [String(row.page || ""), row]));
    return DEFAULTS.map((fallback) => {
      const row = saved.get(fallback.page) || {};
      return {
        ...fallback,
        iconText: String(row.iconText ?? fallback.iconText).slice(0, 12),
        image: String(row.image ?? fallback.image).trim(),
      };
    });
  };

  function read() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "[]");
      return normalize(Array.isArray(saved) ? saved : saved.items);
    } catch {
      return clone(DEFAULTS);
    }
  }

  function write(rows) {
    const next = normalize(rows);
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("bali:nav-icons-changed", { detail: next }));
    return next;
  }

  function resetPage(page) {
    const current = read();
    const index = current.findIndex((row) => row.page === page);
    const fallback = DEFAULTS.find((row) => row.page === page);
    if (index >= 0 && fallback) current[index] = clone(fallback);
    return write(current);
  }

  function reset() {
    localStorage.removeItem(KEY);
    return write(DEFAULTS);
  }

  function item(page) {
    return read().find((row) => row.page === page) || DEFAULTS.find((row) => row.page === page);
  }

  function renderFallback(node, row) {
    node.classList.remove("nav-icon-image");
    node.replaceChildren();
    node.textContent = row?.iconText || "•";
  }

  function applyButton(button) {
    if (!button) return;
    const row = item(button.dataset.page);
    if (!row) return;
    let icon = button.querySelector("i");
    if (!icon) {
      icon = document.createElement("i");
      button.prepend(icon);
    }
    icon.setAttribute("aria-hidden", "true");
    if (!row.image) {
      renderFallback(icon, row);
      return;
    }
    icon.classList.add("nav-icon-image");
    icon.replaceChildren();
    const image = document.createElement("img");
    image.src = row.image;
    image.alt = "";
    image.draggable = false;
    image.addEventListener("error", () => renderFallback(icon, row), { once: true });
    icon.appendChild(image);
  }

  function applyAll(root = document) {
    root.querySelectorAll?.(".nav [data-page]").forEach(applyButton);
  }

  const imageData = (file, size = 256) => new Promise((resolve, reject) => {
    if (!file) return reject(new Error("Файл не выбран"));
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const context = canvas.getContext("2d");
      const scale = Math.max(size / image.width, size / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/webp", .9));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось прочитать изображение"));
    };
    image.src = url;
  });

  window.addEventListener("bali:nav-icons-changed", () => applyAll());
  window.addEventListener("storage", (event) => {
    if (event.key === KEY) applyAll();
  });
  ["bali:full-demo-ready", "bali:full-demo-enhancements-ready", "bali:match3-changed"].forEach((name) => {
    window.addEventListener(name, () => requestAnimationFrame(() => applyAll()));
  });

  window.BaliNavIcons = { KEY, DEFAULTS, read, write, reset, resetPage, item, applyButton, applyAll, imageData };
})();
