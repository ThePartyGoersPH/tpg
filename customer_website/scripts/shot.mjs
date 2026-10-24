import { chromium } from 'playwright';
import fs from 'node:fs';

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a1410"/><stop offset="1" stop-color="#0d0b0a"/></linearGradient></defs><rect width="600" height="400" fill="url(#g)"/><circle cx="470" cy="80" r="130" fill="rgba(204,0,0,0.22)"/></svg>`;

const BARS = [
  { id: 1, name: 'Juan Bar', city: 'Imus', rating: 4.0, review_count: 2, follower_count: 3, bar_types: ['Restobar'], image_path: 'juan.jpg', logo_path: 'juan.png', video_path: 'juan.mp4' },
  { id: 2, name: 'Carmelita', city: 'Bacoor', rating: 0, review_count: 0, follower_count: 0, bar_types: ['Cocktail Bar'], image_path: 'car.jpg' },
  { id: 3, name: 'melolo', city: 'Dasmariñas', rating: 4.8, review_count: 12, follower_count: 54, bar_types: ['Bar'], image_path: 'me.jpg' },
  { id: 4, name: 'The Library KTV', city: 'Imus', rating: 4.5, review_count: 30, follower_count: 120, bar_types: ['KTV Lounge'], image_path: 'lib.jpg' },
  { id: 5, name: 'Comedy Club Cafe', city: 'General Trias', rating: 4.2, review_count: 8, follower_count: 40, bar_types: ['Comedy Bar'], image_path: 'com.jpg' },
  { id: 6, name: 'Garden Beer Haus', city: 'Tagaytay', rating: 4.6, review_count: 20, follower_count: 88, bar_types: ['Beer Garden'], image_path: 'gar.jpg' },
  { id: 7, name: 'Neon Lounge', city: 'Imus', rating: 4.9, review_count: 50, follower_count: 200, bar_types: ['Live Music'], image_path: 'neo.jpg' },
];

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('console', (m) => console.log('PAGE:', m.text()));
  page.on('pageerror', (e) => console.log('PAGEERR:', e.message));

  await page.addInitScript(() => {
    try { localStorage.setItem('token', 'preview-fake-token'); localStorage.setItem('theme', 'dark'); } catch (e) {}
  });

  await page.route('**/*', (route) => {
    const url = route.request().url();
    const isLocal = url.includes('localhost:3000');
    if (url.includes('/auth/me')) {
      console.log('MOCK /auth/me');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: 1, role: 'customer', role_name: 'customer', first_name: 'Preview', last_name: 'User', email: 'preview@example.com' } }) });
    }
    if (isLocal && url.includes('/public/bars') && !url.includes('/public/bars/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: BARS }) });
    }
    if (isLocal) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
    }
    if (route.request().resourceType() === 'image') {
      return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: SVG });
    }
    return route.continue();
  });

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const pre = await page.evaluate(() => ({
    theme: document.documentElement.getAttribute('data-theme'),
    sidebar: !!document.querySelector('.app-sidebar'),
    hasLogin: document.body.innerText.includes('Log in') || document.body.innerText.includes('Sign in'),
    cards: document.querySelectorAll('.grab-bar-card').length,
  }));
  console.log('PRE-NAV', JSON.stringify(pre));

  const clicked = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a, button, [role="button"], div'));
    const el = links.find((l) => (l.textContent || '').trim() === 'Bars');
    if (el) { el.click(); return true; }
    return false;
  });
  console.log('clicked Bars link:', clicked);

  try {
    await page.waitForSelector('.grab-bar-card', { timeout: 15000 });
  } catch (e) {
    console.log('No cards after nav:', e.message);
  }
  await page.waitForTimeout(1500);

  const post = await page.evaluate(() => ({
    theme: document.documentElement.getAttribute('data-theme'),
    cards: document.querySelectorAll('.grab-bar-card').length,
    topRated: document.querySelectorAll('.bars-featured-ribbon').length,
  }));
  console.log('POST-NAV', JSON.stringify(post));

  const out = '/Users/juancho/Downloads/websites/customer_website/preview-bars-dark.png';
  await page.screenshot({ path: out, fullPage: true });
  console.log('SCREENSHOT_SAVED', out, fs.existsSync(out) ? `(${fs.statSync(out).size} bytes)` : '(MISSING)');

  await browser.close();
};

run().catch((e) => { console.error('SCRIPT_ERROR', e); process.exit(1); });
