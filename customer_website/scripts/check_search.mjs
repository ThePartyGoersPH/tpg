import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', e => console.log('PAGE_ERR:', e.message));
await p.route('**/*', (route) => {
  const url = route.request().url();
  if (url.includes('/auth/me')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: 'u1', first_name: 'Alex', last_name: 'Reyes', email: 'a@a.com', role: 'customer', user_type: 'customer' } }) });
  if (url.includes('/public/bars')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
  if (url.startsWith(BASE) || url.includes('localhost:5173')) return route.continue();
  if (url.includes('localhost:3000')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(url)) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>' });
  return route.fulfill({ status: 200, contentType: 'text/plain', body: '' });
});
await p.addInitScript(() => {
  localStorage.setItem('token', 'mock'); localStorage.setItem('user', JSON.stringify({ id: 'u1', first_name: 'Alex', last_name: 'Reyes', email: 'a@a.com', role: 'customer', user_type: 'customer' }));
  localStorage.setItem('theme', 'dark');
});
await p.goto(BASE, { waitUntil: 'domcontentloaded' });
await p.waitForSelector('input[placeholder^="Search bars, restobars, events"]', { timeout: 10000 });
await p.getByPlaceholder('Search bars, restobars, events in Cavite...').fill('daa');
await p.getByPlaceholder('Search bars, restobars, events in Cavite...').press('Enter');
await p.waitForURL('**/bars**', { timeout: 10000 });
await p.waitForTimeout(800);
const info = await p.evaluate(() => ({
  url: location.href,
  hasBarsHero: !!document.querySelector('.bars-hero'),
  hasBarsSearchInput: !!document.querySelector('.grab-search-input'),
  hasFeedFilter: !!document.querySelector('.feed-filter-btn'),
  hasQuickStats: document.body.innerText.includes('QUICK STATS'),
  hasFindBars: document.body.innerText.includes('Find Bars'),
}));
console.log('SEARCH_TRACE', JSON.stringify(info, null, 0));
await b.close();
