// docker logs riftden-web 2>&1 | node scripts/metrics-report.mjs
import readline from 'node:readline';
const values = new Map(); const pages = new Map();
for await (const line of readline.createInterface({ input: process.stdin })) {
  try {
    const m = JSON.parse(line); if (m.type !== 'riftden_metric') continue;
    if (m.name === 'page_view') pages.set(m.page, (pages.get(m.page) ?? 0) + 1);
    else { const list = values.get(m.name) ?? []; list.push(m.value); values.set(m.name, list); }
  } catch { /* Ignore ordinary application log lines. */ }
}
for (const [name, list] of values) {
  list.sort((a,b) => a-b);
  console.log(`${name}: n=${list.length}, p75=${list[Math.max(0, Math.ceil(list.length * 0.75) - 1)]}`);
}
console.log('Page views by section:', Object.fromEntries(pages));
