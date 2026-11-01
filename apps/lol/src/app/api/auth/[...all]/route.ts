// Better Auth: вход, регистрация, подтверждение почты, сброс и смена пароля, выход, удаление аккаунта.
import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '@/lib/account/auth';
import { accountsConfigured } from '@/lib/account/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const unavailable = () => Response.json({ code: 'ACCOUNTS_UNAVAILABLE', message: 'Accounts are not configured' }, { status: 503, headers: { 'cache-control': 'no-store' } });

const handle = (request: Request) => (accountsConfigured() ? toNextJsHandler(getAuth()).POST(request) : unavailable());

export { handle as GET, handle as POST };
