import { describe, expect, it } from 'vitest';
import { plausibleTracker } from '@/lib/plausible';

// Трекер Plausible: только production, только https-скрипт, необязательный data-api
// (события через собственный домен сайта); неверный адрес событий выключает трекер.
describe('plausibleTracker', () => {
  const env = {
    NODE_ENV: 'production',
    PLAUSIBLE_SCRIPT_URL: 'https://riftden.com/stats/js/script.js',
    PLAUSIBLE_SITE_DOMAIN: 'riftden.com',
  };

  it('is off outside production and when disabled', () => {
    expect(plausibleTracker({ ...env, NODE_ENV: 'development' })).toBeNull();
    expect(plausibleTracker({ ...env, PLAUSIBLE_TRACKING: 'off' })).toBeNull();
  });

  it('keeps the plain config without an event endpoint', () => {
    expect(plausibleTracker(env)).toEqual({ src: 'https://riftden.com/stats/js/script.js', domain: 'riftden.com' });
  });

  it('accepts a same-site or https event endpoint', () => {
    expect(plausibleTracker({ ...env, PLAUSIBLE_API_URL: '/stats/api/event' })?.api).toBe('/stats/api/event');
    expect(plausibleTracker({ ...env, PLAUSIBLE_API_URL: 'https://riftden.com/stats/api/event' })?.api).toBe(
      'https://riftden.com/stats/api/event',
    );
  });

  it('refuses unsafe event endpoints', () => {
    for (const value of ['//evil.example/api/event', 'http://riftden.com/stats/api/event', 'javascript:alert(1)', '/stats/../event2']) {
      expect(plausibleTracker({ ...env, PLAUSIBLE_API_URL: value })).toBeNull();
    }
  });
});
