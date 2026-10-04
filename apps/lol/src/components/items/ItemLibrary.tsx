'use client';

import { useSearchParams } from 'next/navigation';
import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { useLocale, useMessages, usePagePath } from '@rift/engine/i18n/LocaleProvider';
import { defineMessages, LOCALE_TAG } from '@rift/engine/i18n/locale';
import { Icon } from '@/components/Icon';
import { img } from '@/lib/assets';
import { CATEGORIES, fmtGold, ITEM_STATS, STAT_FILTERS, type Item, type ItemCategory } from '@/lib/items';
import { ItemDetail } from './ItemDetail';
import styles from './ItemLibrary.module.css';

const MESSAGES = defineMessages({
  ru: {
    search: 'Поиск по названию',
    placeholder: 'Название предмета',
    sections: 'Раздел магазина',
    all: 'Все',
    stats: 'Характеристики',
    reset: 'Сбросить',
    empty: 'Ничего не нашлось. Уберите фильтры или проверьте название.',
    selected: 'Выбранный предмет',
  },
  en: {
    search: 'Search by name',
    placeholder: 'Item name',
    sections: 'Shop section',
    all: 'All',
    stats: 'Stats',
    reset: 'Reset',
    empty: 'Nothing found. Remove filters or check the name.',
    selected: 'Selected item',
  },
});

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]/g, '');

/** Предмет, открытый без выбора: Грань Бесконечности — самый узнаваемый в магазине. */
const DEFAULT_ITEM = '3031';

/** Библиотека предметов как магазин в игре: разделы, цены, фильтры по характеристикам и карточка предмета. */
export function ItemLibrary({ items }: { items: Item[] }) {
  const t = useMessages(MESSAGES);
  const locale = useLocale();
  const pathname = usePagePath();
  const params = useSearchParams();
  const detailRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [category, setCategory] = useState<ItemCategory | null>(null);
  const [filters, setFilters] = useState<string[]>([]);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const selected = byId.get(params.get('item') ?? '') ?? byId.get(DEFAULT_ITEM) ?? items[0];

  const select = (id: string) => {
    window.history.replaceState(null, '', `${pathname}?item=${id}`);
    // на узком экране карточка над списком — подводим к ней
    if (window.innerWidth < 960) requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const toggleFilter = (key: string) => setFilters((f) => (f.includes(key) ? f.filter((x) => x !== key) : [...f, key]));

  const visible = useMemo(() => {
    const q = norm(deferredQuery);
    const active = STAT_FILTERS[locale].filter((f) => filters.includes(f.key));
    return items.filter(
      (i) => (!category || i.category === category) && (!q || norm(i.name).includes(q)) && active.every((f) => f.stats.some((s) => (i.stats[s] ?? 0) > 0)),
    );
  }, [items, category, filters, deferredQuery, locale]);

  const groups = CATEGORIES[locale].map((c) => ({
    ...c,
    items: visible.filter((i) => i.category === c.key).sort((a, b) => a.gold.total - b.gold.total || a.name.localeCompare(b.name, LOCALE_TAG[locale])),
  })).filter((g) => g.items.length > 0);

  return (
    <div className={styles.library}>
      <div className={styles.main}>
        <div className={styles.toolbar}>
          <label className={styles.search}>
            <Icon name="search" size={17} />
            <span className="sr-only">{t.search}</span>
            <input value={query} onChange={(e) => setQuery(e.currentTarget.value)} placeholder={t.placeholder} autoComplete="off" spellCheck={false} />
          </label>

          <div className={styles.tabs} role="group" aria-label={t.sections}>
            <button type="button" aria-pressed={category === null} onClick={() => setCategory(null)}>
              {t.all} <span>{items.length}</span>
            </button>
            {CATEGORIES[locale].map((c) => (
              <button key={c.key} type="button" aria-pressed={category === c.key} onClick={() => setCategory((cur) => (cur === c.key ? null : c.key))}>
                {c.label} <span>{items.filter((i) => i.category === c.key).length}</span>
              </button>
            ))}
          </div>

          <div className={styles.filters} role="group" aria-label={t.stats}>
            {STAT_FILTERS[locale].map((f) => {
              const def = ITEM_STATS[locale][f.stats[0]];
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={filters.includes(f.key)}
                  style={{ '--c': def.color } as React.CSSProperties}
                  onClick={() => toggleFilter(f.key)}
                >
                  <Icon name={def.icon} size={15} />
                  {f.label}
                </button>
              );
            })}
            {filters.length > 0 && (
              <button type="button" className={styles.reset} onClick={() => setFilters([])}>
                {t.reset}
              </button>
            )}
          </div>
        </div>

        {groups.map((g) => (
          <section key={g.key} className={styles.group} aria-labelledby={`items-${g.key}`}>
            <div className={styles.groupHead}>
              <h2 id={`items-${g.key}`}>{g.label}</h2>
              <span>{g.items.length}</span>
              <p>{g.hint}</p>
            </div>
            <ul className={styles.grid}>
              {g.items.map((i) => (
                <li key={i.id}>
                  <button type="button" className={styles.tile} aria-pressed={selected?.id === i.id} title={i.name} onClick={() => select(i.id)}>
                    <img src={img.item(i.id)} alt="" width={64} height={64} loading="lazy" decoding="async" />
                    <span className={`num ${styles.price}`}>{fmtGold(i.gold.total, locale)}</span>
                    <span className="sr-only">{i.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {groups.length === 0 && <p className={styles.empty}>{t.empty}</p>}
      </div>

      <aside ref={detailRef} className={styles.side} aria-label={t.selected} aria-live="polite">
        {selected && <ItemDetail item={selected} byId={byId} onSelect={select} />}
      </aside>
    </div>
  );
}
