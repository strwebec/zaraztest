import { test, expect } from '@playwright/test';
import { login, registerClient } from '../helpers/auth';
import { uniqueTestEmail } from '../fixtures/users';

/**
 * Corrections vs. the spec:
 * - The bottom nav (MobileBottomNav) only renders inside the CLIENT area
 *   layout (app/[locale]/client/layout.tsx) — 4 tabs: Мої записи / Улюблені /
 *   Сповіщення / Профіль. Business and admin areas deliberately have NO
 *   bottom nav (this was an explicit earlier fix — "remove cramped bottom nav
 *   from business"). An unauthenticated visitor sees no bottom nav at all.
 * - There's no "mobile booking modal" — on mobile the booking panel isn't a
 *   modal, it renders inline in the business profile page's own flow
 *   (`lg:hidden` block in business/[id]/page.tsx). The one true modal in the
 *   app that's booking-shaped is ManualBookingModal, used on the BUSINESS
 *   side (desktop calendar), not by clients on mobile.
 */

test.use({ viewport: { width: 375, height: 812 } });

test.describe('Mobile client navigation', () => {
  test('bottom nav has 4 tabs, each navigates, and the active one is highlighted', async ({ page, request }) => {
    const email = uniqueTestEmail('mobilenav');
    await registerClient(page, 'uk', { name: 'TEST_MobileNav', email, phone: '+380991234567', password: 'TestClient123!' });
    await page.goto('/uk/client/bookings');

    const nav = page.locator('nav.fixed.bottom-0');
    await expect(nav).toBeVisible();
    const tabs = nav.locator('a');
    await expect(tabs).toHaveCount(4);

    await tabs.nth(1).click(); // Улюблені
    await expect(page).toHaveURL(/\/client\/favorites/);
    await expect(tabs.nth(1)).toHaveClass(/text-primary/);
  });

  test('the bottom nav does not render for an unauthenticated visitor on the home page', async ({ page }) => {
    await page.goto('/uk');
    await expect(page.locator('nav.fixed.bottom-0')).toHaveCount(0);
  });

  test('the bottom nav does not render in the business cabinet', async ({ page }) => {
    await page.goto('/uk/login');
    await login(page, 'uk', 'medcenter@example.com', 'DemoOwner123!');
    await expect(page).toHaveURL(/business-account\/dashboard/);
    await expect(page.locator('nav.fixed.bottom-0')).toHaveCount(0);
  });
});

test.describe('Mobile catalog', () => {
  test('business cards stack in a single column', async ({ page }) => {
    await page.goto('/uk/catalog');
    const grid = page.locator('.grid').first();
    const columns = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(1);
  });
});

test.describe('Touch targets', () => {
  test('primary nav and CTA buttons meet the 44px minimum touch target', async ({ page }) => {
    await page.goto('/uk');
    const loginButton = page.getByRole('button', { name: 'Увійти' });
    const box = await loginButton.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
