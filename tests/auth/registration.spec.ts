import { test, expect } from '@playwright/test';
import { login, logout, registerClient, registerBusiness } from '../helpers/auth';
import { uniqueTestEmail, TEST_USERS } from '../fixtures/users';
import { updateDoc } from '../helpers/db';

/**
 * Corrections vs. the original spec, verified against the running app:
 * - There is no /uk/register route. Registration is a tab on /uk/login
 *   (?tab=register, optionally &type=business).
 * - Registration no longer logs the user in directly: it emails a 6-digit code
 *   that must be entered on a follow-up screen (POST /auth/verify-registration)
 *   before a session is issued and the user lands on "/". helpers/auth.ts's
 *   registerClient/registerBusiness read the code back from the register
 *   response (only echoed when NODE_ENV=test) and complete that step, so the
 *   assertions below still observe the final logged-in redirect.
 * - There's no password-reset flow in the backend at all (no /forgot-password,
 *   no reset-token routes) — the whole "Password reset" suite in the spec tests
 *   a feature that doesn't exist, so it's omitted rather than faked.
 * - There's no server-side phone format validation — the phone field is a plain
 *   `type="tel"` input with no pattern/regex, so a Ukrainian-format assertion
 *   would be testing something the app doesn't do.
 */

test.describe('Client registration', () => {
  test('registers a new client and lands on the home page, logged in', async ({ page }) => {
    const email = uniqueTestEmail('client');
    await registerClient(page, 'uk', { name: 'TEST_Client', email, phone: '+380991234567', password: 'TestClient123!' });

    await expect(page).toHaveURL(/\/uk\/?$/);
    // The public home page has no sidebar (logout lives in the client cabinet
    // layout, not here — see client/layout.tsx) — the header's own name button
    // (Header.tsx: {user.name.split(' ')[0]}, replacing the "Увійти" link) is
    // what actually indicates a logged-in state on this page.
    await expect(page.getByRole('button', { name: 'TEST_Client' })).toBeVisible();
  });

  test('rejects a duplicate email with a specific error, not a generic one', async ({ page }) => {
    // Register once, log out, try again with the same email.
    const email = uniqueTestEmail('dup');
    await registerClient(page, 'uk', { name: 'TEST_Dup', email, phone: '+380991234567', password: 'TestClient123!' });
    await logout(page);

    await registerClient(page, 'uk', { name: 'TEST_Dup2', email, phone: '+380991234567', password: 'TestClient123!' });
    await expect(page.getByText('Цей email вже зареєстровано')).toBeVisible();
  });

  test('blocks a password under 8 characters', async ({ page }) => {
    const email = uniqueTestEmail('weakpw');
    await page.goto('/uk/login?tab=register');
    await page.getByPlaceholder("Ваше ім'я").or(page.getByPlaceholder("Ім'я")).first().fill('TEST_WeakPw');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="tel"]').fill('+380991234567');
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('short1');
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Зареєструватися' }).click();

    // The password field has minLength=8 in the register tab, so the browser's
    // own constraint validation intercepts this before it ever reaches the
    // server — assert on that native validity state rather than a server error.
    const isValid = await passwordInput.evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(isValid).toBe(false);
  });

  test('requires the terms checkbox before submit is enabled', async ({ page }) => {
    await page.goto('/uk/login?tab=register');
    await expect(page.getByRole('button', { name: 'Зареєструватися' })).toBeDisabled();
    await page.locator('input[type="checkbox"]').check();
    await expect(page.getByRole('button', { name: 'Зареєструватися' })).toBeEnabled();
  });
});

test.describe('Business registration', () => {
  test('registers a business and shows the pending-approval notice', async ({ page }) => {
    const suffix = `${Date.now()}`;
    await registerBusiness(page, 'uk', {
      ownerName: `TEST_Owner_${suffix}`,
      businessName: `TEST_Business_${suffix}`,
      email: `test_bizowner_${suffix}@example.com`,
      phone: '+380991234567',
      password: 'TestBusiness123!',
    });

    // Registration auto-logs the owner in and sends them to their (empty,
    // pending) dashboard — the "awaiting approval" copy lives on the public
    // registration form itself (shown before submit), not a post-submit screen.
    await expect(page).toHaveURL(/\/uk\/business-account\/dashboard/);
  });

  test('a newly registered business is not visible in the public catalog', async ({ page, request }) => {
    const suffix = `${Date.now()}`;
    const businessName = `TEST_Business_${suffix}`;
    await registerBusiness(page, 'uk', {
      ownerName: `TEST_Owner_${suffix}`,
      businessName,
      email: `test_bizowner_${suffix}@example.com`,
      phone: '+380991234567',
      password: 'TestBusiness123!',
    });

    const res = await request.get('http://localhost:4000/api/catalog/businesses?city=stryi&requireSlot=false');
    const json = await res.json();
    const names: string[] = json.businesses.map((b: { name: string }) => b.name);
    expect(names).not.toContain(businessName);
  });
});

