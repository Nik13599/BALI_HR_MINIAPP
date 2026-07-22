(() => {
  if (window.__BALI_PROFILE_DEMOGRAPHICS__) return;
  window.__BALI_PROFILE_DEMOGRAPHICS__ = true;
  const game = window.BaliBeta4Game;
  const appUsers = window.BaliAppUsers;
  const social = window.BaliBeta4Social;
  if (!game) return;
  const AGE_KEY = "bali_age_verification_v1";
  const readAge = () => { try { return JSON.parse(localStorage.getItem(AGE_KEY) || "null"); } catch { return null; } };
  const today = () => new Date().toISOString().slice(0, 10);
  function ageOf(value) {
    if (!value) return -1;
    const birth = new Date(`${value}T12:00:00`);
    if (Number.isNaN(birth.getTime())) return -1;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age -= 1;
    return age;
  }
  function telegramHints() {
    const user = window.Telegram?.WebApp?.initDataUnsafe?.user || {};
    const birthday = user.birth_date || user.birthDate || user.birthday || "";
    const birthDate = typeof birthday === "string" ? birthday : (birthday?.year && birthday?.month && birthday?.day ? `${birthday.year}-${String(birthday.month).padStart(2, "0")}-${String(birthday.day).padStart(2, "0")}` : "");
    const gender = ["male", "female"].includes(user.gender) ? user.gender : "";
    return { birthDate, gender };
  }
  function syncPublicDemographics(profile = game.profile()) {
    const birthDate = profile.birthDate || profile.birth_date || "";
    const age = Number(profile.age ?? ageOf(birthDate));
    const gender = profile.gender || "unspecified";
    social?.saveProfile?.({ gender, birthDate, age: age >= 18 ? age : null });
  }
  function syncVerified() {
    const verified = readAge();
    if (!verified?.verified || !verified.birthDate) return;
    const profile = game.profile();
    const age = ageOf(verified.birthDate);
    if (profile.birthDate !== verified.birthDate || Number(profile.age || 0) !== age) game.saveProfile({ birthDate: verified.birthDate, age });
    syncPublicDemographics({ ...game.profile(), birthDate: verified.birthDate, age });
  }
  function inject() {
    const form = document.getElementById("profileV2SettingsForm");
    if (!form || form.querySelector('[name="birthDate"]')) return;
    const profile = game.profile();
    const verified = readAge();
    const hint = telegramHints();
    const birthDate = profile.birthDate || verified?.birthDate || hint.birthDate || "";
    const gender = profile.gender || social?.profile?.().gender || hint.gender || "unspecified";
    const age = ageOf(birthDate);
    const anchor = form.querySelector('[name="publicRanking"]')?.closest("label") || form.querySelector("button[type=submit]");
    anchor?.insertAdjacentHTML("beforebegin", `<label><span>Дата рождения</span><input name="birthDate" type="date" max="${today()}" value="${birthDate}"><small id="profileCalculatedAge">${age >= 0 ? `Возраст: ${age} лет` : "Укажите дату — возраст рассчитается автоматически"}</small></label><label><span>Пол</span><select name="gender"><option value="unspecified" ${gender === "unspecified" ? "selected" : ""}>Не указывать</option><option value="female" ${gender === "female" ? "selected" : ""}>Женский</option><option value="male" ${gender === "male" ? "selected" : ""}>Мужской</option></select></label>`);
  }
  document.addEventListener("input", event => {
    if (event.target.name !== "birthDate") return;
    const output = document.getElementById("profileCalculatedAge");
    const age = ageOf(event.target.value);
    if (output) output.textContent = age >= 0 ? `Возраст: ${age} лет` : "Укажите корректную дату";
  }, true);
  document.addEventListener("submit", event => {
    if (event.target.id !== "profileV2SettingsForm") return;
    const form = event.target;
    const birthDate = form.elements.birthDate?.value || "";
    const gender = form.elements.gender?.value || "unspecified";
    const age = ageOf(birthDate);
    if (birthDate && age < 18) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.alert("Приложение BALI предназначено только для лиц 18 лет и старше.");
      return;
    }
    game.saveProfile({ birthDate, gender, age: age >= 0 ? age : null });
    social?.saveProfile?.({ gender, birthDate, age: age >= 18 ? age : null });
    if (birthDate) localStorage.setItem(AGE_KEY, JSON.stringify({ verified: true, birthDate, verifiedAt: readAge()?.verifiedAt || new Date().toISOString() }));
    setTimeout(() => appUsers?.register?.(), 0);
  }, true);
  new MutationObserver(() => inject()).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("bali:age-verified", () => { syncVerified(); appUsers?.register?.(); });
  syncVerified();
  setTimeout(() => { inject(); syncPublicDemographics(); }, 200);
})();