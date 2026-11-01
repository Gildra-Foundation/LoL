'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { startTransition, useEffect, useMemo, useState } from 'react';
import { useLocale, usePagePath } from '@rift/engine/i18n/LocaleProvider';
import { LOCALE_TAG, defineMessages, localePath } from '@rift/engine/i18n/locale';
import { createJsonLoader } from '@rift/engine/lib/json-loader';
import { plural } from '@rift/engine/lib/format';
import { Icon } from '@/components/Icon';
import { RARITIES } from '@/lib/labels';
import { AVAILABILITY } from '@/lib/skin-labels';
import { RARITY_ORDER, rarityOfSlug, raritySlug, type Rarity } from '@/lib/skin-assets';
import type { SkinLite } from '@/lib/skins';
import catalog from '../catalog/Catalog.module.css';
import { SkinCard } from './SkinCard';
import styles from './SkinCatalog.module.css';

const MESSAGES = defineMessages({
  ru: {
    sorts: { new: 'Сначала новые', old: 'Сначала старые', name: 'По алфавиту', champion: 'По чемпиону', price: 'Сначала дорогие', cheap: 'Сначала дешёвые' } as Record<Sort, string>,
    filters: 'Фильтры',
    search: 'Поиск по названию',
    placeholder: 'Образ или чемпион',
    champion: 'Чемпион',
    anyChampion: 'Все чемпионы',
    universe: 'Тематика',
    anyUniverse: 'Все тематики',
    line: 'Набор',
    anyLine: 'Все наборы',
    rarity: 'Редкость',
    standard: 'Обычные',
    availability: 'Доступность',
    extra: 'Особенности',
    chromas: 'Есть хромы',
    voice: 'Новая озвучка',
    legacy: 'Наследие',
    base: 'Показывать базовые',
    reset: 'Сбросить фильтры',
    skins: ['образ', 'образа', 'образов'] as [string, string, string],
    order: 'Порядок',
    empty: 'Под эти фильтры не подходит ни один образ.',
    resetAll: 'Сбросить всё',
    more: (n: number) => `Показать ещё ${n}`,
    loading: 'Загружаем образы…',
    error: 'Не удалось загрузить образы. Проверьте соединение.',
    retry: 'Попробовать снова',
  },
  en: {
    sorts: { new: 'Newest first', old: 'Oldest first', name: 'A to Z', champion: 'By champion', price: 'Most expensive', cheap: 'Cheapest' } as Record<Sort, string>,
    filters: 'Filters',
    search: 'Search by name',
    placeholder: 'Skin or champion',
    champion: 'Champion',
    anyChampion: 'All champions',
    universe: 'Universe',
    anyUniverse: 'All universes',
    line: 'Skin line',
    anyLine: 'All skin lines',
    rarity: 'Rarity',
    standard: 'Standard',
    availability: 'Availability',
    extra: 'Features',
    chromas: 'Has chromas',
    voice: 'New voice',
    legacy: 'Legacy',
    base: 'Show base skins',
    reset: 'Reset filters',
    skins: ['skin', 'skins', 'skins'] as [string, string, string],
    order: 'Sort by',
    empty: 'No skin matches these filters.',
    resetAll: 'Reset all',
    more: (n: number) => `Show ${n} more`,
    loading: 'Loading skins…',
    error: 'Skins could not load. Check your connection.',
    retry: 'Try again',
  },
});

export interface Facet {
  id: string | number;
  slug: string;
  name: string;
}

export interface SkinCatalogProps {
  champions: Facet[];
  universes: Facet[];
  lines: (Facet & { universe: number | null })[];
}

const SORTS = ['new', 'old', 'name', 'champion', 'price', 'cheap'] as const;
type Sort = (typeof SORTS)[number];
const AVAILABILITIES = ['available', 'bundle', 'loot', 'limited', 'legacy', 'rare', 'partner', 'upcoming'];
const PAGE = 60;

const load = createJsonLoader<SkinLite[]>((v): v is SkinLite[] => Array.isArray(v) && v.length > 0 && typeof v[0]?.slug === 'string');

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]/g, '');
const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);
const date = (s: SkinLite) => s.release ?? '';

