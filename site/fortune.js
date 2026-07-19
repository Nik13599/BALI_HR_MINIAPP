(() => {
  const fortune = window.BaliFortune;
  if (!fortune) return;

  const wheel = document.getElementById("fortuneWheel");
  const labels = document.getElementById("fortuneLabels");
  const form = document.getElementById("fortuneForm");
  const codeInput = document.getElementById("fortuneCode");
  const button = document.getElementById("fortuneSpinButton");
  const resultBox = document.getElementById("fortuneResult");
  const statusBox = document.getElementById("fortuneStatus");
  const telegram = window.Telegram?.WebApp;
  const palette = ["#f2c45c", "#1fbc78", "#e84f5f", "#6f78ff", "#ef8f38", "#3eb8d4", "#b76ee8", "#8fc847"];
  let prizes = [];
  let segments = [];
  let rotation = 0;
  let spinning = false;

  const safeText = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[char]));

  function haptic(type = "light") {
    try { telegram?.HapticFeedback?.impactOccurred(type); } catch {}
  }

  function buildSegments(rows) {
    const total = rows.reduce((sum, item) => sum + Math.max(0.01, Number(item.weight || 1)), 0);
    let cursor = 0;
    return rows.map((item, index) => {
      const size = (Math.max(0.01, Number(item.weight || 1)) / total) * 360;
      const segment = {
        ...item,
        index,
        start: cursor,
        end: cursor + size,
        center: cursor + size / 2,
        color: palette[index % palette.length]
      };
      cursor += size;
      return segment;
    });
  }

  function renderWheel() {
    if (!wheel || !labels) return;
    if (!segments.length) {
      wheel.style.background = "#171b1a";
      labels.innerHTML = '<span class="wheel-empty">Призы не настроены</span>';
      button.disabled = true;
      return;
    }

    wheel.style.background = `conic-gradient(${segments.map((segment) =>
      `${segment.color} ${segment.start}deg ${segment.end}deg`
    ).join(",")})`;

    labels.innerHTML = segments.map((segment) => {
      const radius = 37;
      const radians = (segment.center - 90) * Math.PI / 180;
      const x = 50 + Math.cos(radians) * radius;
      const y = 50 + Math.sin(radians) * radius;
      return `<span class="wheel-label" style="left:${x}%;top:${y}%">${safeText(segment.name)}</span>`;
    }).join("");
    button.disabled = false;
  }

  async function loadPrizes() {
    try {
      prizes = await fortune.listPrizes(false);
      segments = buildSegments(prizes);
      renderWheel();
    } catch (error) {
      statusBox.textContent = error.message || "Не удалось загрузить колесо";
      button.disabled = true;
    }
  }

  function randomBetween(min, max) {
    if (crypto.getRandomValues) {
      const value = new Uint32Array(1);
      crypto.getRandomValues(value);
      return min + (value[0] / 4294967296) * (max - min);
    }
    return min + Math.random() * (max - min);
  }

  function showResult(result) {
    resultBox.classList.add("show");
    resultBox.innerHTML = `
      <span>ВАШ РЕЗУЛЬТАТ</span>
      <strong>${safeText(result.prize_name)}</strong>
      <small>Покажите этот экран бармену. Код уже использован повторно и не сработает.</small>`;
    statusBox.textContent = "Результат сохранён в журнале колеса";
  }

  function animateToPrize(result) {
    const segment = segments.find((item) => item.id === result.prize_id)
      || segments.find((item) => item.name === result.prize_name)
      || segments[0];
    const margin = Math.min(7, Math.max(1, (segment.end - segment.start) * 0.18));
    const landingAngle = randomBetween(segment.start + margin, segment.end - margin);
    const currentModulo = ((rotation % 360) + 360) % 360;
    const desiredModulo = ((-landingAngle % 360) + 360) % 360;
    const delta = (desiredModulo - currentModulo + 360) % 360;
    rotation += 6 * 360 + delta;
    wheel.style.transform = `rotate(${rotation}deg)`;
  }

  if (codeInput) {
    codeInput.addEventListener("input", () => {
      const normalized = fortune.normalizeCode(codeInput.value);
      codeInput.value = normalized.slice(0, 12);
    });
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (spinning) return;
    resultBox.classList.remove("show");
    resultBox.textContent = "";

    const code = fortune.normalizeCode(codeInput.value);
    if (code.length < 5) {
      statusBox.textContent = "Введите код, который выдал бармен после оплаты";
      codeInput.focus();
      return;
    }

    spinning = true;
    button.disabled = true;
    button.textContent = "Проверяем код…";
    statusBox.textContent = "Код проверяется. Один код даёт одно вращение.";

    try {
      const result = await fortune.redeem(code, {
        telegramId: telegram?.initDataUnsafe?.user?.id || ""
      });
      haptic("heavy");
      button.textContent = "Колесо крутится…";
      statusBox.textContent = "Определяем ваш приз";
      animateToPrize(result);
      setTimeout(() => {
        showResult(result);
        haptic("medium");
        codeInput.value = "";
        button.textContent = "Ввести следующий код";
        button.disabled = false;
        spinning = false;
      }, 4600);
    } catch (error) {
      statusBox.textContent = error.message || "Код не принят";
      button.textContent = "Активировать и крутить";
      button.disabled = false;
      spinning = false;
      haptic("light");
    }
  });

  window.addEventListener("bali:fortune-changed", loadPrizes);
  loadPrizes();
})();