'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from '@rift/engine/i18n/Link';
import { useMessages, usePagePath } from '@rift/engine/i18n/LocaleProvider';
import { defineMessages } from '@rift/engine/i18n/locale';
import { plural } from '@rift/engine/lib/format';
import { Icon } from '@/components/Icon';
import { championHref, img } from '@/lib/assets';
import { MAP_IMAGE, OVERVIEW, REGION_PLACES, TOUR_ROUTE, regionTies, type Region } from '@/lib/regions';
import { arc, exitPoint, inFrame, spread, type Edge, type Frame, type Pt } from './geometry';
import styles from './RuneterraMap.module.css';

const MESSAGES = defineMessages({
  ru: {
    regions: 'Регионы',
    unaffiliated: 'Без родины',
    mapAlt: 'Карта Рунтерры',
    links: (name: string, count: number) => `${name}: связей ${count}`,
    fullMap: 'Вся карта',
    startTour: 'Отправиться в путь',
    hint: 'Выберите регион на карте или в списке, наведите курсор — проявятся связи с другими землями. Стрелки листают регионы, Esc возвращает к карте.',
    tourLabel: 'Путешествие по Рунтерре',
    tour: 'Путешествие',
    resume: 'Продолжить',
    pause: 'Пауза',
    space: 'Пробел',
    nextRegion: 'Следующий регион',
    rightArrow: 'Стрелка вправо',
    endTour: 'Закончить путешествие',
    region: 'Регион',
    regionPage: 'Страница региона',
    readStory: 'Читать историю',
    regionChampions: 'Чемпионы региона',
    ties: 'Связи с другими регионами',
    tiesTip: 'Число — сколько пар чемпионов связывает регионы. Наведите на чемпиона, чтобы увидеть его связи на карте.',
    unaffiliatedLead: 'Чемпионы, у которых во вселенной League of Legends нет родного региона.',
    champions: 'Чемпионы',
  },
  en: {
    regions: 'Regions',
    unaffiliated: 'Unaffiliated',
    mapAlt: 'Map of Runeterra',
    links: (name: string, count: number) => `${name}: ${count} ${plural(count, ['connection', 'connections', 'connections'], 'en')}`,
    fullMap: 'Full map',
    startTour: 'Start the journey',
    hint: 'Pick a region on the map or in the list, or hover over one to reveal its connections to other lands. Arrow keys flip through regions, Esc returns to the map.',
    tourLabel: 'Journey across Runeterra',
    tour: 'Journey',
    resume: 'Resume',
    pause: 'Pause',
    space: 'Space',
    nextRegion: 'Next region',
    rightArrow: 'Right arrow',
    endTour: 'End the journey',
    region: 'Region',
    regionPage: 'Region page',
    readStory: 'Read the history',
    regionChampions: 'Champions of the region',
    ties: 'Connections to other regions',
    tiesTip: 'The number is how many pairs of champions connect the regions. Hover over a champion to see their connections on the map.',
    unaffiliatedLead: 'Champions who have no home region in the League of Legends universe.',
    champions: 'Champions',
  },
});

export interface MapChampion {
  id: string;
  slug: string;
  name: string;
}

interface RuneterraMapProps {
  regions: Region[];
  unaffiliated: string[];
  champions: MapChampion[];
  /** связи чемпионов по лору, взаимные: id → id знакомых */
  relations: Record<string, string[]>;
}

/** На что наведён курсор в панели: чемпион или регион из списка связей. */
type Focus = { champion: string } | { region: string } | null;

interface Line {
  slug: string;
  name: string;
  count: number;
  d: string;
  width: number;
  /** цель в кадре — число посередине дуги; иначе метка у края кадра со стрелкой к цели */
  inside: boolean;
  mid: Pt;
  end: Pt;
  edge?: Edge;
  angle: number;
  /** при наведении на чемпиона — его знакомые из этого региона */
  people: MapChampion[] | null;
  off: boolean;
}

const UNAFFILIATED = 'unaffiliated';
/** сколько длится остановка в путешествии, мс */
const DWELL = 8000;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const px = (p: Pt): CSSProperties => ({ left: p.x, top: p.y });

