(() => {
  const prizes = [
    { name: "Пиво", weight: 24, color: "#335d49" },
    { name: "Коктейль", weight: 18, color: "#754d9a" },
    { name: "5 шотов", weight: 16, color: "#9a5f31" },
    { name: "10 шотов", weight: 8, color: "#8d3446" },
    { name: "Текила", weight: 14, color: "#87772d" },
    { name: "Без выигрыша", weight: 20, color: "#303633" }
  ];
  const storageKey = "bali_fortune_codes_v1";
  const defaultCodes = ["BALI-777", "BALI-2026", "LUCKY-13"];
  const state = { spinning: false, rotation: 0 };
  const $ = (s) => document.querySelector(s);
  const tg = window.Telegram?.WebApp;
  const haptic = (kind = "medium") => { try { tg?.HapticFeedback?.impactOccurred(kind); } catch {} };

  function loadCodes() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (Array.isArray(saved) && saved.length) return saved;
    } catch {}
    const initial = defaultCodes.map((code) => ({ code, used: false, createdAt: Date.now() }));
    localStorage.setItem(storageKey, JSON.stringify(initial));
    return initial;
  }

  function saveCodes(codes) { localStorage.setItem(storageKey, JSON.stringify(codes)); }

  function buildWheel() {
    const wheel = $("#fortuneWheel");
    if (!wheel) return;
    const segment = 360 / prizes.length;
    wheel.style.background = `conic-gradient(${prizes.map((p, i) => `${p.color} ${i * segment}deg ${(i + 1) * segment}deg`).join(",")})`;
    wheel.innerHTML = prizes.map((prize, index) => `<div class="fortune-label" style="transform:rotate(${index * segment + segment / 2}deg)"><span>${prize.name}</span></div>`).join("");
  }

  function pickPrize() {
    const total = prizes.reduce((sum, p) => sum + p.weight, 0);
    let cursor = Math.random() * total;
    for (let i = 0; i < prizes.length; i += 1) {
      cursor -= prizes[i].weight;
      if (cursor <= 0) return i;
    }
    return prizes.length - 1;
  }

  function setStatus(text, win = false) {
    const status = $("#fortuneStatus");
    status.textContent = text;
    status.classList.toggle("win", win);
  }

  function renderCodes() {
    const list = $("#fortuneCodeList");
    if (!list) return;
    list.innerHTML = loadCodes().map((item) => `<code class="${item.used ? "used" : ""}">${item.code}${item.used ? " · использован" : ""}</code>`).join("");
  }

  function spin(code) {
    if (state.spinning) return;
    const codes = loadCodes();
    const normalized = String(code || "").trim().toUpperCase();
    const item = codes.find((entry) => entry.code === normalized);
    if (!item) return setStatus("Код не найден. Проверьте написание.");
    if (item.used) return setStatus("Этот код уже использован.");

    item.used = true;
    item.usedAt = Date.now();
    saveCodes(codes);
    renderCodes();

    const index = pickPrize();
    const segment = 360 / prizes.length;
    const target = 360 - (index * segment + segment / 2);
    state.rotation += 360 * 7 + target - (state.rotation % 360);
    state.spinning = true;
    setStatus("Колесо вращается…");
    haptic("heavy");
    const wheel = $("#fortuneWheel");
    wheel.style.transform = `rotate(${state.rotation}deg)`;
    setTimeout(() => {
      state.spinning = false;
      setStatus(`Ваш приз: ${prizes[index].name}`, prizes[index].name !== "Без выигрыша");
      haptic(prizes[index].name === "Без выигрыша" ? "light" : "heavy");
    }, 5600);
  }

  function generateCode() {
    const prefix = "BALI";
    const code = `${prefix}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const codes = loadCodes();
    codes.unshift({ code, used: false, createdAt: Date.now() });
    saveCodes(codes);
    renderCodes();
    const out = $("#generatedCode");
    out.value = code;
    out.select();
    navigator.clipboard?.writeText(code).catch(() => {});
    setStatus(`Новый код создан: ${code}`);
  }

  document.addEventListener("DOMContentLoaded", () => {
    buildWheel();
    renderCodes();
    $("#fortuneForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      spin($("#fortuneCode").value);
    });
    $("#fortuneAdminToggle")?.addEventListener("click", () => $("#fortuneAdmin").classList.toggle("open"));
    $("#generateFortuneCode")?.addEventListener("click", generateCode);
    $("#resetFortuneCodes")?.addEventListener("click", () => {
      localStorage.removeItem(storageKey);
      renderCodes();
      setStatus("Коды сброшены до тестового набора.");
    });
  });
})();