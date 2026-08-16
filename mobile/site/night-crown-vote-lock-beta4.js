(() => {
  if (window.__BALI_NIGHT_CROWN_VOTE_LOCK__ || !window.BaliNightCrown) return;
  window.__BALI_NIGHT_CROWN_VOTE_LOCK__ = true;

  const crown = window.BaliNightCrown;
  const originalVote = crown.toggleVote.bind(crown);

  async function lockedVote(eventId, candidateKey) {
    const candidate = (await crown.entries(eventId)).find(row => String(row.user_key) === String(candidateKey));
    if (!candidate) return { ok: false, message: "Участник не допущен к голосованию" };
    const voter = String(crown.myKey());
    const existing = (await crown.votes(eventId)).find(row =>
      String(row.voter_key) === voter && String(row.candidate_gender) === String(candidate.gender)
    );
    if (existing) {
      return {
        ok: false,
        locked: true,
        gender: candidate.gender,
        candidateKey: existing.candidate_key,
        message: candidate.gender === "female"
          ? "Голос за Королеву ночи уже отдан и изменить его нельзя"
          : "Голос за Короля ночи уже отдан и изменить его нельзя"
      };
    }
    const result = await originalVote(eventId, candidateKey);
    if (result?.ok) return { ...result, active: true, locked: true, replaced: false };
    return result;
  }

  function decorate() {
    document.querySelectorAll(".crown-sector").forEach(section => {
      const active = section.querySelector(".crown-score button.active");
      section.querySelector(".crown-vote-locked-note")?.remove();
      if (!active) return;
      section.querySelectorAll(".crown-score button[data-crown-vote]").forEach(button => {
        button.disabled = true;
        button.title = button === active ? "Ваш голос зафиксирован" : "В этой категории голос уже отдан";
      });
      section.querySelector("h3")?.insertAdjacentHTML("afterend", '<div class="crown-vote-locked-note">Ваш голос зафиксирован и не может быть отменён или изменён</div>');
    });
  }

  if (!document.getElementById("nightCrownVoteLockStyle")) {
    const style = document.createElement("style");
    style.id = "nightCrownVoteLockStyle";
    style.textContent = `.crown-vote-locked-note{padding:8px 10px;border:1px solid #f2cd6638;border-radius:11px;background:#f2cd6610;color:#d8c27a;font-size:8px;line-height:1.45}.crown-sector .crown-score button:disabled{cursor:not-allowed;opacity:.38}.crown-sector .crown-score button.active:disabled{opacity:1;background:#f2cd66;color:#111}`;
    document.head.appendChild(style);
  }

  crown.toggleVote = lockedVote;
  const observer = new MutationObserver(records => {
    if (records.some(record => record.addedNodes.length || record.removedNodes.length)) requestAnimationFrame(decorate);
  });
  const start = () => {
    const root = document.getElementById("crownContent");
    if (!root) return false;
    observer.observe(root, { childList: true, subtree: true });
    decorate();
    return true;
  };
  let attempts = 0;
  const timer = setInterval(() => { attempts += 1; if (start() || attempts > 50) clearInterval(timer); }, 100);
  ["bali:night-crown-changed", "bali:data-changed"].forEach(name => window.addEventListener(name, () => setTimeout(decorate, 0)));
})();