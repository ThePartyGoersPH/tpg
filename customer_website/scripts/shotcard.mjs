import { chromium } from 'playwright';
import fs from 'fs';

const theme = process.argv[2] || 'dark';
const out = process.argv[3] || `preview-card-${theme}.png`;
const BASE = 'http://localhost:5173';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

page.on('console', (m) => { if (m.type() === 'error' && m.text().includes('SCRIPT_ERROR')) console.log(m.text()); });

await page.addInitScript((t) => {
  window.localStorage.setItem('token', 'mock-token');
  window.localStorage.setItem('user', JSON.stringify({ id: 'u1', first_name: 'Alex', last_name: 'Reyes', email: 'alex@demo.com', role: 'customer', user_type: 'customer' }));
  window.localStorage.setItem('theme', t);
}, theme);

await page.route('**/*', (route) => {
  const url = route.request().url();
  if (url.includes('/auth/me')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: 'u1', first_name: 'Alex', last_name: 'Reyes', email: 'alex@demo.com', role: 'customer', user_type: 'customer' } }) });
  if (url.includes('/public/bars')) {
    const bars = [
      { id: 'b1', name: 'Velvet Room', bar_type: 'Cocktail Bar', city: 'Imus', address: 'Agusaldo St', rating: 4.9, reviews_count: 312, image_url: '', featured: false },
      { id: 'b2', name: 'Neon Garden', bar_type: 'Beer Garden', city: 'Bacoor', address: 'Molino Rd', rating: 4.6, reviews_count: 188, image_url: '', featured: false },
      { id: 'b3', name: 'The Laugh Lounge', bar_type: 'Comedy Bar', city: 'Dasmariñas', address: 'Palico', rating: 4.7, reviews_count: 95, image_url: '', featured: false },
      { id: 'b4', name: 'Echo KTV', bar_type: 'KTV Lounge', city: 'Imus', address: 'F. Tirona', rating: 4.5, reviews_count: 140, image_url: '', featured: false },
      { id: 'b5', name: 'Rooftop Live', bar_type: 'Live Music', city: 'Tagaytay', address: 'Highway', rating: 4.8, reviews_count: 220, image_url: '', featured: false },
      { id: 'b6', name: 'Savor Restobar', bar_type: 'Restobar', city: 'General Trias', address: 'Governor', rating: 4.4, reviews_count: 76, image_url: '', featured: false },
    ];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: bars }) });
  }
  if (url.startsWith(BASE) || url.includes('localhost:5173')) return route.continue();
  if (url.includes('localhost:3000')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(url)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a1414"/><stop offset="1" stop-color="#0e0b0a"/></linearGradient></defs><rect width="600" height="400" fill="url(#g)"/></svg>`;
    return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg });
  }
  return route.fulfill({ status: 200, contentType: 'text/plain', body: '' });
});

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.sidebar-toggle-btn', { timeout: 15000 });
await page.click('.sidebar-toggle-btn');
await page.getByRole('button', { name: 'Bars', exact: true }).click();
await page.waitForSelector('.bars-hero', { timeout: 15000 });
await page.waitForTimeout(600);

const styles = await page.evaluate(() => {
  const cs = (sel) => { const el = document.querySelector(sel); if (!el) return 'NOT_FOUND'; const s = getComputedStyle(el); return { bg: s.backgroundColor, color: s.color, border: s.borderColor, radius: s.borderRadius }; };
  const els = [...document.querySelectorAll('.bars-pill')].filter((e) => !e.classList.contains('active'));
  const showingEl = [...document.querySelectorAll('.bars-hero *')].find((e) => e.textContent && e.textContent.includes('Showing'));
  return {
    card: cs('.bars-hero'),
    searchBox: cs('.grab-search-box'),
    searchInput: cs('.grab-search-input'),
    pillUnselectedBg: els.length ? getComputedStyle(els[0]).backgroundColor : 'none',
    eyebrowColor: (() => { const s = document.querySelector('.bars-hero span'); return s ? getComputedStyle(s).color : 'none'; })(),
    showingColor: showingEl ? getComputedStyle(showingEl).color : 'none',
  };
});
console.log('CARD_STYLES ' + JSON.stringify(styles));

const card = await page.$('.bars-hero');
await card.screenshot({ path: out });
console.log('CARD_SHOT ' + out);

await browser.close();
