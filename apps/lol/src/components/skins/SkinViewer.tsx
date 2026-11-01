'use client';

import { useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useLocale } from '@rift/engine/i18n/LocaleProvider';
import { defineMessages } from '@rift/engine/i18n/locale';
import { cdAsset } from '@/lib/skin-assets';
import styles from './SkinViewer.module.css';

const MESSAGES = defineMessages({
  ru: {
    views: { splash: 'Сплэш-арт', uncentered: 'Полный арт', loading: 'Загрузка', vintage: 'Винтаж' } as Record<View, string>,
    view: 'Что показать',
    chromas: 'Хромы',
    original: 'Исходный цвет',
    fullscreen: 'Открыть во весь экран',
    close: 'Закрыть',
  },
  en: {
    views: { splash: 'Splash art', uncentered: 'Full art', loading: 'Loading screen', vintage: 'Vintage' } as Record<View, string>,
    view: 'View',
    chromas: 'Chromas',
    original: 'Original colors',
    fullscreen: 'Open full screen',
    close: 'Close',
  },
});

type View = 'splash' | 'uncentered' | 'loading' | 'vintage';

export interface SkinViewerProps {
  name: string;
  images: Partial<Record<View, string | null>>;
  chromas: { id: number; name: string; colors: string[]; image: string | null }[];
  animated: string | null;
}

/** Арты образа: сплэш, полный арт, экран загрузки, винтаж; хромы показывают свою раскраску модели. */
export function SkinViewer({ name, images, chromas, animated }: SkinViewerProps) {
  const t = MESSAGES[useLocale()];
  const views = (['splash', 'uncentered', 'loading', 'vintage'] as const).filter((v) => images[v]);
  const [view, setView] = useState<View>(views[0] ?? 'splash');
  const [chroma, setChroma] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const current = chromas.find((c) => c.id === chroma);
  const src = current?.image ? cdAsset(current.image) : images[view] ? cdAsset(images[view]!) : null;
  const portrait = !current && (view === 'loading' || view === 'vintage');
  const video = !current && view === 'splash' && animated ? cdAsset(animated) : null;

  return (
    <div className={styles.viewer}>
      <div className={styles.stage} data-portrait={portrait} data-chroma={Boolean(current)}>
        {video ? (
          <video key={video} src={video} poster={src ?? undefined} autoPlay muted loop playsInline aria-label={name} />
        ) : (
          src && <img key={src} src={src} alt={current ? `${name}: ${current.name}` : name} />
        )}
        {src && (
          <button type="button" className={styles.zoom} aria-label={t.fullscreen} onClick={() => dialog.current?.showModal()}>
            <Icon name="grid" size={18} />
          </button>
        )}
      </div>

      <div className={styles.controls}>
        {views.length > 1 && (
          <div className={styles.tabs} role="group" aria-label={t.view}>
            {views.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={!current && view === v}
                onClick={() => {
                  setView(v);
                  setChroma(null);
                }}
              >
                {t.views[v]}
              </button>
            ))}
          </div>
        )}
        {chromas.length > 0 && (
          <div className={styles.chromas} role="group" aria-label={t.chromas}>
            <span className={styles.label}>{t.chromas}</span>
            <button type="button" className={styles.swatch} aria-pressed={!current} title={t.original} aria-label={t.original} onClick={() => setChroma(null)}>
              <span style={{ background: 'linear-gradient(135deg, var(--bone) 50%, var(--ash-2) 50%)' }} />
            </button>
            {chromas.map((c) => (
              <button
                key={c.id}
                type="button"
                className={styles.swatch}
                aria-pressed={chroma === c.id}
                title={c.name}
                aria-label={c.name}
                onClick={() => setChroma(c.id)}
              >
                <span style={{ background: swatch(c.colors) }} />
              </button>
            ))}
            {current && <span className={styles.chromaName}>{current.name}</span>}
          </div>
        )}
      </div>

      <dialog ref={dialog} className={styles.lightbox} aria-label={name} onClick={(e) => e.target === dialog.current && dialog.current.close()}>
        {src && <img src={src} alt={name} />}
        <button type="button" className={styles.close} aria-label={t.close} onClick={() => dialog.current?.close()}>
          <Icon name="close" size={22} />
        </button>
      </dialog>
    </div>
  );
}

const swatch = (colors: string[]) =>
  colors.length > 1 ? `linear-gradient(135deg, ${colors[0]} 50%, ${colors[1]} 50%)` : (colors[0] ?? 'var(--ash-2)');
