import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Регистрация → письмо → подтверждение → вход → избранное; сброс пароля и удаление аккаунта.
// Нужны база и почта в режиме capture: письма читаются из E2E_EMAIL_DIR (см. playwright.config.ts).
const mailDir = process.env.E2E_EMAIL_DIR;
test.skip(!mailDir, 'accounts e2e need E2E_DATABASE_URL (local server) or E2E_EMAIL_DIR (staging)');
if (mailDir) mkdirSync(mailDir, { recursive: true });

// у каждого воркера свой адрес посетителя — лимиты попыток считаются по нему
test.use({ extraHTTPHeaders: { 'cf-connecting-ip': `198.18.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` } });

const PASSWORD = 'riftden e2e password';
const uniqueEmail = (tag: string) => `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;

/** Последняя ссылка из письма на адрес to с темой subject. */
async function mailLink(to: string, subject: RegExp): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      () => {
        const letters = readdirSync(mailDir!)
          .filter((f) => f.endsWith('.json'))
          .map((f) => JSON.parse(readFileSync(path.join(mailDir!, f), 'utf8')) as { to: string; subject: string; text: string; at: string })
          .filter((m) => m.to === to && subject.test(m.subject))
          .sort((a, b) => a.at.localeCompare(b.at));
        link = letters.at(-1)?.text.match(/https?:\/\/\S+token=\S+/)?.[0];
        return link;
      },
      { timeout: 15000 },
    )
    .toBeTruthy();
  return link!;
}

const authForm = (page: Page) => page.locator('form').filter({ has: page.getByLabel('Почта') }).last();

async function signUpAndVerify(page: Page, email: string) {
  await page.goto('/account?mode=sign-up');
  const form = authForm(page);
  await form.getByLabel('Почта').fill(email);
  await form.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
  await form.getByRole('button', { name: 'Зарегистрироваться' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Мы отправили письмо' })).toBeVisible();

  const link = await mailLink(email, /подтвердите почту/);
  expect(new URL(link).pathname).toBe('/account/verify');
  await page.goto(new URL(link).pathname + new URL(link).search);
  await page.getByRole('button', { name: 'Подтвердить почту' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Почта подтверждена, вы вошли.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Меню аккаунта' })).toBeVisible();
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Меню аккаунта' }).click();
  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page.getByRole('button', { name: 'Войти' }).first()).toBeVisible();
}

test('sign up, confirm email, sign in and keep favorites', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const email = uniqueEmail('fav');
  await signUpAndVerify(page, email);

  // избранное до входа недоступно, после выхода — тоже
  await signOut(page);
  expect((await page.request.get('/api/favorites')).status()).toBe(401);

  // вход через окно в шапке
  await page.getByRole('button', { name: 'Войти' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Вход в RiftDen' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Почта').fill(email);
  await dialog.getByLabel('Пароль', { exact: true }).fill('wrong password here');
  await dialog.locator('button[type="submit"]').click();
  await expect(dialog.getByRole('alert')).toContainText('Неверная почта или пароль');
  await dialog.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
  await dialog.locator('button[type="submit"]').click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Меню аккаунта' })).toBeVisible();

  // те же запросы, что шлёт кнопка «В избранное»; чужой Origin отклоняется
  const add = (kind: string, ref: string) => page.evaluate(async ([k, r]) => (await fetch('/api/favorites', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: k, ref: r }) })).status, [kind, ref]);
  expect(await add('skin', '103086')).toBe(201);
  expect(await add('champion', 'ahri')).toBe(201);
  expect(await add('skin', '103086')).toBe(200);
  expect((await page.request.post('/api/favorites', { data: { kind: 'skin', ref: '1' }, headers: { origin: 'https://evil.example' } })).status()).toBe(403);

  // список образов в формате каталога (/[lang]/skins-index.json): название, чемпион, картинка с CommunityDragon
  await page.route('**/skins-index.json', (route) =>
    route.fulfill({
      json: [{ id: 103086, slug: 'immortalized-legend-ahri', name: 'Бессмертная легенда Ари', champion: 'Ahri', championName: 'Ари', tile: 'assets/characters/ahri/skins/skin86/images/ahri_splash_tile_86.jpg', rarity: 'kLegendary' }],
    }),
  );
  await page.route('https://raw.communitydragon.org/**', (route) => route.fulfill({ status: 204 }));
  await page.getByRole('button', { name: 'Меню аккаунта' }).click();
  await page.getByRole('banner').getByRole('link', { name: 'Избранное', exact: true }).click();
  await expect(page).toHaveURL(/\/favorites$/);
  await expect(page.getByRole('heading', { name: 'Образы', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Чемпионы', level: 2 })).toBeVisible();
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(2);
  const skin = page.getByRole('link', { name: /Бессмертная легенда Ари/ });
  await expect(skin).toHaveAttribute('href', '/skins/immortalized-legend-ahri');
  await expect(skin).toContainText('Ари');
  await expect(skin.locator('img')).toHaveAttribute('src', /^https:\/\/raw\.communitydragon\.org\/.+\/global\/default\/assets\/characters\/ahri\/skins\/skin86\//);

  // кнопка ♡ убирает из избранного, и это сохраняется на сервере
  const champion = page.getByRole('main').getByRole('listitem').filter({ hasText: 'Ahri' });
  await expect(champion.getByRole('button', { name: 'В избранное' })).toHaveAttribute('aria-pressed', 'true');
  await champion.getByRole('button', { name: 'В избранное' }).click();
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Чемпионы', level: 2 })).toHaveCount(0);

  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
  expect(errors).toEqual([]);
});

test('reset a forgotten password, then delete the account', async ({ page }) => {
  const email = uniqueEmail('reset');
  await signUpAndVerify(page, email);
  await signOut(page);

  await page.goto('/account/reset');
  const form = authForm(page);
  await form.getByLabel('Почта').fill(email);
  await form.getByRole('button', { name: 'Прислать ссылку' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'письмо со ссылкой уже в пути' })).toBeVisible();

  const link = await mailLink(email, /сброс пароля/);
  await page.goto(new URL(link).pathname + new URL(link).search);
  const NEW = 'brand new e2e password';
  await page.getByLabel('Новый пароль').fill(NEW);
  await page.getByLabel('Повторите пароль').fill(NEW + 'x');
  await page.getByRole('button', { name: 'Сменить пароль' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Пароли не совпадают');
  await page.getByLabel('Повторите пароль').fill(NEW);
  await page.getByRole('button', { name: 'Сменить пароль' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Пароль изменён' })).toBeVisible();

  // старый пароль больше не подходит, новый — да
  const signIn = authForm(page);
  await signIn.getByLabel('Почта').fill(email);
  await signIn.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
  await signIn.locator('button[type="submit"]').click();
  await expect(signIn.getByRole('alert')).toContainText('Неверная почта или пароль');
  await signIn.getByLabel('Пароль', { exact: true }).fill(NEW);
  await signIn.locator('button[type="submit"]').click();
  await expect(page.getByRole('button', { name: 'Меню аккаунта' })).toBeVisible();

  // удаление: пароль и подтверждение
  await page.goto('/account/settings');
  const danger = page.getByRole('region', { name: 'Удаление аккаунта' });
  await danger.getByLabel('Пароль').fill(NEW);
  await expect(danger.getByRole('button', { name: 'Удалить аккаунт' })).toBeDisabled();
  await danger.getByLabel('Я понимаю, что это нельзя отменить').check();
  await danger.getByRole('button', { name: 'Удалить аккаунт' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Аккаунт удалён.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Войти' }).first()).toBeVisible();
  expect((await page.request.post('/api/auth/sign-in/email', { data: { email, password: NEW } })).status()).toBe(401);
});

test('account pages are closed to search engines and accessible', async ({ page }) => {
  for (const url of ['/account', '/en/account', '/favorites', '/account/settings', '/account/verify', '/account/reset']) {
    await page.goto(url);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  }
  const robots = await (await page.request.get('/robots.txt')).text();
  // staging (SITE_PREVIEW) закрывает весь сайт одной строкой
  if (!/^Disallow: \/\s*$/m.test(robots)) for (const path of ['/account', '/favorites', '/api/']) expect(robots).toContain(`Disallow: ${path}`);

  for (const url of ['/account?mode=sign-up', '/en/account', '/privacy']) {
    await page.goto(url);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(axe.violations.map((v) => ({ url, id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
  }
  await page.getByRole('button', { name: 'Войти' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Вход в RiftDen' })).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
});