test.describe('Login', () => {
  // This block runs once per Playwright project (chromium, then mobile) within
  // the same overall run — the backend's per-account login-lockout counter
  // (failedLoginAttempts/loginLockedUntil) persists across projects since it's
  // the same shared businessOwner fixture and global-setup only resets it once,
  // at the very start of the whole run. The "wrong password" and "repeated
  // failed attempts" tests below deliberately push that counter close to its
  // threshold; running the block a second time (mobile project) on top of
  // whatever the first pass already accumulated could tip it over and lock the
  // account for real, failing "valid credentials" for a reason that has
  // nothing to do with what that test actually checks. Reset locally so each
  // project's pass through this block always starts clean.
  test.beforeAll(async () => {
    await updateDoc(
      'users',
      { email: TEST_USERS.businessOwner.email },
      { $set: { failedLoginAttempts: 0 }, $unset: { loginLockedUntil: '' } }
    );
  });

  test('valid credentials redirect to the role-appropriate home', async ({ page }) => {
    await login(page, 'uk', TEST_USERS.businessOwner.email, TEST_USERS.businessOwner.password);
    await expect(page).toHaveURL(/\/uk\/business-account\/dashboard/);
  });

  test('wrong password and wrong email both show the same generic error (no enumeration)', async ({ page }) => {
    await login(page, 'uk', TEST_USERS.businessOwner.email, 'DefinitelyWrongPassword1!');
    const wrongPasswordError = await page.getByText('Невірний email або пароль').textContent();

    await page.goto('/uk/login');
    await login(page, 'uk', uniqueTestEmail('doesnotexist'), 'WhateverPassword1!');
    const wrongEmailError = await page.getByText('Невірний email або пароль').textContent();

    expect(wrongPasswordError).toBe(wrongEmailError);
  });

  test('repeated failed attempts eventually lock the account', async ({ request }) => {
    // loginLimiter (IP-keyed) is deliberately skipped when NODE_ENV=test (see
    // middleware/rateLimit.js) so the rest of this suite doesn't get IP-throttled
    // by every other test's own login calls — so a 429 never appears here in
    // test mode. The brute-force protection that IS still active in test mode is
    // the per-account lockout (routes/auth.js: failedLoginAttempts/loginLockedUntil),
    // keyed by account rather than IP. Use a disposable account (not the shared
    // businessOwner fixture) so locking it for real doesn't affect any other test.
    const email = uniqueTestEmail('lockout');
    await request.post('http://localhost:4000/api/auth/register/client', {
      data: {
        name: 'TEST_Lockout',
        email,
        phone: '+380991234567',
        password: 'RealPassword123!',
        citySlug: 'stryi',
        agreeToTerms: true,
      },
    });

    let sawLocked = false;
    for (let i = 0; i < 12; i++) {
      const res = await request.post('http://localhost:4000/api/auth/login', {
        data: { email, password: 'WrongPassword1!' },
      });
      if (res.status() === 423) {
        sawLocked = true;
        break;
      }
    }
    expect(sawLocked).toBe(true);
  });
});

test.describe('Logout', () => {
  test('logout clears the session and protected routes bounce to login', async ({ page }) => {
    await login(page, 'uk', TEST_USERS.businessOwner.email, TEST_USERS.businessOwner.password);
    await expect(page).toHaveURL(/business-account\/dashboard/);

    await logout(page);
    await page.goto('/uk/business-account/dashboard');
    await expect(page).toHaveURL(/\/uk\/login/);
  });

  test('back button after logout still lands on login, not the cached dashboard', async ({ page }) => {
    await login(page, 'uk', TEST_USERS.businessOwner.email, TEST_USERS.businessOwner.password);
    await page.goto('/uk/business-account/calendar');
    await logout(page);
    await page.goBack();
    // The business layout's own auth guard re-checks on mount and bounces
    // unauthenticated visitors regardless of what the back-button cache shows.
    await expect(page).toHaveURL(/\/uk\/login/);
  });
});
