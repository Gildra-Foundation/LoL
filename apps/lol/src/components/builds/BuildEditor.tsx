'use client';

import { useSearchParams } from 'next/navigation';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import Link from '@rift/engine/i18n/Link';
import { useLocale, useMessages, usePagePath } from '@rift/engine/i18n/LocaleProvider';
import { defineMessages, LOCALE_TAG } from '@rift/engine/i18n/locale';
import { fmt, formatShortDate } from '@rift/engine/lib/format';
import { Button } from '@rift/engine/ui/Button';
import { EntityPicker } from '@rift/engine/ui/EntityPicker';
import { Keycap } from '@rift/engine/ui/Keycap';
import { LevelControl } from '@rift/engine/ui/LevelControl';
import { Icon } from '@/components/Icon';
import { ItemDetail } from '@/components/items/ItemDetail';
import { championHref, img } from '@/lib/assets';
import {
  buildCost,
  buildFromQuery,
  buildToQuery,
  buildWarnings,
  computeStats,
  emptyBuild,
  loadSavedBuilds,
  storeSavedBuilds,
  type Build,
  type BuildChampion,
  type SavedBuild,
  type TotalKey,
} from '@/lib/build';
import { CATEGORIES, fmtGold, type Item, type ItemCategory } from '@/lib/items';
import { POSITION_ORDER, POSITIONS } from '@/lib/labels';
import { TREE_COLORS, type RunesData, type SummonerSpell } from '@/lib/runes';
import { RunePage } from './RunePage';
import styles from './BuildEditor.module.css';

export interface BuildEditorProps {
  champions: BuildChampion[];
  items: Item[];
  runes: RunesData;
  spells: SummonerSpell[];
}

type SlotRef = { row: 'start' | 'items'; index: number };

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]/g, '');

