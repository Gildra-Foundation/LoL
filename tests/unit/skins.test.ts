import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseLuaTable } from '../../apps/lol/scripts/fetch-skins.mjs';

it('parses the wiki SkinData Lua table', () => {
  const lua = `-- <pre>
return {
  ["Ahri"] = {
    ["id"] = 103,
    ["skins"] = {
      ["Star Guardian"] = { ["id"] = 14, ["cost"] = 1820, ["voiceactor"] = {"Laura Post"}, ["newvoice"] = true,
        ["lore"] = "She said \\"hi\\" -- not a comment" },
      ["Broken"] = { ["id"] = nil, ['cost'] = "Special" },
    },
  },
}
-- </pre>`;
  const data = parseLuaTable(lua) as Record<string, { id: number; skins: Record<string, Record<string, unknown>> }>;
  expect(data.Ahri.id).toBe(103);
  expect(data.Ahri.skins['Star Guardian']).toMatchObject({ id: 14, cost: 1820, voiceactor: ['Laura Post'], newvoice: true, lore: 'She said "hi" -- not a comment' });
  expect(data.Ahri.skins.Broken).toEqual({ id: null, cost: 'Special' });
});

it('skin data links every skin to its line, universe and champion on both languages', () => {
  for (const lang of ['ru', 'en']) {
    const skins = JSON.parse(readFileSync(`apps/lol/src/data/${lang}/skins.json`, 'utf8')) as { id: number; slug: string; lines: number[]; base: boolean }[];
    const sets = JSON.parse(readFileSync(`apps/lol/src/data/${lang}/skin-sets.json`, 'utf8')) as { lines: { id: number; count: number }[] };
    const counts = new Map<number, number>();
    for (const s of skins) for (const id of s.lines) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const l of sets.lines) expect(counts.get(l.id)).toBe(l.count);
    expect(skins.find((s) => s.id === 103014)?.slug).toBe('star-guardian-ahri');
    expect(skins.find((s) => s.id === 103000)).toMatchObject({ slug: 'ahri-original', base: true });
  }
});
