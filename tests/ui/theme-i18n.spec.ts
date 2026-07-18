import { test, expect } from '@playwright/test';

/**
 * Corrections vs. the spec: there is no dark mode in this app at all. It was
 * removed in a full visual redesign (task 64 in this project's history) —
 * confirmed by: no ThemeToggle component anywhere in components/, and
 * frontend/app/globals.css defines exactly one palette with no
 * `prefers-color-scheme` or `data-theme` rule of any kind. `User.themePref`
 * still exists as an unused leftover schema field with a `'dark'` default,
 * but nothing in the UI reads or writes it. The entire "Dark/Light mode"
 * suite from the spec tests a feature that doesn't exist and is dropped —
 * this file covers only i18n, which is real.
 */

test.describe('Language switching', () => {
  test('defaults to Ukrainian on the home page', async ({ page }) => {
    await page.goto('/uk');
    await expect(page.getByRole('link', { name: 'Каталог' })).toBeVisible();
    await expect(page.getByText('Знайди час для себе')).toBeVisible();
  });

  test('switching to EN changes both the URL and the visible text', async ({ page }) => {
    await page.goto('/uk');
    await page.getByRole('button', { name: 'EN' }).click();
    await expect(page).toHaveURL(/\/en\/?$/);
    await expect(page.getByText('Find time for yourself')).toBeVisible();
  });

  test('the chosen locale persists across a reload (it is baked into the URL, not localStorage)', async ({ page }) => {
    await page.goto('/en');
    await page.reload();
    await expect(page).toHaveURL(/\/en\/?$/);
    await expect(page.getByText('Find time for yourself')).toBeVisible();
  });

  test('switching language preserves the current page, not just the home route', async ({ page }) => {
    await page.goto('/uk/catalog');
    await page.getByRole('button', { name: 'EN' }).click();
    await expect(page).toHaveURL(/\/en\/catalog/);
  });
});
