'use client';

import { useState } from 'react';
import { useMessages } from '@rift/engine/i18n/LocaleProvider';
import { defineMessages } from '@rift/engine/i18n/locale';
import { img } from '@/lib/assets';
import { pickSecondary, type Build } from '@/lib/build';
import { TREE_COLORS, type RuneTree, type RunesData } from '@/lib/runes';
import styles from './RunePage.module.css';

const MESSAGES = defineMessages({
  ru: {
    primary: 'Основное дерево',
    secondary: 'Дополнительное дерево',
    keystone: 'Ключевая руна',
    row: (n: number) => `Ряд ${n}`,
    primaryEmpty: 'Выберите дерево: от него зависит ключевая руна — главный эффект страницы.',
    secondaryEmpty: 'Две руны из другого дерева, обязательно из разных рядов.',
    shards: 'Осколки',
    infoEmpty: 'Наведите на руну — здесь появится её описание.',
  },
  en: {
    primary: 'Primary path',
    secondary: 'Secondary path',
    keystone: 'Keystone',
    row: (n: number) => `Row ${n}`,
    primaryEmpty: 'Pick a path: it decides the keystone, the main effect of the page.',
    secondaryEmpty: 'Two runes from another path, each from a different row.',
    shards: 'Shards',
    infoEmpty: 'Hover over a rune to see its description here.',
  },
});

interface RunePageProps {
  runes: RunesData;
  build: Build;
  onChange: (patch: Partial<Build> | ((b: Build) => Partial<Build>)) => void;
}

type Info = { name: string; html: string; color: string };

const treeStyle = (tree?: RuneTree) => ({ '--tree': tree ? TREE_COLORS[tree.key] : 'var(--line-2)' }) as React.CSSProperties;

/** Страница рун как в клиенте: основное дерево с ключевой руной, дополнительное — две руны из разных рядов, осколки. */
export function RunePage({ runes, build, onChange }: RunePageProps) {
  const t = useMessages(MESSAGES);
  const [info, setInfo] = useState<Info | null>(null);
  const primary = runes.trees.find((t) => t.id === build.primary);
  const secondary = runes.trees.find((t) => t.id === build.secondary);

  const choosePrimary = (tree: RuneTree) =>
    onChange((b) =>
      b.primary === tree.id
        ? {}
        : {
            primary: tree.id,
            runes: [null, null, null, null],
            // дерево не может быть одновременно основным и дополнительным
            ...(b.secondary === tree.id ? { secondary: null, secondaryRunes: [null, null] } : {}),
          },
    );

  const show = (name: string, html: string, tree?: RuneTree) => setInfo({ name, html, color: tree ? TREE_COLORS[tree.key] : 'var(--bone)' });

  const runeButton = (tree: RuneTree, rune: RuneTree['slots'][number][number], selected: boolean, onPick: () => void, big = false) => (
    <button
      key={rune.id}
      type="button"
      className={big ? styles.keystone : styles.rune}
      aria-pressed={selected}
      aria-label={rune.name}
      title={rune.name}
      onClick={() => {
        onPick();
        show(rune.name, rune.html, tree);
      }}
      onPointerEnter={() => show(rune.name, rune.html, tree)}
      onFocus={() => show(rune.name, rune.html, tree)}
    >
      <img src={img.rune(rune.icon)} alt="" width={64} height={64} loading="lazy" />
    </button>
  );

  return (
    <div className={styles.page}>
      <div className={styles.column} style={treeStyle(primary)}>
        <p className={styles.label}>{t.primary}</p>
        <div className={styles.trees} role="group" aria-label={t.primary}>
          {runes.trees.map((t) => (
            <button key={t.id} type="button" aria-pressed={t.id === build.primary} title={t.name} style={treeStyle(t)} onClick={() => choosePrimary(t)}>
              <img src={img.rune(t.icon)} alt="" width={32} height={32} />
              <span className="sr-only">{t.name}</span>
            </button>
          ))}
        </div>
        {primary ? (
          <>
            <p className={styles.treeName}>{primary.name}</p>
            {primary.slots.map((row, ri) => (
              <div key={ri} className={ri === 0 ? styles.keystones : styles.row} role="group" aria-label={ri === 0 ? t.keystone : t.row(ri)}>
                {row.map((r) =>
                  runeButton(primary, r, build.runes[ri] === r.id, () => onChange((b) => ({ runes: b.runes.map((x, i) => (i === ri ? r.id : x)) })), ri === 0),
                )}
              </div>
            ))}
          </>
        ) : (
          <p className={styles.empty}>{t.primaryEmpty}</p>
        )}
      </div>

      <div className={styles.column} style={treeStyle(secondary)}>
        <p className={styles.label}>{t.secondary}</p>
        <div className={styles.trees} role="group" aria-label={t.secondary}>
          {runes.trees
            .filter((t) => t.id !== build.primary)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={t.id === build.secondary}
                title={t.name}
                style={treeStyle(t)}
                onClick={() => onChange((b) => (b.secondary === t.id ? {} : { secondary: t.id, secondaryRunes: [null, null] }))}
              >
                <img src={img.rune(t.icon)} alt="" width={32} height={32} />
                <span className="sr-only">{t.name}</span>
              </button>
            ))}
        </div>
        {secondary ? (
          <>
            <p className={styles.treeName}>{secondary.name}</p>
            {secondary.slots.slice(1).map((row, ri) => (
              <div key={ri} className={styles.row} role="group" aria-label={t.row(ri + 1)}>
                {row.map((r) =>
                  runeButton(secondary, r, build.secondaryRunes.includes(r.id), () => onChange((b) => ({ secondaryRunes: pickSecondary(b.secondaryRunes, secondary, r.id) }))),
                )}
              </div>
            ))}
          </>
        ) : (
          <p className={styles.empty}>{t.secondaryEmpty}</p>
        )}

        <p className={styles.label}>{t.shards}</p>
        {runes.shards.map((row, ri) => (
          <div key={row.label} className={styles.shards} role="group" aria-label={row.label}>
            {row.perks.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={build.shards[ri] === p.id}
                aria-label={`${row.label}: ${p.name}`}
                title={p.name}
                onClick={() => {
                  onChange((b) => ({ shards: b.shards.map((x, i) => (i === ri ? p.id : x)) }));
                  show(p.name, p.html);
                }}
                onPointerEnter={() => show(p.name, p.html)}
                onFocus={() => show(p.name, p.html)}
              >
                <img src={p.icon} alt="" width={32} height={32} loading="lazy" />
              </button>
            ))}
            <span className={styles.shardLabel}>{row.label}</span>
          </div>
        ))}
      </div>

      <div className={styles.info} aria-live="polite" style={{ '--tree': info?.color } as React.CSSProperties}>
        {info ? (
          <>
            <p className={styles.infoName}>{info.name}</p>
            <div className={styles.infoText} dangerouslySetInnerHTML={{ __html: info.html }} />
          </>
        ) : (
          <p className={styles.infoEmpty}>{t.infoEmpty}</p>
        )}
      </div>
    </div>
  );
}
