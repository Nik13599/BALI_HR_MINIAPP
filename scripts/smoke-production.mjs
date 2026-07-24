import { chromium } from 'playwright';

const origin = process.env.BALI_SMOKE_ORIGIN || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });

function collectErrors(page, label) {
  const errors = [];
  page.on('pageerror', error => errors.push(`[${label}] ${String(error?.stack || error)}`));
  page.on('console', message => {
    if (message.type() === 'error') console.error(`[${label} console]`, message.text());
  });
  return errors;
}

async function installNetworkMocks(page) {
  await page.route('https://telegram.org/js/telegram-web-app.js**', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: `window.Telegram={WebApp:{initData:'smoke-init-data',initDataUnsafe:{user:{id:900000001,first_name:'Smoke',last_name:'User',username:'bali_smoke'}},ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){},openTelegramLink(){},openLink(){},HapticFeedback:{selectionChanged(){}}}};`
  }));

  await page.route('**/functions/v1/**', async route => {
    const url = new URL(route.request().url());
    const functionName = url.pathname.split('/').pop();
    let body = {};
    try { body = JSON.parse(route.request().postData() || '{}'); } catch {}

    const ownUser = {
      user_key:'tg:900000001', telegram_id:900000001, first_name:'Smoke', last_name:'User',
      name:'Smoke User', username:'bali_smoke', avatar:'', phone:'', gender:'unspecified'
    };
    const guest = {
      user_key:'tg:900000002', telegram_id:900000002, name:'Test Guest', username:'test_guest', photo:'',
      crop_x:50, crop_y:40, status:'chat', bio:'Пользователь BALI', active:true, profile_active:true,
      share_telegram:true, gender:'unspecified', updated_at:new Date().toISOString()
    };

    let payload = { ok:true };
    if (functionName === 'telegram-social-profile') {
      payload = body.action === 'sync'
        ? { ok:true, profile:{ ...guest, ...ownUser, photo:'' } }
        : { ok:true, profiles:[ownUser, guest], total:2 };
    } else if (functionName === 'telegram-auth-bootstrap') {
      payload = { ok:true, authenticated:true, user:ownUser, balance:100, vip:null };
    } else if (functionName === 'event-checkin-production') {
      if (body.action === 'presence') {
        payload = {
          ok:true,
          presence:[{
            event_id:'event-smoke', user_key:'tg:900000002', telegram_id:900000002,
            checked_in_at:new Date().toISOString(), left_at:null, presence_status:'inside'
          }],
          total:1
        };
      } else {
        payload = { ok:true, rows:[], checkins:[], presence:[], events:[] };
      }
    } else if (/checkin|attendance|presence/i.test(functionName)) {
      payload = { ok:true, rows:[], checkins:[], presence:[], events:[] };
    } else if (/loyalty|reward|gift|vip/i.test(functionName)) {
      payload = { ok:true, rows:[], rewards:[], gifts:[], grants:[], balance:100 };
    }

    await route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(payload) });
  });

  await page.route('**/rest/v1/**', async route => {
    const request = route.request();
    const method = request.method();
    let payload = [];
    if (method !== 'GET' && method !== 'HEAD') {
      try {
        const body = JSON.parse(request.postData() || '{}');
        payload = Array.isArray(body) ? body : [body];
      } catch { payload = []; }
    }
    await route.fulfill({
      status:200,
      contentType:'application/json',
      headers:{ 'content-range':'0-0/0', 'access-control-allow-origin':'*' },
      body:method === 'HEAD' ? '' : JSON.stringify(payload)
    });
  });
}

function assertNoRawErrorText(text, context) {
  for (const marker of [
    'null is not an object',
    'undefined is not an object',
    'Cannot read properties of null',
    'Cannot set properties of null',
    'Ошибка загрузки:'
  ]) {
    if (text.includes(marker)) throw new Error(`${context}: raw runtime error rendered in UI: ${marker}`);
  }
}

async function assertNoDuplicateIds(page, context) {
  const duplicates = await page.evaluate(() => {
    const counts = new Map();
    document.querySelectorAll('[id]').forEach(node => counts.set(node.id, (counts.get(node.id) || 0) + 1));
    return [...counts.entries()].filter(([, count]) => count > 1);
  });
  if (duplicates.length) throw new Error(`${context}: duplicate ids: ${JSON.stringify(duplicates)}`);
}

