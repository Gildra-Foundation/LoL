'use client';
import { useEffect } from 'react';
import { useLocale } from '@rift/engine/i18n/LocaleProvider';
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const lang = useLocale();
  useEffect(() => {
    console.error('RiftDen page error', error.digest ?? 'client');
    if (navigator.doNotTrack !== '1') navigator.sendBeacon('/metrics', new Blob([JSON.stringify({ name: 'client_error', value: 1, page: 'other' })], { type: 'application/json' }));
  }, [error]);
  return <div className="container" role="alert" style={{ paddingBlock: 64 }}>
    <h1>{lang === 'ru' ? 'Не удалось открыть страницу' : 'The page could not load'}</h1>
    <p>{lang === 'ru' ? 'Попробуйте загрузить её снова.' : 'Try loading it again.'}</p>
    <button type="button" onClick={reset}>{lang === 'ru' ? 'Попробовать снова' : 'Try again'}</button>
  </div>;
}
