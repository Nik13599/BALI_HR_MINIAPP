(() => {
  const prizes = [
    { name: "Пиво", short: "ПИВО", icon: "🍺", weight: 24, color: "#c78d2c" },
    { name: "Коктейль", short: "КОКТЕЙЛЬ", icon: "🍸", weight: 18, color: "#7a2947" },
    { name: "5 шотов", short: "5 ШОТОВ", icon: "🥃", weight: 16, color: "#24604f" },
    { name: "10 шотов", short: "10 ШОТОВ", icon: "🔥", weight: 8, color: "#9b3c2f" },
    { name: "Текила", short: "ТЕКИЛА", icon: "🍋", weight: 14, color: "#9b7928" },
    { name: "Без выигрыша", short: "ЕЩЁ РАЗ", icon: "✦", weight: 20, color: "#252927" }
  ];

  const storageKey = "bali_fortune_codes_v2";
  const defaultCodes = ["BALI-777", "BALI-2026", "LUCKY-13"];
  const spinDuration = 5600;
  const state = { spinning: false, rotation: 0, selectedIndex: null };
  const $ = (selector) => document.querySelector(selector);
  const tg = window.Telegram?.WebApp;

  const normalizeAngle = (angle) => ((angle % 360) + 360) % 360;
  const haptic = (kind = "medium") => {
    try { tg?.HapticFeedback?.impactOccurred(kind); } catch {}
  };
  const notify = (kind = "success") => {
    try { tg?.HapticFeedback?.notificationOccurred(kind); } catch {}
  };

  function loadCodes() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (Array.isArray(saved) && saved.length) return saved;
    } catch {}

    const initial = defaultCodes.map((code) => ({ code, used: false, createdAt: Date.now() }));
    saveCodes(initial);
    return initial;
  }

  function saveCodes(codes) {
    try { localStorage.setItem(storageKey, JSON.stringify(codes)); } catch {}
  }

  function buildLights() {
    const holder = $("#fortuneLights");
    if (!holder) return;
    holder.innerHTML = Array.from({ length: 24 }, (_, index) => {
      const angle = index * (360 / 24);
      return `<i style="--light-angle:${angle}deg;--light-delay:${index * -0.07}s"></i>`;
    }).join("");
  }

  function buildWheel() {
    const wheel = $("#fortuneWheel");
    if (!wheel) return;

    const segment = 360 / prizes.length;
    wheel.style.background = `conic-gradient(from 0deg, ${prizes
      .map((prize, index) => `${prize.color} ${index * segment}deg ${(index + 1) * segment}deg`)
      .join(",")})`;

    const labels = prizes.map((prize, index) => {
      const midpoint = index * segment + segment / 2;
      const radians = (midpoint - 90) * Math.PI / 180;
      const x = 50 + Math.cos(radians) * 31;
      const y = 50 + Math.sin(radians) * 31;
      const textRotation = midpoint > 90 && midpoint < 270 ? midpoint + 180 : midpoint;
      return `
        <div class="fortune-label" style="left:${x}%;top:${y}%;--label-rotation:${textRotation}deg">
          <span class="fortune-label-icon">${prize.icon}</span>
          <strong>${prize.short}</strong>
        </div>`;
    }).join("");

    wheel.innerHTML = `
      <div class="fortune-winner-glow" id="fortuneWinnerGlow" aria-hidden="true"></div>
      <div class="fortune-separators" aria-hidden="true"></div>
      ${labels}
      <div class="fortune-center" aria-hidden="true">
        <small>NIGHT CLUB</small>
        <strong>BALI</strong>
        <span>SPIN</span>
      </div>`;
  }

  function pickPrizeIndex() {
    const total = prizes.reduce((sum, prize) => sum + prize.weight, 0);
    let cursor = Math.random() * total;
    for (let index = 0; index < prizes.length; index += 1) {
      cursor -= prizes[index].weight;
      if (cursor <= 0) return index;
    }
    return prizes.length - 1;
  }

  function getPrizeIndexAtPointer(rotation) {
    const segment = 360 / prizes.length;
    const wheelAngleAtPointer = normalizeAngle(-rotation);
    return Math.floor(wheelAngleAtPointer / segment) % prizes.length;
  }

  function setStatus(text, type = "neutral") {
    const status = $("#fortuneStatus");
    if (!status) return;
    status.textContent = text;
    status.dataset.type = type;
  }

  function setControlsDisabled(disabled) {
    const button = $("#fortuneSpinButton");
    const input = $("#fortuneCode");
    const demoButton = $("#fortuneDemoCode");
    if (button) {
      button.disabled = disabled;
      button.querySelector("span").textContent = disabled ? "Колесо вращается…" : "Крутить колесо";
    }
    if (input) input.disabled = disabled;
    if (demoButton) demoButton.disabled = disabled;
  }

  function renderCodes() {
    const list = $("#fortuneCodeList");
    if (!list) return;
    list.innerHTML = loadCodes().map((item) => {
      const suffix = item.used ? ` · ${item.prize || "использован"}` : "";
      return `<code class="${item.used ? "used" : ""}">${item.code}${suffix}</code>`;
    }).join("");
  }

  function clearWinner() {
    const wheel = $("#fortuneWheel");
    if (!wheel) return;
    wheel.classList.remove("has-winner");
    wheel.style.removeProperty("--winner-start");
    wheel.style.removeProperty("--winner-end");
    state.selectedIndex = null;
  }

  function highlightWinner(index) {
    const wheel = $("#fortuneWheel");
    if (!wheel) return;
    const segment = 360 / prizes.length;
    wheel.style.setProperty("--winner-start", `${index * segment}deg`);
    wheel.style.setProperty("--winner-end", `${(index + 1) * segment}deg`);
    wheel.classList.add("has-winner");
  }

  function createConfetti() {
    const layer = $("#fortuneConfetti");
    if (!layer) return;
    layer.innerHTML = Array.from({ length: 34 }, (_, index) => {
      const left = 5 + Math.random() * 90;
      const delay = Math.random() * 0.55;
      const duration = 1.8 + Math.random() * 1.4;
      const rotate = Math.round(Math.random() * 360);
      return `<i style="left:${left}%;--delay:${delay}s;--duration:${duration}s;--rotate:${rotate}deg"></i>`;
    }).join("");
    layer.classList.remove("play");
    void layer.offsetWidth;
    layer.classList.add("play");
  }

  function showResult(prize) {
    const result = $("#fortuneResult");
    if (!result) return;
    $("#fortuneResultIcon").textContent = prize.icon;
    $("#fortuneResultPrize").textContent = prize.name;
    $("#fortuneResultText").textContent = prize.name === "Без выигрыша"
      ? "Сегодня колесо решило оставить интригу. Возвращайтесь за новым шансом."
      : "Покажите этот экран бармену, чтобы получить приз сегодня.";
    result.hidden = false;
    requestAnimationFrame(() => result.classList.add("open"));
    if (prize.name !== "Без выигрыша") createConfetti();
  }

  function hideResult() {
    const result = $("#fortuneResult");
    if (!result) return;
    result.classList.remove("open");
    window.setTimeout(() => { result.hidden = true; }, 220);
  }

  function spin(code) {
    if (state.spinning) return;

    const codes = loadCodes();
    const normalized = String(code || "").trim().toUpperCase();
    const codeItem = codes.find((entry) => entry.code === normalized);

    if (!normalized) return setStatus("Введите код бармена или получите демо-код.", "error");
    if (!codeItem) return setStatus("Код не найден. Проверьте написание.", "error");
    if (codeItem.used) return setStatus("Этот код уже использован.", "error");

    const chosenIndex = pickPrizeIndex();
    const segment = 360 / prizes.length;
    const safeJitter = (Math.random() - 0.5) * segment * 0.44;
    const selectedAngle = chosenIndex * segment + segment / 2 + safeJitter;
    const targetRotation = normalizeAngle(360 - selectedAngle);
    const currentRotation = normalizeAngle(state.rotation);
    const forwardDelta = normalizeAngle(targetRotation - currentRotation);

    codeItem.used = true;
    codeItem.usedAt = Date.now();
    codeItem.pending = true;
    saveCodes(codes);
    renderCodes();

    clearWinner();
    hideResult();
    state.spinning = true;
    state.rotation += 360 * 8 + forwardDelta;
    setControlsDisabled(true);
    setStatus("Удача уже выбирает ваш сектор…", "spinning");
    haptic("heavy");

    const wheel = $("#fortuneWheel");
    wheel.style.transform = `rotate(${state.rotation}deg)`;

    window.setTimeout(() => {
      const actualIndex = getPrizeIndexAtPointer(state.rotation);
      const prize = prizes[actualIndex];
      state.spinning = false;
      state.selectedIndex = actualIndex;

      const freshCodes = loadCodes();
      const freshCodeItem = freshCodes.find((entry) => entry.code === normalized);
      if (freshCodeItem) {
        freshCodeItem.pending = false;
        freshCodeItem.prize = prize.name;
        saveCodes(freshCodes);
      }

      highlightWinner(actualIndex);
      renderCodes();
      setControlsDisabled(false);
      setStatus(`Сектор под стрелкой: ${prize.name}`, prize.name === "Без выигрыша" ? "neutral" : "win");
      notify(prize.name === "Без выигрыша" ? "warning" : "success");
      showResult(prize);
    }, spinDuration);
  }

  function createCode(prefix = "BALI") {
    const code = `${prefix}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const codes = loadCodes();
    codes.unshift({ code, used: false, createdAt: Date.now() });
    saveCodes(codes);
    renderCodes();
    return code;
  }

  function generateAdminCode() {
    const code = createCode("BALI");
    const out = $("#generatedCode");
    if (out) {
      out.value = code;
      out.select();
    }
    navigator.clipboard?.writeText(code).catch(() => {});
    setStatus(`Новый код создан: ${code}`, "win");
  }

  function generateDemoCode() {
    const code = createCode("DEMO");
    const input = $("#fortuneCode");
    if (input) {
      input.value = code;
      input.focus();
    }
    setStatus(`Демо-код ${code} готов. Нажмите «Крутить колесо».`, "win");
    haptic("light");
  }

  document.addEventListener("DOMContentLoaded", () => {
    buildLights();
    buildWheel();
    renderCodes();

    $("#fortuneForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      spin($("#fortuneCode")?.value);
    });

    $("#fortuneDemoCode")?.addEventListener("click", generateDemoCode);
    $("#fortuneResultClose")?.addEventListener("click", hideResult);
    $("#fortuneResultBack")?.addEventListener("click", hideResult);
    $("#fortuneAdminToggle")?.addEventListener("click", () => $("#fortuneAdmin")?.classList.toggle("open"));
    $("#generateFortuneCode")?.addEventListener("click", generateAdminCode);
    $("#resetFortuneCodes")?.addEventListener("click", () => {
      try { localStorage.removeItem(storageKey); } catch {}
      renderCodes();
      clearWinner();
      $("#fortuneCode").value = "";
      setStatus("Коды сброшены до тестового набора.", "neutral");
    });
  });
})();
