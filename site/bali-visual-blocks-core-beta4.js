(() => {
  if (window.BaliVisualBlocks) return;

  const KEY = "bali_visual_blocks_v1";
  const STONE = "/site/assets/bali-temple/hero-stone-face.webp";
  const STATUES = "/site/assets/bali-temple/bronze-statues.webp";
  const BEAR = "/site/assets/bali-temple/gold-bear.webp";
  const GAME = "/site/assets/match3/background.webp";

  const GROUPS = [
    { id: "home", label: "Главная", page: "home" },
    { id: "events", label: "Афиши", page: "events" },
    { id: "menu", label: "Меню", page: "menu" },
    { id: "people", label: "BALI PEOPLE", page: "dating" },
    { id: "game", label: "Игра 3 в ряд", page: "crown" },
    { id: "profile", label: "Профиль", page: "profile" },
  ];

  const BLOCKS = [
    { id: "home.hero", group: "home", label: "Главный баннер", selector: '[data-screen="home"] .hero', titleSelector: "h1", defaultTitle: "BALI", width: 1600, height: 450, defaultImage: STONE, overlay: 48, position: "center" },
    { id: "home.checkin", group: "home", label: "QR-подтверждение входа", selector: "#eventQrHomeCard", titleSelector: "h3", defaultTitle: "Подтвердить вход", width: 1200, height: 800, defaultImage: STONE, overlay: 58, position: "center" },
    { id: "home.upcoming", group: "home", label: "Ближайшие события", selector: "#homeEvents", closest: "section.card", titleSelector: ".card-head h3", defaultTitle: "Ближайшие события", width: 1400, height: 900, defaultImage: STATUES, overlay: 68, position: "center" },
    { id: "home.social", group: "home", label: "Социальные сети", selector: ".home-social-section", titleSelector: "h3", defaultTitle: "Мы в соцсетях", width: 1200, height: 720, defaultImage: STATUES, overlay: 66, position: "center" },
    { id: "home.map", group: "home", label: "Карта и маршрут", selector: ".home-map-section", titleSelector: "h3", defaultTitle: "Как нас найти", width: 1200, height: 720, defaultImage: STONE, overlay: 68, position: "center" },
    { id: "home.contacts", group: "home", label: "Контакты клуба", selector: ".home-contact-section", titleSelector: "h3", defaultTitle: "Связаться с BALI", width: 1200, height: 720, defaultImage: STATUES, overlay: 68, position: "center" },
    { id: "home.about", group: "home", label: "О клубе", selector: '[data-screen="home"] .home-club-footer', titleSelector: ".card-head h3", defaultTitle: "Клуб BALI", width: 1400, height: 850, defaultImage: STONE, overlay: 62, position: "center" },

    { id: "events.header", group: "events", label: "Шапка афиш", selector: '[data-screen="events"] .head', titleSelector: "h2", defaultTitle: "Афиши", width: 1600, height: 600, defaultImage: STATUES, overlay: 52, position: "center" },
    { id: "events.catalog", group: "events", label: "Каталог событий", selector: "#eventsGrid", generatedTitle: true, defaultTitle: "Каталог событий", width: 1400, height: 900, defaultImage: STONE, overlay: 74, position: "center" },

    { id: "menu.header", group: "menu", label: "Шапка меню", selector: '[data-screen="menu"] .head', titleSelector: "h2", defaultTitle: "Меню", width: 1600, height: 600, defaultImage: BEAR, overlay: 55, position: "center" },
    { id: "menu.categories", group: "menu", label: "Категории меню", selector: "#menuTabs", generatedTitle: true, defaultTitle: "Категории меню", width: 1400, height: 520, defaultImage: STATUES, overlay: 74, position: "center" },
    { id: "menu.catalog", group: "menu", label: "Позиции меню", selector: "#menuList", generatedTitle: true, defaultTitle: "Позиции меню", width: 1400, height: 1000, defaultImage: STONE, overlay: 78, position: "center" },

    { id: "people.header", group: "people", label: "Шапка BALI PEOPLE", selector: '[data-screen="dating"] .head', titleSelector: "h2", defaultTitle: "Люди BALI", width: 1600, height: 600, defaultImage: STATUES, overlay: 54, position: "center" },
    { id: "people.filters", group: "people", label: "Фильтры сообщества", selector: '[data-screen="dating"] .social-tabs-v2', generatedTitle: true, defaultTitle: "Фильтры", width: 1400, height: 520, defaultImage: STONE, overlay: 74, position: "center" },
    { id: "people.connections", group: "people", label: "Знакомства и приглашения", selector: "#productionSocialPanel", generatedTitle: true, defaultTitle: "Заявки, приглашения и мои люди", width: 1400, height: 720, defaultImage: STONE, overlay: 74, position: "center" },
    { id: "people.catalog", group: "people", label: "Карточки участников", selector: "#socialV2Content", generatedTitle: true, defaultTitle: "Участники сообщества", width: 1400, height: 1000, defaultImage: STATUES, overlay: 78, position: "center" },

    { id: "game.header", group: "game", label: "Шапка игры", selector: ".match3-topbar", titleSelector: ".match3-brand h2", defaultTitle: "BALI Match", width: 1600, height: 600, defaultImage: GAME, overlay: 50, position: "center" },
    { id: "game.metrics", group: "game", label: "Показатели раунда", selector: ".match3-metrics", generatedTitle: true, defaultTitle: "Показатели раунда", width: 1400, height: 520, defaultImage: GAME, overlay: 72, position: "center" },
    { id: "game.board", group: "game", label: "Игровое поле", selector: ".match3-game-column .match3-panel", titleSelector: ".match3-panel-head h3", defaultTitle: "Ночной раунд", width: 1200, height: 1200, defaultImage: GAME, overlay: 76, position: "center" },
    { id: "game.ranking", group: "game", label: "Недельный рейтинг", selector: "#match3Ranking", closest: ".match3-panel", titleSelector: ".match3-panel-head h3", defaultTitle: "TOP 10 недели", width: 1200, height: 900, defaultImage: STATUES, overlay: 78, position: "center" },
    { id: "game.rewards", group: "game", label: "Награды TOP 10", selector: "#match3Rewards", closest: ".match3-panel", titleSelector: ".match3-panel-head h3", defaultTitle: "Награды TOP 10", width: 1200, height: 900, defaultImage: BEAR, overlay: 78, position: "center" },
    { id: "game.myRewards", group: "game", label: "Мои игровые награды", selector: "#match3MyRewards", closest: ".match3-panel", titleSelector: ".match3-panel-head h3", defaultTitle: "Мои награды", width: 1200, height: 900, defaultImage: BEAR, overlay: 78, position: "center" },

    { id: "profile.header", group: "profile", label: "Шапка профиля", selector: '[data-screen="profile"] .head', titleSelector: "h2", defaultTitle: "Мой профиль", width: 1600, height: 600, defaultImage: STONE, overlay: 54, position: "center" },
    { id: "profile.hero", group: "profile", label: "Карточка пользователя", selector: "#profileHero", generatedTitle: true, defaultTitle: "Карточка пользователя", width: 1200, height: 800, defaultImage: STONE, overlay: 60, position: "center" },
    { id: "profile.level", group: "profile", label: "Статус и прогресс", selector: "#xpCard", generatedTitle: true, defaultTitle: "Статус и прогресс", width: 1200, height: 720, defaultImage: STATUES, overlay: 72, position: "center" },
    { id: "profile.economy", group: "profile", label: "BALI Club: баллы, подарки и VIP", selector: "#productionProfileEconomy", titleSelector: ".card-head h3", defaultTitle: "BALI Club", width: 1200, height: 900, defaultImage: BEAR, overlay: 68, position: "center" },
    { id: "profile.shop", group: "profile", label: "BALI Shop", selector: "#profileV2Quick .profile-v2-tile.shop", titleSelector: "strong", defaultTitle: "BALI Shop", width: 1080, height: 1080, defaultImage: BEAR, overlay: 64, position: "center" },
    { id: "profile.rewards", group: "profile", label: "Мои награды", selector: "#profileV2Quick .profile-v2-tile.rewards", titleSelector: "strong", defaultTitle: "Мои награды", width: 1080, height: 1080, defaultImage: STATUES, overlay: 68, position: "center" },
    { id: "profile.invitations", group: "profile", label: "Приглашения", selector: "#profileV2Quick .profile-v2-tile.invites", titleSelector: "strong", defaultTitle: "Приглашения", width: 1080, height: 1080, defaultImage: STONE, overlay: 68, position: "center" },
    { id: "profile.gifts", group: "profile", label: "Мои подарки", selector: "#profileV2Quick .profile-v2-tile.gifts", titleSelector: "strong", defaultTitle: "Мои подарки", width: 1080, height: 1080, defaultImage: BEAR, overlay: 68, position: "center" },
  ];

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  };
  const definition = (id) => BLOCKS.find((block) => block.id === id);
  const blank = (block) => ({ title: "", image: "", overlay: block.overlay, position: block.position });
  const serverRaw = () => {
    if (!window.BaliProduction) return null;
    const platform = window.BaliProduction.state?.platform || {};
    const assets = new Map((platform.assets || []).map((asset) => [asset.asset_key, asset.url]));
    return Object.fromEntries((platform.blocks || [])
      .filter((row) => ["app", "game", "shared"].includes(row.scope))
      .map((row) => {
        const configuration = row.configuration && typeof row.configuration === "object"
          ? row.configuration
          : {};
        return [row.block_key, {
          title: row.title || "",
          image: row.asset_key ? assets.get(row.asset_key) || "" : String(configuration.image || ""),
          overlay: configuration.overlay,
          position: configuration.position,
        }];
      }));
  };

  function raw() {
    const serverValue = serverRaw();
    if (serverValue) return serverValue;
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
      return saved && typeof saved === "object" ? saved : {};
    } catch {
      return {};
    }
  }

  function normalize(value = raw()) {
    return Object.fromEntries(BLOCKS.map((block) => {
      const current = value?.[block.id] || {};
      return [block.id, {
        title: String(current.title || "").trim().slice(0, 120),
        image: String(current.image || "").trim(),
        overlay: clamp(current.overlay, 0, 88, block.overlay),
        position: ["center", "top", "bottom", "left", "right"].includes(current.position) ? current.position : block.position,
      }];
    }));
  }

  function compact(value) {
    const normalized = normalize(value);
    return Object.fromEntries(BLOCKS.flatMap((block) => {
      const current = normalized[block.id];
      if (!current.title && !current.image) return [];
      return [[block.id, current]];
    }));
  }

  function read() {
    return normalize();
  }

  function write(value) {
    const next = compact(value);
    if (window.BaliProduction) return normalize(next);
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("bali:visual-blocks-changed", { detail: clone(next) }));
    return normalize(next);
  }

  function updateBlock(id, patch = {}) {
    const block = definition(id);
    if (!block) return read();
    const next = read();
    next[id] = { ...next[id], ...patch };
    return write(next);
  }

  function resetBlock(id) {
    const next = raw();
    delete next[id];
    return write(next);
  }

  function reset() {
    if (window.BaliProduction) return read();
    localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent("bali:visual-blocks-changed", { detail: {} }));
    return read();
  }

  const titleOriginals = new WeakMap();
  const styleOriginals = new WeakMap();

  function targets(block) {
    const found = [...document.querySelectorAll(block.selector)];
    if (!block.closest) return found;
    return [...new Set(found.map((node) => node.closest(block.closest)).filter(Boolean))];
  }

  function titleNodes(target, block) {
    if (!block.titleSelector) return [];
    if (target.matches?.(block.titleSelector)) return [target];
    return [...target.querySelectorAll(block.titleSelector)];
  }

  function restoreTitle(target, block) {
    titleNodes(target, block).forEach((node) => {
      if (!titleOriginals.has(node)) return;
      node.innerHTML = titleOriginals.get(node);
      titleOriginals.delete(node);
      node.removeAttribute("data-bali-title-custom");
    });
    document.querySelectorAll("[data-bali-generated-for]").forEach((node) => {
      if (node.dataset.baliGeneratedFor === block.id) node.remove();
    });
  }

  function applyTitle(target, block, title) {
    restoreTitle(target, block);
    if (!title) return;
    if (block.generatedTitle) {
      const heading = document.createElement("h3");
      heading.className = "bali-generated-block-title";
      heading.dataset.baliGeneratedFor = block.id;
      heading.textContent = title;
      target.insertAdjacentElement("beforebegin", heading);
      return;
    }
    titleNodes(target, block).forEach((node) => {
      if (!titleOriginals.has(node)) titleOriginals.set(node, node.innerHTML);
      node.textContent = title;
      node.dataset.baliTitleCustom = block.id;
    });
  }

  function rememberStyle(target) {
    if (styleOriginals.has(target)) return;
    styleOriginals.set(target, {
      image: target.style.getPropertyValue("background-image"),
      imagePriority: target.style.getPropertyPriority("background-image"),
      size: target.style.getPropertyValue("background-size"),
      sizePriority: target.style.getPropertyPriority("background-size"),
      position: target.style.getPropertyValue("background-position"),
      positionPriority: target.style.getPropertyPriority("background-position"),
      repeat: target.style.getPropertyValue("background-repeat"),
      repeatPriority: target.style.getPropertyPriority("background-repeat"),
    });
  }

  function restoreStyle(target) {
    const original = styleOriginals.get(target);
    if (original) {
      const restore = (name, value, priority) => value ? target.style.setProperty(name, value, priority) : target.style.removeProperty(name);
      restore("background-image", original.image, original.imagePriority);
      restore("background-size", original.size, original.sizePriority);
      restore("background-position", original.position, original.positionPriority);
      restore("background-repeat", original.repeat, original.repeatPriority);
      styleOriginals.delete(target);
    } else if (target.dataset.baliVisualImage) {
      ["background-image", "background-size", "background-position", "background-repeat"].forEach((name) => target.style.removeProperty(name));
    }
    target.classList.remove("bali-visual-block-custom");
    delete target.dataset.baliVisualImage;
  }

  function cssUrl(value) {
    return `url("${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]/g, "")}")`;
  }

  function applyImage(target, current) {
    restoreStyle(target);
    if (!current.image) return;
    rememberStyle(target);
    const alpha = clamp(current.overlay, 0, 88, 60) / 100;
    target.style.setProperty("background-image", `linear-gradient(rgba(4,5,4,${alpha}),rgba(4,5,4,${Math.min(.94, alpha + .12)})),${cssUrl(current.image)}`, "important");
    target.style.setProperty("background-size", "cover", "important");
    target.style.setProperty("background-position", current.position || "center", "important");
    target.style.setProperty("background-repeat", "no-repeat", "important");
    target.classList.add("bali-visual-block-custom");
    target.dataset.baliVisualImage = "true";
  }

  function applyBlock(id, state = read()) {
    const block = definition(id);
    if (!block) return 0;
    const current = state[id] || blank(block);
    const found = targets(block);
    found.forEach((target) => {
      target.dataset.baliVisualBlock = block.id;
      applyTitle(target, block, current.title);
      applyImage(target, current);
    });
    if (!found.length) {
      document.querySelectorAll("[data-bali-generated-for]").forEach((node) => {
        if (node.dataset.baliGeneratedFor === block.id && !current.title) node.remove();
      });
    }
    return found.length;
  }

  function applyAll() {
    const state = read();
    let count = 0;
    BLOCKS.forEach((block) => { count += applyBlock(block.id, state); });
    document.documentElement.dataset.baliVisualBlocks = "ready";
    return count;
  }

  function imageData(file, width, height, quality = .78) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error("Файл не выбран"));
      if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) return reject(new Error("Поддерживаются PNG, JPG и WEBP"));
      if (file.size > 12 * 1024 * 1024) return reject(new Error("Файл больше 12 МБ"));
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        const outputWidth = Math.max(320, Number(width) || 1200);
        const outputHeight = Math.max(240, Number(height) || 800);
        const canvas = document.createElement("canvas");
        canvas.width = outputWidth;
        canvas.height = outputHeight;
        const context = canvas.getContext("2d");
        const scale = Math.max(outputWidth / image.width, outputHeight / image.height);
        const drawWidth = image.width * scale;
        const drawHeight = image.height * scale;
        context.drawImage(image, (outputWidth - drawWidth) / 2, (outputHeight - drawHeight) / 2, drawWidth, drawHeight);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/webp", quality));
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Не удалось прочитать изображение"));
      };
      image.src = url;
    });
  }

  const refreshEvents = [
    "bali:visual-blocks-changed",
    "bali:production-refreshed",
    "bali:full-demo-ready",
    "bali:full-demo-enhancements-ready",
    "bali:home-design-changed",
    "bali:match3-changed",
    "bali:beta4-changed",
    "bali:points-changed",
    "bali:profile-v2-mounted",
    "bali:social-changed",
    "bali:data-changed",
  ];
  refreshEvents.forEach((name) => window.addEventListener(name, () => requestAnimationFrame(applyAll)));
  window.addEventListener("storage", (event) => {
    if (window.BaliProduction) return;
    if (event.key === KEY) requestAnimationFrame(applyAll);
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest?.("[data-page]")) setTimeout(applyAll, 80);
  }, true);

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    const count = applyAll();
    if (count >= 16 || attempts >= 80) clearInterval(timer);
  }, 100);

  window.BaliVisualBlocks = {
    KEY,
    GROUPS: clone(GROUPS),
    BLOCKS: clone(BLOCKS),
    read,
    write,
    updateBlock,
    resetBlock,
    reset,
    applyBlock,
    applyAll,
    imageData,
  };
})();
