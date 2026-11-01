'use client';

import { useEffect, useRef } from 'react';
import { useLocale } from '@rift/engine/i18n/LocaleProvider';

interface TurnstileApi {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error('turnstile'));
    };
    document.head.append(s);
  });
  return loading;
}

/**
 * Виджет Cloudflare Turnstile. Токен одноразовый: после каждой отправки формы виджет сбрасывается (resetKey).
 * Скрипт Cloudflare грузится только при показе формы регистрации или сброса.
 */
export function Turnstile({ siteKey, onToken, resetKey, label }: { siteKey: string; onToken: (token: string | null) => void; resetKey: number; label: string }) {
  const locale = useLocale();
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const tokenRef = useRef(onToken);
  tokenRef.current = onToken;

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile) return;
        widget.current = window.turnstile.render(box.current, {
          sitekey: siteKey,
          theme: 'dark',
          language: locale,
          callback: (token: string) => tokenRef.current(token),
          'expired-callback': () => tokenRef.current(null),
          'error-callback': () => tokenRef.current(null),
        });
      })
      .catch(() => tokenRef.current(null));
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey, locale]);

  useEffect(() => {
    if (resetKey && widget.current) {
      window.turnstile?.reset(widget.current);
      tokenRef.current(null);
    }
  }, [resetKey]);

  return <div ref={box} aria-label={label} role="group" style={{ minHeight: 65 }} />;
}
