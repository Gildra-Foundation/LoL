'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { startTransition, useMemo, useState, ViewTransition } from 'react';
import Link from '@rift/engine/i18n/Link';
import { useLocale, usePagePath } from '@rift/engine/i18n/LocaleProvider';
import { LOCALE_TAG, defineMessages } from '@rift/engine/i18n/locale';
import { Icon } from '@/components/Icon';
import { ResourceBar } from '@rift/engine/ui/ResourceBar';
import { championHref, img } from '@/lib/assets';
import { plural } from '@rift/engine/lib/format';
import { ATTACK_TYPES, CLASSES, CLASS_ORDER, DAMAGE_TYPES, DIFFICULTY, POSITIONS, POSITION_ORDER, type ClassTag, type Position } from '@/lib/labels';
import { fmt } from '@/lib/stats';
import styles from './Catalog.module.css';

const MESSAGES = defineMessages({
  ru: {
    sorts: {
      name: 'По алфавиту',
      new: 'Сначала новые',
      hp: 'Больше здоровья',
      ad: 'Больше силы атаки',
      armor: 'Больше брони',
      range: 'Дальше атакуют',
      ms: 'Быстрее бегают',
      easy: 'Сначала простые',
    } as Record<Sort, string>,
    filters: 'Фильтры',
    search: 'Поиск по имени',
    placeholder: 'Имя чемпиона',
    cls: 'Класс',
    position: 'Позиция',
    attackDamage: 'Атака и урон',
    damage: (type: string) => `${type} урон`,
    difficulty: 'Сложность',
    reset: 'Сбросить фильтры',
    champions: ['чемпион', 'чемпиона', 'чемпионов'] as [string, string, string],
    order: 'Порядок',
    hpLabel: (hp: string) => `Здоровье на 18 уровне: ${hp}`,
    hpShort: 'Здоровье на 18 ур.',
    empty: 'Под эти фильтры не подходит ни один чемпион.',
    resetAll: 'Сбросить всё',
  },
  en: {
    sorts: {
      name: 'A to Z',
      new: 'Newest first',
      hp: 'Most health',
      ad: 'Most attack damage',
      armor: 'Most armor',
      range: 'Longest range',
      ms: 'Fastest move speed',
      easy: 'Easiest first',
    } as Record<Sort, string>,
    filters: 'Filters',
    search: 'Search by name',
    placeholder: 'Champion name',
    cls: 'Class',
    position: 'Position',
    attackDamage: 'Attack and damage',
    damage: (type: string) => `${type} damage`,
    difficulty: 'Difficulty',
    reset: 'Reset filters',
    champions: ['champion', 'champions', 'champions'] as [string, string, string],
    order: 'Sort by',
    hpLabel: (hp: string) => `Health at level 18: ${hp}`,
    hpShort: 'Health at lvl 18',
    empty: 'No champion matches these filters.',
    resetAll: 'Reset all',
  },
});

export interface CatalogChampion {
  id: string;
  slug: string;
  name: string;
  title: string;
  tags: ClassTag[];
  positions: Position[];
  attackType: string;
  damageType: string;
  difficulty: number;
  release: number;
  hp18: number;
  ad18: number;
  armor18: number;
  range: number;
  ms: number;
}

const SORTS = ['name', 'new', 'hp', 'ad', 'armor', 'range', 'ms', 'easy'] as const;

type Sort = (typeof SORTS)[number];

const compare: Record<Sort, (a: CatalogChampion, b: CatalogChampion) => number> = {
  name: () => 0,
  new: (a, b) => a.release - b.release,
  hp: (a, b) => b.hp18 - a.hp18,
  ad: (a, b) => b.ad18 - a.ad18,
  armor: (a, b) => b.armor18 - a.armor18,
  range: (a, b) => b.range - a.range,
  ms: (a, b) => b.ms - a.ms,
  easy: (a, b) => a.difficulty - b.difficulty,
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]/g, '');

const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);

