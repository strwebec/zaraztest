import { test, expect, request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import { uniqueTestEmail, TEST_USERS } from '../fixtures/users';
import { findOne } from '../helpers/db';

/**
 * Verified against backend/routes/business.js (cancel → sets
 * cancellationConfirmation + fires a "Це на ваше прохання?" notification) and
 * backend/routes/client.js + jobs/autoUnblock.js (client's yes/no response;
 * 'no' → applyUnfairCancellation; 3rd unfair cancellation sets business.warnings
 * += 1; unanswered after 24h auto-resolves the same way via the daily sweep).
 * This part of the original spec was accurate — no corrections needed here,
 * only the mechanics of driving it (which endpoints, which fields).
 */

async function getBusiness(request: APIRequestContext, namePart: string) {
  const res = await request.get('http://localhost:4000/api/catalog/businesses?city=stryi&requireSlot=false');
  const json = await res.json();
  const biz = json.businesses.find((b: { name: string }) => b.name.includes(namePart));
  if (!biz) throw new Error(`Fixture business containing "${namePart}" not found`);
  return biz as { id: string; name: string };
}

function nextWeekday(offsetDays = 1): string {
  const d = new Date();
  let added = 0;
  while (added < offsetDays) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

/** Registers a client, books MedCenter, then cancels it as the business owner. Returns the bookingId. */
async function setUpCancelledBooking(clientCtx: APIRequestContext, ownerCtx: APIRequestContext, dayOffset: number) {
  const email = uniqueTestEmail('cancelconf');
  const password = 'TestClient123!';
  const registerRes = await clientCtx.post('http://localhost:4000/api/auth/register/client', {
    data: { name: 'TEST_CancelConfirm', email, phone: '+380991234567', password, citySlug: 'stryi', agreeToTerms: true },
  });
  const { devVerificationCode } = await registerRes.json();
  await clientCtx.post('http://localhost:4000/api/auth/verify-registration', { data: { email, code: devVerificationCode } });

  const biz = await getBusiness(clientCtx, 'МедЦентр');
  const detail = await (await clientCtx.get(`http://localhost:4000/api/catalog/businesses/${biz.id}`)).json();
  const bookRes = await clientCtx.post('http://localhost:4000/api/bookings', {
    data: {
      businessId: biz.id,
      serviceId: detail.services[0]._id,
      staffId: detail.staff[0]._id,
      date: nextWeekday(dayOffset),
      startTime: '10:00',
    },
  });
  const booking = await bookRes.json();
  const bookingId = booking.booking?._id ?? booking._id;

  await ownerCtx.post('http://localhost:4000/api/auth/login', {
    data: { email: TEST_USERS.businessOwner.email, password: TEST_USERS.businessOwner.password },
  });
  const cancelRes = await ownerCtx.post(`http://localhost:4000/api/business/bookings/${bookingId}/cancel`);
  expect(cancelRes.ok()).toBe(true);

  return { bookingId, clientEmail: email, clientPassword: password, businessId: biz.id };
}

test.describe('Business-initiated cancellation → client confirmation', () => {
  test('client responding "no" (not their request) is counted unfair for the business', async () => {
    const clientCtx = await playwrightRequest.newContext();
    const ownerCtx = await playwrightRequest.newContext();
    try {
      const { bookingId } = await setUpCancelledBooking(clientCtx, ownerCtx, 2);

      const before = await findOne<{ unfairCancellations: number }>('businesses', { name: 'МедЦентр Стрий' });

      const respondRes = await clientCtx.post(`http://localhost:4000/api/client/bookings/${bookingId}/confirm-cancellation`, {
        data: { response: 'no' },
      });
      expect(respondRes.ok()).toBe(true);

      const after = await findOne<{ unfairCancellations: number }>('businesses', { name: 'МедЦентр Стрий' });
      expect(after).toBeTruthy();
      expect(after!.unfairCancellations).toBeGreaterThan(before?.unfairCancellations ?? 0);
    } finally {
      await clientCtx.dispose();
      await ownerCtx.dispose();
    }
  });

  test('client responding "yes" (it was their request) is NOT counted unfair', async () => {
    const clientCtx = await playwrightRequest.newContext();
    const ownerCtx = await playwrightRequest.newContext();
    try {
      const { bookingId } = await setUpCancelledBooking(clientCtx, ownerCtx, 3);

      const before = await findOne<{ unfairCancellations: number }>('businesses', { name: 'МедЦентр Стрий' });
      const respondRes = await clientCtx.post(`http://localhost:4000/api/client/bookings/${bookingId}/confirm-cancellation`, {
        data: { response: 'yes' },
      });
      expect(respondRes.ok()).toBe(true);

      const after = await findOne<{ unfairCancellations: number }>('businesses', { name: 'МедЦентр Стрий' });
      expect(after!.unfairCancellations).toBe(before!.unfairCancellations);
    } finally {
      await clientCtx.dispose();
      await ownerCtx.dispose();
    }
  });

  test('the same booking cannot be answered twice', async () => {
    const clientCtx = await playwrightRequest.newContext();
    const ownerCtx = await playwrightRequest.newContext();
    try {
      const { bookingId } = await setUpCancelledBooking(clientCtx, ownerCtx, 4);
      await clientCtx.post(`http://localhost:4000/api/client/bookings/${bookingId}/confirm-cancellation`, {
        data: { response: 'yes' },
      });
      const second = await clientCtx.post(`http://localhost:4000/api/client/bookings/${bookingId}/confirm-cancellation`, {
        data: { response: 'no' },
      });
      expect(second.status()).toBe(400);
      const body = await second.json();
      expect(body.error).toBe('ALREADY_RESPONDED');
    } finally {
      await clientCtx.dispose();
      await ownerCtx.dispose();
    }
  });
});