/**
 * Карта Рунтерры: регион выбирается на карте или в списке, камера подлетает к нему,
 * справа открывается арт региона с видео, история и чемпионы. Линии показывают связи
 * чемпионов с другими регионами, путешествие само облетает все регионы.
 */
export function RuneterraMap({ regions, unaffiliated, champions, relations }: RuneterraMapProps) {
  const t = useMessages(MESSAGES);
  const pathname = usePagePath();
  const params = useSearchParams();
  const viewRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const stepAnim = useRef<Animation | null>(null);
  const byId = useMemo(() => new Map(champions.map((c) => [c.id, c])), [champions]);
  const homeOf = useMemo(() => new Map(regions.flatMap((r) => r.champions.map((id) => [id, r.slug] as const))), [regions]);
  const isValid = (slug: string | null) => slug === UNAFFILIATED || regions.some((r) => r.slug === slug);
  const nameOf = (slug: string) => regions.find((r) => r.slug === slug)?.name ?? slug;

  const [selected, setSelected] = useState<string | null>(() => {
    const slug = params.get('region');
    return isValid(slug) ? slug : null;
  });
  const [box, setBox] = useState({ w: 1280, h: 760 });
  const [wide, setWide] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focus, setFocus] = useState<Focus>(null);
  const [tour, setTour] = useState<{ step: number; paused: boolean } | null>(null);
  // курсор над панелью — путешествие ждёт, пока читают
  const [hold, setHold] = useState(false);

  // размер кадра нужен для расчёта камеры
  useLayoutEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const measure = () => {
      setBox({ w: el.clientWidth, h: el.clientHeight });
      setWide(window.innerWidth >= 1000);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ссылка на регион: /runeterra?region=ionia
  useEffect(() => {
    window.history.replaceState(null, '', selected ? `${pathname}?region=${selected}` : pathname);
  }, [selected, pathname]);

  const show = (slug: string | null) => {
    setSelected(slug);
    setExpanded(false);
    setFocus(null);
  };
  // ручной выбор останавливает путешествие
  const select = (slug: string | null) => {
    setTour(null);
    show(slug);
  };

  // ── путешествие ──
  const route = TOUR_ROUTE.filter((slug) => regions.some((r) => r.slug === slug));
  const goStep = (i: number) => {
    if (i >= route.length) return select(null);
    setTour((t) => ({ step: i, paused: t?.paused ?? false }));
    show(route[i]);
  };
  const startTour = () => {
    const i = Math.max(0, route.indexOf(selected ?? ''));
    setTour({ step: i, paused: false });
    show(route[i]);
  };
  const togglePause = () => setTour((t) => t && { ...t, paused: !t.paused });

  // таймер остановки — анимация полосы прогресса: пауза останавливает и полосу, и отсчёт
  const step = tour?.step ?? null;
  const paused = tour ? tour.paused || hold : false;
  const onStepEnd = useEffectEvent(() => {
    if (step !== null) goStep(step + 1);
  });
  useEffect(() => {
    const bar = barRef.current;
    if (step === null || !bar) return;
    const a = bar.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: DWELL, fill: 'forwards' });
    a.onfinish = () => onStepEnd();
    stepAnim.current = a;
    return () => {
      a.onfinish = null;
      a.cancel();
      stepAnim.current = null;
    };
  }, [step]);
  useEffect(() => {
    const a = stepAnim.current;
    if (!a) return;
    if (paused) a.pause();
    else a.play();
  }, [paused, step]);

  const index = regions.findIndex((r) => r.slug === selected);
  const region = index >= 0 ? regions[index] : null;
  const prev = index >= 0 ? regions[(index - 1 + regions.length) % regions.length] : null;
  const next = index >= 0 ? regions[(index + 1) % regions.length] : null;

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest('input, textarea, select, [contenteditable]')) return;
    if (document.querySelector('dialog[open]')) return;
    if (tour) {
      if (e.key === ' ' && !target?.closest('button, a')) {
        e.preventDefault();
        togglePause();
      } else if (e.key === 'Escape') setTour(null);
      else if (e.key === 'ArrowRight') goStep(tour.step + 1);
      else if (e.key === 'ArrowLeft') goStep(Math.max(0, tour.step - 1));
      return;
    }
    if (e.key === 'Escape' && selected) select(null);
    else if (e.key === 'ArrowRight' && next) select(next.slug);
    else if (e.key === 'ArrowLeft' && prev) select(prev.slug);
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // камера: слой с картой — квадрат шириной с кадр; сдвиг в долях его стороны, масштаб от левого верхнего угла
  const place = region ? REGION_PLACES[region.slug] : undefined;
  // на широком экране справа открыта панель — видна только левая часть кадра; у края карты камера уходит дальше, там море
  const side = selected !== null && wide;
  const visible = side ? 0.56 : 1;
  // регион — крупным планом левее центра, «Без родины» — весь мир, ужатый в видимую часть
  const target = place ?? (side ? { ...OVERVIEW, zoom: OVERVIEW.zoom * visible } : OVERVIEW);
  const aspect = box.w > 0 ? box.h / box.w : 0.6;
  const s = target.zoom;
  const cx = side ? (place ? 0.29 : visible / 2) : 0.5;
  const X = clamp(cx - s * target.x, visible - s, 0);
  const Y = clamp(aspect / 2 - s * target.y, aspect - s, 0);
  const screenX = (p: { x: number }) => X + s * p.x;
  const at = (p: { x: number; y: number }) => ({ left: `${screenX(p) * 100}%`, top: `${((Y + s * p.y) / aspect) * 100}%` });

  const people = (ids: string[]) => ids.map((id) => byId.get(id)).filter((c): c is MapChampion => c !== undefined);

  // ── связи: от выбранного региона, а на общем плане — от региона под курсором ──
  const source = region ? region.slug : selected ? null : hovered;
  const ties = useMemo(() => {
    const r = regions.find((x) => x.slug === source);
    return r ? regionTies(r.champions, r.slug, relations, (id) => homeOf.get(id)) : [];
  }, [source, regions, relations, homeOf]);

  const focusChampion = focus && 'champion' in focus ? focus.champion : null;
  const focusRegion = focus && 'region' in focus ? focus.region : null;
  const groups = new Map<string, MapChampion[]>();
  for (const id of focusChampion ? (relations[focusChampion] ?? []) : []) {
    const c = byId.get(id);
    const key = homeOf.get(id) ?? UNAFFILIATED;
    if (c) groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const homeless = groups.get(UNAFFILIATED) ?? [];

  // всё в пикселях кадра; видимая часть — без панели справа и полос под кнопками
  const pt = (p: { x: number; y: number }): Pt => ({ x: (X + s * p.x) * box.w, y: (Y + s * p.y) * box.w });
  const panelWidth = selected && wide ? Math.min(box.w * 0.44, 540) : 0;
  // view — что видно в кадре; frame — куда ставить метки у края, не задевая кнопки
  const view: Frame = { left: 4, top: 4, right: box.w - panelWidth - 4, bottom: box.h - 4 };
  const frame: Frame = { left: 16, top: 64, right: box.w - panelWidth - 16, bottom: box.h - (tour && wide ? 108 : 16) };
  const origin = source && REGION_PLACES[source] ? pt(REGION_PLACES[source]) : null;
  const lines: Line[] = [];
  if (origin && inFrame(origin, view)) {
    // регион у самого края (Фрельйорд под кнопками) — рамку для меток раздвигаем до него
    const edges: Frame = { left: Math.min(frame.left, origin.x), top: Math.min(frame.top, origin.y), right: Math.max(frame.right, origin.x), bottom: Math.max(frame.bottom, origin.y) };
    const raw = ties.flatMap((t) => {
      const p = REGION_PLACES[t.slug];
      if (!p) return [];
      const to = pt(p);
      const inside = inFrame(to, view);
      return [{ ...t, name: nameOf(t.slug), to, inside, exit: inside ? null : exitPoint(origin, to, edges) }];
    });
    const anchors = spread(
      raw.flatMap((l) =>
        // ширина метки на глаз: название, стрелка, число или портреты знакомых
        l.exit ? [{ key: l.slug, edge: l.exit.edge, p: l.exit.p, w: l.name.length * 7 + 56 + (focusChampion ? (groups.get(l.slug)?.length ?? 0) * 28 : 0), h: 30 }] : [],
      ),
      edges,
    );
    for (const l of raw) {
      const end = (l.exit && anchors.get(l.slug)) || l.to;
      const { d, mid } = arc(origin, end, l.inside ? 0.18 : 0.08);
      const known = focusChampion ? (groups.get(l.slug) ?? []) : null;
      lines.push({
        slug: l.slug,
        name: l.name,
        count: l.count,
        d,
        mid,
        end,
        inside: l.inside,
        edge: l.exit?.edge,
        width: 1.25 + Math.min(l.count, 10) * 0.3,
        angle: (Math.atan2(l.to.y - origin.y, l.to.x - origin.x) * 180) / Math.PI,
        people: known,
        off: known ? known.length === 0 : focusRegion ? focusRegion !== l.slug : false,
      });
    }
  }
  const lit = new Set(lines.filter((l) => !l.off).map((l) => l.slug));
  const dimmed = (slug: string) => (source ? slug !== source && !lit.has(slug) : selected !== null && slug !== selected);
  const instant = !selected || undefined;

  return (
    <div className={styles.root}>
      <div className={styles.chips} role="group" aria-label={t.regions}>
        {regions.map((r) => (
          <button key={r.slug} type="button" aria-pressed={selected === r.slug} onClick={() => select(selected === r.slug ? null : r.slug)}>
            {r.name}
            <span>{r.champions.length}</span>
          </button>
        ))}
        <button type="button" aria-pressed={selected === UNAFFILIATED} onClick={() => select(selected === UNAFFILIATED ? null : UNAFFILIATED)}>
          {t.unaffiliated}
          <span>{unaffiliated.length}</span>
        </button>
      </div>

      <div className={styles.stage} data-open={selected ? '' : undefined}>
        <div ref={viewRef} className={styles.viewport}>
          <div className={styles.layer} style={{ transform: `translate(${X * 100}%, ${Y * 100}%) scale(${s})` }}>
            <img src={MAP_IMAGE} alt={t.mapAlt} width={2048} height={2048} fetchPriority="high" draggable={false} />
          </div>

          {/* линии появляются, когда камера долетела; на общем плане — сразу */}
          {lines.length > 0 && (
            <svg key={`lines-${source}`} className={styles.lines} data-instant={instant} viewBox={`0 0 ${box.w} ${box.h}`} aria-hidden="true">
              {lines.map((l) => (
                <g key={l.slug} data-off={l.off || undefined}>
                  <path className={styles.track} d={l.d} strokeWidth={l.width} pathLength={100} />
                  <path className={styles.flow} d={l.d} strokeWidth={l.width} />
                </g>
              ))}
            </svg>
          )}

          {/* «Без родины»: весь мир мелко, подписи только при наведении */}
          <div className={styles.markers} data-compact={(selected === UNAFFILIATED && wide) || undefined}>
            {regions.map((r) => {
              const p = REGION_PLACES[r.slug];
              if (!p) return null;
              const leave = () => setHovered((h) => (h === r.slug ? null : h));
              // метка под панелью скрыта; у её края подпись уходит влево, чтобы панель не резала
              const x = screenX(p) * box.w;
              const edge = box.w - panelWidth;
              return (
                <button
                  key={r.slug}
                  type="button"
                  className={styles.marker}
                  style={at(p)}
                  aria-pressed={selected === r.slug}
                  data-dim={dimmed(r.slug) || undefined}
                  data-hidden-place={p.hidden || undefined}
                  data-flip={(x > edge - 190 && x < edge) || undefined}
                  data-covered={x > edge - 8 || undefined}
                  onClick={() => select(r.slug)}
                  onPointerEnter={() => setHovered(r.slug)}
                  onPointerLeave={leave}
                  onFocus={() => setHovered(r.slug)}
                  onBlur={leave}
                >
                  <span className={styles.pin} />
                  <span className={styles.label}>
                    {r.name}
                    <small>{r.champions.length}</small>
                  </span>
                </button>
              );
            })}
          </div>

          {(lines.length > 0 || homeless.length > 0) && (
            <div key={`tags-${source}`} className={styles.tags} data-instant={instant}>
              {lines.map((l) =>
                l.inside ? (
                  l.people ? (
                    l.people.length > 0 && (
                      <span key={l.slug} className={styles.faces} style={px(l.end)} aria-hidden="true">
                        {l.people.map((c) => (
                          <img key={c.id} src={img.icon(c.id)} alt="" title={c.name} width={120} height={120} />
                        ))}
                      </span>
                    )
                  ) : (
                    <span key={l.slug} className={styles.count} style={px(l.mid)} data-off={l.off || undefined} aria-hidden="true">
                      {l.count}
                    </span>
                  )
                ) : (
                  <button
                    key={l.slug}
                    type="button"
                    tabIndex={-1}
                    className={styles.pointer}
                    data-edge={l.edge}
                    data-off={l.off || undefined}
                    style={px(l.end)}
                    aria-label={t.links(l.name, l.count)}
                    onClick={() => select(l.slug)}
                  >
                    <span className={styles.arrow} style={{ rotate: `${l.angle}deg` }}>
                      <Icon name="chevron-right" size={14} strokeWidth={2.5} />
                    </span>
                    {l.name}
                    {l.people ? l.people.map((c) => <img key={c.id} src={img.icon(c.id)} alt="" title={c.name} width={120} height={120} />) : <b>{l.count}</b>}
                  </button>
                ),
              )}
              {homeless.length > 0 && (
                <span className={styles.homeless} aria-hidden="true">
                  {t.unaffiliated}
                  {homeless.map((c) => (
                    <img key={c.id} src={img.icon(c.id)} alt="" title={c.name} width={120} height={120} />
                  ))}
                </span>
              )}
            </div>
          )}

          <div className={styles.tools}>
            {selected && (
              <button type="button" className={styles.tool} onClick={() => select(null)}>
                <Icon name="chevron-left" size={16} />
                {t.fullMap}
              </button>
            )}
            {!tour && (
              <button type="button" className={styles.tool} data-tour="" onClick={startTour}>
                <Icon name="play" size={14} />
                {t.startTour}
              </button>
            )}
          </div>

          {!selected && (
            <p className={styles.hint}>{t.hint}</p>
          )}
        </div>

        {/* на широком экране — поверх карты внизу слева, на узком — под картой */}
        {tour && (
          <div className={styles.tour} role="group" aria-label={t.tourLabel}>
            <div className={styles.tourTop}>
              <p className={styles.tourTitle}>
                <span>{t.tour}</span>
                <b>{nameOf(route[tour.step])}</b>
              </p>
              <span className={`num ${styles.tourCount}`}>
                {tour.step + 1} / {route.length}
              </span>
              <div className={styles.tourButtons}>
                <button type="button" onClick={togglePause} aria-label={tour.paused ? t.resume : t.pause} title={t.space}>
                  <Icon name={tour.paused ? 'play' : 'pause'} size={16} />
                </button>
                <button type="button" onClick={() => goStep(tour.step + 1)} aria-label={t.nextRegion} title={t.rightArrow}>
                  <Icon name="chevron-right" size={18} />
                </button>
                <button type="button" onClick={() => setTour(null)} aria-label={t.endTour} title="Esc">
                  <Icon name="close" size={16} />
                </button>
              </div>
            </div>
            <ol className={styles.tourSteps}>
              {route.map((slug, i) => (
                <li key={slug}>
                  <button
                    type="button"
                    aria-label={nameOf(slug)}
                    title={nameOf(slug)}
                    aria-current={i === tour.step ? 'step' : undefined}
                    data-done={i < tour.step || undefined}
                    onClick={() => goStep(i)}
                  >
                    {i === tour.step && <span ref={barRef} />}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}

        <aside className={styles.panel} aria-live="polite" aria-label={t.region} onPointerEnter={() => setHold(true)} onPointerLeave={() => setHold(false)}>
          {region && (
            <article key={region.slug} className={styles.card}>
              <div className={styles.art}>
                {region.image && <img src={region.image} alt="" width={1920} height={888} />}
                {region.video && (
                  <video
                    className={styles.video}
                    src={region.video}
                    poster={region.image ?? undefined}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="none"
                    onPlaying={(e) => (e.currentTarget.dataset.ready = '')}
                  />
                )}
              </div>
              <div className={styles.body}>
                <h2>{region.name}</h2>
                {region.text[0] && <p className={styles.lead}>{region.text[0]}</p>}
                <div className={styles.actions}>
                  <Link href={`/runeterra/${region.slug}`} className={styles.page}>
                    {t.regionPage}
                    <Icon name="chevron-right" size={16} />
                  </Link>
                  {region.text.length > 1 && !expanded && (
                    <button type="button" className={styles.more} onClick={() => setExpanded(true)}>
                      {t.readStory}
                    </button>
                  )}
                </div>
                {expanded && region.text.slice(1).map((t, i) => <p key={i}>{t}</p>)}
                <Champions
                  title={t.regionChampions}
                  list={people(region.champions)}
                  relations={relations}
                  focus={focusChampion}
                  onFocus={(id) => setFocus(id ? { champion: id } : null)}
                />
                {ties.length > 0 && (
                  <>
                    <h3 className={styles.champsTitle}>{t.ties}</h3>
                    <ul className={styles.ties}>
                      {ties.map((tie) => (
                        <li key={tie.slug}>
                          <button
                            type="button"
                            onClick={() => select(tie.slug)}
                            onPointerEnter={() => setFocus({ region: tie.slug })}
                            onPointerLeave={() => setFocus(null)}
                            onFocus={() => setFocus({ region: tie.slug })}
                            onBlur={() => setFocus(null)}
                          >
                            {nameOf(tie.slug)}
                            <b>{tie.count}</b>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className={styles.tip}>{t.tiesTip}</p>
                  </>
                )}
                <div className={styles.cycle}>
                  {prev && (
                    <button type="button" onClick={() => select(prev.slug)}>
                      <Icon name="chevron-left" size={16} />
                      {prev.name}
                    </button>
                  )}
                  {next && (
                    <button type="button" onClick={() => select(next.slug)}>
                      {next.name}
                      <Icon name="chevron-right" size={16} />
                    </button>
                  )}
                </div>
              </div>
            </article>
          )}
          {selected === UNAFFILIATED && (
            <article className={styles.card}>
              <div className={styles.body}>
                <h2>{t.unaffiliated}</h2>
                <p className={styles.lead}>{t.unaffiliatedLead}</p>
                <Champions title={t.champions} list={people(unaffiliated)} />
              </div>
            </article>
          )}
        </aside>
      </div>
    </div>
  );
}

interface ChampionsProps {
  title: string;
  list: MapChampion[];
  relations?: Record<string, string[]>;
  /** чемпион под курсором: его знакомые подсвечены */
  focus?: string | null;
  onFocus?: (id: string | null) => void;
}

function Champions({ title, list, relations, focus, onFocus }: ChampionsProps) {
  const known = focus && relations ? new Set(relations[focus] ?? []) : null;
  return (
    <>
      <h3 className={styles.champsTitle}>
        {title} <span>{list.length}</span>
      </h3>
      <ul className={styles.champs} data-focus={focus ? '' : undefined}>
        {list.map((c) => {
          const links = relations?.[c.id]?.length ?? 0;
          return (
            <li key={c.id}>
              <Link
                href={championHref(c.slug)}
                data-focus={focus === c.id || undefined}
                data-known={known?.has(c.id) || undefined}
                onPointerEnter={onFocus && (() => onFocus(c.id))}
                onPointerLeave={onFocus && (() => onFocus(null))}
                onFocus={onFocus && (() => onFocus(c.id))}
                onBlur={onFocus && (() => onFocus(null))}
              >
                <span className={styles.face}>
                  <img src={img.icon(c.id)} alt="" width={120} height={120} loading="lazy" />
                  {links > 0 && <b aria-hidden="true">{links}</b>}
                </span>
                <span className={styles.name}>{c.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
