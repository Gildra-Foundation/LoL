'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useLocale } from '@rift/engine/i18n/LocaleProvider';
import { LOCALES, defineMessages, type Locale } from '@rift/engine/i18n/locale';
import { createJsonLoader } from '@rift/engine/lib/json-loader';
import { plural } from '@rift/engine/lib/format';
import { VOICE_GROUPS, VOICE_LABELS, voiceLine, type VoiceGroup } from '@/lib/voice-lines';
import styles from './SkinMedia.module.css';

const ModelViewer = dynamic(() => import('./ModelViewer'), { ssr: false });

const MESSAGES = defineMessages({
  ru: {
    model: '3D-модель',
    modelLead: 'Модель из файлов игры: вращайте мышью или пальцем, колесо — приближение.',
    load: (mb: string) => `Загрузить модель${mb ? ` (${mb} МБ)` : ''}`,
    loading: 'Загружаем модель…',
    error: 'Модель не загрузилась.',
    animations: 'Анимации',
    rotate: 'Модель образа, её можно вращать',
    voice: 'Озвучка',
    voiceLead: (n: number) => `${n} ${plural(n, ['реплика', 'реплики', 'реплик'], 'ru')} из игры.`,
    sharedVoice: 'У этого образа озвучка базового чемпиона.',
    language: 'Язык озвучки',
    line: (n: number) => `Реплика ${n}`,
    play: 'Слушать',
    sec: (n: number) => `${n.toFixed(1).replace('.', ',')} с`,
    chroma: 'Хрома на модели',
    original: 'Исходная',
    anims: { idle: 'Ожидание', run: 'Бег', attack: 'Атака', spell1: 'Q', spell2: 'W', spell3: 'E', spell4: 'R', dance: 'Танец', recall: 'Возвращение', joke: 'Шутка', taunt: 'Насмешка', laugh: 'Смех', death: 'Гибель' } as Record<string, string>,
    langs: { ru: 'Русская', en: 'Английская' } as Record<Locale, string>,
  },
  en: {
    model: '3D model',
    modelLead: 'The model from the game files: drag to rotate, scroll to zoom.',
    load: (mb: string) => `Load model${mb ? ` (${mb} MB)` : ''}`,
    loading: 'Loading the model…',
    error: 'The model could not load.',
    animations: 'Animations',
    rotate: 'Skin model you can rotate',
    voice: 'Voice lines',
    voiceLead: (n: number) => `${n} ${plural(n, ['line', 'lines', 'lines'], 'en')} from the game.`,
    sharedVoice: 'This skin uses the base champion voice.',
    language: 'Voice language',
    line: (n: number) => `Line ${n}`,
    play: 'Play',
    sec: (n: number) => `${n.toFixed(1)} s`,
    chroma: 'Chroma on the model',
    original: 'Original',
    anims: { idle: 'Idle', run: 'Run', attack: 'Attack', spell1: 'Q', spell2: 'W', spell3: 'E', spell4: 'R', dance: 'Dance', recall: 'Recall', joke: 'Joke', taunt: 'Taunt', laugh: 'Laugh', death: 'Death' } as Record<string, string>,
    langs: { ru: 'Russian', en: 'English' } as Record<Locale, string>,
  },
});

interface VoiceLine {
  file: string;
  event?: string;
  duration?: number;
}

/** Запись медиа-конвейера для одного образа (tools/media-pipeline). */
export interface MediaEntry {
  chromas?: Record<string, { image?: string; texture?: string }>;
  model?: { glb: string; animations: string[]; bytes?: number };
  vo?: Partial<Record<Locale, VoiceLine[]>>;
  voFrom?: number;
}

const loadCurrent = createJsonLoader<{ base: string }>((v): v is { base: string } => typeof (v as { base?: unknown })?.base === 'string');
const loadEntry = createJsonLoader<MediaEntry>((v): v is MediaEntry => !!v && typeof v === 'object');

async function mediaOf(id: number) {
  const { base } = await loadCurrent('/media/current.json');
  const entry = await loadEntry(`${base}skins/${id}.json`);
  const voice = !entry.vo && entry.voFrom ? await loadEntry(`${base}skins/${entry.voFrom}.json`).catch(() => null) : null;
  return { base, entry, vo: entry.vo ?? voice?.vo ?? null, shared: Boolean(!entry.vo && entry.voFrom) };
}

