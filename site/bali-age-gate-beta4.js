(() => {
  if (window.__BALI_AGE_GATE__) return;
  window.__BALI_AGE_GATE__ = true;
  const KEY = "bali_age_verification_v1";
  const game = window.BaliBeta4Game;
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } };
  const write = value => { localStorage.setItem(KEY, JSON.stringify(value)); return value; };
  const todayIso = () => new Date().toISOString().slice(0, 10);
  function ageOn(dateString) {
    const birth = new Date(`${dateString}T12:00:00`);
    if (!dateString || Number.isNaN(birth.getTime())) return -1;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const beforeBirthday = now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
    if (beforeBirthday) age -= 1;
    return age;
  }
  function styles() {
    if (document.getElementById("baliAgeGateStyle")) return;
    const style = document.createElement("style");
    style.id = "baliAgeGateStyle";
    style.textContent = `.bali-age-gate{position:fixed;inset:0;z-index:2147483600;display:grid;place-items:center;padding:18px;background:radial-gradient(circle at 50% 0,rgba(200,255,61,.14),transparent 38%),#070908;color:#fff;font-family:Inter,system-ui,sans-serif}.bali-age-card{width:min(430px,100%);display:grid;gap:16px;padding:22px;border:1px solid rgba(255,255,255,.12);border-radius:24px;background:#101412;box-shadow:0 24px 70px #000a}.bali-age-logo{width:58px;height:58px;display:grid;place-items:center;border-radius:18px;background:#c8ff3d;color:#080a08;font:800 26px Unbounded,system-ui}.bali-age-card h1{margin:0;font-size:25px}.bali-age-card p{margin:0;color:#aab2ad;font-size:12px;line-height:1.65}.bali-age-card label{display:grid;gap:7px;color:#cfd5d1;font-size:10px;font-weight:800}.bali-age-card input{width:100%;min-height:52px;padding:0 14px;border:1px solid rgba(255,255,255,.13);border-radius:14px;background:#080b09;color:#fff;font-size:16px;color-scheme:dark}.bali-age-card button{min-height:50px;border:0;border-radius:14px;background:#c8ff3d;color:#080a08;font-weight:900}.bali-age-card button.secondary{border:1px solid rgba(255,255,255,.13);background:#ffffff08;color:#fff}.bali-age-note{padding:11px;border:1px solid rgba(255,205,90,.2);border-radius:13px;background:rgba(255,205,90,.06);color:#dec77f!important;font-size:10px!important}.bali-age-error{color:#ff9696!important;font-weight:800}.bali-age-blocked{text-align:center}.bali-age-blocked .bali-age-logo{margin:auto;background:#ff7373}.bali-age-hidden{display:none!important}`;
    document.head.appendChild(style);
  }
  function shell() {
    let root = document.getElementById("baliAgeGate");
    if (root) return root;
    root = document.createElement("div");
    root.id = "baliAgeGate";
    root.className = "bali-age-gate";
    document.body.appendChild(root);
    return root;
  }
  function intro() {
    const root = shell();
    root.innerHTML = `<section class="bali-age-card"><div class="bali-age-logo">18+</div><div><h1>Подтверждение возраста</h1><p>BALI — приложение ночного клуба. Доступ разрешён только совершеннолетним пользователям.</p></div><p class="bali-age-note">На следующем шаге потребуется указать полную дату рождения: день, месяц и год.</p><button type="button" data-age-continue>Мне уже исполнилось 18 лет</button></section>`;
  }
  function dateForm(value = "", message = "") {
    const root = shell();
    root.innerHTML = `<form class="bali-age-card" id="baliAgeForm"><div class="bali-age-logo">B</div><div><h1>Укажите дату рождения</h1><p>Мы проверим, что на сегодняшний день вам исполнилось 18 лет.</p></div><label><span>Дата рождения</span><input name="birthDate" type="date" max="${todayIso()}" value="${String(value || "")}" required></label>${message ? `<p class="bali-age-error">${message}</p>` : ""}<button type="submit">Подтвердить возраст</button></form>`;
  }
  function blocked(value = "") {
    const root = shell();
    root.innerHTML = `<section class="bali-age-card bali-age-blocked"><div class="bali-age-logo">18+</div><h1>Доступ ограничен</h1><p>Данное приложение предназначено для лиц 18 лет и старше.</p><button class="secondary" type="button" data-age-correct data-value="${String(value || "")}">Проверить введённую дату</button></section>`;
  }
  function unlock(birthDate) {
    const value = write({ verified:true, birthDate, verifiedAt:new Date().toISOString() });
    try { game?.saveProfile?.({ birthDate:value.birthDate, ageVerifiedAt:value.verifiedAt }); } catch {}
    document.getElementById("baliAgeGate")?.remove();
    document.documentElement.classList.remove("bali-age-locked");
    window.dispatchEvent(new CustomEvent("bali:age-verified", { detail:value }));
  }
  function start() {
    styles();
    const saved = read();
    if (saved?.verified && ageOn(saved.birthDate) >= 18) return;
    document.documentElement.classList.add("bali-age-locked");
    if (saved?.rejected && saved.birthDate) blocked(saved.birthDate); else intro();
  }
  document.addEventListener("click", event => {
    if (event.target.closest("[data-age-continue]")) dateForm();
    const correct = event.target.closest("[data-age-correct]");
    if (correct) dateForm(correct.dataset.value || "");
  }, true);
  document.addEventListener("submit", event => {
    if (event.target.id !== "baliAgeForm") return;
    event.preventDefault();
    const birthDate = String(new FormData(event.target).get("birthDate") || "");
    const age = ageOn(birthDate);
    if (age < 0) return dateForm(birthDate, "Укажите корректную дату рождения.");
    if (new Date(`${birthDate}T12:00:00`) > new Date()) return dateForm(birthDate, "Дата рождения не может быть в будущем.");
    if (age < 18) {
      write({ verified:false, rejected:true, birthDate, checkedAt:new Date().toISOString() });
      blocked(birthDate);
      return;
    }
    unlock(birthDate);
  }, true);
  start();
})();