const compare: Record<Sort, (a: SkinLite, b: SkinLite) => number> = {
  new: (a, b) => date(b).localeCompare(date(a)) || b.id - a.id,
  old: (a, b) => (date(a) || '9').localeCompare(date(b) || '9') || a.id - b.id,
  name: () => 0,
  champion: () => 0,
  price: (a, b) => (b.cost ?? -1) - (a.cost ?? -1),
  cheap: (a, b) => (a.cost ?? 1e9) - (b.cost ?? 1e9),
};

/** Каталог образов: все фильтры в адресе, список загружается одним JSON при открытии страницы. */
export function SkinCatalog({ champions, universes, lines }: SkinCatalogProps) {
  const locale = useLocale();
  const t = MESSAGES[locale];
  const router = useRouter();
  const pathname = usePagePath();
  const params = useSearchParams();
  const [skins, setSkins] = useState<SkinLite[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    load(localePath(locale, '/skins-index.json'))
      .then((value) => !cancelled && setSkins(value))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [locale, attempt]);

  const champion = champions.find((c) => c.slug === params.get('champion')) ?? null;
  const universe = universes.find((u) => u.slug === params.get('universe')) ?? null;
  const line = lines.find((l) => l.slug === params.get('line')) ?? null;
  const rarities = list(params.get('rarity'));
  const availability = list(params.get('availability'));
  const flags = list(params.get('only'));
  const showBase = params.get('base') === '1' || Boolean(champion);
  const sort = (SORTS.some((s) => s === params.get('sort')) ? params.get('sort') : champion ? 'old' : 'new') as Sort;

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    if (query.trim()) next.set('q', query.trim());
    else next.delete('q');
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setLimit(PAGE);
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const toggle = (key: string, values: string[], value: string) => {
    const set = new Set(values);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    update({ [key]: [...set].join(',') || null });
  };

  const visibleLines = universe ? lines.filter((l) => l.universe === Number(universe.id)) : lines;

  const visible = useMemo(() => {
    if (!skins) return [];
    const q = norm(query);
    const rarityKeys = new Set(rarities.map((r) => (r === 'standard' ? null : rarityOfSlug(r))));
    return skins
      .filter(
        (s) =>
          (showBase || !s.base) &&
          (!q || norm(s.name).includes(q) || norm(s.championName).includes(q) || norm(s.champion).includes(q)) &&
          (!champion || s.champion === champion.id) &&
          (!universe || s.universes.includes(Number(universe.id))) &&
          (!line || s.lines.includes(Number(line.id))) &&
          (!rarities.length || rarityKeys.has(s.rarity)) &&
          (!availability.length || availability.includes(s.availability ?? '')) &&
          (!flags.includes('chromas') || s.chromas > 0) &&
          (!flags.includes('voice') || s.newVoice) &&
          (!flags.includes('legacy') || s.legacy),
      )
      .toSorted(
        (a, b) =>
          compare[sort](a, b) ||
          (sort === 'champion' ? a.championName.localeCompare(b.championName, LOCALE_TAG[locale]) || a.num - b.num : 0) ||
          a.name.localeCompare(b.name, LOCALE_TAG[locale]),
      );
  }, [skins, query, showBase, champion, universe, line, rarities, availability, flags, sort, locale]);

  const activeCount = [champion, universe, line].filter(Boolean).length + rarities.length + availability.length + flags.length;
  const resetFilters = { champion: null, universe: null, line: null, rarity: null, availability: null, only: null, base: null };

  return (
    <div className={catalog.layout}>
      <aside className={catalog.filters} data-open={filtersOpen}>
        <button type="button" className={catalog.filtersToggle} aria-expanded={filtersOpen} onClick={() => setFiltersOpen((o) => !o)}>
          <Icon name="sliders" size={18} /> {t.filters}
          {activeCount > 0 && <span className={catalog.count}>{activeCount}</span>}
        </button>

        <div className={catalog.filtersBody}>
          <label className={catalog.search}>
            <Icon name="search" size={17} />
            <span className="sr-only">{t.search}</span>
            <input
              value={query}
              placeholder={t.placeholder}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => {
                setQuery(e.currentTarget.value);
                setLimit(PAGE);
              }}
              onBlur={() => update({ q: query.trim() || null })}
            />
          </label>

          <label className={styles.select}>
            <span>{t.champion}</span>
            <select value={champion?.slug ?? ''} onChange={(e) => update({ champion: e.currentTarget.value || null })}>
              <option value="">{t.anyChampion}</option>
              {champions.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.select}>
            <span>{t.universe}</span>
            <select value={universe?.slug ?? ''} onChange={(e) => update({ universe: e.currentTarget.value || null, line: null })}>
              <option value="">{t.anyUniverse}</option>
              {universes.map((u) => (
                <option key={u.slug} value={u.slug}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.select}>
            <span>{t.line}</span>
            <select value={line?.slug ?? ''} onChange={(e) => update({ line: e.currentTarget.value || null })}>
              <option value="">{t.anyLine}</option>
              {visibleLines.map((l) => (
                <option key={l.slug} value={l.slug}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset className={catalog.group}>
            <legend>{t.rarity}</legend>
            <div className={catalog.options}>
              {RARITY_ORDER.map((r: Rarity) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={rarities.includes(raritySlug(r))}
                  style={{ '--c': RARITIES[locale][r].color } as React.CSSProperties}
                  onClick={() => toggle('rarity', rarities, raritySlug(r))}
                >
                  <span className={styles.gem} aria-hidden="true" />
                  {RARITIES[locale][r].label}
                </button>
              ))}
              <button type="button" aria-pressed={rarities.includes('standard')} onClick={() => toggle('rarity', rarities, 'standard')}>
                {t.standard}
              </button>
            </div>
          </fieldset>

          <fieldset className={catalog.group}>
            <legend>{t.availability}</legend>
            <div className={catalog.options}>
              {AVAILABILITIES.map((a) => (
                <button key={a} type="button" aria-pressed={availability.includes(a)} onClick={() => toggle('availability', availability, a)}>
                  {AVAILABILITY[locale][a]}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className={catalog.group}>
            <legend>{t.extra}</legend>
            <div className={catalog.options}>
              {(['chromas', 'voice', 'legacy'] as const).map((f) => (
                <button key={f} type="button" aria-pressed={flags.includes(f)} onClick={() => toggle('only', flags, f)}>
                  {t[f]}
                </button>
              ))}
              {!champion && (
                <button type="button" aria-pressed={showBase} onClick={() => update({ base: showBase ? null : '1' })}>
                  {t.base}
                </button>
              )}
            </div>
          </fieldset>

          {activeCount > 0 && (
            <button type="button" className={catalog.reset} onClick={() => update(resetFilters)}>
              <Icon name="reset" size={15} /> {t.reset}
            </button>
          )}
        </div>
      </aside>

      <div className={catalog.results}>
        <div className={catalog.bar}>
          <p className={catalog.found} aria-live="polite">
            {skins && (
              <>
                <b className="num">{visible.length}</b> {plural(visible.length, t.skins, locale)}
              </>
            )}
          </p>
          <label className={catalog.sort}>
            <span>{t.order}</span>
            <select value={sort} onChange={(e) => update({ sort: e.currentTarget.value })}>
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {t.sorts[s]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {failed ? (
          <div role="alert" className={catalog.empty}>
            <p>{t.error}</p>
            <button type="button" onClick={() => setAttempt((n) => n + 1)}>
              {t.retry}
            </button>
          </div>
        ) : !skins ? (
          <p role="status" className={styles.status}>
            {t.loading}
          </p>
        ) : (
          <>
            <ul className={styles.grid} role="list">
              {visible.slice(0, limit).map((s) => (
                <li key={s.id}>
                  <SkinCard skin={s} lang={locale} />
                </li>
              ))}
            </ul>
            {visible.length > limit && (
              <button type="button" className={styles.more} onClick={() => setLimit((n) => n + PAGE)}>
                {t.more(Math.min(PAGE, visible.length - limit))}
              </button>
            )}
            {visible.length === 0 && (
              <div className={catalog.empty}>
                <p>{t.empty}</p>
                <button type="button" onClick={() => update({ ...resetFilters, q: null })}>
                  {t.resetAll}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
