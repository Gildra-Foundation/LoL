// Избранное аккаунта: GET — список, POST/DELETE { kind, ref } — добавить и убрать.
import { sessionUser } from '@/lib/account/auth';
import { accountsConfigured, authOrigin } from '@/lib/account/config';
import { getPool } from '@/lib/account/db';
import { handleFavorites, pgFavorites } from '@/lib/account/favorites';
import { createLimiter } from '@/lib/account/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const limits = { ip: createLimiter(300, 60_000), read: createLimiter(120, 60_000), write: createLimiter(60, 60_000) };

async function handle(request: Request) {
  if (!accountsConfigured()) return Response.json({ error: 'unavailable' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  return handleFavorites(request, { origin: authOrigin(), user: sessionUser, store: pgFavorites(getPool()), limits });
}

export { handle as GET, handle as POST, handle as DELETE };
