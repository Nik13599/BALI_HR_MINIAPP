(() => {
  if (window.BaliPeopleGame) return;
  const store = window.BaliStore;
  const game = window.BaliBeta4Game;
  const social = window.BaliBeta4Social;
  const points = window.BaliPoints;
  const attendance = window.BaliEventQrAttendance;
  if (!store || !game || !social) return;

  const KEY = "bali_people_event_votes_v1";
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
  const write = rows => { localStorage.setItem(KEY, JSON.stringify(rows)); window.dispatchEvent(new CustomEvent("bali:people-votes-changed")); return rows; };
  const now = () => new Date().toISOString();
  const safe = value => String(value || "guest").replace(/[^a-zA-Z0-9_-]/g, "-");
  const myId = () => String(social.myId());
  const identityKeys = () => new Set(game.identityKeys(game.profile()).map(String));
  const dateOnly = value => String(value || "").slice(0, 10);

  async function allCheckins(eventId = "") {
    try {
      if (attendance?.listCheckins) return await attendance.listCheckins(eventId);
    } catch {}
    const rows = Object.values(JSON.parse(localStorage.getItem("bali_event_checkins_v1") || "{}"));
    return rows.filter(row => !eventId || String(row.event_id) === String(eventId));
  }

  async function cloudVotes(filters = {}) {
    if (!store.cloudEnabled || !store.client) return [];
    try {
      let query = store.client.from("bali_people_votes").select("*");
      if (filters.eventId) query = query.eq("event_id", filters.eventId);
      if (filters.from) query = query.gte("event_date", filters.from);
      if (filters.to) query = query.lte("event_date", filters.to);
      const { data, error } = await query;
      return error ? [] : data || [];
    } catch { return []; }
  }

  async function votes(filters = {}) {
    const local = read().filter(row => (!filters.eventId || String(row.event_id) === String(filters.eventId)) && (!filters.from || dateOnly(row.event_date) >= filters.from) && (!filters.to || dateOnly(row.event_date) <= filters.to));
    const cloud = await cloudVotes(filters);
    return [...new Map([...cloud, ...local].map(row => [row.id, row])).values()];
  }

  function personMap() {
    const map = new Map();
    social.people().forEach(person => map.set(String(person.id), person));
    Object.values(points?.accounts?.() || {}).forEach(person => {
      const key = String(person.userKey || person.id || person.code || "");
      if (key) map.set(key, { ...(map.get(key) || {}), ...person, id: key });
    });
    return map;
  }

  async function candidates(eventId) {
    const rows = await allCheckins(eventId);
    const people = personMap();
    const map = new Map();
    rows.forEach(row => {
      const key = String(row.user_key || (row.telegram_id ? `tg:${row.telegram_id}` : row.id));
      const profile = people.get(key) || [...people.values()].find(person => row.telegram_id && String(person.telegramId || "") === String(row.telegram_id)) || {};
      map.set(key, {
        id: key,
        name: profile.name || row.name || "Гость BALI",
        username: profile.username || row.telegram || "",
        photo: profile.photo || profile.avatar || "",
        cropX: Number(profile.cropX ?? 50),
        cropY: Number(profile.cropY ?? 50),
        gender: profile.gender || "unspecified",
        eventId: String(row.event_id || eventId),
        checkedInAt: row.checked_in_at || ""
      });
    });
    return [...map.values()];
  }

  async function currentEvent() {
    const events = (await store.list("events")).filter(event => event.active !== false);
    const checkins = await allCheckins();
    const keys = identityKeys();
    const mine = checkins.filter(row => keys.has(String(row.user_key || "")) || String(row.telegram_id || "") === String(game.profile().telegramId || "")).sort((a,b) => String(b.checked_in_at || "").localeCompare(String(a.checked_in_at || "")))[0];
    if (mine) return events.find(event => String(event.id) === String(mine.event_id)) || { id: mine.event_id, title: mine.event_title || "Мероприятие BALI", event_date: mine.event_date, event_time: mine.event_time || "23:00" };
    const today = new Date().toISOString().slice(0,10);
    return events.find(event => String(event.event_date) === today) || null;
  }

  async function canVote(eventId) {
    const rows = await allCheckins(eventId);
    const keys = identityKeys();
    return rows.some(row => keys.has(String(row.user_key || "")) || String(row.telegram_id || "") === String(game.profile().telegramId || ""));
  }

  async function saveCloud(row, remove = false) {
    if (!store.cloudEnabled || !store.client) return;
    try {
      if (remove) await store.client.from("bali_people_votes").delete().eq("id", row.id);
      else await store.client.from("bali_people_votes").upsert(row, { onConflict: "event_id,voter_key,candidate_key" });
    } catch {}
  }

  async function toggleVote(event, candidateKey) {
    if (!event?.id) return { ok:false, message:"Мероприятие не выбрано" };
    if (!(await canVote(event.id))) return { ok:false, message:"Голосовать могут только гости, подтвердившие вход по QR" };
    const rows = await candidates(event.id);
    const candidate = rows.find(row => String(row.id) === String(candidateKey));
    if (!candidate) return { ok:false, message:"Участник не находится на этом мероприятии" };
    if (String(candidate.id) === myId()) return { ok:false, message:"Нельзя голосовать за себя" };
    const voter = myId();
    const id = `people-vote-${safe(event.id)}-${safe(voter)}-${safe(candidate.id)}`;
    const local = read();
    const index = local.findIndex(row => row.id === id);
    if (index >= 0) {
      const removed = local[index];
      local.splice(index,1);
      write(local);
      await saveCloud(removed, true);
      return { ok:true, active:false, candidate };
    }
    const row = { id, event_id:String(event.id), event_title:event.title || "Мероприятие BALI", event_date:event.event_date || new Date().toISOString().slice(0,10), voter_key:voter, candidate_key:String(candidate.id), candidate_name:candidate.name, candidate_gender:candidate.gender || "unspecified", created_at:now() };
    local.unshift(row);
    write(local.slice(0,10000));
    await saveCloud(row);
    return { ok:true, active:true, candidate };
  }

  async function hasVoted(eventId, candidateKey) {
    const rows = await votes({ eventId });
    return rows.some(row => String(row.voter_key) === myId() && String(row.candidate_key) === String(candidateKey));
  }

  async function ranking(filters = {}) {
    const rows = await votes(filters);
    const map = new Map();
    rows.forEach(row => {
      const key = String(row.candidate_key);
      const item = map.get(key) || { id:key, name:row.candidate_name || "Гость BALI", gender:row.candidate_gender || "unspecified", votes:0 };
      item.votes += 1;
      map.set(key,item);
    });
    const profiles = personMap();
    return [...map.values()].map(item => ({ ...item, ...(profiles.get(item.id) || {}), id:item.id, votes:item.votes, gender:(profiles.get(item.id)?.gender || item.gender || "unspecified") })).sort((a,b) => b.votes - a.votes || String(a.name).localeCompare(String(b.name),"ru"));
  }

  function winners(rows) {
    const female = rows.find(row => row.gender === "female") || null;
    const male = rows.find(row => row.gender === "male") || null;
    const star = rows.find(row => !["female","male"].includes(row.gender)) || null;
    return { female, male, star };
  }

  async function history() {
    const rows = await votes();
    const events = new Map();
    rows.forEach(row => {
      const key = String(row.event_id);
      const item = events.get(key) || { id:key, title:row.event_title || "Мероприятие BALI", date:dateOnly(row.event_date), votes:[] };
      item.votes.push(row);
      events.set(key,item);
    });
    const result = [];
    for (const event of events.values()) {
      const rankingRows = await ranking({ eventId:event.id });
      result.push({ ...event, ranking:rankingRows, winners:winners(rankingRows) });
    }
    return result.sort((a,b) => String(b.date).localeCompare(String(a.date)));
  }

  window.BaliPeopleGame = { KEY, allCheckins, candidates, currentEvent, canVote, votes, toggleVote, hasVoted, ranking, winners, history, myId };
})();