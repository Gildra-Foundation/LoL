'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from '@rift/engine/i18n/Link';
import { useLocale, useMessages } from '@rift/engine/i18n/LocaleProvider';
import { localePath } from '@rift/engine/i18n/locale';
import { createJsonLoader } from '@rift/engine/lib/json-loader';
import { useAccount } from '@/components/account/AccountProvider';
import { AuthForm } from '@/components/account/AuthForm';
import { FAVORITE_KINDS, type Favorite, type FavoriteKind } from '@/lib/account/shared';
import { defineMessages, type Locale } from '@/lib/i18n';
import { FavoriteButton } from './FavoriteButton';
import styles from './Favorites.module.css';

/** Запись облегчённого списка образов (/[lang]/skins-index.json, собирается вместе с каталогом). */
export interface SkinIndexEntry {
  id: number | string;
  slug: string;
  name: string;
  champion: string;
  tile: string;
  rarity?: string | null;
}

const MESSAGES = defineMessages({
  ru: {
    groups: { skin: 'Образы', skinline: 'Наборы', universe: 'Тематики', champion: 'Чемпионы' } as Record<FavoriteKind, string>,
    all: 'Всё',
    filter: 'Что показать',
    empty: 'В избранном пока ничего нет. Нажмите ♡ на странице образа, набора или чемпиона.',
    toSkins: 'Открыть образы',
    signIn: 'Избранное хранится в аккаунте. Войдите или зарегистрируйтесь.',
    loading: 'Загружаю избранное…',
    skinPending: (id: string) => `Образ ${id}`,
    added: 'Добавлено',
  },
  en: {
    groups: { skin: 'Skins', skinline: 'Skin lines', universe: 'Universes', champion: 'Champions' } as Record<FavoriteKind, string>,
    all: 'All',
    filter: 'Show',
    empty: 'Nothing here yet. Press ♡ on a skin, skin line or champion page.',
    toSkins: 'Browse skins',
    signIn: 'Favorites live in your account. Sign in or create one.',
    loading: 'Loading favorites…',
    skinPending: (id: string) => `Skin ${id}`,
    added: 'Added',
  },
});

// одна загрузка списка образов на язык; до появления каталога файла нет — тогда показываем id
const isSkinIndex = (value: unknown): value is SkinIndexEntry[] =>
  Array.isArray(value) && value.every((e) => e && typeof e === 'object' && 'id' in e && typeof e.slug === 'string' && typeof e.name === 'string');
const loadSkinIndex = createJsonLoader(isSkinIndex);
const skinIndexUrl = (locale: Locale) => localePath(locale, '/skins-index.json');

const humanize = (slug: string) => slug.replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

const PATH: Record<Exclude<FavoriteKind, 'skin'>, (ref: string) => string> = {
  skinline: (ref) => `/skins/lines/${ref}`,
  universe: (ref) => `/skins/universes/${ref}`,
  champion: (ref) => `/champions/${ref}`,
};

export function FavoritesView() {
  const t = useMessages(MESSAGES);
  const locale = useLocale();
  const { status, favorites, reloadFavorites } = useAccount();
  const [skins, setSkins] = useState<Map<string, SkinIndexEntry> | null>(null);
  const [filter, setFilter] = useState<FavoriteKind | 'all'>('all');

  const list = useMemo(() => (favorites ? [...favorites.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : null), [favorites]);
  const hasSkins = list?.some((f) => f.kind === 'skin') ?? false;

  useEffect(() => {
    if (status === 'user') void reloadFavorites();
  }, [status, reloadFavorites]);

  useEffect(() => {
    if (!hasSkins || skins) return;
    loadSkinIndex(skinIndexUrl(locale))
      .then((entries) => setSkins(new Map(entries.map((e) => [String(e.id), e]))))
      .catch(() => setSkins(new Map()));
  }, [hasSkins, skins, locale]);

  if (status === 'loading' || (status === 'user' && !list)) return <p role="status">{t.loading}</p>;
  if (status !== 'user') {
    return (
      <div className={styles.signIn}>
        <p>{t.signIn}</p>
        <AuthForm initialMode="sign-in" />
      </div>
    );
  }
  if (!list?.length) {
    return (
      <div className={styles.empty}>
        <p>{t.empty}</p>
        <Link href="/skins">{t.toSkins}</Link>
      </div>
    );
  }

  const counts = Object.fromEntries(FAVORITE_KINDS.map((k) => [k, list.filter((f) => f.kind === k).length])) as Record<FavoriteKind, number>;
  const kinds = FAVORITE_KINDS.filter((k) => counts[k] > 0 && (filter === 'all' || filter === k));

  return (
    <div className={styles.view}>
      <div className={styles.filters} role="group" aria-label={t.filter}>
        <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          {t.all} <span>{list.length}</span>
        </button>
        {FAVORITE_KINDS.filter((k) => counts[k] > 0).map((k) => (
          <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {t.groups[k]} <span>{counts[k]}</span>
          </button>
        ))}
      </div>

      {kinds.map((kind) => (
        <section key={kind} aria-labelledby={`fav-${kind}`} className={styles.group}>
          <h2 id={`fav-${kind}`}>{t.groups[kind]}</h2>
          <ul className={kind === 'skin' ? styles.tiles : styles.rows}>
            {list
              .filter((f) => f.kind === kind)
              .map((f) => (kind === 'skin' ? <SkinTile key={f.ref} favorite={f} entry={skins?.get(f.ref)} /> : <Row key={f.ref} favorite={f} />))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function SkinTile({ favorite, entry }: { favorite: Favorite; entry: SkinIndexEntry | undefined }) {
  const t = useMessages(MESSAGES);
  return (
    <li className={styles.tile} data-rarity={entry?.rarity ?? undefined}>
      {entry ? (
        <Link href={`/skins/${entry.slug}`} className={styles.tileLink}>
          <img src={entry.tile} alt="" loading="lazy" decoding="async" width={280} height={280} />
          <span className={styles.tileName}>{entry.name}</span>
          <span className={styles.tileSub}>{entry.champion}</span>
        </Link>
      ) : (
        <div className={styles.tileLink}>
          <span className={styles.tilePlaceholder} aria-hidden="true" />
          <span className={styles.tileName}>{t.skinPending(favorite.ref)}</span>
        </div>
      )}
      <FavoriteButton kind="skin" id={favorite.ref} compact className={styles.tileButton} />
    </li>
  );
}

function Row({ favorite }: { favorite: Favorite }) {
  const kind = favorite.kind as Exclude<FavoriteKind, 'skin'>;
  return (
    <li className={styles.row}>
      <Link href={PATH[kind](favorite.ref)}>{humanize(favorite.ref)}</Link>
      <FavoriteButton kind={kind} id={favorite.ref} compact />
    </li>
  );
}