const MESSAGES = defineMessages({
  ru: {
    stat: {
      hp: 'Здоровье',
      ad: 'Сила атаки',
      ap: 'Сила умений',
      armor: 'Броня',
      mr: 'Сопр. магии',
      as: 'Скорость атаки',
      ms: 'Скорость',
      crit: 'Шанс крита',
      haste: 'Ускорение умений',
      lethality: 'Смертоносность',
      armorPenPct: 'Пробивание брони',
      magicPen: 'Маг. пробивание',
      magicPenPct: 'Маг. пробивание',
      lifesteal: 'Вампиризм',
      omnivamp: 'Всестороннее вытягивание',
      mana: 'Мана',
      tenacity: 'Стойкость',
    },
    newBuild: 'Новый билд',
    startFull: 'Стартовые слоты заняты — выберите слот, чтобы заменить предмет',
    itemsFull: 'Все шесть слотов заняты — выберите слот, чтобы заменить предмет',
    copied: 'Ссылка на билд скопирована',
    copyPrompt: 'Скопируйте ссылку на билд',
    pickFirst: 'Сначала выберите чемпиона',
    alreadySaved: 'Этот билд уже сохранён',
    savedHere: 'Билд сохранён в этом браузере',
    opened: (name: string) => `Открыт билд «${name}»`,
    slot: (item: string, n: number) => `${item}, слот ${n}`,
    emptySlot: (n: number) => `Пустой слот ${n}`,
    removeItem: (item: string) => `Убрать «${item}»`,
    championLane: 'Чемпион и линия',
    noChampion: 'Чемпион не выбран',
    forWhom: 'Для кого этот билд',
    changeChampion: 'Сменить чемпиона',
    pickChampion: 'Выбрать чемпиона',
    championName: 'Имя чемпиона',
    lane: 'Линия',
    mainLane: 'Основная линия чемпиона',
    runes: 'Руны',
    runeCount: (n: number) => `${n} из 9`,
    spells: 'Заклинания призывателя',
    spellSlot: (key: string, name?: string) => `Слот ${key}: ${name ?? 'пусто'}`,
    spellList: 'Заклинания',
    cooldown: (value: string) => `Перезарядка ${value} с.`,
    spellHint: 'Выберите слот D или F и нажмите на заклинание. Повторное нажатие на занятое заклинание меняет слоты местами.',
    items: 'Предметы',
    start: 'Старт',
    build: 'Сборка',
    slotHintSelected: 'Выберите предмет для этого слота или другой слот того же ряда, чтобы поменять их местами.',
    slotHint: 'Нажмите на предмет — он встанет в первый свободный слот. Нажмите на слот, чтобы заменить или переставить.',
    searchItem: 'Поиск предмета',
    itemName: 'Название предмета',
    shopSection: 'Раздел магазина',
    nothing: 'Ничего не нашлось',
    hoverItem: 'Наведите на предмет, чтобы увидеть характеристики.',
    summary: 'Итог билда',
    buildName: 'Название билда',
    stats: 'Характеристики',
    note: (level: number) => `На ${level} уровне с предметами сборки и осколками`,
    adaptive: (to: 'ad' | 'ap') => `, адаптивная сила — в ${to === 'ad' ? 'силу атаки' : 'силу умений'}`,
    asCapped: '. Скорость атаки упирается в предел 2,5',
    passives: '. Пассивные эффекты предметов и рун не учтены.',
    noStats: 'Выберите чемпиона — посчитаем его характеристики с этим билдом.',
    save: 'Сохранить',
    share: 'Поделиться',
    clear: 'Очистить',
    clearConfirm: 'Точно очистить?',
    myBuilds: 'Мои билды',
    remove: 'Удалить',
    removeBuild: (name: string) => `Удалить «${name}»`,
  },
  en: {
    stat: {
      hp: 'Health',
      ad: 'Attack damage',
      ap: 'Ability power',
      armor: 'Armor',
      mr: 'Magic resist',
      as: 'Attack speed',
      ms: 'Move speed',
      crit: 'Crit chance',
      haste: 'Ability haste',
      lethality: 'Lethality',
      armorPenPct: 'Armor penetration',
      magicPen: 'Magic penetration',
      magicPenPct: 'Magic penetration',
      lifesteal: 'Life steal',
      omnivamp: 'Omnivamp',
      mana: 'Mana',
      tenacity: 'Tenacity',
    },
    newBuild: 'New build',
    startFull: 'Starting slots are full: select a slot to replace its item',
    itemsFull: 'All six slots are full: select a slot to replace its item',
    copied: 'Build link copied',
    copyPrompt: 'Copy the build link',
    pickFirst: 'Pick a champion first',
    alreadySaved: 'This build is already saved',
    savedHere: 'Build saved in this browser',
    opened: (name: string) => `Opened “${name}”`,
    slot: (item: string, n: number) => `${item}, slot ${n}`,
    emptySlot: (n: number) => `Empty slot ${n}`,
    removeItem: (item: string) => `Remove ${item}`,
    championLane: 'Champion and lane',
    noChampion: 'No champion selected',
    forWhom: 'Who this build is for',
    changeChampion: 'Change champion',
    pickChampion: 'Choose champion',
    championName: 'Champion name',
    lane: 'Lane',
    mainLane: "Champion's main lane",
    runes: 'Runes',
    runeCount: (n: number) => `${n} of 9`,
    spells: 'Summoner spells',
    spellSlot: (key: string, name?: string) => `Slot ${key}: ${name ?? 'empty'}`,
    spellList: 'Spells',
    cooldown: (value: string) => `Cooldown: ${value}s.`,
    spellHint: 'Select slot D or F, then click a spell. Clicking a spell that is already picked swaps the slots.',
    items: 'Items',
    start: 'Start',
    build: 'Build',
    slotHintSelected: 'Pick an item for this slot, or another slot in the same row to swap them.',
    slotHint: 'Click an item to put it in the first free slot. Click a slot to replace or move its item.',
    searchItem: 'Search items',
    itemName: 'Item name',
    shopSection: 'Shop section',
    nothing: 'Nothing found',
    hoverItem: 'Hover over an item to see its stats.',
    summary: 'Build summary',
    buildName: 'Build name',
    stats: 'Stats',
    note: (level: number) => `At level ${level} with the build's items and shards`,
    adaptive: (to: 'ad' | 'ap') => `, adaptive force goes to ${to === 'ad' ? 'attack damage' : 'ability power'}`,
    asCapped: '. Attack speed hits the 2.5 cap',
    passives: '. Item and rune passives are not included.',
    noStats: 'Pick a champion to see their stats with this build.',
    save: 'Save',
    share: 'Share',
    clear: 'Clear',
    clearConfirm: 'Really clear?',
    myBuilds: 'My builds',
    remove: 'Delete',
    removeBuild: (name: string) => `Delete ${name}`,
  },
});