/** 3D-модель и озвучка образа. Пока для образа нет файлов медиа-конвейера, блок не показывается. */
export function SkinMedia({
  id,
  chromas,
  championNames = {},
}: {
  id: number;
  chromas: { id: number; name: string; colors: string[] }[];
  /** имена чемпионов по id на языке страницы — для реплик «союзник: Орн» */
  championNames?: Record<string, string>;
}) {
  const locale = useLocale();
  const t = MESSAGES[locale];
  const [media, setMedia] = useState<Awaited<ReturnType<typeof mediaOf>> | null>(null);
  const [show3d, setShow3d] = useState(false);
  const [chroma, setChroma] = useState<number | null>(null);
  const [lang, setLang] = useState<Locale>(locale);
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    mediaOf(id)
      .then((m) => !cancelled && setMedia(m))
      .catch(() => undefined);
    return () => {
      cancelled = true;
      audio.current?.pause();
    };
  }, [id]);

  if (!media || (!media.entry.model && !media.vo)) return null;
  const { base, entry } = media;
  const lines = media.vo?.[lang] ?? [];
  const langs = LOCALES.filter((l) => media.vo?.[l]?.length);
  const textured = chromas.filter((c) => entry.chromas?.[c.id]?.texture);

  // реплики по группам в порядке VOICE_GROUPS: передвижение, атака, убийства…
  const byGroup = new Map<VoiceGroup, { line: VoiceLine; detail: string }[]>();
  for (const line of lines) {
    const { group, detail } = voiceLine(line.event, locale, championNames);
    byGroup.set(group, [...(byGroup.get(group) ?? []), { line, detail }]);
  }
  const groups = VOICE_GROUPS.filter((g) => byGroup.has(g)).map((g) => [g, byGroup.get(g)!] as const);

  const play = (file: string) => {
    audio.current?.pause();
    if (playing === file) return setPlaying(null);
    const el = new Audio(base + file);
    el.onended = () => setPlaying(null);
    audio.current = el;
    setPlaying(file);
    el.play().catch(() => setPlaying(null));
  };

  return (
    <div className={styles.media}>
      {entry.model && (
        <section className={styles.section}>
          <h2 className={styles.h3}>{t.model}</h2>
          <p className={styles.lead}>{t.modelLead}</p>
          {show3d ? (
            <ModelViewer
              url={base + entry.model.glb}
              animations={entry.model.animations}
              animationLabel={(name) => t.anims[name.toLowerCase()] ?? name}
              base={base}
              chroma={chroma === null ? null : String(chroma)}
              labels={{ loading: t.loading, error: t.error, animations: t.animations, rotate: t.rotate }}
            />
          ) : (
            <button type="button" className={styles.load} onClick={() => setShow3d(true)}>
              <Icon name="play" size={16} /> {t.load(entry.model.bytes ? (entry.model.bytes / 1048576).toFixed(1) : '')}
            </button>
          )}
          {show3d && textured.length > 0 && (
            <div className={styles.chromas} role="group" aria-label={t.chroma}>
              <button type="button" aria-pressed={chroma === null} onClick={() => setChroma(null)}>
                {t.original}
              </button>
              {textured.map((c) => (
                <button key={c.id} type="button" aria-pressed={chroma === c.id} onClick={() => setChroma(c.id)} title={c.name}>
                  <span className={styles.swatch} style={{ background: c.colors[0] ?? 'var(--ash-2)' }} />
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {media.vo && langs.length > 0 && (
        <section className={styles.section}>
          <div className={styles.head}>
            <h2 className={styles.h3}>{t.voice}</h2>
            {langs.length > 1 && (
              <div className={styles.langs} role="group" aria-label={t.language}>
                {langs.map((l) => (
                  <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>
                    {t.langs[l]}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className={styles.lead}>{media.shared ? t.sharedVoice : t.voiceLead(lines.length)}</p>
          {groups.map(([group, items]) => (
            <details key={group} className={styles.group} open={group === groups[0][0]}>
              <summary>
                {VOICE_LABELS[locale][group]} <span className="num">{items.length}</span>
              </summary>
              <ol className={styles.lines}>
                {items.map(({ line, detail }, i) => {
                  const label = detail ? detail[0].toUpperCase() + detail.slice(1) : t.line(i + 1);
                  return (
                    <li key={line.file}>
                      <button type="button" aria-pressed={playing === line.file} onClick={() => play(line.file)} aria-label={`${t.play}: ${VOICE_LABELS[locale][group]}, ${label}`}>
                        <Icon name={playing === line.file ? 'pause' : 'play'} size={14} />
                        <span>{label}</span>
                        {line.duration ? <span className="num">{t.sec(line.duration)}</span> : null}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
