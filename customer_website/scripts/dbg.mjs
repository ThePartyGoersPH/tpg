import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport:{width:1440,height:900} })).newPage();
p.on('console', m => { if(m.type()==='error') console.log('CONSOLE_ERR:', m.text()); });
p.on('requestfailed', r => console.log('REQ_FAIL', r.url(), r.failure()?.errorText));
await p.route('**/*', (route) => {
  const url = route.request().url();
  if (url.includes('/auth/me')) return route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ data: { data: { id:'u1', first_name:'Alex', last_name:'Reyes', email:'a@a.com', role:'customer', user_type:'customer' } } }) });
  if (url.includes('localhost:3000')) return route.fulfill({ status:200, contentType:'application/json', body:'{}' });
  return route.continue();
});
await p.addInitScript(() => {
  localStorage.setItem('token','mock');
  localStorage.setItem('user', JSON.stringify({id:'u1',first_name:'Alex',last_name:'Reyes',email:'a@a.com',role:'customer',user_type:'customer'}));
  localStorage.setItem('theme','dark');
});
await p.goto('http://localhost:5173/', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(3000);
const info = await p.evaluate(() => ({
  hasToggle: !!document.querySelector('.sidebar-toggle-btn'),
  toggleVisible: (()=>{const e=document.querySelector('.sidebar-toggle-btn'); if(!e) return false; const r=e.getBoundingClientRect(); return r.width>0&&r.height>0;})(),
  barsHeroExists: !!document.querySelector('.bars-hero'),
  bodyText: document.body.innerText.slice(0,160),
}));
console.log('INFO', JSON.stringify(info));
await b.close();
