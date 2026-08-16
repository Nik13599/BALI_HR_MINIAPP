(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { localStorage.setItem(key, JSON.stringify(value)); return value; };
  const esc = (value = '') => String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const now = () => new Date();
  const localDate = (date = now()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const addDays = (dateText, amount) => { const d = new Date(`${dateText}T12:00:00`); d.setDate(d.getDate()+amount); return localDate(d); };
  const fmtDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('ru-RU',{day:'2-digit',month:'long'}) : '—';
  const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const initials = name => String(name || 'B').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  const profile = () => read('bali_beta4_profile_v1', read('bali_bonus_profile_v1', {id:'bali-user-nikolay',name:'Николай'}));
  const people = () => read('bali_social_people_v1', []);
  const personMap = () => new Map(people().map(x => [String(x.id), x]));
  const eventStart = event => new Date(`${event.event_date}T${event.event_time || '23:00'}:00`);
  const eventEnd = event => {
    if (event.end_at || event.event_end_at) return new Date(event.end_at || event.event_end_at);
    let endDate = event.event_end_date || event.event_date;
    const startTime = event.event_time || '23:00';
    const endTime = event.event_end_time || event.end_time || '06:00';
    const mins = value => { const [h,m] = String(value).split(':').map(Number); return h*60+(m||0); };
    if (!event.event_end_date && mins(endTime) <= mins(startTime)) endDate = addDays(endDate, 1);
    return new Date(`${endDate}T${endTime}:00`);
  };
  const isToday = event => event.event_date === localDate() || (now() >= eventStart(event) && now() <= eventEnd(event));
  const isUpcoming = event => event.active !== false && eventEnd(event).getTime() >= Date.now();
  const sortedEvents = () => read('bali_events_v2', []).filter(isUpcoming).sort((a,b)=>eventStart(a)-eventStart(b));
  const image = (src, alt='') => src ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async">` : `<div class="compact-placeholder">BALI</div>`;
  const avatar = (person, cls='avatar') => `<span class="${cls}">${person?.photo || person?.avatar ? `<img src="${esc(person.photo || person.avatar)}" alt="${esc(person.name || '')}" loading="lazy" decoding="async">` : esc(initials(person?.name))}</span>`;

  const state = { page:'home', menuCategory:'Все', activeEventId:null };
  const app = $('#app');
  if (!app) return;

  function normalizeDemoDates() {
    const today = localDate();
    const marker = localStorage.getItem('bali_fast_demo_day_v1');
    const events = read('bali_events_v2', []);
    const offsets = {'event-demo-crown':0,'event-demo-tropic':5,'event-demo-football':9,'event-demo-black':14};
    let changed = false;
    if (marker !== today) {
      events.forEach(event => {
        if (Object.hasOwn(offsets,event.id)) {
          event.event_date = addDays(today, offsets[event.id]);
          event.event_end_time ||= '06:00';
          changed = true;
        }
      });
      localStorage.setItem('bali_fast_demo_day_v1', today);
    }
    if (changed) write('bali_events_v2', events);
  }

  function ensureAttendees() {
    const events = read('bali_events_v2', []);
    const members = people();
    const extra = [
      {id:'demo-guest-9',name:'Елена'}, {id:'demo-guest-10',name:'Игорь'},
      {id:'demo-guest-11',name:'Виктория'}, {id:'demo-guest-12',name:'Алексей'}
    ];
    const pool = [...members, ...extra];
    const desired = {'event-demo-crown':10,'event-demo-tropic':7,'event-demo-football':6,'event-demo-black':5};
    const all = read('bali_event_rsvps_v1', {});
    events.forEach(event => {
      all[event.id] ||= {};
      const target = desired[event.id] || 4;
      for (let i=0; i<Math.min(target,pool.length); i++) {
        const p = pool[i];
        const key = String(p.id || `guest-${i}`);
        if (!all[event.id][key]) all[event.id][key] = {
          user_key:key, name:p.name || `Гость ${i+1}`,
          status:i%3===0?'going':'interested', attendance_mode:i%3===0?'general_admission':'interest',
          updated_at:new Date().toISOString()
        };
      }
    });
    write('bali_event_rsvps_v1', all);
  }

  function ensureData() {
    normalizeDemoDates();
    ensureAttendees();
  }

  function rsvpRows(eventId) { return Object.values(read('bali_event_rsvps_v1', {})[eventId] || {}); }
  function eventBookings(event) {
    return read('bali_bookings_v2', []).filter(row =>
      (String(row.event_id || '') === String(event.id) || (!row.event_id && row.booking_date === event.event_date)) &&
      !['cancelled','completed'].includes(row.status)
    );
  }
  function eventStats(event) {
    const rows = rsvpRows(event.id);
    const bookings = eventBookings(event);
    const tableGuests = bookings.reduce((sum,row)=>sum+Number(row.guests || 0),0);
    return { rows, bookings, tableGuests, total:rows.length + tableGuests };
  }

  function shell() {
    app.innerHTML = `<div class="app">
      <header class="topbar"><button class="brand" data-nav="home"><span class="brand-logo">B</span><span><strong>BALI</strong><small>БРАУЗЕРНАЯ DEMO</small></span></button><span class="demo-badge">FAST DEMO</span></header>
      <main class="viewport"><div class="content" id="content"></div></main>
      <nav class="nav" aria-label="Навигация">
        ${[['home','⌂','Главная'],['events','◫','Афиша'],['menu','◇','Меню'],['people','🌴','BALI People'],['contest','👑','Конкурс'],['profile','◎','Профиль']].map(([id,icon,label])=>`<button type="button" data-nav="${id}"><i>${icon}</i><span>${label}</span></button>`).join('')}
      </nav>
    </div>
    <div class="modal" id="eventModal" aria-hidden="true"><div class="modal-sheet" role="dialog" aria-modal="true"><button class="modal-close" type="button" data-close-modal>×</button><div id="modalBody"></div></div></div>
    <div class="toast" id="toast"></div>`;
  }

  function toast(message) {
    const node = $('#toast'); if (!node) return;
    node.textContent = message; node.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(()=>node.classList.remove('show'),2200);
  }

  function setPage(page) {
    state.page = page;
    $$('.nav [data-nav]').forEach(btn=>btn.classList.toggle('active',btn.dataset.nav===page));
    renderPage();
    $('.viewport')?.scrollTo({top:0,behavior:'instant'});
  }
  function $$(s,root=document){return [...root.querySelectorAll(s)]}

  function eventCard(event, compact=false) {
    const stats = eventStats(event);
    const today = isToday(event);
    if (compact) return `<article class="compact-event ${today?'today':''}" data-event-id="${esc(event.id)}">
      ${today?'<span class="today-label">УЖЕ СЕГОДНЯ</span>':''}<div>${image(event.image_url,event.title)}</div><div><h3>${esc(event.title)}</h3><p>${fmtDate(event.event_date)} · ${esc(event.event_time || '23:00')}–${esc(event.event_end_time || '06:00')} · 👥 ${stats.total}</p></div><b>＋</b></article>`;
    return `<article class="event-card ${today?'today':''}" data-event-id="${esc(event.id)}">
      ${today?'<span class="today-label">УЖЕ СЕГОДНЯ</span>':''}<div class="event-media">${image(event.image_url,event.title)}</div>
      <div class="event-body"><small>${fmtDate(event.event_date)} · ${esc(event.event_time || '23:00')}–${esc(event.event_end_time || '06:00')}</small><h3>${esc(event.title)}</h3><p>${esc(event.description || 'Подробности мероприятия')}</p><div class="event-meta"><span>👥 Собираются: ${stats.total}</span><span>Подробнее →</span></div></div></article>`;
  }

  function renderHome(root) {
    const events = sortedEvents();
    root.innerHTML = `<section class="hero"><span class="eyebrow">NIGHT CLUB · МИНСК</span><h1>Твоя ночь<br><em>начинается здесь</em></h1><p>Афиша, гости, BALI People, конкурс, награды и профиль — в одной быстрой браузерной DEMO.</p><div class="pills"><span>Кирова, 13</span><span>ПТ–СБ · 23:00–06:00</span><span>Свободный вход</span></div></section>
      <section class="card"><div class="card-head"><h2>Ближайшие события</h2><button class="link-btn" data-nav="events">Все афиши</button></div><div class="compact-list">${events.slice(0,3).map(x=>eventCard(x,true)).join('') || '<div class="empty">Ближайшие события скоро появятся</div>'}</div></section>
      <section class="card"><div class="card-head"><h3>О клубе</h3></div><p style="margin:0;color:var(--muted);font-size:11px;line-height:1.6">BALI — ночной клуб в центре Минска: события, DJ-сеты, танцпол, бар, кальяны, большие экраны и комфортная рассадка.</p></section>`;
  }

  function renderEvents(root) {
    const events = sortedEvents();
    root.innerHTML = `<div class="page-head"><div><span class="eyebrow">БЛИЖАЙШИЕ ДАТЫ</span><h1>Афиша</h1></div><span class="count">${events.length} событий</span></div><div class="events-grid">${events.map(x=>eventCard(x)).join('') || '<div class="empty">Афиш пока нет</div>'}</div>`;
  }

  function renderMenu(root) {
    const rows = read('bali_menu_v2', []).filter(x=>x.active!==false);
    const categories = ['Все',...new Set(rows.map(x=>x.category || 'Другое'))];
    const shown = state.menuCategory==='Все' ? rows : rows.filter(x=>(x.category||'Другое')===state.menuCategory);
    root.innerHTML = `<div class="page-head"><div><span class="eyebrow">БАР · КУХНЯ · КАЛЬЯНЫ</span><h1>Меню</h1></div><span class="count">${shown.length} позиций</span></div><div class="menu-tabs">${categories.map(c=>`<button type="button" class="${c===state.menuCategory?'active':''}" data-menu-category="${esc(c)}">${esc(c)}</button>`).join('')}</div><div class="menu-list">${shown.map(x=>`<article class="menu-item"><div><h3>${esc(x.name)}</h3><p>${esc(x.description||'')}</p></div><strong>${Number(x.price||0)} BYN</strong></article>`).join('') || '<div class="empty">Позиции не найдены</div>'}</div>`;
  }

  function renderPeople(root) {
    const rows = people().filter(x=>x.active!==false);
    root.innerHTML = `<div class="page-head"><div><span class="eyebrow">ЗНАКОМСТВА В BALI</span><h1>BALI People</h1></div><span class="count">${rows.length} человек</span></div><div class="people-grid">${rows.map(person=>`<article class="person"><div class="person-top">${avatar(person)}<div><h3>${esc(person.name)}</h3><p>${esc(person.level || person.vipPlan || 'Гость BALI')}</p></div></div><span class="status">${esc(person.statusLabel || statusLabel(person.status))}</span><p>${esc(person.bio || '')}</p></article>`).join('')}</div>`;
  }
  function statusLabel(status){return ({party:'Ищу компанию на вечеринку',table:'Ищу компанию за столик',chat:'Открыт к общению',closed:'Не знакомлюсь'})[status] || 'В BALI'}

  function renderContest(root) {
    const entries = read('bali_night_crown_entries_v1', []).filter(x=>x.status==='approved');
    const votes = read('bali_night_crown_votes_v1', []);
    const voteCount = key => votes.filter(v=>String(v.candidate_key)===String(key)).length;
    root.innerHTML = `<div class="page-head"><div><span class="eyebrow">КОРОЛЬ И КОРОЛЕВА BALI</span><h1>Конкурс</h1></div><span class="count">${entries.length} участников</span></div><section class="card"><p style="margin:0;color:var(--muted);font-size:11px;line-height:1.6">Голосуйте за Короля и Королеву ночи. Все голоса сохраняются локально в браузере.</p></section><div class="contest-grid">${entries.map(x=>`<article class="contest-card">${avatar({name:x.name,photo:x.photo_url})}<h3>${esc(x.name)}</h3><p>${x.gender==='female'?'Королева':'Король'} · ${voteCount(x.user_key)} голосов</p><button class="secondary full" type="button" data-vote="${esc(x.user_key)}">Голосовать</button></article>`).join('') || '<div class="empty">Участники скоро появятся</div>'}</div>`;
  }

  function renderProfile(root) {
    const p = profile();
    const rewards = read('bali_beta4_custom_rewards_v1', []);
    const grants = read('bali_beta4_reward_grants_v1', []);
    const earnedIds = new Set(grants.filter(g=>String(g.userKey||g.user_key)===String(p.id||p.userKey)).map(g=>String(g.rewardId||g.reward_id)));
    const gifts = read('bali_social_gifts_v1', []).filter(g=>String(g.toId||g.to_id)===String(p.id||p.userKey));
    const vip = read('bali_beta4_vip_gifts_v1', []).find(v=>!v.revokedAt && (v.targetKeys||[]).includes(p.id||p.userKey));
    root.innerHTML = `<div class="page-head"><div><span class="eyebrow">ЛИЧНЫЙ КАБИНЕТ</span><h1>Профиль</h1></div></div><section class="card profile-hero">${avatar({name:p.name,photo:p.avatar})}<div><h2>${esc(p.name||'Гость BALI')}</h2><p>${esc(vip?.planId ? `Статус: BALI ${String(vip.planId).toUpperCase()}` : 'Статус: Гость BALI')}</p><span class="status">${esc(statusLabel(p.status))}</span></div></section><div class="stats"><article class="stat"><strong>${Number(p.visits||0)}</strong><span>ПОСЕЩЕНИЯ</span></article><article class="stat"><strong>${Number(p.bookings||0)}</strong><span>БРОНИ</span></article><article class="stat"><strong>${Number(p.points||read('bali_bonus_profile_v1',{}).balance||0)}</strong><span>БАЛЛЫ</span></article><article class="stat"><strong>${earnedIds.size}</strong><span>НАГРАДЫ</span></article></div><section class="card"><div class="card-head"><h3>Награды</h3><span class="count">${earnedIds.size}/${rewards.length}</span></div><div class="reward-grid">${rewards.map(r=>`<article class="reward ${earnedIds.has(String(r.id))?'earned':''}"><div class="icon">${esc(r.icon||'🏆')}</div><h3>${esc(r.title)}</h3><p>${esc(r.description||'')}</p></article>`).join('')}</div></section><section class="card"><div class="card-head"><h3>Подарки</h3><span class="count">${gifts.length}</span></div><div class="gift-list">${gifts.map(g=>`<article class="gift"><span class="gift-icon">${esc(g.icon||'🎁')}</span><div><h3>${esc(g.giftName||g.gift_name||'Подарок')}</h3><p>От ${esc(g.fromName||g.from_name||'BALI')}</p></div></article>`).join('') || '<div class="empty">Подарков пока нет</div>'}</div></section>`;
  }

  function renderPage() {
    const root = $('#content'); if (!root) return;
    ({home:renderHome,events:renderEvents,menu:renderMenu,people:renderPeople,contest:renderContest,profile:renderProfile}[state.page] || renderHome)(root);
  }

  function attendeesHtml(event) {
    const map = personMap();
    const rows = rsvpRows(event.id);
    const bookingRows = eventBookings(event);
    const seen = new Set();
    const items = [];
    rows.forEach(row => { const key=String(row.user_key||row.id||row.name); if(seen.has(key))return; seen.add(key); items.push({key,name:row.name||'Гость',person:map.get(key)}); });
    bookingRows.forEach(row => { const key=`booking-${row.id}`; items.push({key,name:`${row.customer_name||row.name||'Гость'} +${Math.max(0,Number(row.guests||1)-1)}`,person:null}); });
    return items.slice(0,18).map(item=>`<div class="attendee">${avatar(item.person||{name:item.name})}<span>${esc(item.name)}</span></div>`).join('');
  }

  function openEvent(id) {
    const event = sortedEvents().find(x=>String(x.id)===String(id)); if (!event) return;
    state.activeEventId = event.id;
    const stats = eventStats(event);
    const current = rsvpRows(event.id).find(x=>String(x.user_key)===String(profile().id||profile().userKey));
    const performers = Array.isArray(event.performers) ? event.performers : defaultPerformers(event.id);
    $('#modalBody').innerHTML = `<div class="modal-media" style="${event.image_url?`background-image:url('${String(event.image_url).replace(/'/g,'%27')}')`:''}"></div><div class="modal-content"><span class="eyebrow">${isToday(event)?'УЖЕ СЕГОДНЯ · ':''}${fmtDate(event.event_date)} · ${esc(event.event_time||'23:00')}–${esc(event.event_end_time||'06:00')}</span><h2>${esc(event.title)}</h2><p>${esc(event.details_description||event.description||'Подробности мероприятия')}</p><div class="modal-stats"><article class="modal-stat"><strong>${stats.total}</strong><span>СОБИРАЮТСЯ</span></article><article class="modal-stat"><strong>${stats.rows.length}</strong><span>ХОТЯТ ПОЙТИ</span></article><article class="modal-stat"><strong>${stats.tableGuests}</strong><span>ЗА СТОЛАМИ</span></article></div><section><div class="card-head"><h3>Кто собирается пойти</h3><span class="count">${stats.total} человек</span></div><div class="attendees">${attendeesHtml(event)}</div></section>${performers.length?`<section><div class="card-head"><h3>Ведущие и DJ</h3></div><div class="attendees">${performers.map(x=>`<div class="attendee">${avatar({name:x.name,photo:x.photo_url})}<span>${esc(x.role||'Участник')}<br>${esc(x.name)}</span></div>`).join('')}</div></section>`:''}<div class="form-row"><button class="${current?.status==='interested'?'primary':'secondary'}" type="button" data-rsvp="interested">Хочу пойти</button><button class="${current?.status==='going'?'primary':'secondary'}" type="button" data-rsvp="going">Приду без брони</button></div><section class="card"><div class="card-head"><h3>Бронирование стола</h3></div>${bookingForm(event)}</section></div>`;
    const modal = $('#eventModal'); modal.classList.add('open'); modal.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open');
  }

  function defaultPerformers(id) {
    const map = {
      'event-demo-crown':[{role:'DJ',name:'DJ ANI'},{role:'Ведущий',name:'Максим Орлов'}],
      'event-demo-tropic':[{role:'DJ',name:'DJ ANI'},{role:'Go-Go',name:'Sofia Wave'}],
      'event-demo-football':[{role:'Ведущий',name:'MC Иван'}],
      'event-demo-black':[{role:'Special Guest',name:'Будет объявлен'}]
    };
    return map[id] || [];
  }

  function bookingForm(event) {
    const p = profile();
    const tables = read('bali_tables_v2', []).filter(x=>x.active!==false);
    const occupied = new Set(eventBookings(event).map(x=>String(x.table_id)));
    return `<form class="form" id="fastBooking"><div class="form-row"><label>Имя<input name="name" value="${esc(p.name||'')}" required></label><label>Телефон<input name="phone" value="${esc(p.phone||'')}" required></label></div><div class="form-row"><label>Гостей<select name="guests">${[2,3,4,5,6,8,10].map(n=>`<option value="${n}">${n}</option>`).join('')}</select></label><label>Стол<select name="table_id" required><option value="">Выберите</option>${tables.map(t=>`<option value="${esc(t.id)}" ${occupied.has(String(t.id))?'disabled':''}>${esc(t.name||t.id)} · ${Number(t.seats||4)} мест${occupied.has(String(t.id))?' · занят':''}</option>`).join('')}</select></label></div><label>Комментарий<textarea name="comment"></textarea></label><button class="primary full" type="submit">Забронировать стол</button></form>`;
  }

  function closeModal() {
    const modal = $('#eventModal'); if (!modal) return;
    modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); document.body.classList.remove('modal-open'); state.activeEventId=null;
  }

  function toggleRsvp(status) {
    const eventId = state.activeEventId; if (!eventId) return;
    const p = profile(); const key=String(p.id||p.userKey||'demo-user');
    const all = read('bali_event_rsvps_v1',{}); all[eventId] ||= {};
    if (all[eventId][key]?.status===status) delete all[eventId][key];
    else all[eventId][key]={user_key:key,name:p.name||'Гость BALI',status,attendance_mode:status==='going'?'general_admission':'interest',updated_at:new Date().toISOString()};
    write('bali_event_rsvps_v1',all); toast(status==='going'?'Отмечено: приду без брони':'Статус «Хочу пойти» обновлён'); openEvent(eventId);
  }

  function saveBooking(form) {
    const event = sortedEvents().find(x=>String(x.id)===String(state.activeEventId)); if(!event)return;
    const data=Object.fromEntries(new FormData(form).entries());
    const tables=read('bali_tables_v2',[]), table=tables.find(x=>String(x.id)===String(data.table_id));
    const bookings=read('bali_bookings_v2',[]); const p=profile();
    const booking={id:uid('booking'),event_id:event.id,booking_date:event.event_date,booking_time:event.event_time||'23:00',table_id:data.table_id,table_name:table?.name||data.table_id,customer_name:data.name,phone:data.phone,guests:Number(data.guests||2),status:'confirmed',comment:data.comment||'',created_at:new Date().toISOString()};
    bookings.unshift(booking); write('bali_bookings_v2',bookings);
    const all=read('bali_event_rsvps_v1',{}); all[event.id] ||= {}; const key=String(p.id||p.userKey||'demo-user'); all[event.id][key]={user_key:key,name:data.name,status:'booked',attendance_mode:'table_booking',booking_id:booking.id,guests:Number(data.guests||2),updated_at:new Date().toISOString()}; write('bali_event_rsvps_v1',all);
    toast('Стол успешно забронирован'); openEvent(event.id); renderPage();
  }

  function vote(candidateKey) {
    const entries=read('bali_night_crown_entries_v1',[]), candidate=entries.find(x=>String(x.user_key)===String(candidateKey)); if(!candidate)return;
    const p=profile(), voter=String(p.id||p.userKey||'demo-user'); const votes=read('bali_night_crown_votes_v1',[]);
    const existing=votes.findIndex(v=>String(v.voter_key)===voter && v.candidate_gender===candidate.gender);
    const row={id:uid('vote'),event_id:candidate.event_id,voter_key:voter,candidate_key:candidate.user_key,candidate_name:candidate.name,candidate_gender:candidate.gender,created_at:new Date().toISOString()};
    if(existing>=0)votes[existing]=row;else votes.push(row); write('bali_night_crown_votes_v1',votes); toast('Голос сохранён'); renderPage();
  }

  document.addEventListener('click', event => {
    const nav=event.target.closest('[data-nav]'); if(nav){event.preventDefault();setPage(nav.dataset.nav);return;}
    const eventCardNode=event.target.closest('[data-event-id]'); if(eventCardNode){event.preventDefault();openEvent(eventCardNode.dataset.eventId);return;}
    if(event.target.closest('[data-close-modal]') || event.target.id==='eventModal'){event.preventDefault();closeModal();return;}
    const rsvp=event.target.closest('[data-rsvp]'); if(rsvp){toggleRsvp(rsvp.dataset.rsvp);return;}
    const category=event.target.closest('[data-menu-category]'); if(category){state.menuCategory=category.dataset.menuCategory;renderPage();return;}
    const voteBtn=event.target.closest('[data-vote]'); if(voteBtn){vote(voteBtn.dataset.vote);return;}
  });
  document.addEventListener('submit',event=>{if(event.target.id==='fastBooking'){event.preventDefault();saveBooking(event.target);}});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeModal();});
  window.addEventListener('storage',()=>{ensureData();renderPage();});

  ensureData(); shell(); setPage('home');
})();