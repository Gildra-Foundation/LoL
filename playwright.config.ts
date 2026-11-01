import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
const external = process.env.PLAYWRIGHT_BASE_URL;
// Аккаунты в e2e: своя база (E2E_DATABASE_URL) и письма в папку вместо SMTP. Против staging папку задаёт E2E_EMAIL_DIR.
const accountsDb = process.env.E2E_DATABASE_URL;
if (accountsDb && !process.env.E2E_EMAIL_DIR) process.env.E2E_EMAIL_DIR = path.resolve('artifacts/e2e-mail');
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: true, workers: 2,
  retries: process.env.CI ? 1 : 0, timeout: 45000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: external ?? 'http://127.0.0.1:3015', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: external ? undefined : {
    command: 'npm run start -w @rift/lol -- -p 3015 -H 127.0.0.1', url: 'http://127.0.0.1:3015/health.json', reuseExistingServer: !process.env.CI,
    env: accountsDb ? {
      DATABASE_URL: accountsDb,
      BETTER_AUTH_SECRET: 'e2e-only-secret-e2e-only-secret-e2e-only',
      BETTER_AUTH_URL: 'http://127.0.0.1:3015',
      EMAIL_TRANSPORT: 'capture',
      EMAIL_CAPTURE_DIR: process.env.E2E_EMAIL_DIR!,
    } : undefined,
  },
});