/** Строки сводки: первые всегда, остальные — если билд что-то даёт. */
const STAT_ROWS: { key: TotalKey; icon: string; color: string; always?: boolean; decimals?: number; percent?: boolean }[] = [
  { key: 'hp', icon: 'hp', color: 'var(--stat-hp)', always: true },
  { key: 'ad', icon: 'ad', color: 'var(--stat-ad)', always: true },
  { key: 'ap', icon: 'ap', color: 'var(--stat-ap)', always: true },
  { key: 'armor', icon: 'armor', color: 'var(--stat-armor)', always: true },
  { key: 'mr', icon: 'mr', color: 'var(--stat-mr)', always: true },
  { key: 'as', icon: 'as', color: 'var(--stat-as)', always: true, decimals: 3 },
  { key: 'ms', icon: 'ms', color: 'var(--stat-ms)', always: true },
  { key: 'crit', icon: 'crit', color: 'var(--stat-crit)', percent: true },
  { key: 'haste', icon: 'haste', color: 'var(--stat-haste)' },
  { key: 'lethality', icon: 'pen', color: 'var(--stat-pen)' },
  { key: 'armorPenPct', icon: 'pen', color: 'var(--stat-pen)', percent: true },
  { key: 'magicPen', icon: 'pen', color: 'var(--stat-ap)' },
  { key: 'magicPenPct', icon: 'pen', color: 'var(--stat-ap)', percent: true },
  { key: 'lifesteal', icon: 'vamp', color: 'var(--stat-vamp)', percent: true },
  { key: 'omnivamp', icon: 'vamp', color: 'var(--stat-vamp)', percent: true },
  { key: 'mana', icon: 'mp', color: 'var(--stat-mana)' },
  { key: 'tenacity', icon: 'tenacity', color: 'var(--ash)', percent: true },
];

const PICKER_TABS: ItemCategory[] = ['legendary', 'boots', 'epic', 'basic', 'starter', 'consumable'];

