// Запуск сервера: миграции базы аккаунтов и ежечасная уборка просроченного.
import { accountsConfigured } from './config';
import { getPool } from './db';
import { cleanup, migrate } from './migrations';

const log = (status: string, extra: Record<string, unknown> = {}) => console.info(JSON.stringify({ type: 'riftden_accounts', status, ...extra }));

export async function startAccounts(): Promise<void> {
  if (!accountsConfigured()) {
    log('disabled', { reason: 'DATABASE_URL or BETTER_AUTH_SECRET is not set' });
    return;
  }
  // база может подниматься дольше сайта: до минуты повторов, затем сайт работает дальше, а аккаунты отвечают ошибкой
  for (let attempt = 1; ; attempt++) {
    try {
      const applied = await migrate(getPool());
      log('ready', { applied });
      break;
    } catch (error) {
      if (attempt >= 12) {
        log('migration-failed', { error: (error as Error).message });
        return;
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  const timer = setInterval(() => cleanup(getPool()).catch((error) => log('cleanup-failed', { error: (error as Error).message })), 3600_000);
  timer.unref();
}
