import { describe, expect, it, vi, afterEach } from 'vitest';
import { growthFactor, statsAtLevel, type BaseStats } from '@/lib/stats';
import { afterArmor, simulateDuel } from '@/lib/duel';
import { buildFromQuery, buildToQuery, emptyBuild } from '@/lib/build';
import { localePath, stripLocale } from '@rift/engine/i18n/locale';
import { createJsonLoader } from '@rift/engine/lib/json-loader';
import champions from '@/data/ru/champions.json';
import items from '@/data/ru/items.json';
import runes from '@/data/ru/runes.json';
import spells from '@/data/ru/spells.json';
import type { Item } from '@/lib/items';
import type { RunesData } from '@/lib/runes';
const garen = champions.find((c) => c.id === 'Garen')!;
const catalog = { champions, items: new Map((items as Item[]).map((i) => [i.id, i])), runes: runes as RunesData, spells };
afterEach(() => vi.unstubAllGlobals());
describe('game calculations', () => {
  it('preserves base stats at level one and full growth at 18', () => {
    expect(growthFactor(1)).toBe(0); expect(growthFactor(18)).toBe(17);
    expect(statsAtLevel(garen.stats, 1).hp).toBe(garen.stats.hp);
    expect(statsAtLevel(garen.stats, 18).hp).toBe(garen.stats.hp + 17 * garen.stats.hpperlevel);
  });
  it('uses the separate attack speed ratio', () => {
    const stats = { ...garen.stats, attackspeed: 0.6, attackspeedratio: 0.7, attackspeedperlevel: 2 };
    expect(statsAtLevel(stats, 18).attackspeed).toBeCloseTo(0.6 + 0.7 * 0.02 * 17);
  });
  it('reduces damage by armor and handles negative armor', () => {
    expect(afterArmor(100, 0)).toBe(100); expect(afterArmor(100, 100)).toBe(50);
    expect(afterArmor(100, -100)).toBe(150);
  });
  it('does not favor either side in an identical duel', () => {
    const result = simulateDuel(garen.stats as BaseStats, garen.stats as BaseStats, 6, false);
    expect(result.winner).toBeNull();
    expect(result.sides[0].dealt).toBeCloseTo(result.sides[1].dealt);
  });
});
describe('shared build URLs', () => {
  it('round trips a valid build, including non-Latin names', () => {
    const build = emptyBuild(); build.champion = 'garen'; build.lane = 'TOP';
    build.items[0] = items[0].id; build.spells[0] = spells[0].id; build.name = 'Гарен & тест';
    expect(buildFromQuery(new URLSearchParams(buildToQuery(build, spells)), catalog)).toEqual(build);
  });
  it('rejects unknown entities and duplicates of summoner spells', () => {
    const build = buildFromQuery(new URLSearchParams(`c=unknown&it=unknown&sp=${spells[0].key}.${spells[0].key}`), catalog);
    expect(build.champion).toBeNull(); expect(build.items).toEqual(Array(6).fill(null));
    expect(build.spells).toEqual([spells[0].id, null]);
  });
});
it('preserves query strings and fragments across languages', () => {
  expect(localePath('en', '/items?item=3031#recipe')).toBe('/en/items?item=3031#recipe');
  expect(stripLocale('/en/items?item=3031#recipe')).toEqual({ locale: 'en', path: '/items?item=3031#recipe' });
  expect(stripLocale('/ru/champions').path).toBe('/champions');
});
it('deduplicates concurrent loads and evicts failures for retry', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response('', { status: 503 }))
    .mockResolvedValueOnce(Response.json({ ok: true }));
  vi.stubGlobal('fetch', fetchMock);
  const load = createJsonLoader<{ ok: boolean }>((v): v is { ok: boolean } => !!v && typeof v === 'object' && 'ok' in v);
  const first = load('/index'); expect(load('/index')).toBe(first);
  await expect(first).rejects.toThrow('503');
  await expect(load('/index')).resolves.toEqual({ ok: true });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it('evicts malformed JSON payloads', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ wrong: true })));
  const load = createJsonLoader<string>((v): v is string => typeof v === 'string');
  await expect(load('/index')).rejects.toThrow('Invalid response');
});
