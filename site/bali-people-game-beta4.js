(() => {
  if (window.__BALI_PEOPLE_GAME_UI__ || !window.BaliPeopleGame) return;
  window.__BALI_PEOPLE_GAME_UI__ = true;
  const peopleGame = window.BaliPeopleGame;
  let activeTab = "event";
  let activeEvent = null;
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const initials = name => String(name || "B").trim().split(/\s+/).slice(0,2).map(part => part[0]).join("").toUpperCase();
  const toast = message => { const node=document.getElementById("toast"); if(!node)return; node.textContent=message; node.classList.add("show"); clearTimeout(toast.timer); toast.timer=setTimeout(()=>node.classList.remove("show"),2400); };
  const iso = date => date.toISOString().slice(0,10);
  const ago = days => { const d=new Date(); d.setDate(d.getDate()-days); return iso(d); };

  function styles() {
    if (document.getElementById("baliPeopleGameStyle")) return;
    const style = document.createElement("style");
    style.id = "baliPeopleGameStyle";
    style.textContent = `.people-game-card{position:relative;overflow:hidden;display:grid;gap:12px;margin-bottom:12px;padding:16px;border:1px solid rgba(200,255,61,.26);border-radius:21px;background:radial-gradient(circle at 95% 0,rgba(200,255,61,.2),transparent 42%),linear-gradient(145deg,#151b17,#0b0e0c)}.people-game-card:after{content:'🌴';position:absolute;right:10px;top:2px;font-size:68px;opacity:.08}.people-game-card>*{position:relative;z-index:1}.people-game-card h3{margin:3px 0 0;font:600 18px Unbounded}.people-game-card p{margin:0;color:var(--muted);font-size:9px;line-height:1.55}.people-game-winners{display:grid;grid-template-columns:1fr 1fr;gap:8px}.people-game-winner{padding:11px;border:1px solid var(--line);border-radius:14px;background:#ffffff08}.people-game-winner small{display:block;color:var(--muted);font-size:8px}.people-game-winner strong{display:block;margin-top:5px;color:var(--lime);font-size:12px}.people-game-dialog{width:min(620px,calc(100% - 12px));max-height:96dvh;padding:0;border:1px solid var(--line);border-radius:23px;background:#0a0d0c;color:#fff;overflow:hidden}.people-game-dialog::backdrop{background:#000e;backdrop-filter:blur(6px)}.people-game-shell{max-height:96dvh;overflow:auto}.people-game-head{position:sticky;top:0;z-index:5;display:flex;justify-content:space-between;align-items:center;padding:15px;border-bottom:1px solid var(--line);background:#0a0d0cf2}.people-game-head h2{margin:3px 0 0;font-size:18px}.people-game-close{width:42px;height:42px;border:1px solid var(--line);border-radius:50%;background:#ffffff08;color:#fff;font-size:24px}.people-game-body{display:grid;gap:12px;padding:14px}.people-game-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.people-game-tabs button{min-height:42px;padding:5px;border:1px solid var(--line);border-radius:12px;background:#ffffff07;color:var(--muted);font-size:8px}.people-game-tabs button.active{background:var(--lime);color:#090b08}.people-game-summary{padding:13px;border:1px solid rgba(200,255,61,.22);border-radius:16px;background:rgba(200,255,61,.06)}.people-game-summary h3{margin:0 0 5px;font-size:13px}.people-game-summary p{margin:0;color:var(--muted);font-size:9px;line-height:1.5}.people-game-list{display:grid;gap:8px}.people-game-row{display:grid;grid-template-columns:38px 48px minmax(0,1fr) auto;gap:9px;align-items:center;padding:10px;border:1px solid var(--line);border-radius:15px;background:#111413}.people-game-row>i{width:48px;height:48px;display:grid;place-items:center;overflow:hidden;border-radius:50%;background:#ffffff0a;color:var(--lime);font-style:normal;font-weight:900}.people-game-row>i img{width:100%;height:100%;object-fit:cover}.people-game-row h3{margin:0;font-size:11px}.people-game-row p{margin:3px 0 0;color:var(--muted);font-size:8px}.people-game-row b{color:var(--lime);font-size:10px}.people-game-row button{min-width:54px;min-height:38px;border:1px solid var(--line);border-radius:11px;background:#ffffff08;color:#fff}.people-game-row button.active{background:var(--lime);color:#090b08}.people-game-history{display:grid;gap:9px}.people-game-history article{padding:12px;border:1px solid var(--line);border-radius:15px;background:#ffffff06}.people-game-history h3{margin:0 0 7px;font-size:11px}.people-game-history p{margin:4px 0;color:var(--muted);font-size:9px}.people-game-empty{padding:25px 14px;border:1px dashed var(--line);border-radius:17px;color:var(--muted);text-align:center;font-size:9px;line-height:1.6}@media(max-width:390px){.people-game-tabs{grid-template-columns:1fr 1fr}.people-game-row{grid-template-columns:30px 42px 1fr}.people-game-row>i{width:42px;height:42px}.people-game-row button{grid-column:2/-1}.people-game-winners{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
  }

  function renameSection() {
    const page = document.querySelector('[data-screen="dating"]');
    if (page) {
      const title = page.querySelector(".head h2");
      const eyebrow = page.querySelector(".head .eyebrow");
      if (title) title.textContent = "BALI PEOPLE";
      if (eyebrow) eyebrow.textContent = "ЛЮДИ НОЧИ · ИГРА МЕРОПРИЯТИЯ";
    }
    const nav = document.querySelector('.nav [data-page="dating"]');
    if (nav) nav.innerHTML = "<i>🌴</i><span>BALI PEOPLE</span>";
  }

  function ensureDialog() {
    if (document.getElementById("baliPeopleGameDialog")) return;
    document.body.insertAdjacentHTML("beforeend", `<dialog class="people-game-dialog" id="baliPeopleGameDialog"><div class="people-game-shell"><header class="people-game-head"><div><span class="eyebrow">BALI PEOPLE GAME</span><h2>Рейтинг гостей</h2></div><button class="people-game-close" type="button" data-close-people-game>×</button></header><div class="people-game-body"><div class="people-game-tabs"><button class="active" data-people-game-tab="event">Мероприятие</button><button data-people-game-tab="week">Неделя</button><button data-people-game-tab="month">Месяц</button><button data-people-game-tab="history">История</button></div><div id="baliPeopleGameContent"></div></div></div></dialog>`);
  }

  function winnerName(person, empty = "Пока не выбран") { return person?.name || empty; }

  async function cardHtml() {
    activeEvent = await peopleGame.currentEvent();
    const ranking = activeEvent ? await peopleGame.ranking({ eventId:activeEvent.id }) : [];
    const winners = peopleGame.winners(ranking);
    return `<span class="eyebrow">BALI PEOPLE GAME 🌴</span><h3>${activeEvent ? esc(activeEvent.title) : "Miss BALI & Mr. BALI"}</h3><p>${activeEvent ? "Гости мероприятия голосуют друг за друга. Голос события действует только до следующего мероприятия." : "Подтвердите вход по QR-коду, чтобы участвовать в голосовании мероприятия."}</p><div class="people-game-winners"><article class="people-game-winner"><small>MISS BALI</small><strong>${esc(winnerName(winners.female))}</strong></article><article class="people-game-winner"><small>MR. BALI</small><strong>${esc(winnerName(winners.male))}</strong></article></div><button class="primary full" type="button" data-open-people-game>Открыть рейтинг и голосование</button>`;
  }

  async function mount() {
    renameSection();
    ensureDialog();
    const root = document.querySelector('[data-screen="dating"] .inner');
    const tabs = root?.querySelector(".social-tabs-v2");
    if (!root || !tabs) return false;
    let card = document.getElementById("baliPeopleGameCard");
    if (!card) {
      card = document.createElement("section");
      card.id = "baliPeopleGameCard";
      card.className = "people-game-card";
      tabs.before(card);
    }
    card.innerHTML = await cardHtml();
    return true;
  }

  const avatar = person => person.photo || person.avatar ? `<img src="${esc(person.photo || person.avatar)}" alt="" style="object-position:${Number(person.cropX ?? 50)}% ${Number(person.cropY ?? 50)}%">` : esc(initials(person.name));
  const genderTitle = gender => gender === "female" ? "Miss BALI" : gender === "male" ? "Mr. BALI" : "BALI Star";

  async function eventView() {
    if (!activeEvent) activeEvent = await peopleGame.currentEvent();
    if (!activeEvent) return '<div class="people-game-empty">Сейчас нет активного мероприятия. Результаты появятся после первых QR-отметок.</div>';
    const [candidates, ranking, allowed] = await Promise.all([peopleGame.candidates(activeEvent.id), peopleGame.ranking({ eventId:activeEvent.id }), peopleGame.canVote(activeEvent.id)]);
    const scores = new Map(ranking.map(row => [String(row.id), row.votes]));
    const voted = new Set((await peopleGame.votes({ eventId:activeEvent.id })).filter(row => String(row.voter_key) === peopleGame.myId()).map(row => String(row.candidate_key)));
    const rows = candidates.sort((a,b) => Number(scores.get(String(b.id)) || 0) - Number(scores.get(String(a.id)) || 0) || String(a.name).localeCompare(String(b.name),"ru"));
    return `<div class="people-game-summary"><h3>${esc(activeEvent.title)}</h3><p>${allowed ? "Вы на мероприятии: можно голосовать. Один человек может поставить один голос каждому участнику, кроме себя." : "Рейтинг виден всем. Голосование доступно после подтверждения входа по QR-коду."}</p></div><div class="people-game-list">${rows.map((person,index) => `<article class="people-game-row"><strong>#${index+1}</strong><i>${avatar(person)}</i><div><h3>${esc(person.name)}</h3><p>${esc(genderTitle(person.gender))}</p></div><div><b>${Number(scores.get(String(person.id)) || 0)} 🌴</b><button type="button" class="${voted.has(String(person.id)) ? "active" : ""}" data-event-people-vote="${esc(person.id)}" ${!allowed || String(person.id) === peopleGame.myId() ? "disabled" : ""}>🌴</button></div></article>`).join("") || '<div class="people-game-empty">На мероприятии пока нет гостей, открытых для BALI PEOPLE.</div>'}</div>`;
  }

  async function periodView(type) {
    const filters = type === "week" ? { from:ago(7), to:iso(new Date()) } : { from:ago(30), to:iso(new Date()) };
    const rows = await peopleGame.ranking(filters);
    const winners = peopleGame.winners(rows);
    return `<div class="people-game-summary"><h3>${type === "week" ? "Топ недели" : "Топ месяца"}</h3><p>Сумма уникальных голосов, полученных на мероприятиях за выбранный период. Miss BALI: <b>${esc(winnerName(winners.female,"—"))}</b>. Mr. BALI: <b>${esc(winnerName(winners.male,"—"))}</b>.</p></div><div class="people-game-list">${rows.map((person,index) => `<article class="people-game-row"><strong>#${index+1}</strong><i>${avatar(person)}</i><div><h3>${esc(person.name)}</h3><p>${esc(genderTitle(person.gender))}</p></div><b>${Number(person.votes)} 🌴</b></article>`).join("") || '<div class="people-game-empty">За этот период голосов пока нет.</div>'}</div>`;
  }

  async function historyView() {
    const events = await peopleGame.history();
    return `<div class="people-game-history">${events.map(event => `<article><h3>${esc(event.title)} · ${esc(event.date)}</h3><p>👑 Miss BALI: <b>${esc(winnerName(event.winners.female,"не выбрана"))}</b></p><p>👑 Mr. BALI: <b>${esc(winnerName(event.winners.male,"не выбран"))}</b></p><p>Топ: ${event.ranking.slice(0,3).map((person,index) => `${index+1}. ${esc(person.name)} — ${person.votes}`).join(" · ") || "голосов не было"}</p></article>`).join("") || '<div class="people-game-empty">История появится после завершённых голосований.</div>'}</div>`;
  }

  async function renderDialog() {
    const root = document.getElementById("baliPeopleGameContent");
    if (!root) return;
    document.querySelectorAll("[data-people-game-tab]").forEach(button => button.classList.toggle("active", button.dataset.peopleGameTab === activeTab));
    root.innerHTML = '<div class="people-game-empty">Обновляю рейтинг…</div>';
    if (activeTab === "event") root.innerHTML = await eventView();
    if (activeTab === "week" || activeTab === "month") root.innerHTML = await periodView(activeTab);
    if (activeTab === "history") root.innerHTML = await historyView();
  }

  document.addEventListener("click", async event => {
    if (event.target.closest('[data-page="dating"]')) setTimeout(mount,0);
    if (event.target.closest("[data-open-people-game]")) {
      activeEvent = await peopleGame.currentEvent();
      activeTab = "event";
      await renderDialog();
      document.getElementById("baliPeopleGameDialog")?.showModal();
      return;
    }
    if (event.target.closest("[data-close-people-game]")) { event.target.closest("dialog")?.close(); return; }
    const tab = event.target.closest("[data-people-game-tab]");
    if (tab) { activeTab = tab.dataset.peopleGameTab; await renderDialog(); return; }
    const vote = event.target.closest("[data-event-people-vote]");
    if (vote) {
      const result = await peopleGame.toggleVote(activeEvent, vote.dataset.eventPeopleVote);
      toast(result.ok ? (result.active ? "Голос 🌴 добавлен" : "Голос снят") : result.message);
      await renderDialog();
      await mount();
    }
  }, true);

  ["bali:people-votes-changed","bali:data-changed","bali:social-changed"].forEach(name => window.addEventListener(name, () => { requestAnimationFrame(mount); if (document.getElementById("baliPeopleGameDialog")?.open) requestAnimationFrame(renderDialog); }));
  styles();
  let attempts=0;const timer=setInterval(async()=>{attempts++;if(await mount()||attempts>40)clearInterval(timer)},100);
})();