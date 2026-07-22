import type { Page, Response } from '@playwright/test';

/**
 * Registration/login lives on ONE page — /login with a tab switcher (Вхід /
 * Реєстрація) and, on the register tab, an account-type switcher (Я клієнт /
 * Я бізнес) — not the separate /register route the original spec assumed.
 */
export async function login(page: Page, locale: 'uk' | 'en', email: string, password: string) {
  await page.goto(`/${locale}/login`);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  // Wait for the POST itself, not just the click — a caller that does a hard
  // page.goto() immediately after this (rather than an auto-retrying
  // expect(page).toHaveURL(...)) would otherwise navigate before the session
  // cookies are actually set, landing back on the login page unauthenticated.
  await Promise.all([
    page.waitForResponse((res) => res.url().includes('/api/auth/login')),
    page.locator('button[type="submit"]').click(),
  ]);
}

export async function logout(page: Page) {
  // Logout only lives in each role's cabinet-layout sidebar (client/business-account/
  // admin layout.tsx), not on the public home page — a freshly-registered/logged-in
  // CLIENT lands on "/" (no sidebar there), so "Вийти" isn't visible yet. Business/admin
  // callers are already on a cabinet page by the time they call this, where the sidebar
  // (and "Вийти") is already present — give it a real wait rather than a snap
  // isVisible() check, since a page.goto() immediately before this call means the
  // sidebar may simply not have finished rendering yet, not that it doesn't exist.
  const logoutButton = page.getByRole('button', { name: 'Вийти' });
  // Generous timeout — some cabinet pages (e.g. the calendar) are heavier to
  // hydrate than others, and this is a "is it already on screen" check, not the
  // fallback path; giving up too early here would wrongly take the client-only
  // fallback below for a business/admin page that just hadn't finished loading yet.
  const alreadyVisible = await logoutButton
    .waitFor({ state: 'visible', timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  if (!alreadyVisible) {
    await page.goto('/uk/client/bookings');
    await logoutButton.waitFor({ state: 'visible' });
  }
  // Wait for the logout request itself, not just the click — the app redirects
  // client-side afterward, and a caller that does a hard page.goto() right after
  // this call would otherwise race that in-flight SPA navigation (observed as
  // "Navigation ... interrupted by another navigation to /uk/login").
  await Promise.all([
    page.waitForResponse((res) => res.url().includes('/api/auth/logout')),
    logoutButton.click(),
  ]);
}

// Registration now requires entering an emailed verification code before the
// account is usable (backend/routes/auth.js's /register/* routes no longer
// issue a session directly). The backend echoes the code back in the register
// response when NODE_ENV=test so this can complete the flow without a real
// inbox — this branch only fires on success (201); a registration error (e.g.
// duplicate email) leaves the form's error message on screen for the test to
// assert on instead.
async function completeVerificationIfPending(page: Page, response: Response) {
  if (response.status() !== 201) return;
  const body = await response.json();
  if (!body.devVerificationCode) return;
  await page.locator('input[inputmode="numeric"]').fill(body.devVerificationCode);
  await page.getByRole('button', { name: 'Підтвердити' }).click();
}

// The city <select> starts empty (citySlug='') until useCities() resolves and
// an effect defaults it to the first real city — if cities haven't loaded yet,
// the dropdown's only option is the "Інше місто" (other-city) sentinel, which
// requires a free-text city name the registration helpers below never fill in.
// Submitting mid-race gets a 400 (INVALID_CITY) and the page never navigates
// away. Wait for a real city option to exist before touching the form.
async function waitForCitiesLoaded(page: Page) {
  // The city <select> is the first <select> on this form (the category
  // <select>, business-registration only, comes after it in the DOM). Select a
  // real city explicitly rather than relying on the app's own useEffect-driven
  // auto-select to have already run by the time we read the form's state —
  // that's an internal timing race this test shouldn't depend on.
  const citySelect = page.locator('select').first();
  const firstCityOption = citySelect.locator('option[value]:not([value="other-city"])').first();
  await firstCityOption.waitFor({ state: 'attached' });
  const value = await firstCityOption.getAttribute('value');
  if (value) await citySelect.selectOption(value);
}

export async function registerClient(
  page: Page,
  locale: 'uk' | 'en',
  data: { name: string; email: string; phone: string; password: string }
) {
  await page.goto(`/${locale}/login?tab=register`);
  await waitForCitiesLoaded(page);
  await page.getByPlaceholder("Ваше ім'я").or(page.getByPlaceholder("Ім'я")).first().fill(data.name);
  await page.locator('input[type="email"]').fill(data.email);
  await page.locator('input[type="tel"]').fill(data.phone);
  await page.locator('input[type="password"]').fill(data.password);
  await page.locator('input[type="checkbox"]').check();
  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes('/api/auth/register/client')),
    page.getByRole('button', { name: 'Зареєструватися' }).click(),
  ]);
  await completeVerificationIfPending(page, response);
}

export async function registerBusiness(
  page: Page,
  locale: 'uk' | 'en',
  data: { ownerName: string; businessName: string; email: string; phone: string; password: string }
) {
  await page.goto(`/${locale}/login?tab=register&type=business`);
  await waitForCitiesLoaded(page);
  await page.getByPlaceholder("Ваше ім'я").fill(data.ownerName);
  await page.getByPlaceholder('Назва бізнесу').fill(data.businessName);
  await page.locator('input[type="email"]').fill(data.email);
  await page.locator('input[type="tel"]').fill(data.phone);
  await page.locator('input[type="password"]').fill(data.password);
  await page.locator('input[type="checkbox"]').check();
  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes('/api/auth/register/business')),
    page.getByRole('button', { name: 'Зареєструвати бізнес' }).click(),
  ]);
  await completeVerificationIfPending(page, response);
}
