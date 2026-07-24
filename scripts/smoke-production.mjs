import { chromium } from 'playwright';

const baseUrl = process.env.BALI_SMOKE_URL || 'http://127.0.0.1:4173/site/?smoke=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const pageErrors = [];

page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));
page.on('console', message => {
  if (message.type() === 'error') console.error('[browser console]', message.text());
});

await page.route('https://telegram.org/js/telegram-web-app.js**', route => route.fulfill({
  status: 200,
  contentType: 'application/javascript',
  body: `window.Telegram={WebApp:{initData:'smoke-init-data',initDataUnsafe:{user:{id:900000001,first_name:'Smoke',last_name:'User',username:'bali_smoke'}},ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){},openTelegramLink(){},openLink(){},HapticFeedback:{selectionChanged(){}}}};`
}));

await page.route('**/functions/v1/telegram-social-profile', async route => {
  let body = {};
  try { body = JSON.parse(route.request().postData() || '{}'); } catch {}
  const profile = {
    user_key:'tg:900000002',telegram_id:900000002,name:'Test Guest',username:'test_guest',photo:'',
    crop_x:50,crop_y:40,status:'chat',bio:'Пользователь BALI',active:true,profile_active:true,
    share_telegram:true,gender:'unspecified',updated_at:new Date().toISOString()
  };
  const payload = body.action === 'sync'
    ? { ok:true, profile:{ ...profile, user_key:'tg:900000001', telegram_id:900000001, name:'Smoke User', username:'bali_smoke' } }
    : { ok:true, profiles:[profile], total:1 };
  await route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(payload) });
});

await page.route('**/rest/v1/events**', route => route.fulfill({ status:200, contentType:'application/json', headers:{ 'content-range':'0-0/0' }, body:'[]' }));
await page.route('**/rest/v1/menu_items**', route => route.fulfill({ status:200, contentType:'application/json', headers:{ 'content-range':'0-0/0' }, body:'[]' }));
await page.route('**/rest/v1/bookings**', route => route.fulfill({ status:200, contentType:'application/json', headers:{ 'content-range':'0-0/0' }, body:'[]' }));
await page.route('**/rest/v1/app_users**', route => route.fulfill({ status:200, contentType:'application/json', body:'[]' }));
await page.route('**/rest/v1/points_accounts**', route => route.fulfill({ status:200, contentType:'application/json', body:'[]' }));
await page.route('**/rest/v1/social_profiles**', route => route.fulfill({ status:200, contentType:'application/json', body:'[]' }));
await page.route('**/rest/v1/vip_memberships**', route => route.fulfill({ status:200, contentType:'application/json', body:'[]' }));
await page.route('**/rest/v1/vip_plans**', route => route.fulfill({ status:200, contentType:'application/json', body:'[]' }));

await page.goto(baseUrl, { waitUntil:'domcontentloaded', timeout:30000 });
await page.waitForFunction(() => document.querySelector('.shell') && document.documentElement.dataset.baliBuild, null, { timeout:30000 });
await page.waitForTimeout(3500);

const build = await page.evaluate(() => document.documentElement.dataset.baliBuild || '');
if (!/^bali-production-\d+$/.test(build)) throw new Error(`Unexpected build marker: ${build}`);

for (const section of ['home','events','menu','dating','profile']) {
  const button = page.locator(`nav [data-page="${section}"]`);
  await button.waitFor({ state:'visible', timeout:10000 });
  await button.click();
  await page.waitForTimeout(250);
  const active = await page.locator(`[data-screen="${section}"]`).evaluate(node => node.classList.contains('active'));
  if (!active) throw new Error(`Section ${section} did not become active`);
}

await page.locator('nav [data-page="dating"]').click();
await page.waitForTimeout(1500);
const peopleText = await page.locator('#socialV2Content').innerText();
if (!peopleText.includes('Test Guest')) throw new Error(`BALI People did not render remote user: ${peopleText}`);

await page.locator('nav [data-page="profile"]').click();
await page.waitForTimeout(700);
const profileTiles = await page.locator('#profileV2Quick > button').allInnerTexts();
if (profileTiles.length !== 3) throw new Error(`Expected 3 profile tiles, found ${profileTiles.length}: ${profileTiles.join(' | ')}`);
for (const label of ['BALI Shop','Мои награды','Мои подарки']) {
  if (!profileTiles.some(text => text.includes(label))) throw new Error(`Missing profile tile: ${label}`);
}

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

const duplicateIds = await page.evaluate(() => {
  const counts = new Map();
  document.querySelectorAll('[id]').forEach(node => counts.set(node.id, (counts.get(node.id) || 0) + 1));
  return [...counts.entries()].filter(([, count]) => count > 1);
});
if (duplicateIds.length) throw new Error(`Duplicate ids: ${JSON.stringify(duplicateIds)}`);

const rawErrorText = await page.evaluate(() => document.body.innerText);
for (const marker of ['null is not an object','undefined is not an object','Cannot read properties of null','Cannot set properties of null']) {
  if (rawErrorText.includes(marker)) throw new Error(`Raw runtime error rendered in UI: ${marker}`);
}

const storedErrors = await page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('bali_runtime_errors_v1') || '[]'); }
  catch { return []; }
});
if (storedErrors.length) throw new Error(`Runtime error boundary captured errors: ${JSON.stringify(storedErrors.slice(0,3))}`);
if (pageErrors.length) throw new Error(`Unhandled page errors: ${pageErrors.join('\n---\n')}`);

console.log(`Production smoke test passed for ${build}.`);
await browser.close();