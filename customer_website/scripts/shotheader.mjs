import { chromium } from 'playwright';

const out = process.argv[2] || '/tmp/header.png';
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a1410"/><stop offset="1" stop-color="#0d0b0a"/></linearGradient></defs><rect width="600" height="400" fill="url(#g)"/><circle cx="470" cy="80" r="130" fill="rgba(204,0,0,0.22)"/></svg>`;
const BARS = [
  { id: 1, name: 'Juan Bar', city: 'Imus', rating: 4.0, review_count: 2, follower_count: 3, bar_types: ['Restobar'], image_path: 'j.jpg', video_path: 'j.mp4' },
  { id: 2, name: 'Carmelita', city: 'Bacoor', rating: 0, review_count: 0, follower_count: 0, bar_types: ['Cocktail Bar'], image_path: 'c.jpg' },
  { id: 3, name: 'melolo', city: 'Dasmariñas', rating: 4.8, review_count: 12, follower_count: 54, bar_types: ['Bar'], image_path: 'm.jpg' },
  { id: 4, name: 'The Library KTV', city: 'Imus', rating: 4.5, review_count: 30, follower_count: 120, bar_types: ['KTV Lounge'], image_path: 'l.jpg' },
  { id: 5, name: 'Comedy Club Cafe', city: 'General Trias', rating: 4.2, review_count: 8, follower_count: 40, bar_types: ['Comedy Bar'], image_path: 'co.jpg' },
  { id: 6, name: 'Garden Beer Haus', city: 'Tagaytay', rating: 4.6, review_count: 20, follower_count: 88, bar_types: ['Beer Garden'], image_path: 'g.jpg' },
  { id: 7, name: 'Neon Lounge', city: 'Imus', rating: 4.9, review_count: 50, follower_count: 200, bar_types: ['Live Music'], image_path: 'n.jpg' },
];

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('token', 'preview-fake-token'); localStorage.setItem('theme', 'dark'); } catch (e) {} });
  await page.route('**/*', (route) => {
    const url = route.request().url();
    const isLocal = url.includes('localhost:3000');
    if (url.includes('/auth/me'))       return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: 1, role: 'customer', role_name: 'customer', first_name: 'Preview', last_name: 'User', email: 'p@e.com' } }) });
    if (isLocal && url.includes('/public/bars') && !url.includes('/public/bars/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: BARS }) });
    if (isLocal) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
    if (route.request().resourceType() === 'image') return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: SVG });
    return route.continue();
  });
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => { const links = Array.from(document.querySelectorAll('a, button, [role="button"], div')); const el = links.find((l) => (l.textContent || '').trim() === 'Bars'); if (el) el.click(); });
  await page.waitForSelector('.grab-bar-card', { timeout: 20000 });
  await page.waitForTimeout(1200);
  const hc = await page.evaluate(() => { const h = document.querySelector('.navbar-wrap') || document.querySelector('header'); return h ? (h.className || 'header') : null; });
  console.log('HEADER_CLASS=', hc);
  await page.locator('header').first().screenshot({ path: out });
  console.log('HEADER_SHOT', out);
  await browser.close();
};
run().catch((e) => { console.error('SCRIPT_ERROR', e); process.exit(1); });
