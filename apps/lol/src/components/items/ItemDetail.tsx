import { useLocale, useMessages } from '@rift/engine/i18n/LocaleProvider';
import { defineMessages } from '@rift/engine/i18n/locale';
import { Icon } from '@/components/Icon';
import { img } from '@/lib/assets';
import { CATEGORY_LABEL, fmtGold, fmtItemStat, ITEM_STATS, type Item, type ItemStat } from '@/lib/items';
import styles from './ItemDetail.module.css';

const MESSAGES = defineMessages({
  ru: { price: 'Цена', recipe: 'Доплата за рецепт', sell: 'Продажа', from: 'Собирается из', into: 'Улучшается в' },
  en: { price: 'Cost', recipe: 'Recipe cost', sell: 'Sell', from: 'Builds from', into: 'Builds into' },
});

interface ItemDetailProps {
  item: Item;
  byId: Map<string, Item>;
  /** переход к компоненту или улучшению */
  onSelect?: (id: string) => void;
  /** компактный вид — для подсказки в конструкторе */
  compact?: boolean;
}

/** Карточка предмета: цена, характеристики, эффекты, рецепт и улучшения. */
export function ItemDetail({ item, byId, onSelect, compact = false }: ItemDetailProps) {
  const t = useMessages(MESSAGES);
  const locale = useLocale();
  const stats = Object.entries(item.stats) as [ItemStat, number][];
  return (
    <div className={[styles.detail, compact && styles.compact].filter(Boolean).join(' ')}>
      <div className={styles.head}>
        <img src={img.item(item.id)} alt="" width={64} height={64} />
        <div>
          <p className={styles.category}>{CATEGORY_LABEL[locale][item.category]}</p>
          <h2 className={styles.name}>{item.name}</h2>
          {item.plaintext && <p className={styles.plain}>{item.plaintext}</p>}
        </div>
      </div>

      <dl className={styles.prices}>
        <div>
          <dt>{t.price}</dt>
          <dd className="num">{fmtGold(item.gold.total, locale)}</dd>
        </div>
        {item.from.length > 0 && (
          <div>
            <dt>{t.recipe}</dt>
            <dd className="num">{fmtGold(item.gold.base, locale)}</dd>
          </div>
        )}
        <div>
          <dt>{t.sell}</dt>
          <dd className="num">{fmtGold(item.gold.sell, locale)}</dd>
        </div>
      </dl>

      {stats.length > 0 && (
        <ul className={styles.stats}>
          {stats.map(([k, v]) => (
            <li key={k} style={{ '--c': ITEM_STATS[locale][k].color } as React.CSSProperties}>
              <Icon name={ITEM_STATS[locale][k].icon} size={16} />
              <span>{ITEM_STATS[locale][k].label}</span>
              <b className="num">{fmtItemStat(k, v, locale)}</b>
            </li>
          ))}
        </ul>
      )}

      {item.html && <div className={styles.effects} dangerouslySetInnerHTML={{ __html: item.html }} />}

      {!compact && item.from.length > 0 && (
        <section className={styles.section}>
          <h3>{t.from}</h3>
          <Recipe ids={item.from} byId={byId} onSelect={onSelect} depth={0} />
        </section>
      )}

      {!compact && item.into.length > 0 && (
        <section className={styles.section}>
          <h3>{t.into}</h3>
          <ul className={styles.into}>
            {item.into.map((id) => {
              const next = byId.get(id);
              if (!next) return null;
              return (
                <li key={id}>
                  <button type="button" title={next.name} onClick={() => onSelect?.(id)}>
                    <img src={img.item(id)} alt="" width={64} height={64} loading="lazy" />
                    <span className="sr-only">{next.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Рецепт деревом: компоненты и их компоненты. */
function Recipe({ ids, byId, onSelect, depth }: { ids: string[]; byId: Map<string, Item>; onSelect?: (id: string) => void; depth: number }) {
  const locale = useLocale();
  return (
    <ul className={styles.recipe}>
      {ids.map((id, i) => {
        const part = byId.get(id);
        if (!part) return null;
        return (
          <li key={`${id}-${i}`}>
            <button type="button" onClick={() => onSelect?.(id)}>
              <img src={img.item(id)} alt="" width={64} height={64} loading="lazy" />
              <span>{part.name}</span>
              <span className={`num ${styles.gold}`}>{fmtGold(part.gold.total, locale)}</span>
            </button>
            {depth < 1 && part.from.length > 0 && <Recipe ids={part.from} byId={byId} onSelect={onSelect} depth={depth + 1} />}
          </li>
        );
      })}
    </ul>
  );
}
