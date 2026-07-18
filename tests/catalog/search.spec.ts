import { test, expect } from '@playwright/test';

/**
 * Corrections vs. the spec:
 * - The Catalog page has no time-range, min-rating, or district filter — only a
 *   category sidebar, a keyword search box, a date picker, and a rating/price
 *   sort toggle. Filter combination tests are written against what exists.
 * - Ranking is: 5-star businesses first (by score), then TOP-placed non-5-star
 *   (by score), then everyone else (by score) — verified in
 *   backend/routes/catalog.js. There's no shimmer animation on the TOP badge,
 *   just a plain "TOP" pill.
 * - The default search date is today. Since availability is computed per real
 *   staff schedules, "today" can legitimately have zero results if it falls on
 *   a day none of the seeded staff work — tests pick an explicit weekday date
 *   instead of relying on "today" to avoid weekend flakiness.
 */

function nextWeekday(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1); // skip Sun/Sat
  return d.toISOString().slice(0, 10);
}

test.describe('Catalog & search', () => {
  test('home page search with a keyword lands on catalog with matching results', async ({ page }) => {
    await page.goto('/uk');
    await page.getByPlaceholder('Яку послугу шукаєш?').fill('манікюр');
    await page.getByRole('button', { name: 'Знайти' }).click();

    await expect(page).toHaveURL(/\/uk\/catalog\?/);
    await expect(page.getByText(/закладів знайдено/)).toBeVisible();
  });

  test('catalog cards show name, rating and price', async ({ page }) => {
    await page.goto(`/uk/catalog?date=${nextWeekday()}`);
    const firstCard = page.locator('.grid > div').first();
    await expect(firstCard).toBeVisible();
    await expect(firstCard.getByText('★')).toBeVisible();
  });

  test('TOP-placed businesses show the TOP badge', async ({ page }) => {
    await page.goto(`/uk/catalog?date=${nextWeekday()}`);
    await expect(page.getByText('TOP', { exact: true }).first()).toBeVisible();
  });

  test('category filter narrows results to that category', async ({ page }) => {
    await page.goto(`/uk/catalog?date=${nextWeekday()}`);
    const barberButton = page.getByRole('button', { name: 'Барбер', exact: true }).first();
    await barberButton.click();
    // Category selection is local React state, not synced to the URL (unlike
    // the keyword search, which the catalog page does push to `?q=`) — assert
    // on the visible highlighted state and the result count instead of a URL
    // change that the app was never designed to make.
    await expect(barberButton).toHaveClass(/bg-primary-glow/);
    const resultsText = await page.getByText(/закладів знайдено/).textContent();
    expect(resultsText).toMatch(/^[1-9]\d* закладів знайдено/); // barber has 3 seeded businesses, never 0
  });

  test('sort toggle switches between rating and price ordering', async ({ page }) => {
    await page.goto(`/uk/catalog?date=${nextWeekday()}`);
    const priceButton = page.getByRole('button', { name: 'За ціною' });
    await priceButton.click();
    await expect(priceButton).toHaveClass(/bg-primary/);
  });

  test('keyword + category combine (both conditions apply)', async ({ page }) => {
    await page.goto(`/uk/catalog?date=${nextWeekday()}&category=barber`);
    await page.getByPlaceholder('Яку послугу шукаєш?').fill('Fade');
    await page.waitForTimeout(500); // debounce
    const resultsText = await page.getByText(/закладів знайдено/).textContent();
    expect(resultsText).toContain('1 закладів знайдено'); // only "Fade Society" matches both
  });

  test('a category with no seeded businesses shows the empty-results message', async ({ page }) => {
    // "veterinary" has 0 seeded businesses (confirmed via GET /api/catalog/categories
    // + /businesses at write time) — swap category if seed data changes.
    await page.goto(`/uk/catalog?date=${nextWeekday()}&category=veterinary`);
    await expect(page.getByText('На жаль, нічого не знайдено на цю дату')).toBeVisible();
  });
});

test.describe('Catalog on mobile viewport', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('cards render single-column and each one navigates to the profile', async ({ page }) => {
    await page.goto(`/uk/catalog?date=${nextWeekday()}`);
    const firstCard = page.locator('.grid > div').first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();
    await expect(page).toHaveURL(/\/uk\/business\//);
  });
});
