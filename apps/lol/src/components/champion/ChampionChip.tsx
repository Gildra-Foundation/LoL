'use client';

import Link from '@rift/engine/i18n/Link';
import { useLocale } from '@rift/engine/i18n/LocaleProvider';
import { championHref, img } from '@/lib/assets';
import { CLASSES, type ClassTag } from '@/lib/labels';
import styles from './ChampionChip.module.css';

interface ChampionChipProps {
  id: string;
  slug: string;
  name: string;
  tags: ClassTag[];
  note?: string;
}

/** Компактная ссылка на чемпиона: портрет, имя, классы. */
export function ChampionChip({ id, slug, name, tags, note }: ChampionChipProps) {
  const locale = useLocale();
  return (
    <Link href={championHref(slug)} className={styles.chip}>
      <img src={img.icon(id)} alt="" width={48} height={48} loading="lazy" decoding="async" />
      <span className={styles.text}>
        <span className={styles.name}>{name}</span>
        <span className={styles.note}>{note ?? tags.map((t) => CLASSES[locale][t].label).join(', ')}</span>
      </span>
    </Link>
  );
}
