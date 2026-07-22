(() => {
  if (window.__BALI_CROWN_WIN_CARDS__) return;
  window.__BALI_CROWN_WIN_CARDS__ = true;

  const crown = window.BaliNightCrown;
  if (!crown?.history) return;

  const norm = value => String(value || "").trim().replace(/^@/, "").toLocaleLowerCase("ru");
  const keys = subject => new Set([
    subject?.id,
    subject?.user_key,
    subject?.userKey,
    subject?.owner_key,
    subject?.ownerKey,
    subject?.client_key,
    subject?.code
  ].filter(Boolean).map(String));

  function samePerson(winner, subject) {
    if (!winner || !subject) return false;
    const subjectKeys = keys(subject);
    const winnerKeys = [winner.id, winner.user_key, winner.userKey, winner.owner_key, winner.code].filter(Boolean).map(String);
    if (winnerKeys.some(value => subjectKeys.has(value))) return true;
    const subjectName = norm(subject.name);
    const winnerName = norm(winner.name);
    return Boolean(subjectName && winnerName && subjectName === winnerName);
  }

  async function winCounts(subject) {
    let rows = [];
    try { rows = await crown.history(); } catch { return { miss: 0, mister: 0 }; }
    return rows.reduce((result, item) => {
      if (samePerson(item?.winners?.female, subject)) result.miss += 1;
      if (samePerson(item?.winners?.male, subject)) result.mister += 1;
      return result;
    }, { miss: 0, mister: 0 });
  }

  function styles() {
    if (document.getElementById("crownWinCardsStyle")) return;
    const style = document.createElement("style");
    style.id = "crownWinCardsStyle";
    style.textContent = `
      .crown-win-card{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:11px}
      .crown-win-card article{padding:11px;border:1px solid rgba(242,205,102,.32);border-radius:14px;background:rgba(242,205,102,.08);text-align:center}
      .crown-win-card span{display:block;color:#d8c27a;font-size:7px;font-weight:900;letter-spacing:.06em}.crown-win-card strong{display:block;margin-top:6px;color:#f2cd66;font:600 16px Unbounded}
      .customer-crown-wins{margin-top:0}.customer-crown-wins h3{margin:0 0 10px}
      @media(max-width:420px){.crown-win-card{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  async function injectPublic(personId) {
    const social = window.BaliBeta4Social;
    const body = document.getElementById("socialPersonBody");
    const person = social?.visiblePeople?.().find(row => String(row.id) === String(personId));
    if (!body || !person) return;
    const counts = await winCounts(person);
    body.querySelector("#baliPeopleCrownWins")?.remove();
    if (!counts.miss && !counts.mister) return;
    const target = body.querySelector(".bali-people-public-details") || body;
    target.insertAdjacentHTML("beforeend", `<section id="baliPeopleCrownWins"><div class="crown-win-card">${counts.miss ? `<article><span>МИСС BALI · КОРОЛЕВА НОЧИ</span><strong>${counts.miss}×</strong></article>` : ""}${counts.mister ? `<article><span>МИСТЕР BALI · КОРОЛЬ НОЧИ</span><strong>${counts.mister}×</strong></article>` : ""}</div></section>`);
  }

  const dossier = window.BaliAdminCustomerDossier;
  if (dossier?.open && dossier?.resolve && !dossier.__crownWinsWrapped) {
    dossier.__crownWinsWrapped = true;
    const originalOpen = dossier.open.bind(dossier);
    dossier.open = async ref => {
      const subject = await dossier.resolve(ref);
      await originalOpen(ref);
      const body = document.getElementById("customerDossierBody");
      if (!body || !subject) return;
      const counts = await winCounts(subject);
      body.querySelector("#customerCrownWins")?.remove();
      if (!counts.miss && !counts.mister) return;
      body.insertAdjacentHTML("beforeend", `<section class="customer-dossier-card customer-crown-wins" id="customerCrownWins"><h3>Победы в конкурсе</h3><div class="crown-win-card">${counts.miss ? `<article><span>МИСС BALI · КОРОЛЕВА НОЧИ</span><strong>${counts.miss}×</strong></article>` : ""}${counts.mister ? `<article><span>МИСТЕР BALI · КОРОЛЬ НОЧИ</span><strong>${counts.mister}×</strong></article>` : ""}</div></section>`);
    };
  }

  document.addEventListener("click", event => {
    const card = event.target.closest("[data-open-social-person]");
    if (card && !event.target.closest("button")) setTimeout(() => injectPublic(card.dataset.openSocialPerson), 0);
  });

  styles();
  window.BaliCrownWinCards = { winCounts, injectPublic };
})();