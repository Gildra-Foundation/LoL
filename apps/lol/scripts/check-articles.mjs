// Проверяет статьи в src/content/articles/<язык>: frontmatter, синтаксис MDX,
// существование чемпионов, образов и ключей характеристик.
// Запуск: npm run check-articles
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { compile } from '@mdx-js/mdx';
import remarkGfm from 'remark-gfm';
import YAML from 'yaml';

const ROOT = new URL('../src/content/articles/', import.meta.url);
// чемпионы и образы одинаковы на всех языках
const champions = JSON.parse(await readFile(new URL('../src/data/ru/champions.json', import.meta.url), 'utf8'));
const byId = new Map(champions.map((c) => [c.id, c]));

// категории — как в src/lib/articles.ts
const CATEGORIES = {
  ru: ['Механики', 'Макро', 'Новичкам', 'Аналитика'],
  en: ['Mechanics', 'Macro', 'Beginners', 'Analytics'],
};
const COMPONENTS = ['Callout', 'Champ', 'ChampionGrid', 'Formula', 'StatLeaders'];
const STATS = ['hp', 'hpregen', 'mp', 'armor', 'spellblock', 'attackdamage', 'attackspeed', 'movespeed', 'attackrange', 'ehp_physical', 'ehp_magic', 'aa_dps'];
const TAGS = ['Fighter', 'Tank', 'Mage', 'Assassin', 'Support', 'Marksman'];

let failed = 0;
const files = [];
for (const lang of Object.keys(CATEGORIES)) {
  const dir = new URL(`${lang}/`, ROOT);
  if (!existsSync(dir)) continue;
  for (const name of await readdir(dir)) if (/\.mdx?$/.test(name)) files.push({ lang, name, url: new URL(name, dir) });
}

for (const { lang, name, url } of files) {
  const file = `${lang}/${name}`;
  const errors = [];
  const src = await readFile(url, 'utf8');
  const match = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    console.log(`✗ ${file}: нет frontmatter`);
    failed++;
    continue;
  }
  const [, front, body] = match;

  let fm = {};
  try {
    fm = YAML.parse(front) ?? {};
  } catch (err) {
    errors.push(`frontmatter не парсится: ${err.message}`);
  }
  for (const key of ['title', 'description', 'category', 'date', 'cover']) {
    if (fm[key] === undefined) errors.push(`нет поля ${key}`);
  }
  if (fm.category && !CATEGORIES[lang].includes(fm.category)) errors.push(`неизвестная категория «${fm.category}»`);
  if (fm.date && Number.isNaN(new Date(fm.date).getTime())) errors.push(`неверная дата ${fm.date}`);
  if (fm.cover) {
    const champ = byId.get(fm.cover.champion);
    if (!champ) errors.push(`cover.champion «${fm.cover.champion}» не найден`);
    else if (!champ.skins.some((s) => s.num === (fm.cover.skin ?? 0))) errors.push(`у ${champ.id} нет образа №${fm.cover.skin}`);
  }
  for (const id of fm.champions ?? []) if (!byId.has(id)) errors.push(`champions: «${id}» не найден`);

  for (const [, name] of body.matchAll(/<([A-Z][A-Za-z]*)/g)) {
    if (!COMPONENTS.includes(name)) errors.push(`неизвестный компонент <${name}>`);
  }
  for (const [, id] of body.matchAll(/<Champ\s+id="([^"]+)"/g)) if (!byId.has(id)) errors.push(`<Champ id="${id}"> не найден`);
  for (const [, list] of body.matchAll(/ids=\{\[([^\]]*)\]\}/g)) {
    for (const [, id] of list.matchAll(/"([^"]+)"/g)) if (!byId.has(id)) errors.push(`ids: «${id}» не найден`);
  }
  for (const [, stat] of body.matchAll(/<StatLeaders[^>]*\bstat="([^"]+)"/g)) if (!STATS.includes(stat)) errors.push(`StatLeaders: неизвестный stat «${stat}»`);
  for (const [, tag] of body.matchAll(/<StatLeaders[^>]*\btag="([^"]+)"/g)) if (!TAGS.includes(tag)) errors.push(`StatLeaders: неизвестный tag «${tag}»`);
  if (/^#\s/m.test(body)) errors.push('в тексте есть заголовок H1 — используйте ## и ###');
  if (/<!--/.test(body)) errors.push('HTML-комментарии не поддерживаются в MDX');

  if (name.endsWith('.mdx')) {
    try {
      await compile(body, { remarkPlugins: [remarkGfm] });
    } catch (err) {
      errors.push(`ошибка MDX: ${err.message}`);
    }
  }

  const words = body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  if (errors.length) {
    failed++;
    console.log(`✗ ${file}`);
    for (const e of errors) console.log(`    – ${e}`);
  } else {
    console.log(`✓ ${file} (${words} слов)`);
  }
}

console.log(failed ? `\nОшибок в файлах: ${failed}` : files.length ? `\nВсе статьи в порядке (${files.length}).` : 'Статей пока нет.');
process.exitCode = failed ? 1 : 0;
