// Maakt PNG-iconen uit public/icons/icon.svg met de meegeleverde Chromium (Playwright).
// Gebruik: npm run icons
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');

const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
const out = (f) => new URL('../public/icons/' + f, import.meta.url).pathname;
const targets = [
  { file: 'icon-192.png', size: 192, pad: 0 },
  { file: 'icon-512.png', size: 512, pad: 0 },
  { file: 'apple-touch-icon.png', size: 180, pad: 0 },
  // Maskable: inhoud binnen de veilige zone (80%), achtergrond tot de rand.
  { file: 'icon-maskable-512.png', size: 512, pad: 0.1 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  const inner = t.size * (1 - 2 * t.pad);
  await page.setContent(
    `<body style="margin:0;background:#0b0b12;display:flex;align-items:center;justify-content:center;width:${t.size}px;height:${t.size}px">` +
      `<div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body>`,
  );
  await page.screenshot({ path: out(t.file), omitBackground: false });
  console.log('✓', t.file);
}
await browser.close();
