'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useReportWebVitals } from 'next/web-vitals';
import { stripLocale } from '@rift/engine/i18n/locale';
const sections = new Set(['champions','items','builds','compare','duel','stats','tier-list','guess','runeterra','methodology']);
function section(path: string) {
  const first = stripLocale(path).path.split('/')[1];
  return sections.has(first) ? first : first ? 'other' : 'home';
}
function send(name: string, value: number, page: string) {
  if (navigator.doNotTrack === '1') return;
  // No cookies, IDs, raw URLs, query strings, user agents or external collectors.
  const body = JSON.stringify({ name, value, page });
  if (!navigator.sendBeacon('/metrics', new Blob([body], { type: 'application/json' }))) {
    void fetch('/metrics', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
  }
}
const reportVitals: Parameters<typeof useReportWebVitals>[0] = (metric) => {
  if (['LCP','INP','CLS','FCP','TTFB'].includes(metric.name)) send(metric.name, metric.value, section(window.location.pathname));
};
export function SiteMetrics() {
  const pathname = usePathname();
  useEffect(() => { send('page_view', 1, section(pathname)); }, [pathname]);
  useReportWebVitals(reportVitals);
  return null;
}
