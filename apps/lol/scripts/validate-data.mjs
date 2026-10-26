import { readFile } from 'node:fs/promises';
import { DATA, LOCALES } from './locales.mjs';
const read = async (file) => JSON.parse(await readFile(new URL(file, DATA), 'utf8'));
const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const meta = await read('meta.json');
assert(/^\d+\.\d+\.\d+$/.test(meta.version), 'Invalid patch');
assert(Number.isFinite(Date.parse(meta.fetchedAt)), 'Invalid update date');
let reference;
for (const { code } of LOCALES) {
  const champions = await read(`${code}/champions.json`);
  const ids = new Set(champions.map((c) => c.id));
  assert(champions.length === meta.count && ids.size === champions.length, `${code}: incomplete or duplicate champions`);
  const slugs = new Set();
  for (const c of champions) {
    assert(c.name && /^[a-z0-9-]+$/.test(c.slug) && !slugs.has(c.slug), `${code}/${c.id}: name/slug`); slugs.add(c.slug);
    assert(c.spells?.length === 4 && c.passive?.name && c.skins?.some((s) => s.num === 0), `${code}/${c.id}: abilities/skins`);
    for (const stat of ['hp','hpperlevel','armor','armorperlevel','spellblock','spellblockperlevel','attackdamage','attackdamageperlevel','attackspeed','attackspeedperlevel','mp','mpperlevel','movespeed','attackrange','hpregen','hpregenperlevel','mpregen','mpregenperlevel']) assert(Number.isFinite(c.stats?.[stat]), `${code}/${c.id}: ${stat}`);
    assert(c.stats.hp > 0 && c.stats.attackspeed > 0, `${code}/${c.id}: invalid base stats`);
  }
  const comparable = champions.map((c) => ({ id: c.id, stats: c.stats })).sort((a,b) => a.id.localeCompare(b.id));
  if (reference) assert(JSON.stringify(reference) === JSON.stringify(comparable), `${code}: stats differ between locales`); else reference = comparable;
  const items = await read(`${code}/items.json`);
  const itemIds = new Set(items.map((i) => i.id));
  assert(items.length > 50 && itemIds.size === items.length, `${code}: items incomplete/duplicate`);
  for (const i of items) {
    assert(i.name && ['starter','boots','basic','epic','legendary','consumable'].includes(i.category), `${code}/${i.id}: item metadata`);
    assert(Number.isFinite(i.gold?.total) && i.gold.total >= 0, `${code}/${i.id}: gold`);
    for (const n of Object.values(i.stats)) assert(Number.isFinite(n), `${code}/${i.id}: nonfinite stat`);
    assert(!/<(?:script|iframe|object|embed)\b|\bon[a-z]+\s*=|javascript:/i.test(i.html), `${code}/${i.id}: unsafe HTML`);
  }
  const runes = await read(`${code}/runes.json`);
  assert(runes.trees?.length === 5 && runes.shards?.length === 3, `${code}: runes incomplete`);
  for (const tree of runes.trees ?? []) assert(tree.slots.length === 4 && tree.slots.every((row) => row.length > 0), `${code}/${tree.id}: rune rows`);
  const spells = await read(`${code}/spells.json`);
  assert(spells.length > 0 && new Set(spells.map((s) => s.id)).size === spells.length, `${code}: spells incomplete/duplicate`);
  const regions = await read(`${code}/regions.json`);
  const pages = await read(`${code}/region-pages.json`);
  const lore = await read(`${code}/lore.json`);
  assert(regions.regions?.length > 0 && Object.keys(lore).length > 0, `${code}: lore/regions empty`);
  for (const region of regions.regions ?? []) assert(region.name && pages[region.slug], `${code}/${region.slug}: missing region page`);
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Data OK: patch ${meta.version}, ${meta.count} champions, ${LOCALES.length} locales`);
