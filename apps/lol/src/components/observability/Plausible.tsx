// Plausible CE: включается только настройкой (см. lib/plausible.ts). В страницу попадают
// лишь публичные адрес скрипта и id сайта. Стандартный script.js
// сам считает переходы через History API, поэтому клиентская навигация Next учитывается.
// В dev и тестах (NODE_ENV не production) ничего не отправляется. SiteMetrics работает как раньше.
import Script from 'next/script';
import { plausibleTracker } from '@/lib/plausible';

export function Plausible() {
  const tracker = plausibleTracker();
  if (!tracker) return null;
  return (
    <Script
      id="plausible"
      strategy="afterInteractive"
      defer
      data-domain={tracker.domain}
      data-api={tracker.api}
      src={tracker.src}
    />
  );
}
