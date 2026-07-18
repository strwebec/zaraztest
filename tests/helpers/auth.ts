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
  await page.locator('button[type="submit"]').click();
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Вийти' }).click();
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

export async function registerClient(
  page: Page,
  locale: 'uk' | 'en',
  data: { name: string; email: string; phone: string; password: string }
) {
  await page.goto(`/${locale}/login?tab=register`);
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
