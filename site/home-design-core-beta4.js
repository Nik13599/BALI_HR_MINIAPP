(() => {
  if (window.BaliHomeDesign) return;
  const KEY = "bali_home_design_v1";
  const defaults = {
    brand: { logo: "", name: "BALI", subtitle: "МИНСК · NIGHT CLUB" },
    global: { accent: "#c8ff3d", pageBackground: "#080a0a", text: "#f5f7f5" },
    hero: {
      eyebrow: "ЕДИНОЕ ПРИЛОЖЕНИЕ БАЛИ",
      title: "BALI",
      accentTitle: "",
      text: "BALI — приложение ночного клуба и комьюнити людей, объединённых музыкой, любимыми диджеями, артистами и яркими вечеринками.",
      backgroundColor: "#151a17",
      backgroundImage: "",
      align: "left",
      minHeight: 265,
      pills: ["Кирова, 13", "ПТ–СБ · 23:00–06:00", "5 минут от «Динамо»"]
    },
    actions: {
      backgroundColor: "transparent",
      backgroundImage: "",
      align: "center",
      events: { title: "Смотреть афиши", icon: "" },
      profile: { title: "Мой профиль", icon: "" }
    },
    controls: {
      arrowIcon: ""
    },
    stats: {
      points: { title: "Баллы", icon: "" },
      vip: { title: "VIP статус", icon: "" },
      game: { title: "Рейтинг в игре", icon: "" },
      rank: { title: "Общий рейтинг", subtitle: "Минск", icon: "" },
      notice: { title: "Уведомления", subtitle: "подарки и приглашения", icon: "" }
    },
    event: {
      empty: "Ближайшие события скоро появятся",
      kicker: "БЛИЖАЙШЕЕ СОБЫТИЕ",
      allEvents: "Посмотреть все мероприятия",
      participants: "участников",
      friends: "друзей",
      clans: "клана",
      join: "Я иду",
      book: "Забронировать",
      people: "Посмотреть людей и кланы",
      participantsIcon: "",
      friendsIcon: "",
      clansIcon: "",
      joinIcon: "",
      bookIcon: "",
      peopleIcon: ""
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
    booking: {
      title: "Ближайшее бронирование",
      empty: "У вас пока нет активной брони",
      choose: "Выбрать",
      open: "Открыть",
      icon: ""
    },
    upcoming: { title: "Три ближайших события", button: "Все афиши", backgroundColor: "#111413", backgroundImage: "", align: "left" },
    about: {
      heading: "О ЗАВЕДЕНИИ",
      title: "О клубе",
      text: "BALI — ночной клуб с большими экранами, танцполом, контактным баром, кальянами и комфортными столами.",
      icon: "",
      backgroundColor: "#111413",
      backgroundImage: "",
      align: "left"
    },
    social: {
      heading: "СОЦСЕТИ"
    },
    contacts: {
      title: "Связаться с BALI",
      backgroundColor: "#111413",
      backgroundImage: "",
      align: "left",
      instagram: { heading: "", title: "Instagram", subtitle: "Новости и атмосфера", href: "https://www.instagram.com/bali.minsk/", icon: "" },
      telegram: { heading: "", title: "Telegram", subtitle: "Канал клуба", href: "https://t.me/bali_minsk", icon: "" },
      tiktok: { heading: "", title: "TikTok", subtitle: "Видео из BALI", href: "https://www.tiktok.com/", icon: "" },
      manager: { heading: "СВЯЗАТЬСЯ С BALI", title: "Связаться с менеджером", subtitle: "Личный чат в Telegram", href: "https://t.me/bali_minsk", icon: "" },
      phone: { heading: "ТЕЛЕФОН", title: "Позвонить", subtitle: "+375 29 670-03-00", href: "+375296700300", icon: "" },
      map: { heading: "КАК НАС НАЙТИ", title: "Как добраться", subtitle: "Яндекс Карты", href: "https://yandex.by/maps/?text=%D0%9A%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%2013%20%D0%9C%D0%B8%D0%BD%D1%81%D0%BA", icon: "" }
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
