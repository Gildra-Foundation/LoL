'use client';
import dynamic from 'next/dynamic';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useLocale, useMessages } from '@rift/engine/i18n/LocaleProvider';
import { defineMessages, localePath } from '@rift/engine/i18n/locale';
import { createJsonLoader } from '@rift/engine/lib/json-loader';
import type { BuildEditorProps } from './BuildEditor';
const Editor = dynamic(() => import('./BuildEditor').then((m) => m.BuildEditor));
const load = createJsonLoader<BuildEditorProps>((v): v is BuildEditorProps => {
  if (!v || typeof v !== 'object') return false;
  const data = v as Partial<BuildEditorProps>;
  return Array.isArray(data.champions) && data.champions.length > 0 && Array.isArray(data.items) &&
    Array.isArray(data.spells) && !!data.runes && Array.isArray(data.runes.trees) && Array.isArray(data.runes.shards);
});
const MESSAGES = defineMessages({
  ru: { loading: 'Загружаем конструктор билдов…', error: 'Не удалось загрузить конструктор. Проверьте соединение.', retry: 'Попробовать снова' },
  en: { loading: 'Loading the build editor…', error: 'The editor could not load. Check your connection.', retry: 'Try again' },
});
export function BuildLoader() {
  const locale = useLocale();
  const t = useMessages(MESSAGES);
  const [data, setData] = useState<BuildEditorProps | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  useEffect(() => {
    let cancelled = false;
    setData(null); setFailed(false);
    load(localePath(locale, '/build-data.json')).then((value) => {
      if (!cancelled) setData(value);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [locale, attempt]);
  const fallback = <p role="status">{t.loading}</p>;
  return <div style={{ minHeight: 720 }}>
    {failed ? <div role="alert"><p>{t.error}</p><button type="button" onClick={retry}>{t.retry}</button></div>
      : data ? <Suspense fallback={fallback}><Editor {...data} /></Suspense> : fallback}
    <noscript>{locale === 'ru' ? 'Для конструктора требуется JavaScript.' : 'The editor requires JavaScript.'}</noscript>
  </div>;
}
