(() => {
  if (window.__BALI_BETA4_MAP__) return;
  window.__BALI_BETA4_MAP__ = true;
  const store = window.BaliStore;
  if (!store) return;
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
  const esc=(v="")=>String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const clamp=v=>Math.max(3,Math.min(97,Number(v??50)));
  let tables=[];

  const style=document.createElement("style");
  style.textContent=`#tableChoices{display:block!important;width:100%}.booking-square-map{position:relative;width:100%;aspect-ratio:1;overflow:hidden;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:#f0ebe3 url('./hall-plan.svg') center/contain no-repeat;touch-action:manipulation}.booking-square-table{position:absolute;transform:translate(-50%,-50%);display:grid;place-items:center;width:31px;height:31px;padding:0;border:1px solid rgba(11,13,12,.72);border-radius:50%;background:#c8ff3d;color:#090b08;box-shadow:0 4px 12px rgba(0,0,0,.25);font:700 8px Unbounded;z-index:2}.booking-square-table.square{border-radius:7px}.booking-square-table.vip{background:#e4c86e;border-color:#7d6221;color:#2c2107}.booking-square-table:disabled{background:#ff7777;border-color:#6b1d1d;color:#2b0505;opacity:1;pointer-events:none}.booking-map-legend{display:flex;justify-content:center;gap:9px;margin-top:9px;flex-wrap:wrap}.booking-map-legend span{display:flex;align-items:center;gap:5px;color:#9da49f;font-size:8px}.booking-map-legend i{width:8px;height:8px;border-radius:50%;background:#c8ff3d}.booking-map-legend i.busy{background:#ff7777}.booking-map-legend i.vip{background:#e4c86e}.booking-map-help{text-align:center;margin-top:7px;color:#9da49f;font-size:9px}.booking-data-overlay{position:fixed;inset:0;z-index:1000;display:none;place-items:end center;background:rgba(0,0,0,.82)}.booking-data-overlay.open{display:grid}.booking-data-sheet{width:min(520px,100%);max-height:92dvh;overflow:auto;padding:18px;border-radius:22px 22px 0 0;background:#0d100f;display:grid;gap:11px}.booking-data-head{display:flex;justify-content:space-between;align-items:center}.booking-data-head h3{margin:0;font:600 19px Unbounded}.booking-data-close{width:40px;height:40px;border:1px solid rgba(255,255,255,.1);border-radius:50%;background:#171c1a;color:#fff;font-size:22px}.booking-data-summary{padding:11px;border:1px solid rgba(200,255,61,.22);border-radius:14px;background:rgba(200,255,61,.06);color:#c8ff3d;font-weight:800}.booking-data-sheet>.row{display:grid!important}.booking-data-sheet>label{display:grid!important}.booking-data-sheet>button{display:block!important;width:100%}@media(max-width:380px){.booking-square-table{width:28px;height:28px;font-size:7px}}`;
  document.head.appendChild(style);

  function prepareForm(form){
    if(form.querySelector('.booking-data-overlay'))return;
    const mapLabel=[...form.children].find(x=>x.querySelector?.('#tableChoices'));
    const overlay=document.createElement('div');overlay.className='booking-data-overlay';
    const sheet=document.createElement('div');sheet.className='booking-data-sheet';
    sheet.innerHTML='<div class="booking-data-head"><div><span class="eyebrow">БРОНИРОВАНИЕ</span><h3>Введите данные</h3></div><button type="button" class="booking-data-close">×</button></div><div class="booking-data-summary"></div>';
    [...form.children].filter(x=>x!==mapLabel&&!x.matches('input[type="hidden"]')).forEach(x=>sheet.appendChild(x));
    overlay.appendChild(sheet);form.appendChild(overlay);
    sheet.querySelector('.booking-data-close').onclick=()=>overlay.classList.remove('open');
    overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.classList.remove('open')});
  }

  function openDetails(id){
    const form=document.getElementById('bookingForm'),table=tables.find(x=>String(x.id)===String(id));
    if(!form||!table||!table.available)return;
    form.elements.table_id.value=table.id;
    const overlay=form.querySelector('.booking-data-overlay');
    overlay.querySelector('.booking-data-summary').textContent=`${table.name||table.id} · ${Number(table.seats||4)} мест`;
    overlay.classList.add('open');
  }

  async function draw(){
    const root=document.getElementById('tableChoices'),form=document.getElementById('bookingForm');
    if(!root||!form||!form.elements.event_id.value)return;
    const eventId=form.elements.event_id.value,date=form.elements.booking_date.value;
    const layouts=read('bali_event_layouts_v1',{}),layout=layouts[eventId]||{},base=read('bali_hall_layout_config_v1',{});
    const source=layout.tables?.length?layout.tables:await store.list('hall_tables');
    const bookings=(await store.list('bookings')).filter(b=>!['cancelled','completed'].includes(b.status)&&(b.event_id===eventId||(!b.event_id&&b.booking_date===date)));
    const occupied=new Set(bookings.map(b=>String(b.table_id)));
    tables=source.filter(t=>t.active!==false).map(t=>({...t,available:!occupied.has(String(t.id))}));
    const buttons=tables.map(t=>`<button type="button" class="booking-square-table ${['round','square','vip'].includes(t.shape)?t.shape:'round'}" data-square-table="${esc(t.id)}" style="left:${clamp(t.x)}%;top:${clamp(t.y)}%" ${t.available?'':'disabled'}>${esc(String(t.name||t.id).replace(/^Стол\s*/i,''))}</button>`).join('');
    root.innerHTML=`<div class="booking-square-map" id="bookingSquareMap">${buttons||'<div class="booking-layout-empty">Схема ещё не настроена</div>'}</div><div class="booking-map-legend"><span><i></i>Свободен</span><span><i class="busy"></i>Занят</span><span><i class="vip"></i>VIP</span></div><div class="booking-map-help">Нажмите на свободный стол</div>`;
    const bg=layout.background||base.image||'';if(bg)document.getElementById('bookingSquareMap').style.backgroundImage=`url("${String(bg).replace(/"/g,'%22')}")`;
    prepareForm(form);
    const title=root.closest('label')?.querySelector(':scope > span');if(title)title.textContent='Выберите свободный стол';
  }

  document.addEventListener('click',e=>{
    const table=e.target.closest('[data-square-table]');
    if(table){e.preventDefault();e.stopImmediatePropagation();openDetails(table.dataset.squareTable);return}
    if(e.target.closest('[data-event]'))setTimeout(draw,320);
  },true);
  document.getElementById('eventDialog')?.addEventListener('close',()=>document.querySelector('.booking-data-overlay')?.classList.remove('open'));
  window.addEventListener('bali:data-changed',()=>setTimeout(draw,320));
})();