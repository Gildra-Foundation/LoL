'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useLocale, useMessages } from '@rift/engine/i18n/LocaleProvider';
import { defineMessages, type Locale } from '@rift/engine/i18n/locale';
import { Keycap } from '@rift/engine/ui/Keycap';
import { fmt } from '@/lib/stats';
import { AbilitySlot } from './AbilitySlot';
import { useChampion, type AbilityKey } from './ChampionProvider';
import styles from './AbilitiesSection.module.css';

const MESSAGES = defineMessages({
  ru: {
    kind: {
      P: 'Пассивное умение',
      Q: 'Умение Q',
      W: 'Умение W',
      E: 'Умение E',
      R: 'Абсолютное умение',
    } as Record<AbilityKey, string>,
    pause: 'Пауза',
    play: 'Смотреть видео умения',
    title: 'Умения',
    pickBefore: 'Выберите ячейку или нажмите',
    pickAfter: 'на клавиатуре.',
    video: (name: string) => `Видео: ${name}`,
    noVideo: 'Видео для этого умения Riot пока не опубликовала',
    cooldown: 'Перезарядка, с',
    none: 'нет',
    byRank: 'По рангам',
    cost: 'Стоимость',
    range: 'Дальность',
    ranks: 'Рангов',
  },
  en: {
    kind: {
      P: 'Passive',
      Q: 'Q ability',
      W: 'W ability',
      E: 'E ability',
      R: 'Ultimate',
    } as Record<AbilityKey, string>,
    pause: 'Pause',
    play: 'Watch ability video',
    title: 'Abilities',
    pickBefore: 'Pick a slot or press',
    pickAfter: 'on your keyboard.',
    video: (name: string) => `Video: ${name}`,
    noVideo: "Riot hasn't published a video for this ability yet",
    cooldown: 'Cooldown, s',
    none: 'none',
    byRank: 'By rank',
    cost: 'Cost',
    range: 'Range',
    ranks: 'Ranks',
  },
});

export interface AbilityFull {
  key: AbilityKey;
  name: string;
  icon: string;
  description: string;
  video: { webm: string; mp4: string; poster: string } | null;
  /** перезарядка по рангам, секунды */
  cooldown: number[];
  costText: string;
  rangeText: string;
  maxrank: number;
}

const fmtSec = (v: number, locale: Locale) => fmt(v, Number.isInteger(v) ? 0 : 1, locale);

function AbilityVideo({ video, label }: { video: NonNullable<AbilityFull['video']>; label: string }) {
  const t = useMessages(MESSAGES);
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  // видео играет, только пока раздел на экране и пользователь не просил меньше движения
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) el.play().then(() => setPlaying(true), () => setPlaying(false));
        else {
          el.pause();
          setPlaying(false);
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [video.webm]);

  if (failed) return null;

  return (
    <div className={styles.video}>
      <video
        ref={ref}
        muted
        loop
        playsInline
        preload="none"
        poster={video.poster}
        width={1280}
        height={720}
        aria-label={label}
        onError={() => setFailed(true)}
      >
        <source src={video.webm} type="video/webm" />
        <source src={video.mp4} type="video/mp4" onError={() => setFailed(true)} />
      </video>
      <button
        type="button"
        className={styles.play}
        data-playing={playing}
        aria-label={playing ? t.pause : t.play}
        onClick={() => {
          const el = ref.current!;
          if (el.paused) el.play().then(() => setPlaying(true));
          else {
            el.pause();
            setPlaying(false);
          }
        }}
      >
        <Icon name={playing ? 'pause' : 'play'} size={22} />
      </button>
    </div>
  );
}

/** Умения: ячейки P Q W E R, видео-демонстрация и перезарядка по рангам. */
export function AbilitiesSection({ abilities }: { abilities: AbilityFull[] }) {
  const locale = useLocale();
  const t = MESSAGES[locale];
  const { ability } = useChampion();
  const current = abilities.find((a) => a.key === ability) ?? abilities[0];
  const uniformCooldown = new Set(current.cooldown).size <= 1;

  return (
    <div className={styles.section}>
      <div className={styles.head}>
        <h2>{t.title}</h2>
        <p>
          {t.pickBefore} <Keycap size="sm">P</Keycap> <Keycap size="sm">Q</Keycap> <Keycap size="sm">W</Keycap>{' '}
          <Keycap size="sm">E</Keycap> <Keycap size="sm">R</Keycap> {t.pickAfter}
        </p>
      </div>

      <div className={styles.slots} role="group" aria-label={t.title}>
        {abilities.map((a) => (
          <AbilitySlot key={a.key} ability={a} size="lg" showName />
        ))}
      </div>

      <div className={styles.panel} aria-live="polite">
        {current.video ? (
          <AbilityVideo key={current.key} video={current.video} label={t.video(current.name)} />
        ) : (
          <div className={styles.noVideo}>
            <img src={current.icon} alt="" width={96} height={96} />
            <span>{t.noVideo}</span>
          </div>
        )}

        <div className={styles.text}>
          <p className={styles.kind}>{t.kind[current.key]}</p>
          <h3>{current.name}</h3>
          <p className={styles.description}>{current.description}</p>

          {current.key !== 'P' && (
            <dl className={styles.meta}>
              <div className={styles.cooldown}>
                <dt>{t.cooldown}</dt>
                <dd>
                  {current.cooldown.every((v) => v === 0) ? (
                    t.none
                  ) : uniformCooldown ? (
                    <span className="num">{fmtSec(current.cooldown[0], locale)}</span>
                  ) : (
                    <ol className={styles.ranks} aria-label={t.byRank}>
                      {current.cooldown.map((v, n) => (
                        <li key={n}>
                          <span className={styles.rankNo}>{n + 1}</span>
                          <span className="num">{fmtSec(v, locale)}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </dd>
              </div>
              <div>
                <dt>{t.cost}</dt>
                <dd>{current.costText}</dd>
              </div>
              <div>
                <dt>{t.range}</dt>
                <dd>{current.rangeText}</dd>
              </div>
              <div>
                <dt>{t.ranks}</dt>
                <dd className="num">{current.maxrank}</dd>
              </div>
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}
