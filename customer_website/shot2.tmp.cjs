const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 700, height: 900 } })).newPage();
  await page.goto('file:///tmp/po-email.html');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/po-email.png', fullPage: true });
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message.slice(0, 150)); process.exit(1); });
EOF
NODE_PATH=/Users/juancho/Downloads/websites/customer_website/node_modules node shot2.tmp.cjs 2>&1 | tail -1; rm -f ./shot2.tmp.cjs
python3 - <<'EOF'
import statistics
from PIL import Image
im = Image.open('/tmp/po-email.png').convert('RGB')
w, h = im.size
px = list(im.getdata())
lum = [0.299*r+0.587*g+0.114*b for r,g,b in px]
red = sum(1 for r,g,b in px if r > 170 and g < 80 and b < 80)
white = sum(1 for v in lum if v > 200)
print(f"size={im.size} mean={statistics.mean(lum):.1f} red_brand={red} white_text={white}")
EOF