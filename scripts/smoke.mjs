import assert from 'node:assert/strict';
const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3015';
const canonical = process.env.SMOKE_SITE_URL ?? 'https://riftden.com';
const checks = [
  ['/', 280 * 1024], ['/en', 280 * 1024], ['/champions', 150 * 1024],
  ['/champions/garen', 220 * 1024], ['/items', 260 * 1024], ['/builds', 100 * 1024],
  ['/methodology', 70 * 1024], ['/skins', 160 * 1024], ['/en/skins', 160 * 1024],
  ['/skins/star-guardian-ahri', 160 * 1024], ['/skins/lines/star-guardian-season-4', 200 * 1024],
  ['/skins/universes/star-guardian', 200 * 1024], ['/skins/rarity/legendary', 260 * 1024],
];
for (const [path, budget] of checks) {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200, `${path}: status`);
  const html = await response.text();
  assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1, `${path}: H1`);
  assert(html.includes(`rel="canonical" href="${canonical}${path === '/' ? '' : path}"`), `${path}: canonical`);
  assert(Buffer.byteLength(html) <= budget, `${path}: ${Buffer.byteLength(html)} > ${budget} byte budget`);
  assert(html.includes('hrefLang="ru"') || html.includes('hrefLang="en"') || html.includes('hreflang="ru"'), `${path}: hreflang`);
  console.log(`${path}: 200, ${Buffer.byteLength(html)} bytes, SEO OK`);
}
assert.equal((await fetch(base + '/missing-release-check')).status, 404);
const redirect = await fetch(base + '/ru/champions?class=Tank', { redirect: 'manual' });
assert.equal(redirect.status, 308); assert(new URL(redirect.headers.get('location'), base).pathname === '/champions');
assert(new URL(redirect.headers.get('location'), base).search === '?class=Tank');
const robots = await (await fetch(base + '/robots.txt')).text(); assert(robots.includes(`${canonical}/sitemap.xml`));
const sitemap = await (await fetch(base + '/sitemap.xml')).text();
assert(sitemap.includes(`${canonical}/champions/garen`)); assert(sitemap.includes(`${canonical}/skins/star-guardian-ahri`)); assert(!sitemap.includes('/design')); assert(!sitemap.includes('localhost'));
for (const path of ['/search-index.json', '/en/search-index.json', '/skins-index.json', '/en/skins-index.json', '/build-data.json', '/en/build-data.json', '/health.json']) {
  const response = await fetch(base + path); assert.equal(response.status, 200, path); await response.json();
}
const accountConfig = await fetch(base + '/api/account-config');
assert.equal(accountConfig.status, 200, 'account config');
const accounts = await accountConfig.json();
if (process.env.SMOKE_EXPECT_ACCOUNTS) assert.equal(accounts.enabled, true, 'accounts enabled');
const favoritesAnon = await fetch(base + '/api/favorites');
assert([401, 503].includes(favoritesAnon.status), `favorites without session: ${favoritesAnon.status}`);
const metric = await fetch(base + '/metrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'page_view', value: 1, page: 'home' }) });
assert.equal(metric.status, 204, 'metrics accepted');
const invalidMetric = await fetch(base + '/metrics', { method: 'POST', body: JSON.stringify({ name: 'arbitrary', value: -1, page: 'private-query' }) });
assert.equal(invalidMetric.status, 400, 'metrics validation');
const largeMetric = await fetch(base + '/metrics', { method: 'POST', body: 'x'.repeat(2048) });
assert.equal(largeMetric.status, 413, 'metrics payload limit');
console.log('Release smoke checks passed');
