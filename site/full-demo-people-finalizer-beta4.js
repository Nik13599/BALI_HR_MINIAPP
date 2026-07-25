(() => {
  if (window.__BALI_FULL_DEMO_PEOPLE_FINALIZER__) return;
  window.__BALI_FULL_DEMO_PEOPLE_FINALIZER__ = true;

  const social = window.BaliBeta4Social;
  const peopleApi = window.BaliFullDemoPeople;
  if (!social || !peopleApi) return;

  const normalize = value => String(value || "").toLocaleLowerCase("ru").replace(/^@/, "").replace(/[^\p{L}\p{N}+]+/gu, " ").trim();
  const ageFor = person => {
    const explicit = Number(person?.age || 0);
    if (explicit >= 18 && explicit <= 99) return explicit;
    const raw = person?.birthDate || person?.birth_date || person?.birthday || "";
    if (!raw) return 0;
    const birth = new Date(`${String(raw).slice(0,10)}T12:00:00`);
    if (Number.isNaN(birth.getTime())) return 0;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age -= 1;
    return age >= 18 && age <= 99 ? age : 0;
  };
  const genderFor = person => {
    const value = normalize(person?.gender || person?.sex || "");
    if (["female","f","woman","женщина","женский"].includes(value)) return "female";
    if (["male","m","man","мужчина","мужской"].includes(value)) return "male";
    return "unknown";
  };

  social.visiblePeople = () => social.people().filter(person => String(person.id) !== String(social.myId()) && person.active === true);

  function finalizeCards() {
    const rows = social.visiblePeople();
    document.querySelectorAll("[data-open-social-person]").forEach(card => {
      const person = rows.find(row => String(row.id) === String(card.dataset.openSocialPerson));
      if (!person) return;
      const searchable = [person.name];
      if (peopleApi.canSee(person,"telegram")) searchable.push(person.username);
      if (peopleApi.canSee(person,"phone")) searchable.push(person.phone);
      card.dataset.peopleSearch = normalize(searchable.join(" "));
      card.dataset.peopleAge = String(ageFor(person) || 0);
      card.dataset.peopleGender = genderFor(person);
      if (!peopleApi.viewerHasVip()) {
        card.querySelectorAll(".people-public-badges span").forEach(badge => {
          if (/\bбалл/i.test(badge.textContent || "")) badge.remove();
        });
      }
    });

    const query = normalize(document.getElementById("baliPeopleNameSearch")?.value || "");
    const gender = document.getElementById("baliPeopleGender")?.value || "all";
    const min = Number(document.getElementById("baliPeopleAgeMin")?.value || 18);
    const max = Number(document.getElementById("baliPeopleAgeMax")?.value || 99);
    const useAge = min > 18 || max < 99;
    document.querySelectorAll("[data-open-social-person]").forEach(card => {
      const matchesText = !query || String(card.dataset.peopleSearch || "").includes(query);
      const matchesGender = gender === "all" || card.dataset.peopleGender === gender;
      const age = Number(card.dataset.peopleAge || 0);
      const matchesAge = !useAge || (age && age >= Math.min(min,max) && age <= Math.max(min,max));
      card.hidden = !(matchesText && matchesGender && matchesAge);
    });

    if (!peopleApi.viewerHasVip()) {
      document.querySelectorAll("#fullPeopleDetails .people-detail-row").forEach(row => {
        if ((row.querySelector("span")?.textContent || "").trim() === "BALI-баллы") row.remove();
      });
    }
  }

  function forceFullRender() {
    const all = document.querySelector('[data-social-v2-tab="all"]');
    if (all && !document.querySelector('[data-social-v2-tab="inside"].active') && !document.querySelector('[data-social-v2-tab="thumbs"].active')) all.click();
    requestAnimationFrame(() => requestAnimationFrame(finalizeCards));
  }

  document.addEventListener("input", event => {
    if (["baliPeopleNameSearch","baliPeopleAgeMin","baliPeopleAgeMax"].includes(event.target.id)) requestAnimationFrame(() => requestAnimationFrame(finalizeCards));
  });
  document.addEventListener("change", event => {
    if (event.target.id === "baliPeopleGender") requestAnimationFrame(() => requestAnimationFrame(finalizeCards));
  });
  document.addEventListener("click", event => {
    if (event.target.closest("[data-social-v2-tab],[data-page=\"dating\"]")) setTimeout(forceFullRender,0);
    if (event.target.closest("[data-open-social-person]") && !event.target.closest("button")) setTimeout(finalizeCards,20);
  }, true);

  const schedule = () => requestAnimationFrame(() => requestAnimationFrame(finalizeCards));
  ["bali:full-demo-enhancements-ready","bali:social-changed","bali:points-changed","bali:loyalty-changed","bali:beta4-changed","bali:checkin-complete","bali:checkin-left"].forEach(name => window.addEventListener(name,schedule));
  forceFullRender();
  window.BaliFullDemoPeopleFinalizer = { finalizeCards, forceFullRender };
})();