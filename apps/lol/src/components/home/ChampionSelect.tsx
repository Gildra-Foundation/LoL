'use client';

import { useRouter } from 'next/navigation';
import { useDeferredValue, useMemo, useRef, useState, ViewTransition } from 'react';
import { AbilitySlot, type AbilityBrief } from '@/components/champion/AbilitySlot';
import { ChampionProvider, useChampion, type AbilityKey } from '@/components/champion/ChampionProvider';
import Link from '@rift/engine/i18n/Link';
import { useLocale, useMessages } from '@rift/engine/i18n/LocaleProvider';
import { defineMessages, localePath } from '@rift/engine/i18n/locale';
import { buttonClass } from '@rift/engine/ui/Button';
import { Icon } from '@/components/Icon';
import { Keycap } from '@rift/engine/ui/Keycap';
import { ResourceBar } from '@rift/engine/ui/ResourceBar';
import { championHref, img } from '@/lib/assets';
import { plural } from '@rift/engine/lib/format';
import { CLASSES, DIFFICULTY, POSITIONS, POSITION_ORDER, type ClassTag, type Position } from '@/lib/labels';
import { STATS, fmt, fmtStat } from '@/lib/stats';
import styles from './ChampionSelect.module.css';

const MESSAGES = defineMessages({
  ru: {
    title: 'Выбор чемпиона',
    count: (n: number, patch: string) => `${n} ${plural(n, ['чемпион', 'чемпиона', 'чемпионов'], 'ru')}, патч ${patch}`,
    searchLabel: 'Поиск по имени',
    searchPlaceholder: 'Имя чемпиона',
    lane: 'Линия',
    all: 'Все',
    champions: 'Чемпионы',
    empty: 'Никого не нашли. Выберите другую линию или проверьте имя.',
    keySelect: 'выбор',
    keyOpen: 'страница',
    keyAbilities: 'умения',
    difficulty: (level: string) => `Сложность: ${level}`,
    atLevel1: 'на 1 уровне',
    atLevel18: 'на 18',
    healthLabel: (hp1: string, hp18: string) => `Здоровье: ${hp1} на 1 уровне, ${hp18} на 18 уровне`,
    open: 'Открыть страницу',
    compare: 'Сравнить',
    passive: 'Пассивное умение',
    ability: (key: string) => `Умение ${key}`,
  },
  en: {
    title: 'Champion select',
    count: (n: number, patch: string) => `${n} ${plural(n, ['champion', 'champions', 'champions'], 'en')}, patch ${patch}`,
    searchLabel: 'Search by name',
    searchPlaceholder: 'Champion name',
    lane: 'Lane',
    all: 'All',
    champions: 'Champions',
    empty: 'No one found. Pick another lane or check the name.',
    keySelect: 'select',
    keyOpen: 'open',
    keyAbilities: 'abilities',
    difficulty: (level: string) => `Difficulty: ${level}`,
    atLevel1: 'at level 1',
    atLevel18: 'at 18',
    healthLabel: (hp1: string, hp18: string) => `Health: ${hp1} at level 1, ${hp18} at level 18`,
    open: 'Open page',
    compare: 'Compare',
    passive: 'Passive',
    ability: (key: string) => `${key} ability`,
  },
});

/** Только то, что показывает экран выбора: значения посчитаны на сервере. */
export interface SelectChampion {
  id: string;
  slug: string;
  name: string;
  title: string;
  tags: ClassTag[];
  positions: Position[];
  difficulty: number;
  hp1: number;
  hp18: number;
  ad: number;
  armor: number;
  mr: number;
  range: number;
  /** P Q W E R: название и файл иконки на Data Dragon */
  abilities: { key: AbilityKey; name: string; file: string }[];
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]/g, '');

interface ChampionSelectProps {
  champions: SelectChampion[];
  initialId: string;
  patch: string;
}

