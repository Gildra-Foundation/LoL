'use client';

import { useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useLocale } from '@rift/engine/i18n/LocaleProvider';
import { defineMessages } from '@rift/engine/i18n/locale';
import { plural } from '@rift/engine/lib/format';
import styles from './SkinGallery.module.css';

const MESSAGES = defineMessages({
  ru: {
    back: 'Листать назад',
    forward: 'Листать вперёд',
    open: (name: string) => `Открыть образ «${name}»`,
    base: 'Базовый',
    standard: 'Обычный',
    legacy: ', наследие',
    chromas: ['цвет', 'цвета', 'цветов'] as [string, string, string],
    viewer: 'Просмотр образа',
    of: 'из',
    prev: 'Предыдущий образ',
    next: 'Следующий образ',
    close: 'Закрыть',
  },
  en: {
    back: 'Scroll back',
    forward: 'Scroll forward',
    open: (name: string) => `Open skin “${name}”`,
    base: 'Base',
    standard: 'Standard',
    legacy: ', legacy',
    chromas: ['chroma', 'chromas', 'chromas'] as [string, string, string],
    viewer: 'Skin viewer',
    of: 'of',
    prev: 'Previous skin',
    next: 'Next skin',
    close: 'Close',
  },
});

export interface SkinData {
  num: number;
  name: string;
  loading: string;
  splash: string;
  rarity: { label: string; color: string } | null;
  legacy: boolean;
  chromas: number;
}

/** Лента образов; по нажатию — полноразмерный сплэш-арт с листанием стрелками. */
export function SkinGallery({ skins }: { skins: SkinData[] }) {
  const locale = useLocale();
  const t = MESSAGES[locale];
  const dialogRef = useRef<HTMLDialogElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const [current, setCurrent] = useState(0);

  const show = (i: number) => setCurrent((i + skins.length) % skins.length);
  const open = (i: number) => {
    show(i);
    dialogRef.current?.showModal();
  };
  const skin = skins[current];

  return (
    <div className={styles.gallery}>
      <div className={styles.controls}>
        <button type="button" aria-label={t.back} onClick={() => trackRef.current?.scrollBy({ left: -trackRef.current.clientWidth * 0.8, behavior: 'smooth' })}>
          <Icon name="chevron-left" />
        </button>
        <button type="button" aria-label={t.forward} onClick={() => trackRef.current?.scrollBy({ left: trackRef.current.clientWidth * 0.8, behavior: 'smooth' })}>
          <Icon name="chevron-right" />
        </button>
      </div>

      <ul ref={trackRef} className={styles.track} role="list">
        {skins.map((s, i) => (
          <li key={s.num}>
            <button
              type="button"
              className={styles.skin}
              style={s.rarity ? ({ '--rarity': s.rarity.color } as React.CSSProperties) : undefined}
              onClick={() => open(i)}
              aria-label={t.open(s.name)}
            >
              <img src={s.loading} alt="" width={308} height={560} loading="lazy" decoding="async" />
              <span className={styles.info}>
                <span className={styles.name}>{s.name}</span>
                <span className={styles.meta}>
                  {s.num === 0 ? t.base : (s.rarity?.label ?? t.standard)}
                  {s.legacy && t.legacy}
                  {s.chromas > 0 && `, ${s.chromas} ${plural(s.chromas, t.chromas, locale)}`}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        className={styles.lightbox}
        aria-label={t.viewer}
        onClick={(e) => e.target === dialogRef.current && dialogRef.current.close()}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') show(current - 1);
          if (e.key === 'ArrowRight') show(current + 1);
        }}
      >
        <figure>
          <img src={skin.splash} alt={skin.name} width={1215} height={717} />
          <figcaption>
            <span className={styles.lbName}>{skin.name}</span>
            <span className={styles.lbCount}>
              <span className="num">{current + 1}</span> {t.of} <span className="num">{skins.length}</span>
            </span>
          </figcaption>
        </figure>
        <button type="button" className={`${styles.lbButton} ${styles.prev}`} onClick={() => show(current - 1)} aria-label={t.prev}>
          <Icon name="chevron-left" size={24} />
        </button>
        <button type="button" className={`${styles.lbButton} ${styles.next}`} onClick={() => show(current + 1)} aria-label={t.next}>
          <Icon name="chevron-right" size={24} />
        </button>
        <button type="button" className={`${styles.lbButton} ${styles.close}`} onClick={() => dialogRef.current?.close()} aria-label={t.close}>
          <Icon name="close" size={22} />
        </button>
      </dialog>
    </div>
  );
}
