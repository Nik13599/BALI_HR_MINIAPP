(() => {
  if (window.__BALI_PEOPLE_GENDER_SETTING__ || !window.BaliBeta4Social) return;
  window.__BALI_PEOPLE_GENDER_SETTING__ = true;
  const social = window.BaliBeta4Social;

  function inject() {
    const form = document.getElementById("profileV2SettingsForm");
    if (!form || form.querySelector('[name="gender"]')) return;
    const status = form.querySelector('[name="socialStatus"]')?.closest("label");
    const label = document.createElement("label");
    label.innerHTML = `<span>Пол для титула BALI PEOPLE</span><select name="gender"><option value="unspecified">Не указывать</option><option value="female">Женский — Miss BALI</option><option value="male">Мужской — Mr. BALI</option></select>`;
    (status || form.querySelector("button[type=submit]"))?.insertAdjacentElement("beforebegin", label);
    label.querySelector("select").value = social.profile().gender || "unspecified";
  }

  document.addEventListener("click", event => {
    if (event.target.closest("[data-open-profile-settings]")) setTimeout(inject, 0);
  }, true);

  document.addEventListener("submit", event => {
    if (event.target.id !== "profileV2SettingsForm") return;
    const gender = event.target.elements.gender?.value || "unspecified";
    social.saveProfile({ gender });
  }, true);

  const observer = new MutationObserver(inject);
  const root = document.getElementById("profileSettingsBody");
  if (root) observer.observe(root, { childList:true, subtree:true });
})();