async function testUserApp() {
  const page = await browser.newPage({ viewport:{ width:390, height:844 }, deviceScaleFactor:1 });
  const pageErrors = collectErrors(page, 'user');
  await installNetworkMocks(page);

  await page.goto(`${origin}/site/?smoke=1`, { waitUntil:'domcontentloaded', timeout:30000 });
  await page.waitForFunction(() => document.querySelector('.shell') && document.documentElement.dataset.baliBuild, null, { timeout:30000 });
  await page.waitForTimeout(3500);

  const build = await page.evaluate(() => document.documentElement.dataset.baliBuild || '');
  if (!/^bali-production-\d+$/.test(build)) throw new Error(`Unexpected build marker: ${build}`);

  for (const section of ['home','events','menu','dating','profile']) {
    const button = page.locator(`nav [data-page="${section}"]`);
    await button.waitFor({ state:'visible', timeout:10000 });
    await button.click();
    await page.waitForTimeout(300);
    const active = await page.locator(`[data-screen="${section}"]`).evaluate(node => node.classList.contains('active'));
    if (!active) throw new Error(`User section ${section} did not become active`);
  }

  await page.locator('nav [data-page="dating"]').click();
  await page.waitForTimeout(1500);
  const peopleText = await page.locator('#socialV2Content').innerText();
  if (!peopleText.includes('Test Guest')) throw new Error(`BALI People did not render remote user: ${peopleText}`);
  if (!peopleText.includes('Smoke User')) throw new Error(`BALI People did not render current user: ${peopleText}`);

  await page.locator('[data-social-v2-tab="inside"]').click();
  await page.waitForTimeout(700);
  const insideText = await page.locator('#socialV2Content').innerText();
  if (!insideText.includes('Test Guest')) throw new Error(`QR presence tab did not render checked-in user: ${insideText}`);
  if (!insideText.includes('НА МЕРОПРИЯТИИ')) throw new Error(`Checked-in badge is missing: ${insideText}`);

  await page.locator('nav [data-page="profile"]').click();
  await page.waitForTimeout(500);
  const profileTiles = await page.locator('#profileV2Quick > button').allInnerTexts();
  if (profileTiles.length !== 3) throw new Error(`Expected 3 profile tiles, found ${profileTiles.length}: ${profileTiles.join(' | ')}`);
  for (const label of ['BALI Shop','Мои награды','Мои подарки']) {
    if (!profileTiles.some(text => text.includes(label))) throw new Error(`Missing profile tile: ${label}`);
  }
  const profileSnapshot = await page.locator('[data-screen="profile"] .inner').innerHTML();
  await page.waitForTimeout(1000);
  const profileSnapshotAfter = await page.locator('[data-screen="profile"] .inner').innerHTML();
  if (profileSnapshotAfter !== profileSnapshot) throw new Error('Profile DOM continued changing after it became visible');

  await page.locator('nav [data-page="home"]').click();
  await page.waitForTimeout(500);
  const homeState = await page.evaluate(() => {
    const home = document.getElementById('homeInner');
    return {
      order:[...(home?.children || [])].map(node => node.id || node.className),
      eventsTitle:document.querySelector('#homeEventsCard .card-head h3')?.textContent || '',
      aboutTitle:document.querySelector('#homeAboutCard .card-head h3')?.textContent || ''
    };
  });
  if (homeState.eventsTitle !== 'Ближайшие события') throw new Error(`Wrong events title: ${homeState.eventsTitle}`);
  if (homeState.aboutTitle !== 'О клубе') throw new Error(`Wrong about title: ${homeState.aboutTitle}`);
  const heroIndex = homeState.order.indexOf('homeHero');
  const referralIndex = homeState.order.indexOf('baliReferralCard');
  if (heroIndex < 0 || referralIndex < 0 || heroIndex > referralIndex) throw new Error(`Unstable home order: ${homeState.order.join(' > ')}`);

  await assertNoDuplicateIds(page, 'User app');
  assertNoRawErrorText(await page.evaluate(() => document.body.innerText), 'User app');

  const storedErrors = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('bali_runtime_errors_v1') || '[]'); }
    catch { return []; }
  });
  if (storedErrors.length) throw new Error(`User error boundary captured errors: ${JSON.stringify(storedErrors.slice(0,3))}`);
  if (pageErrors.length) throw new Error(`Unhandled user page errors: ${pageErrors.join('\n---\n')}`);

  await page.close();
  return build;
}

async function testAdmin() {
  const page = await browser.newPage({ viewport:{ width:1366, height:900 }, deviceScaleFactor:1 });
  const pageErrors = collectErrors(page, 'admin');
  await installNetworkMocks(page);

  await page.goto(`${origin}/site/admin-production.html?smoke=1`, { waitUntil:'domcontentloaded', timeout:30000 });
  await page.waitForSelector('#demoLogin', { state:'attached', timeout:20000 });
  await page.evaluate(() => {
    localStorage.removeItem('bali_admin_runtime_errors_v1');
    document.getElementById('demoLogin')?.click();
  });
  await page.waitForFunction(() => !document.getElementById('appView')?.classList.contains('hidden'), null, { timeout:15000 });
  await page.waitForTimeout(1800);

  const expectedTitles = {
    dashboard:'Обзор', messages:'Сообщения', bookings:'Брони', events:'События', customers:'Клиенты',
    bonuses:'Баллы + VIP', menu:'Меню', hall:'Схемы', reviews:'Отзывы', settings:'Настройки'
  };

  for (const [view, expectedTitle] of Object.entries(expectedTitles)) {
    const button = page.locator(`#adminNav button[data-view="${view}"]`);
    await button.waitFor({ state:'visible', timeout:10000 });
    await button.click();
    await page.waitForTimeout(1200);

    const title = (await page.locator('#pageTitle').innerText()).trim();
    const content = (await page.locator('#content').innerText()).trim();
    if (!title || title === 'undefined') throw new Error(`Admin view ${view} has invalid title: ${title}`);
    if (!title.includes(expectedTitle)) throw new Error(`Admin view ${view}: expected title ${expectedTitle}, got ${title}`);
    if (!content || content === 'Загрузка…') throw new Error(`Admin view ${view} did not render content`);
    assertNoRawErrorText(content, `Admin view ${view}`);
  }

  await assertNoDuplicateIds(page, 'Admin');
  const adminStoredErrors = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('bali_admin_runtime_errors_v1') || '[]'); }
    catch { return []; }
  });
  if (adminStoredErrors.length) throw new Error(`Admin error boundary captured errors: ${JSON.stringify(adminStoredErrors.slice(0,5))}`);
  if (pageErrors.length) throw new Error(`Unhandled admin page errors: ${pageErrors.join('\n---\n')}`);

  const build = await page.evaluate(() => document.body.dataset.adminBuild || '');
  await page.close();
  return build;
}

try {
  const userBuild = await testUserApp();
  const adminBuild = await testAdmin();
  console.log(`Production smoke tests passed: user ${userBuild}; admin ${adminBuild}.`);
} finally {
  await browser.close();
}