/** Конструктор билда: чемпион и линия, руны, заклинания, предметы и итоговые характеристики. Весь билд живёт в адресе. */
export function BuildEditor({ champions, items, runes, spells }: BuildEditorProps) {
  const t = useMessages(MESSAGES);
  const locale = useLocale();
  const pathname = usePagePath();
  const params = useSearchParams();
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const shardById = useMemo(() => new Map(runes.shards.flatMap((r) => r.perks).map((p) => [p.id, p])), [runes]);
  const spellById = useMemo(() => new Map(spells.map((s) => [s.id, s])), [spells]);
  const catalog = useMemo(() => ({ champions, runes, spells, items: itemById }), [champions, runes, spells, itemById]);

  const [build, setBuild] = useState<Build>(() => buildFromQuery(params, catalog));
  const [level, setLevel] = useState(18);
  const [slot, setSlot] = useState<SlotRef | null>(null);
  const [spellSlot, setSpellSlot] = useState(0);
  const [spellInfo, setSpellInfo] = useState<SummonerSpell | null>(null);
  const [tab, setTab] = useState<ItemCategory>('legendary');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [hoverItem, setHoverItem] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedBuild[]>([]);
  const [status, setStatus] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const champion = champions.find((c) => c.slug === build.champion);
  // изменение считается от актуального билда: быстрые клики подряд не теряются
  const update = (patch: Partial<Build> | ((b: Build) => Partial<Build>)) => setBuild((b) => ({ ...b, ...(typeof patch === 'function' ? patch(b) : patch) }));
  const setRow = (row: SlotRef['row'], next: (string | null)[]) => update(row === 'start' ? { start: next } : { items: next });

  // ссылка всегда описывает текущий билд — ею можно поделиться в любой момент
  useEffect(() => {
    const q = buildToQuery(build, spells);
    window.history.replaceState(null, '', q ? `${pathname}?${q}` : pathname);
  }, [build, spells, pathname]);

  useEffect(() => setSaved(loadSavedBuilds()), []);

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(''), 2600);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), 3000);
    return () => clearTimeout(t);
  }, [confirmClear]);

  const autoName = champion ? `${champion.name}${build.lane ? `, ${POSITIONS[locale][build.lane].label.toLowerCase()}` : ''}` : t.newBuild;

  // ── предметы ──
  const placeItem = (item: Item) => {
    const toStart = item.category === 'starter' || item.category === 'consumable';
    let target = slot;
    if (!target) {
      const row = toStart ? 'start' : 'items';
      const index = build[row].findIndex((x) => x === null);
      if (index < 0) {
        setStatus(toStart ? t.startFull : t.itemsFull);
        return;
      }
      target = { row, index };
    }
    const next = [...build[target.row]];
    next[target.index] = item.id;
    setRow(target.row, next);
    setSlot(null);
  };

  const clickSlot = (ref: SlotRef) => {
    if (slot && slot.row === ref.row && slot.index !== ref.index) {
      // второй слот в том же ряду — меняем предметы местами
      const next = [...build[ref.row]];
      [next[slot.index], next[ref.index]] = [next[ref.index], next[slot.index]];
      setRow(ref.row, next);
      setSlot(null);
      return;
    }
    setSlot(slot && slot.row === ref.row && slot.index === ref.index ? null : ref);
  };

  const removeSlot = (ref: SlotRef) => {
    setRow(ref.row, build[ref.row].map((x, i) => (i === ref.index ? null : x)));
    setSlot(null);
  };

  const q = norm(deferredQuery);
  const pickerItems = items
    .filter((i) => (q ? norm(i.name).includes(q) : i.category === tab))
    .sort((a, b) => a.gold.total - b.gold.total || a.name.localeCompare(b.name, LOCALE_TAG[locale]));

  // ── заклинания ──
  const pickSpell = (spell: SummonerSpell) => {
    const next = [...build.spells];
    const other = spellSlot === 0 ? 1 : 0;
    // то же заклинание во втором слоте — меняем местами
    if (next[other] === spell.id) next[other] = next[spellSlot];
    next[spellSlot] = spell.id;
    update({ spells: next });
    setSpellInfo(spell);
    if (!next[other]) setSpellSlot(other);
  };

  // ── итог ──
  const stats = champion ? computeStats(champion, build, level, itemById, shardById) : null;
  const warnings = buildWarnings(build, champion, itemById, spells, locale);
  const startCost = buildCost(build.start, itemById);
  const itemsCost = buildCost(build.items, itemById);
  const runeCount = [...build.runes, ...build.secondaryRunes, ...build.shards].filter(Boolean).length;
  const keystone = runes.trees.find((t) => t.id === build.primary)?.slots[0].find((r) => r.id === build.runes[0]);
  const secondaryTree = runes.trees.find((t) => t.id === build.secondary);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus(t.copied);
    } catch {
      window.prompt(t.copyPrompt, window.location.href);
    }
  };

  const save = () => {
    const query = buildToQuery(build, spells);
    if (!build.champion) {
      setStatus(t.pickFirst);
      return;
    }
    if (saved.some((s) => s.query === query)) {
      setStatus(t.alreadySaved);
      return;
    }
    const entry: SavedBuild = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: build.name.trim() || autoName, champion: build.champion, savedAt: Date.now(), query };
    const next = [entry, ...saved].slice(0, 30);
    setSaved(next);
    storeSavedBuilds(next);
    setStatus(t.savedHere);
  };

  const load = (s: SavedBuild) => {
    setBuild(buildFromQuery(new URLSearchParams(s.query), catalog));
    setSlot(null);
    setStatus(t.opened(s.name));
  };

  const remove = (id: string) => {
    const next = saved.filter((s) => s.id !== id);
    setSaved(next);
    storeSavedBuilds(next);
  };

  const clear = () => {
    if (!confirmClear) return setConfirmClear(true);
    setConfirmClear(false);
    setBuild(emptyBuild());
    setSlot(null);
  };

  const slotButton = (row: 'start' | 'items', index: number) => {
    const id = build[row][index];
    const item = id ? itemById.get(id) : undefined;
    const selected = slot?.row === row && slot.index === index;
    return (
      <div key={`${row}-${index}`} className={styles.slotWrap}>
        <button
          type="button"
          className={styles.slot}
          aria-pressed={selected}
          aria-label={item ? t.slot(item.name, index + 1) : t.emptySlot(index + 1)}
          title={item?.name}
          onClick={() => clickSlot({ row, index })}
          onPointerEnter={() => item && setHoverItem(item.id)}
        >
          {item ? <img src={img.item(item.id)} alt="" width={64} height={64} /> : <Icon name="plus" size={16} />}
          {row === 'items' && (
            <Keycap size="sm" className={styles.slotKey}>
              {index + 1}
            </Keycap>
          )}
        </button>
        {item && (
          <button type="button" className={styles.slotRemove} aria-label={t.removeItem(item.name)} onClick={() => removeSlot({ row, index })}>
            <Icon name="close" size={12} strokeWidth={2.4} />
          </button>
        )}
      </div>
    );
  };

  const hovered = hoverItem ? itemById.get(hoverItem) : undefined;

  return (
    <div className={styles.editor}>
      <div className={styles.main}>
        {/* 1. Чемпион и линия */}
        <section className={styles.panel} aria-labelledby="b-champion">
          <h2 id="b-champion">
            <span className={styles.step}>1</span>{t.championLane}
          </h2>
          <div className={styles.champion}>
            {champion ? (
              <img src={img.icon(champion.id)} alt="" width={120} height={120} className={styles.portrait} />
            ) : (
              <span className={styles.portraitEmpty}>?</span>
            )}
            <div className={styles.championText}>
              <p className={styles.championName}>{champion ? <Link href={championHref(champion.slug)}>{champion.name}</Link> : t.noChampion}</p>
              <p className={styles.championTitle}>{champion?.title ?? t.forWhom}</p>
              <EntityPicker
                side="blue"
                current={champion ?? ({ id: '', name: '' } as BuildChampion)}
                items={champions}
                iconUrl={img.icon}
                label={champion ? t.changeChampion : t.pickChampion}
                placeholder={t.championName}
                onPick={(c) => update({ champion: c.slug, lane: build.lane ?? c.positions[0] ?? null })}
              />
            </div>
          </div>
          <div className={styles.lanes} role="group" aria-label={t.lane}>
            {POSITION_ORDER.map((p) => (
              <button key={p} type="button" aria-pressed={build.lane === p} title={POSITIONS[locale][p].label} onClick={() => update({ lane: build.lane === p ? null : p })}>
                <Icon name={p} size={18} />
                {POSITIONS[locale][p].short}
                {champion?.positions.includes(p) && <i className={styles.mainLane} title={t.mainLane} />}
              </button>
            ))}
          </div>
        </section>

        {/* 2. Руны */}
        <section className={styles.panel} aria-labelledby="b-runes">
          <h2 id="b-runes">
            <span className={styles.step}>2</span>{t.runes} <span className={styles.progress}>{t.runeCount(runeCount)}</span>
          </h2>
          <RunePage runes={runes} build={build} onChange={update} />
        </section>

        {/* 3. Заклинания призывателя */}
        <section className={styles.panel} aria-labelledby="b-spells">
          <h2 id="b-spells">
            <span className={styles.step}>3</span>{t.spells}
          </h2>
          <div className={styles.spells}>
            <div className={styles.spellSlots}>
              {[0, 1].map((i) => {
                const sp = build.spells[i] ? spellById.get(build.spells[i]!) : undefined;
                return (
                  <button
                    key={i}
                    type="button"
                    className={styles.spellSlot}
                    aria-pressed={spellSlot === i}
                    aria-label={t.spellSlot(i === 0 ? 'D' : 'F', sp?.name)}
                    onClick={() => setSpellSlot(i)}
                  >
                    {sp ? <img src={img.spell(sp.image)} alt="" width={64} height={64} /> : <Icon name="plus" size={16} />}
                    <Keycap size="sm" className={styles.slotKey}>
                      {i === 0 ? 'D' : 'F'}
                    </Keycap>
                  </button>
                );
              })}
            </div>
            <div className={styles.spellList} role="group" aria-label={t.spellList}>
              {spells.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={build.spells.includes(s.id)}
                  title={s.name}
                  onClick={() => pickSpell(s)}
                  onPointerEnter={() => setSpellInfo(s)}
                  onFocus={() => setSpellInfo(s)}
                >
                  <img src={img.spell(s.image)} alt="" width={64} height={64} loading="lazy" />
                  <span>{s.name}</span>
                </button>
              ))}
            </div>
          </div>
          <p className={styles.spellInfo}>
            {spellInfo ? (
              <>
                <b>{spellInfo.name}</b> — {spellInfo.description} {t.cooldown(fmt(spellInfo.cooldown, 0, locale))}
              </>
            ) : (
              t.spellHint
            )}
          </p>
        </section>

        {/* 4. Предметы */}
        <section className={styles.panel} aria-labelledby="b-items">
          <h2 id="b-items">
            <span className={styles.step}>4</span>{t.items}
          </h2>
          <div className={styles.itemRows}>
            <div className={styles.itemRow}>
              <span className={styles.rowLabel}>{t.start}</span>
              <div className={styles.slots}>{build.start.map((_, i) => slotButton('start', i))}</div>
              <span className={`num ${styles.rowCost}`}>{fmtGold(startCost, locale)}</span>
            </div>
            <div className={styles.itemRow}>
              <span className={styles.rowLabel}>{t.build}</span>
              <div className={styles.slots}>{build.items.map((_, i) => slotButton('items', i))}</div>
              <span className={`num ${styles.rowCost}`}>{fmtGold(itemsCost, locale)}</span>
            </div>
          </div>
          <p className={styles.slotHint}>
            {slot ? t.slotHintSelected : t.slotHint}
          </p>

          <div className={styles.picker}>
            <div className={styles.pickerBar}>
              <label className={styles.search}>
                <Icon name="search" size={16} />
                <span className="sr-only">{t.searchItem}</span>
                <input value={query} onChange={(e) => setQuery(e.currentTarget.value)} placeholder={t.itemName} autoComplete="off" spellCheck={false} />
              </label>
              <div className={styles.tabs} role="group" aria-label={t.shopSection}>
                {PICKER_TABS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={!q && tab === key}
                    onClick={() => {
                      setTab(key);
                      setQuery('');
                    }}
                  >
                    {CATEGORIES[locale].find((c) => c.key === key)?.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.pickerBody}>
              <ul className={styles.pickerGrid}>
                {pickerItems.map((i) => (
                  <li key={i.id}>
                    <button type="button" title={i.name} onClick={() => placeItem(i)} onPointerEnter={() => setHoverItem(i.id)} onFocus={() => setHoverItem(i.id)}>
                      <img src={img.item(i.id)} alt="" width={64} height={64} loading="lazy" />
                      <span className="num">{fmtGold(i.gold.total, locale)}</span>
                      <span className="sr-only">{i.name}</span>
                    </button>
                  </li>
                ))}
                {pickerItems.length === 0 && <li className={styles.none}>{t.nothing}</li>}
              </ul>
              <div className={styles.pickerInfo}>
                {hovered ? <ItemDetail item={hovered} byId={itemById} compact /> : <p className={styles.none}>{t.hoverItem}</p>}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Итог */}
      <aside className={styles.summary} aria-label={t.summary}>
        <label className={styles.nameField}>
          <span className="sr-only">{t.buildName}</span>
          <input value={build.name} maxLength={60} placeholder={autoName} onChange={(e) => update({ name: e.currentTarget.value })} />
        </label>

        <div className={styles.preview}>
          <div className={styles.previewTop}>
            {champion ? <img src={img.icon(champion.id)} alt="" width={120} height={120} className={styles.previewChamp} /> : <span className={styles.previewChampEmpty} />}
            {keystone ? (
              <img src={img.rune(keystone.icon)} alt={keystone.name} title={keystone.name} width={64} height={64} className={styles.previewKeystone} />
            ) : (
              <span className={styles.previewRuneEmpty} />
            )}
            {secondaryTree && (
              <img
                src={img.rune(secondaryTree.icon)}
                alt={secondaryTree.name}
                title={secondaryTree.name}
                width={32}
                height={32}
                className={styles.previewTree}
                style={{ '--tree': TREE_COLORS[secondaryTree.key] } as React.CSSProperties}
              />
            )}
            <div className={styles.previewSpells}>
              {build.spells.map((id, i) => {
                const sp = id ? spellById.get(id) : undefined;
                return sp ? <img key={i} src={img.spell(sp.image)} alt={sp.name} title={sp.name} width={64} height={64} /> : <span key={i} />;
              })}
            </div>
            {build.lane && (
              <span className={styles.previewLane} title={POSITIONS[locale][build.lane].label}>
                <Icon name={build.lane} size={18} />
              </span>
            )}
          </div>
          <div className={styles.previewItems}>
            {build.items.map((id, i) => (id ? <img key={i} src={img.item(id)} alt={itemById.get(id)?.name} title={itemById.get(id)?.name} width={64} height={64} /> : <span key={i} />))}
          </div>
        </div>

        {stats && champion ? (
          <>
            <div className={styles.statsHead}>
              <h3>{t.stats}</h3>
              <LevelControl value={level} onChange={setLevel} compact id="build-level" />
            </div>
            <table className={styles.stats}>
              <tbody>
                {STAT_ROWS.filter((r) => r.always || stats.total[r.key] > 0).map((r) => {
                  const total = stats.total[r.key];
                  const bonus = total - stats.base[r.key];
                  const digits = r.decimals ?? 0;
                  return (
                    <tr key={r.key + (r.percent ? '%' : '')} style={{ '--c': r.color } as React.CSSProperties}>
                      <th scope="row">
                        <Icon name={r.icon} size={15} />
                        {t.stat[r.key]}
                      </th>
                      <td className="num">
                        {fmt(total, digits, locale)}
                        {r.percent && <span className={styles.unit}>%</span>}
                      </td>
                      <td className={styles.bonus}>{Math.abs(bonus) > 1e-6 && `+${fmt(bonus, digits, locale)}${r.percent ? '%' : ''}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className={styles.note}>
              {t.note(level)}
              {stats.adaptive && t.adaptive(stats.adaptive)}
              {stats.asCapped && t.asCapped}
              {t.passives}
            </p>
          </>
        ) : (
          <p className={styles.note}>{t.noStats}</p>
        )}

        <dl className={styles.cost}>
          <div>
            <dt>{t.start}</dt>
            <dd className="num">{fmtGold(startCost, locale)}</dd>
          </div>
          <div>
            <dt>{t.build}</dt>
            <dd className="num">{fmtGold(itemsCost, locale)}</dd>
          </div>
        </dl>

        {warnings.length > 0 && (
          <ul className={styles.warnings}>
            {warnings.map((w) => (
              <li key={w}>
                <Icon name="warning" size={15} />
                {w}
              </li>
            ))}
          </ul>
        )}

        <div className={styles.actions}>
          <Button variant="primary" size="sm" onClick={save}>
            {t.save}
          </Button>
          <Button size="sm" onClick={share}>
            <Icon name="share" size={15} />
            {t.share}
          </Button>
          <Button variant="ghost" size="sm" className={confirmClear ? styles.danger : undefined} onClick={clear}>
            {confirmClear ? t.clearConfirm : t.clear}
          </Button>
        </div>
        <p className={styles.status} role="status">
          {status}
        </p>

        {saved.length > 0 && (
          <div className={styles.saved}>
            <h3>{t.myBuilds}</h3>
            <ul>
              {saved.map((s) => {
                const c = champions.find((x) => x.slug === s.champion);
                return (
                  <li key={s.id}>
                    <button type="button" className={styles.savedOpen} onClick={() => load(s)}>
                      {c ? <img src={img.icon(c.id)} alt="" width={120} height={120} /> : <span />}
                      <span>{s.name}</span>
                      <small>{formatShortDate(new Date(s.savedAt), locale)}</small>
                    </button>
                    <button type="button" className={styles.savedRemove} aria-label={t.removeBuild(s.name)} title={t.remove} onClick={() => remove(s.id)}>
                      <Icon name="close" size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}

