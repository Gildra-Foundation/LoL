import { defineConfig, devices } from '@playwright/test';
const external = process.env.PLAYWRIGHT_BASE_URL;
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
  },
});