/** Каталог чемпионов: фильтры сохраняются в адресе, карточки переставляются с анимацией. */
export function Catalog({ champions, maxHp }: { champions: CatalogChampion[]; maxHp: number }) {
  const locale = useLocale();
  const t = MESSAGES[locale];
  const router = useRouter();
  const pathname = usePagePath();
  const params = useSearchParams();

  const cls = (CLASS_ORDER.find((t) => t.toLowerCase() === params.get('class')) ?? null) as ClassTag | null;
  const positions = list(params.get('position')).map((p) => p.toUpperCase()) as Position[];
  const attack = list(params.get('attack'));
  const damage = list(params.get('damage'));
  const difficulty = list(params.get('difficulty')).map(Number);
  const sort = (SORTS.some((s) => s === params.get('sort')) ? params.get('sort') : 'name') as Sort;
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // смена фильтра — переход: карточки уходят, приходят и переставляются плавно
  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const toggle = (key: string, values: string[], value: string) => {
    const set = new Set(values);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    update({ [key]: [...set].join(',').toLowerCase() || null });
  };

  const visible = useMemo(() => {
    const q = norm(query);
    return champions
      .filter(
        (c) =>
          (!q || norm(c.name).includes(q) || norm(c.id).includes(q)) &&
          (!cls || c.tags.includes(cls)) &&
          (!positions.length || c.positions.some((p) => positions.includes(p))) &&
          (!attack.length || attack.includes(c.attackType)) &&
          (!damage.length || damage.includes(c.damageType.toLowerCase())) &&
          (!difficulty.length || difficulty.includes(c.difficulty)),
      )
      .toSorted((a, b) => compare[sort](a, b) || a.name.localeCompare(b.name, LOCALE_TAG[locale]));
  }, [champions, query, cls, positions, attack, damage, difficulty, sort, locale]);

  const activeCount = (cls ? 1 : 0) + positions.length + attack.length + damage.length + difficulty.length;

  return (
    <div className={styles.layout}>
      <aside className={styles.filters} data-open={filtersOpen}>
        <button type="button" className={styles.filtersToggle} aria-expanded={filtersOpen} onClick={() => setFiltersOpen((o) => !o)}>
          <Icon name="sliders" size={18} /> {t.filters}{activeCount > 0 && <span className={styles.count}>{activeCount}</span>}
        </button>

        <div className={styles.filtersBody}>
          <label className={styles.search}>
            <Icon name="search" size={17} />
            <span className="sr-only">{t.search}</span>
            <input
              value={query}
              placeholder={t.placeholder}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setQuery(e.currentTarget.value)}
              onBlur={() => update({ q: query.trim() || null })}
            />
          </label>

          <fieldset className={styles.group}>
            <legend>{t.cls}</legend>
            <div className={styles.options}>
              {CLASS_ORDER.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={cls === tag}
                  style={{ '--c': `var(--cls-${tag})` } as React.CSSProperties}
                  onClick={() => update({ class: cls === tag ? null : tag.toLowerCase() })}
                >
                  <Icon name={tag} size={16} />
                  {CLASSES[locale][tag].plural}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.group}>
            <legend>{t.position}</legend>
            <div className={styles.options}>
              {POSITION_ORDER.map((p) => (
                <button key={p} type="button" aria-pressed={positions.includes(p)} onClick={() => toggle('position', positions, p)}>
                  <Icon name={p} size={16} />
                  {POSITIONS[locale][p].label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.group}>
            <legend>{t.attackDamage}</legend>
            <div className={styles.options}>
              {Object.entries(ATTACK_TYPES[locale]).map(([k, label]) => (
                <button key={k} type="button" aria-pressed={attack.includes(k)} onClick={() => toggle('attack', attack, k)}>
                  {label}
                </button>
              ))}
              {Object.entries(DAMAGE_TYPES[locale]).map(([k, label]) => (
                <button key={k} type="button" aria-pressed={damage.includes(k.toLowerCase())} onClick={() => toggle('damage', damage, k.toLowerCase())}>
                  {t.damage(label)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.group}>
            <legend>{t.difficulty}</legend>
            <div className={styles.options}>
              {[1, 2, 3].map((d) => (
                <button key={d} type="button" aria-pressed={difficulty.includes(d)} onClick={() => toggle('difficulty', difficulty.map(String), String(d))}>
                  {DIFFICULTY[locale][d]}
                </button>
              ))}
            </div>
          </fieldset>

          {activeCount > 0 && (
            <button
              type="button"
              className={styles.reset}
              onClick={() => update({ class: null, position: null, attack: null, damage: null, difficulty: null })}
            >
              <Icon name="reset" size={15} /> {t.reset}
            </button>
          )}
        </div>
      </aside>

      <div className={styles.results}>
        <div className={styles.bar}>
          <p className={styles.found} aria-live="polite">
            <b className="num">{visible.length}</b> {plural(visible.length, t.champions, locale)}
          </p>
          <label className={styles.sort}>
            <span>{t.order}</span>
            <select value={sort} onChange={(e) => update({ sort: e.currentTarget.value === 'name' ? null : e.currentTarget.value })}>
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {t.sorts[s]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ul className={styles.grid} role="list">
          {visible.map((c) => (
            <ViewTransition key={c.id}>
              <li>
                <Link href={championHref(c.slug)} transitionTypes={['nav-forward']} className={styles.card} style={{ '--cls': `var(--cls-${c.tags[0]})` } as React.CSSProperties}>
                  <span className={styles.art}>
                    <ViewTransition name={`champ-${c.id}`} share="morph" default="none">
                      <img src={img.loading(c.id)} alt="" width={308} height={560} loading="lazy" decoding="async" />
                    </ViewTransition>
                  </span>
                  <span className={styles.plate}>
                    <span className={styles.name}>{c.name}</span>
                    <span className={styles.meta}>
                      {c.tags.map((t) => (
                        <Icon key={t} name={t} size={14} />
                      ))}
                      <span>{c.title}</span>
                    </span>
                    <ResourceBar value={c.hp18} scaleMax={maxHp} size="sm" label={t.hpLabel(fmt(c.hp18, 0, locale))} />
                    <span className={styles.hp}>
                      <span>{t.hpShort}</span>
                      <span className="num">{fmt(c.hp18, 0, locale)}</span>
                    </span>
                  </span>
                </Link>
              </li>
            </ViewTransition>
          ))}
        </ul>

        {visible.length === 0 && (
          <div className={styles.empty}>
            <p>{t.empty}</p>
            <button type="button" onClick={() => update({ class: null, position: null, attack: null, damage: null, difficulty: null, q: null })}>
              {t.resetAll}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
