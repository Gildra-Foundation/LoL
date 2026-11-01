// Что нужно формам входа на статических страницах: включены ли аккаунты и ключ сайта Turnstile (публичный).
import { accountsConfigured, turnstile } from '@/lib/account/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    { enabled: accountsConfigured(), turnstileSiteKey: turnstile()?.siteKey ?? null },
    { headers: { 'cache-control': 'no-store' } },
  );
}
