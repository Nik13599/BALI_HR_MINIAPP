(() => {
  if (window.BaliHomeDesign) return;
  const KEY = "bali_home_design_v1";
  const defaults = {
    brand: { logo: "", name: "BALI", subtitle: "МИНСК · NIGHT CLUB" },
    global: { accent: "#c8ff3d", pageBackground: "#080a0a", text: "#f5f7f5" },
    hero: {
      eyebrow: "NIGHT CLUB · CONTACT BAR · 18+",
      title: "Твоя ночь",
      accentTitle: "начинается здесь",
      text: "Клубный формат BALI: события, танцпол, контактный бар, кальяны и индивидуальная рассадка столов.",
      backgroundColor: "#151a17",
      backgroundImage: "",
      align: "left",
      minHeight: 310,
      pills: ["Кирова, 13", "ПТ–СБ · 23:00–06:00", "5 минут от «Динамо»"]
    },
    actions: {
      backgroundColor: "transparent",
      backgroundImage: "",
      align: "center",
      events: { title: "Смотреть афиши", icon: "" },
      profile: { title: "Мой профиль", icon: "" }
    },
    checkin: {
      eyebrow: "Я УЖЕ В BALI",
      title: "Подтвердить вход",
      text: "Отсканируйте QR-код мероприятия у хостес, чтобы посещение попало в профиль, рейтинг и систему наград.",
      button: "Сканировать QR-код",
      icon: "",
      backgroundColor: "#121914",
      backgroundImage: "",
      align: "left"
    },
    upcoming: { title: "Три ближайших события", button: "Все афиши", backgroundColor: "#111413", backgroundImage: "", align: "left" },
    about: {
      title: "О клубе",
      text: "BALI — ночной клуб с большими экранами, танцполом, контактным баром, кальянами и комфортными столами.",
      backgroundColor: "#111413",
      backgroundImage: "",
      align: "left"
    },
    contacts: {
      title: "Связаться с BALI",
      backgroundColor: "#111413",
      backgroundImage: "",
      align: "left",
      instagram: { title: "Instagram", subtitle: "Новости и атмосфера", icon: "" },
      telegram: { title: "Telegram", subtitle: "Канал клуба", icon: "" },
      manager: { title: "Связаться с менеджером", subtitle: "Личный чат в Telegram", icon: "" },
      phone: { title: "Позвонить", subtitle: "+375 29 670-03-00", icon: "" },
      map: { title: "Как добраться", subtitle: "Яндекс Карты", icon: "" }
    }
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  const merge = (base, patch) => {
    const out = clone(base);
    const walk = (target, source) => Object.entries(source || {}).forEach(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value) && target[key] && typeof target[key] === "object" && !Array.isArray(target[key])) walk(target[key], value);
      else target[key] = value;
    });
    walk(out, patch || {});
    return out;
  };
  const read = () => {
    try { return merge(defaults, JSON.parse(localStorage.getItem(KEY) || "{}")); }
    catch { return clone(defaults); }
  };
  const write = value => {
    const next = merge(defaults, value || {});
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("bali:home-design-changed", { detail: next }));
    return next;
  };
  const reset = () => { localStorage.removeItem(KEY); return write(defaults); };
  const imageData = (file, max = 1600, quality = .86) => new Promise((resolve, reject) => {
    if (!file) return reject(new Error("Файл не выбран"));
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, max / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", quality));
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Не удалось прочитать изображение")); };
    image.src = url;
  });
  window.BaliHomeDesign = { KEY, defaults, read, write, reset, imageData };
})();