/** Экран выбора чемпиона: сетка портретов слева, выбранный чемпион, его умения и цифры справа. */
export function ChampionSelect({ champions, initialId, patch }: ChampionSelectProps) {
  const locale = useLocale();
  const t = MESSAGES[locale];
  const stats = STATS[locale];
  const router = useRouter();
  const gridRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState(initialId);
  const [previousId, setPreviousId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [lane, setLane] = useState<Position | null>(null);
  const deferredQuery = useDeferredValue(query);

  // полоски здоровья в одном масштабе: видно, кто живучее
  const maxHp = useMemo(() => Math.max(...champions.map((c) => c.hp18)), [champions]);

  const visible = useMemo(() => {
    const q = norm(deferredQuery);
    return champions.filter((c) => (!lane || c.positions.includes(lane)) && (!q || norm(c.name).includes(q) || norm(c.id).includes(q)));
  }, [champions, lane, deferredQuery]);

  const selected = champions.find((c) => c.id === selectedId) ?? champions[0];
  const previous = previousId ? champions.find((c) => c.id === previousId) : null;

  const abilities: AbilityBrief[] = selected.abilities.map((a) => ({
    key: a.key,
    name: a.name,
    icon: a.key === 'P' ? img.passive(a.file) : img.spell(a.file),
  }));

  const select = (id: string) => {
    if (id === selectedId) return;
    setPreviousId(selectedId);
    setSelectedId(id);
  };

  const open = (c: SelectChampion) => router.push(localePath(locale, championHref(c.slug)), { transitionTypes: ['nav-forward'] });

  // стрелки двигают выбор по сетке, Enter открывает страницу чемпиона
  const onGridKey = (e: React.KeyboardEvent) => {
    const index = visible.findIndex((c) => c.id === selectedId);
    const columns = gridRef.current ? getComputedStyle(gridRef.current).gridTemplateColumns.split(' ').length : 5;
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns };
    if (e.key in moves) {
      e.preventDefault();
      const next = visible[Math.min(visible.length - 1, Math.max(0, (index < 0 ? 0 : index) + moves[e.key]))];
      if (next) {
        select(next.id);
        gridRef.current?.querySelector<HTMLButtonElement>(`[data-id="${next.id}"]`)?.focus();
      }
    } else if (e.key === 'Enter' && index >= 0) {
      e.preventDefault();
      open(visible[index]);
    }
  };

  return (
    <ChampionProvider>
      <section className={styles.select} aria-label={t.title}>
        <div className={styles.picker}>
          <div className={styles.intro}>
            <h1>{t.title}</h1>
            <p>{t.count(champions.length, patch)}</p>
          </div>

          <label className={styles.search}>
            <Icon name="search" size={17} />
            <span className="sr-only">{t.searchLabel}</span>
            <input value={query} onChange={(e) => setQuery(e.currentTarget.value)} placeholder={t.searchPlaceholder} autoComplete="off" spellCheck={false} />
          </label>

          <div className={styles.lanes} role="group" aria-label={t.lane}>
            <button type="button" aria-pressed={lane === null} onClick={() => setLane(null)}>
              <Icon name="grid" size={17} />
              {t.all}
            </button>
            {POSITION_ORDER.map((p) => (
              <button key={p} type="button" aria-pressed={lane === p} title={POSITIONS[locale][p].label} onClick={() => setLane((current) => (current === p ? null : p))}>
                <Icon name={p} size={17} />
                {POSITIONS[locale][p].short}
              </button>
            ))}
          </div>

          <div ref={gridRef} className={styles.grid} role="listbox" aria-label={t.champions} onKeyDown={onGridKey}>
            {visible.map((c) => {
              const active = c.id === selectedId;
              const image = <img src={img.icon(c.id)} alt="" width={120} height={120} loading="lazy" decoding="async" />;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  title={c.name}
                  data-id={c.id}
                  tabIndex={active || (!visible.some((v) => v.id === selectedId) && c === visible[0]) ? 0 : -1}
                  className={styles.cell}
                  onClick={() => select(c.id)}
                  onDoubleClick={() => open(c)}
                >
                  <span className={styles.portrait}>
                    {active ? (
                      <ViewTransition name={`champ-${c.id}`} share="morph" default="none">
                        {image}
                      </ViewTransition>
                    ) : (
                      image
                    )}
                  </span>
                  <span className={styles.label}>{c.name}</span>
                </button>
              );
            })}
            {visible.length === 0 && <p className={styles.empty}>{t.empty}</p>}
          </div>

          <p className={styles.keys}>
            <span>
              <Keycap size="sm">←</Keycap>
              <Keycap size="sm">→</Keycap>
              {t.keySelect}
            </span>
            <span>
              <Keycap size="sm">Enter</Keycap>
              {t.keyOpen}
            </span>
            <span>
              <Keycap size="sm">Q</Keycap>
              {t.keyAbilities}
            </span>
          </p>
        </div>

        <div className={styles.stage}>
          {previous && <img key={`prev-${previous.id}`} className={styles.splashPrev} src={img.centered(previous.id)} alt="" width={1280} height={720} />}
          <img key={selected.id} className={styles.splash} src={img.centered(selected.id)} alt="" width={1280} height={720} />

          <div className={styles.info}>
            <ul className={styles.meta}>
              {selected.tags.map((tag) => (
                <li key={tag} style={{ '--cls': `var(--cls-${tag})` } as React.CSSProperties}>
                  <Icon name={tag} size={15} />
                  {CLASSES[locale][tag].label}
                </li>
              ))}
              {selected.positions.slice(0, 2).map((p) => (
                <li key={p}>
                  <Icon name={p} size={15} />
                  {POSITIONS[locale][p].label}
                </li>
              ))}
              <li>{t.difficulty(DIFFICULTY[locale][selected.difficulty].toLowerCase())}</li>
            </ul>
            <h2 className={styles.name}>{selected.name}</h2>
            <p className={styles.title}>{selected.title}</p>

            <Abilities key={selected.id} abilities={abilities} />

            <div className={styles.hp}>
              <div className={styles.hpHead}>
                <span>{stats.hp.label}</span>
                <span className={styles.legend}>
                  <span>
                    <i className={styles.swatch} />
                    <b className="num">{fmt(selected.hp1, 0, locale)}</b> {t.atLevel1}
                  </span>
                  <span>
                    <i className={`${styles.swatch} ${styles.swatchGrowth}`} />
                    <b className="num">{fmt(selected.hp18, 0, locale)}</b> {t.atLevel18}
                  </span>
                </span>
              </div>
              <ResourceBar
                value={selected.hp18}
                base={selected.hp1}
                scaleMax={maxHp}
                label={t.healthLabel(fmt(selected.hp1, 0, locale), fmt(selected.hp18, 0, locale))}
              />
            </div>

            <dl className={styles.quick}>
              <div>
                <dt>{stats.attackdamage.short}</dt>
                <dd className="num">{fmtStat('attackdamage', selected.ad, locale)}</dd>
              </div>
              <div>
                <dt>{stats.armor.short}</dt>
                <dd className="num">{fmtStat('armor', selected.armor, locale)}</dd>
              </div>
              <div>
                <dt>{stats.spellblock.short}</dt>
                <dd className="num">{fmtStat('spellblock', selected.mr, locale)}</dd>
              </div>
              <div>
                <dt>{stats.attackrange.short}</dt>
                <dd className="num">{fmtStat('attackrange', selected.range, locale)}</dd>
              </div>
            </dl>

            <div className={styles.actions}>
              <Link href={championHref(selected.slug)} transitionTypes={['nav-forward']} className={buttonClass('primary')}>
                {t.open}
              </Link>
              <Link href={`/compare?a=${selected.slug}`} className={buttonClass('secondary')}>
                {t.compare}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </ChampionProvider>
  );
}

/** Ячейки умений и название выбранного. При смене чемпиона ячейки «откатываются» по очереди. */
function Abilities({ abilities }: { abilities: AbilityBrief[] }) {
  const t = useMessages(MESSAGES);
  const { ability } = useChampion();
  const current = abilities.find((a) => a.key === ability) ?? abilities[0];
  return (
    <div className={styles.abilities}>
      <div className={styles.slots}>
        {abilities.map((a, i) => (
          <AbilitySlot key={a.key} ability={a} bootDelay={i * 70} />
        ))}
      </div>
      <p className={styles.abilityName}>
        <span>{current.key === 'P' ? t.passive : t.ability(current.key)}</span>
        {current.name}
      </p>
    </div>
  );
}
