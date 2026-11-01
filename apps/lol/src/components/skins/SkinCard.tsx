import Link from '@rift/engine/i18n/Link';
import type { Locale } from '@rift/engine/i18n/locale';
import { RARITIES } from '@/lib/labels';
import { cdAsset, skinHref } from '@/lib/skin-assets';
import type { SkinLite } from '@/lib/skins';
import styles from './SkinCatalog.module.css';

export type SkinCardData = Pick<SkinLite, 'id' | 'slug' | 'name' | 'championName' | 'rarity' | 'loading' | 'cost' | 'chromas'>;

/** Карточка образа: загрузочный экран, название, чемпион, редкость, цена и число хром. Без состояния — годится и для сервера. */
export function SkinCard({ skin, lang }: { skin: SkinCardData; lang: Locale }) {
  const rarity = skin.rarity ? RARITIES[lang][skin.rarity] : null;
  return (
    <Link href={skinHref(skin.slug)} className={styles.card} style={rarity ? ({ '--rarity': rarity.color } as React.CSSProperties) : undefined}>
      <span className={styles.art}>
        {skin.loading && <img src={cdAsset(skin.loading)} alt="" width={308} height={560} loading="lazy" decoding="async" />}
      </span>
      <span className={styles.plate}>
        <span className={styles.name}>{skin.name}</span>
        <span className={styles.meta}>
          <span>{skin.championName}</span>
          {rarity && <span className={styles.rarity}>{rarity.label}</span>}
        </span>
        {(skin.cost || skin.chromas > 0) && (
          <span className={styles.facts}>
            <span className="num">{skin.cost ? `${skin.cost} RP` : ''}</span>
            {skin.chromas > 0 && (
              <span className={styles.dots} title={String(skin.chromas)}>
                {'●'.repeat(Math.min(skin.chromas, 5))}
              </span>
            )}
          </span>
        )}
      </span>
    </Link>
  );
}

/** Сетка карточек образов. */
export function SkinGrid({ skins, lang }: { skins: SkinCardData[]; lang: Locale }) {
  return (
    <ul className={styles.grid} role="list">
      {skins.map((s) => (
        <li key={s.id}>
          <SkinCard skin={s} lang={lang} />
        </li>
      ))}
    </ul>
  );
}
