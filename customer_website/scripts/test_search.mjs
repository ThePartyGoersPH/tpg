import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGE_ERR:', e.message));

const BARS = [
  { id: 'b1', name: "Juan's Bar", city: 'Imus', address: 'Aguinaldo Hwy', bar_types: ['Restobar'], rating: 4.8, reviews_count: 120, image_url: '' },
  { id: 'b2', name: 'Sky Rooftop Lounge', city: 'Tagaytay', address: 'Highway', bar_types: ['Rooftop', 'Cocktail Bar'], rating: 4.7, reviews_count: 90, image_url: '' },
  { id: 'b3', name: 'Neon KTV', city: 'Dasmariñas', address: 'Palico', bar_types: ['KTV Lounge'], rating: 4.5, reviews_count: 80, image_url: '' },
  { id: 'b4', name: 'The Comedy Club', city: 'Bacoor', address: 'Molino', bar_types: ['Comedy Bar'], rating: 4.4, reviews_count: 60, image_url: '' },
  { id: 'b5', name: 'Velvet Cocktail Room', city: 'Imus', address: 'Cavite', bar_types: ['Cocktail Bar'], rating: 4.6, reviews_count: 70, image_url: '' },
  { id: 'b6', name: 'Brews Beer Garden', city: 'General Trias', address: 'Governor', bar_types: ['Beer Garden'], rating: 4.3, reviews_count: 50, image_url: '' },
];

await page.route('**/*', (route) => {
  const url = route.request().url();
  if (url.includes('/auth/me')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: 'u1', first_name: 'Alex', last_name: 'Reyes', email: 'a@a.com', role: 'customer', user_type: 'customer' } }) });
  if (url.includes('/public/bars')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: BARS }) });
  if (url.startsWith(BASE) || url.includes('localhost:5173')) return route.continue();
  if (url.includes('localhost:3000')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(url)) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>' });
  return route.fulfill({ status: 200, contentType: 'text/plain', body: '' });
});

await page.addInitScript(() => {
  localStorage.setItem('token', 'mock');
  localStorage.setItem('user', JSON.stringify({ id: 'u1', first_name: 'Alex', last_name: 'Reyes', email: 'a@a.com', role: 'customer', user_type: 'customer' }));
  localStorage.setItem('theme', 'dark');
});

await page.goto(BASE, { waitUntil: 'domcontentloaded' });

async function runSearch(term) {
  await page.goto(BASE + '/bars?search=' + encodeURIComponent(term), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.grab-search-input', { timeout: 10000 });
  const url = page.url();
  const inputVal = await page.getByPlaceholder('Search by bar name, city, or address...').inputValue();
  const count = await page.locator('.grab-bar-card').count();
  const emptyText = await page.locator('h3').filter({ hasText: 'No bars found' }).first().textContent().catch(() => null);
  console.log(JSON.stringify({ term, url, inputVal, count, emptyText }));
}

// 1) Homepage hero actually navigates with the term (req #1)
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input[placeholder^="Search bars, restobars, events"]', { timeout: 10000 });
await page.getByPlaceholder('Search bars, restobars, events in Cavite...').fill('rooftop');
await page.getByPlaceholder('Search bars, restobars, events in Cavite...').press('Enter');
await page.waitForURL('**/bars**', { timeout: 10000 });
await page.waitForSelector('.grab-search-input', { timeout: 10000 });
console.log('HERO_NAV', JSON.stringify({ url: page.url(), inputVal: await page.getByPlaceholder('Search by bar name, city, or address...').inputValue() }));

// 2) Param-reading path for name / location / category / zero (req #2,#3,#4)
await runSearch('juan');
await runSearch('dasma');
await runSearch('cocktail');
await runSearch('zzzzz');

// category combo after a search: go to bars?search=cocktail then click "KTV Lounge"
await page.goto(BASE + '/bars?search=cocktail', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.grab-bar-card', { timeout: 10000 });
const beforeCat = await page.locator('.grab-bar-card').count();
await page.getByRole('button', { name: 'KTV Lounge', exact: true }).click();
await page.waitForTimeout(300);
const afterCat = await page.locator('.grab-bar-card').count();
console.log(JSON.stringify({ combo: { search: 'cocktail', clickCategory: 'KTV Lounge', beforeCat, afterCat } }));

await browser.close();
