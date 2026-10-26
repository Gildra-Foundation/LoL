import { chromium } from '@playwright/test';
import fs from 'node:fs';
const base = process.env.CAPTURE_BASE_URL ?? 'https://riftden.com';
fs.mkdirSync('artifacts/release', { recursive: true });
const browser = await chromium.launch();
const evidence = [];
try {
  for (const [device, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    for (const [step, name, route] of [[1,'home','/'],[2,'champion','/champions/garen'],[3,'builds','/builds?c=garen']]) {
      const errors = []; page.removeAllListeners('pageerror'); page.on('pageerror', e => errors.push(e.message));
      const response = await page.goto(base + route);
      await page.getByRole('heading', { level: 1 }).waitFor();
      if (name === 'builds') await page.getByRole('button', { name: 'Сменить чемпиона', exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => scrollTo(0, 0));
      const imageErrors = await page.locator('img').evaluateAll(async images => {
        const visible = images.filter(i => { const r = i.getBoundingClientRect(); return r.width && r.height && r.top < innerHeight && r.bottom > 0; });
        return (await Promise.all(visible.map(async i => { try { await i.decode(); return null; } catch { return i.src; } }))).filter(Boolean);
      });
      const file = `artifacts/release/${step}-${name}-${device}.png`;
      await page.screenshot({ path: file });
      evidence.push({ step, name, device, route, file, status: response.status(), errors, imageErrors });
      console.log(JSON.stringify(evidence.at(-1)));
    }
    await context.close();
  }
} finally { await browser.close(); }
fs.writeFileSync('artifacts/release/evidence.json', JSON.stringify(evidence, null, 2));
if (evidence.some(e => e.status !== 200 || e.errors.length || e.imageErrors.length)) process.exitCode = 1;
