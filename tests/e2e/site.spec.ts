import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for (const path of ['/', '/champions', '/champions/garen', '/items', '/builds', '/methodology', '/skins', '/skins/star-guardian-ahri']) {
  test(`page renders without errors or horizontal overflow: ${path}`, async ({ page }, testInfo) => {
    const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    if (path === '/builds') await expect(page.getByRole('button', { name: 'Выбрать чемпиона', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    for (const image of await page.locator('img[fetchpriority="high"]').all()) {
      await image.evaluate((node) => (node as HTMLImageElement).decode());
    }
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('page.png'), fullPage: false });
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
  });
}
test('search recovers from a failed index request', async ({ page }) => {
  let calls = 0;
  await page.route('**/search-index.json', async (route) => {
    calls += 1;
    if (calls === 1) await route.fulfill({ status: 503, body: '{}' }); else await route.continue();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Поиск, клавиша /', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Не удалось загрузить поиск');
  await page.getByRole('button', { name: 'Попробовать снова', exact: true }).click();
  await page.getByRole('combobox', { name: 'Поиск', exact: true }).fill('Гарен');
  await expect(page.getByRole('option').filter({ hasText: 'Гарен' }).first()).toBeVisible();
  await page.getByRole('combobox', { name: 'Поиск', exact: true }).press('Enter');
  await expect(page).toHaveURL(/\/champions\/garen$/);
});
test('shared build loads a champion and survives reload', async ({ page }) => {
  await page.goto('/builds?c=garen&lane=top');
  await expect(page.getByRole('button', { name: 'Сменить чемпиона', exact: true })).toBeVisible();
  await expect(page.getByRole('main')).toContainText('Гарен');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Сменить чемпиона', exact: true })).toBeVisible();
});
test('keyboard can skip navigation to main content', async ({ page }) => {
  await page.goto('/methodology');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Перейти к содержимому' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
});

test('catalog search and role filter persist in the URL', async ({ page }) => {
  await page.goto('/champions');
  const filterToggle = page.getByRole('button', { name: /^Фильтры/, includeHidden: true });
  await filterToggle.waitFor({ state: 'attached' });
  if (await filterToggle.isVisible()) await filterToggle.click();
  await page.getByRole('textbox', { name: 'Поиск по имени' }).fill('Гарен');
  await expect(page.getByRole('main').getByRole('link').filter({ hasText: 'Гарен' })).toHaveCount(1);
  await page.getByRole('group', { name: 'Позиция', exact: true }).getByRole('button', { name: 'Верхняя линия' }).click();
  await expect(page).toHaveURL(/position=top/);
  await page.reload();
  await filterToggle.waitFor({ state: 'attached' });
  if (await filterToggle.isVisible()) await filterToggle.click();
  await expect(page.getByRole('textbox', { name: 'Поиск по имени' })).toHaveValue('Гарен');
});
test('skin catalog filters persist in the URL and open a skin page', async ({ page }) => {
  await page.goto('/skins?champion=ahri');
  const filterToggle = page.getByRole('button', { name: /^Фильтры/, includeHidden: true });
  await filterToggle.waitFor({ state: 'attached' });
  if (await filterToggle.isVisible()) await filterToggle.click();
  await expect(page.getByRole('combobox', { name: 'Чемпион' })).toHaveValue('ahri');
  await page.getByRole('group', { name: 'Редкость', exact: true }).getByRole('button', { name: 'Легендарный' }).click();
  await expect(page).toHaveURL(/rarity=legendary/);
  await page.getByRole('main').getByRole('link', { name: /Звездная защитница Ари/ }).first().click();
  await expect(page).toHaveURL(/\/skins\/star-guardian-ahri$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Звездная защитница Ари');
  const chromas = page.getByRole('group', { name: 'Хромы' });
  await chromas.getByRole('button').nth(1).click();
  await expect(chromas.getByRole('button').nth(1)).toHaveAttribute('aria-pressed', 'true');
});
test('comparison changes stats and preserves selected level', async ({ page }) => {
  await page.goto('/compare?a=garen&b=darius');
  const health = page.getByRole('meter', { name: 'Здоровье: Гарен' });
  const before = await health.getAttribute('aria-valuenow');
  await page.getByRole('button', { name: 'Уровень выше', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Уровень', exact: true })).toHaveValue('2');
  await expect(health).not.toHaveAttribute('aria-valuenow', before!);
  await expect(page).toHaveURL(/level=2/);
});
test('build can be saved locally', async ({ page }) => {
  await page.goto('/builds?c=garen');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Билд сохранён' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Мои билды' })).toBeVisible();
});
