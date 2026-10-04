'use client';

import { useEffect, useRef, useState } from 'react';
import { useMessages } from '@rift/engine/i18n/LocaleProvider';
import { defineMessages } from '@rift/engine/i18n/locale';
import { Icon } from '@/components/Icon';
import type { RegionPage } from '@/lib/regions';
import styles from './RegionGallery.module.css';

const MESSAGES = defineMessages({
  ru: {
    count: (n: number, total: number) => `${n} из ${total}`,
    prev: 'Предыдущий арт',
    next: 'Следующий арт',
    close: 'Закрыть',
  },
  en: {
    count: (n: number, total: number) => `${n} of ${total}`,
    prev: 'Previous art',
    next: 'Next art',
    close: 'Close',
  },
});

type Gallery = RegionPage['galleries'][number];

/** Галерея артов региона: сетка с подписями и просмотр на весь экран, стрелки листают, Esc закрывает. */
export function RegionGallery({ gallery }: { gallery: Gallery }) {
  const t = useMessages(MESSAGES);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<number | null>(null);
  const images = gallery.images;

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open !== null && !d.open) d.showModal();
    if (open === null && d.open) d.close();
  }, [open]);

  const step = (dir: number) => setOpen((i) => (i === null ? i : (i + dir + images.length) % images.length));
  const current = open !== null ? images[open] : null;

  return (
    <section className={styles.gallery} aria-labelledby={`gallery-${gallery.title}`}>
      <h2 id={`gallery-${gallery.title}`}>{gallery.title}</h2>
      <ul className={styles.grid}>
        {images.map((im, i) => (
          <li key={im.uri}>
            <button type="button" onClick={() => setOpen(i)}>
              <img src={im.uri} alt="" loading="lazy" decoding="async" width={im.width ?? 1920} height={im.height ?? 1080} />
              {im.title && <span className={styles.caption}>{im.title}</span>}
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-label={current?.title || gallery.title}
        onClose={() => setOpen(null)}
        onClick={(e) => e.target === dialogRef.current && setOpen(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') step(1);
          if (e.key === 'ArrowLeft') step(-1);
        }}
      >
        {current && (
          <figure className={styles.figure}>
            <img src={current.uri} alt={current.title} />
            <figcaption>
              {current.title && <b>{current.title}</b>}
              {current.description && <span>{current.description}</span>}
              <span className={styles.count}>{t.count(open! + 1, images.length)}</span>
            </figcaption>
            {images.length > 1 && (
              <>
                <button type="button" className={styles.prev} aria-label={t.prev} onClick={() => step(-1)}>
                  <Icon name="chevron-left" size={28} />
                </button>
                <button type="button" className={styles.next} aria-label={t.next} onClick={() => step(1)}>
                  <Icon name="chevron-right" size={28} />
                </button>
              </>
            )}
            <button type="button" className={styles.close} aria-label={t.close} onClick={() => setOpen(null)}>
              <Icon name="close" size={22} />
            </button>
          </figure>
        )}
      </dialog>
    </section>
  );
}
