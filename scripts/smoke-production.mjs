import { chromium } from 'playwright';

const origin = process.env.BALI_SMOKE_ORIGIN || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless:true });

function collectErrors(page, label) {
  const errors = [];
  page.on('pageerror', error => errors.push(`[${label}] ${String(error?.stack || error)}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`[${label} console] ${message.text()}`); });
  return errors;
}

const mockSupabase = `
(() => {
  const now = new Date().toISOString();
  const db = window.__mockDb = {
    events:[{id:'event-1',title:'BALI PARTY',description:'Тестовое событие',event_date:'2026-07-25',event_time:'23:00',active:true,image_url:''}],
    menu_items:[{id:'menu-1',name:'Коктейль BALI',description:'Фирменный коктейль',category:'Бар',price:20,active:true,sort_order:1}],
    hall_tables:[{id:'table-1',name:'Стол 1',seats:4,active:true}],
    bookings:[],
    customers:[{id:'customer-1',name:'Test Guest',phone:'+375291111111',telegram:'@test_guest',visits:1}],
    app_users:[{id:'u1',user_key:'tg:900000001',telegram_id:900000001,name:'Smoke User',username:'@bali_smoke',active:true,last_seen_at:now},{id:'u2',user_key:'tg:900000002',telegram_id:900000002,name:'Test Guest',username:'@test_guest',active:true,last_seen_at:now}],
    event_checkins:[{id:'c1',event_id:'event-1',event_title:'BALI PARTY',user_key:'tg:900000002',telegram_id:900000002,name:'Test Guest',presence_status:'inside',checked_in_at:now,left_at:null}],
    loyalty_rewards:[{id:'r1',title:'VIP-статус',description:'VIP на 7 дней',icon:'👑',points_cost:500,stock:null,active:true,created_at:now}],
    loyalty_gifts:[{id:'g1',title:'Коктейль BALI',description:'Подарочный коктейль',icon:'🍸',points_cost:300,stock:null,active:true,created_at:now}],
    reward_grants:[], gift_grants:[],
    app_settings:[{id:'main',club_name:'BALI',address:'Минск',phone:'+375296700300',events_title:'Ближайшие события',about_title:'О клубе',attendance_points:100}]
  };
  const makeQuery = table => {
    const q = { filters:[], orderKey:null, ascending:true, mode:'select', payload:null };
    const api = {
      select(){ q.mode = q.mode === 'upsert' ? 'upsert' : 'select'; return api; },
      order(key, options={}){ q.orderKey=key; q.ascending=options.ascending !== false; return api; },
      eq(key, value){ q.filters.push([key,value]); return api; },
      delete(){ q.mode='delete'; return api; },
      upsert(payload){ q.mode='upsert'; q.payload=payload; return api; },
      single(){ return execute(true); },
      then(resolve,reject){ return execute(false).then(resolve,reject); }
    };
    async function execute(single) {
      let rows = [...(db[table] || [])];
      if (q.mode === 'delete') {
        db[table] = rows.filter(row => !q.filters.every(([key,value]) => String(row[key]) === String(value)));
        return { data:null, error:null };
      }
      if (q.mode === 'upsert') {
        const payload = { ...q.payload };
        if (!payload.id) payload.id = crypto.randomUUID();
        const index = rows.findIndex(row => String(row.id) === String(payload.id));
        const saved = { ...(index >= 0 ? rows[index] : {}), created_at:index >= 0 ? rows[index].created_at : now, ...payload };
        if (index >= 0) rows[index]=saved; else rows.unshift(saved);
        db[table]=rows;
        return { data:single ? saved : [saved], error:null };
      }
      for (const [key,value] of q.filters) rows = rows.filter(row => String(row[key]) === String(value));
      if (q.orderKey) rows.sort((a,b) => String(a[q.orderKey] || '').localeCompare(String(b[q.orderKey] || '')) * (q.ascending ? 1 : -1));
      return { data:single ? rows[0] : rows, error:null };
    }
    return api;
  };
  window.supabase = { createClient(){ return {
    from:makeQuery,
    rpc:async(name,args) => name === 'get_table_availability' ? {data:db.hall_tables.map(t => ({...t,available:true})),error:null} : name === 'create_public_booking' ? (db.bookings.push({id:crypto.randomUUID(),...args}),{data:{ok:true},error:null}) : {data:[],error:null},
    auth:{ getSession:async()=>({data:{session:{user:{email:'admin@bali.local'}}}}), signInWithPassword:async()=>({data:{session:{user:{email:'admin@bali.local'}}},error:null}), signOut:async()=>({error:null}) }
  }; }};
})();`;

async function mocks(page) {
  await page.route('https://telegram.org/js/telegram-web-app.js**', route => route.fulfill({ status:200, contentType:'application/javascript', body:`window.__opened=[];window.Telegram={WebApp:{initData:'smoke-init-data',initDataUnsafe:{user:{id:900000001,first_name:'Smoke',last_name:'User',username:'bali_smoke'}},ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){},openTelegramLink(url){window.__opened.push(url)},openLink(url){window.__opened.push(url)},showScanQrPopup(){},HapticFeedback:{selectionChanged(){}}}};` }));
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', route => route.fulfill({ status:200, contentType:'application/javascript', body:mockSupabase }));
  await page.route('**/functions/v1/**', route => route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({ok:true,user:{user_key:'tg:900000001'},points:100}) }));
}

async function testUser() {
  const page = await browser.newPage({ viewport:{width:390,height:844} });
  const errors = collectErrors(page,'user');
  await mocks(page);
  await page.goto(`${origin}/site/?smoke=1`, { waitUntil:'domcontentloaded' });
  await page.waitForSelector('.bali-app');
  await page.waitForTimeout(300);
  const headings = await page.locator('[data-screen="home"] h2').allInnerTexts();
  if (!headings.includes('Ближайшие события') || !headings.includes('О клубе')) throw new Error(`Wrong home headings: ${headings.join(' | ')}`);
  for (const section of ['home','events','menu','people','profile']) {
    await page.locator(`.bali-nav [data-page="${section}"]`).click();
    if (!(await page.locator(`[data-screen="${section}"]`).evaluate(node => node.classList.contains('active')))) throw new Error(`Section ${section} did not open`);
  }
  await page.locator('.bali-nav [data-page="home"]').click();
  await page.locator('[data-link="instagram"]').click();
  await page.locator('[data-link="manager"]').click();
  const opened = await page.evaluate(() => window.__opened);
  if (!opened.some(url => url.includes('instagram.com'))) throw new Error('Instagram button did not call Telegram openLink');
  if (!opened.some(url => url.includes('t.me/BaliMinskAppBot'))) throw new Error('Manager button did not call Telegram openTelegramLink');
  await page.locator('.bali-nav [data-page="people"]').click();
  const allPeople = await page.locator('#peopleList').innerText();
  if (!allPeople.includes('Smoke User') || !allPeople.includes('Test Guest')) throw new Error(`BALI People incomplete: ${allPeople}`);
  await page.locator('[data-people-tab="inside"]').click();
  const inside = await page.locator('#peopleList').innerText();
  if (!inside.includes('Test Guest') || !inside.includes('НА МЕРОПРИЯТИИ')) throw new Error(`Inside tab incomplete: ${inside}`);
  await page.locator('.bali-nav [data-page="profile"]').click();
  const profile = await page.locator('#profileContent').innerText();
  if (!profile.includes('VIP-статус') || !profile.includes('Коктейль BALI')) throw new Error(`Catalogs missing from profile: ${profile}`);
  await page.locator('.bali-nav [data-page="events"]').click();
  await page.locator('[data-event-id="event-1"]').first().click();
  await page.locator('[data-action="book"]').click();
  await page.locator('#bookingForm input[name="phone"]').fill('+375291234567');
  await page.locator('#bookingForm select[name="table_id"]').selectOption('table-1');
  await page.locator('#bookingForm').evaluate(form => form.requestSubmit());
  await page.waitForTimeout(150);
  if (errors.length) throw new Error(errors.join('\n'));
  await page.close();
}

async function testAdmin() {
  const page = await browser.newPage({ viewport:{width:1366,height:900} });
  const errors = collectErrors(page,'admin');
  await mocks(page);
  await page.goto(`${origin}/site/admin-production.html?smoke=1`, { waitUntil:'domcontentloaded' });
  await page.waitForSelector('.admin-shell');
  for (const view of ['overview','rewards','gifts','grants','customers','events','settings']) {
    await page.locator(`#adminNav [data-view="${view}"]`).click();
    await page.waitForTimeout(50);
    if (!(await page.locator('#adminContent').innerText()).trim()) throw new Error(`Admin view ${view} is empty`);
  }
  await page.locator('#adminNav [data-view="rewards"]').click();
  await page.locator('#adminPrimary').click();
  await page.locator('#adminEditorForm input[name="title"]').fill('Новая награда');
  await page.locator('#adminEditorForm input[name="points_cost"]').fill('150');
  await page.locator('#adminEditorForm').evaluate(form => form.requestSubmit());
  await page.waitForTimeout(100);
  if (!(await page.locator('#adminContent').innerText()).includes('Новая награда')) throw new Error('Reward creation failed');
  await page.locator('[data-action="issue"][data-kind="reward"]').first().click();
  await page.locator('#adminIssueForm select[name="user_key"]').selectOption('tg:900000001');
  await page.locator('#adminIssueForm').evaluate(form => form.requestSubmit());
  await page.waitForTimeout(100);
  if (!(await page.locator('#adminContent').innerText()).includes('Награда')) throw new Error('Reward issuance failed');
  if (errors.length) throw new Error(errors.join('\n'));
  await page.close();
}

try {
  await testUser();
  await testAdmin();
  console.log('Clean BALI rebuild smoke tests passed.');
} finally {
  await browser.close();
}
