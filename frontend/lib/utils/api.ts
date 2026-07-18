export type Category = { id: string; name: string; nameEn: string };

export type CatalogBusiness = {
  id: string;
  name: string;
  category: string;
  district?: string;
  rating: number;
  reviews: number;
  priceFrom: number | null;
  priceFromIsFree?: boolean;
  coverPhotoUrl?: string;
  top: boolean;
  nextSlot: string | null;
};

export type City = { _id: string; slug: string; name: string; nameEn: string };

export type Service = {
  _id: string;
  name: string;
  description?: string;
  price: number;
  isFree?: boolean;
  combinable?: boolean;
  durationMinutes: number;
  category: string;
  staff: string[];
  photoUrl?: string;
};

export type Staff = { _id: string; name: string; role?: string; bio?: string; photoUrl?: string };

export type BusinessDetail = {
  _id: string;
  name: string;
  description?: string;
  category: string;
  district?: string;
  address?: string;
  phone?: string;
  googleMapsUrl?: string;
  socials?: { instagram?: string; facebook?: string };
  coverPhotoUrl?: string;
  galleryUrls?: string[];
  googleRating: number;
  googleReviewsCount: number;
  platformRating: number;
  platformReviewsCount: number;
  top?: { active: boolean; until?: string };
  cancellationPolicyHours: 12 | 24 | 48;
  status?: 'PENDING' | 'ACTIVE' | 'HIDDEN' | 'BLOCKED';
  rejectionReason?: string;
  backupSheetUrl?: string;
  createdAt?: string;
  workingHours?: WeekSchedule;
};

export type User = {
  id: string;
  role: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  city?: string;
  language: 'uk' | 'en';
  emailVerified: boolean;
  business?: string;
  permissions?: AdminPermissionBucket[];
  rating?: number;
  blockedUntil?: string | null;
  underReview?: boolean;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  data?: Record<string, unknown>;
  constructor(status: number, code?: string, data?: Record<string, unknown>) {
    super(code || `API error ${status}`);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

// Access tokens expire after 15 minutes (see backend/utils/tokens.js); without this, any
// request made after that silently 401s and the role-gated layouts bounce the user to
// /login even though their 30-day refresh token is still perfectly valid. These paths
// must never trigger a refresh-and-retry — /refresh itself would loop, and a failed
// login/register attempt is a real credentials error, not an expired-session error.
const NO_REFRESH_RETRY = ['/auth/refresh', '/auth/login', '/auth/register/client', '/auth/register/business'];

let refreshPromise: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function apiGet<T>(path: string, retried = false): Promise<T> {
  const res = await fetch(`/api${path}`, { credentials: 'include' });
  if (res.status === 401 && !retried && !NO_REFRESH_RETRY.includes(path)) {
    if (await refreshSession()) return apiGet<T>(path, true);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error, body);
  }
  return res.json();
}

async function apiSend<T>(method: string, path: string, body?: unknown, retried = false): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (res.status === 401 && !retried && !NO_REFRESH_RETRY.includes(path)) {
    if (await refreshSession()) return apiSend<T>(method, path, body, true);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.error, json);
  return json;
}

function apiPost<T>(path: string, body?: unknown) {
  return apiSend<T>('POST', path, body);
}

function apiPatch<T>(path: string, body?: unknown) {
  return apiSend<T>('PATCH', path, body);
}

function apiDelete<T>(path: string) {
  return apiSend<T>('DELETE', path);
}

async function apiUpload<T>(path: string, formData: FormData, retried = false): Promise<T> {
  const res = await fetch(`/api${path}`, { method: 'POST', credentials: 'include', body: formData });
  if (res.status === 401 && !retried) {
    if (await refreshSession()) return apiUpload<T>(path, formData, true);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.error, json);
  return json;
}

export function fetchCategories() {
  return apiGet<{ categories: Category[] }>('/catalog/categories');
}

export function fetchCities() {
  return apiGet<{ cities: City[] }>('/catalog/cities');
}

export function fetchBusinesses(params: {
  city: string;
  category?: string;
  date?: string;
  sort?: string;
  q?: string;
  requireSlot?: boolean;
}) {
  const qs = new URLSearchParams();
  qs.set('city', params.city);
  if (params.category) qs.set('category', params.category);
  if (params.date) qs.set('date', params.date);
  if (params.sort) qs.set('sort', params.sort);
  if (params.q) qs.set('q', params.q);
  if (params.requireSlot === false) qs.set('requireSlot', 'false');
  return apiGet<{ city: City; date: string; count: number; businesses: CatalogBusiness[] }>(
    `/catalog/businesses?${qs.toString()}`
  );
}

export function fetchBusinessDetail(id: string) {
  return apiGet<{ business: BusinessDetail; services: Service[]; staff: Staff[] }>(`/catalog/businesses/${id}`);
}

export function fetchAvailability(businessId: string, serviceId: string, date: string) {
  const qs = new URLSearchParams({ serviceId, date });
  return apiGet<{ date: string; slots: { time: string; staffId: string }[] }>(
    `/catalog/businesses/${businessId}/availability?${qs.toString()}`
  );
}

export function createBooking(payload: {
  businessId: string;
  serviceId: string;
  staffId: string;
  date: string;
  startTime: string;
  comment?: string;
}) {
  return apiPost<{ booking: { _id: string } }>('/bookings', payload);
}

export function fetchAvailabilityMulti(businessId: string, serviceIds: string[], date: string) {
  const qs = new URLSearchParams({ serviceIds: serviceIds.join(','), date });
  return apiGet<{ date: string; slots: { time: string; staffId: string }[]; totalDuration: number }>(
    `/catalog/businesses/${businessId}/availability-multi?${qs.toString()}`
  );
}

export function createGroupBooking(payload: {
  businessId: string;
  serviceIds: string[];
  staffId: string;
  date: string;
  startTime: string;
  comment?: string;
}) {
  return apiPost<{ bookings: { _id: string }[] }>('/bookings/group', payload);
}

export function fetchMe() {
  return apiGet<{ user: User }>('/auth/me');
}

export function login(email: string, password: string) {
  return apiPost<{ user: User }>('/auth/login', { email, password });
}

export function registerClient(payload: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  citySlug: string;
  agreeToTerms: boolean;
}) {
  return apiPost<{ pendingVerification: true; email: string }>('/auth/register/client', payload);
}

export function registerBusiness(payload: {
  ownerName: string;
  email: string;
  phone?: string;
  password: string;
  businessName: string;
  category: string;
  customCategoryName?: string;
  citySlug: string;
  agreeToTerms: boolean;
}) {
  return apiPost<{ pendingVerification: true; email: string }>('/auth/register/business', payload);
}

export function verifyRegistrationCode(payload: { email: string; code: string }) {
  return apiPost<{ user: User }>('/auth/verify-registration', payload);
}

export function resendVerificationCode(payload: { email: string }) {
  return apiPost<{ ok: boolean }>('/auth/resend-code', payload);
}

export function logout() {
  return apiPost<{ ok: boolean }>('/auth/logout');
}

export type ClientBooking = {
  _id: string;
  business: { _id: string; name: string; category: string; cancellationPolicyHours: number };
  service: { _id: string; name: string };
  staff: { _id: string; name: string };
  date: string;
  startTime: string;
  status: string;
  hasReview: boolean;
  review?: Pick<Review, '_id' | 'rating' | 'text' | 'dispute'> | null;
  readyAt?: string;
  groupId?: string | null;
  _group: 'upcoming' | 'past' | 'cancelled';
};

export type ReviewDispute = {
  status: 'OPEN' | 'UPHELD' | 'DISMISSED';
  reason: string;
  openedAt: string;
  clientResponse?: string;
  clientRespondedAt?: string;
  resolution?: string;
  resolvedAt?: string;
};

export type Review = {
  _id: string;
  business: string | { _id: string; name: string };
  client: { _id: string; name: string };
  booking: string;
  rating: number;
  text: string;
  status: 'PUBLISHED' | 'PENDING' | 'REJECTED';
  reply?: { text?: string; repliedAt?: string };
  replyFlagged: boolean;
  dispute?: ReviewDispute;
  createdAt: string;
};

export type ClientNotification = {
  _id: string;
  type: string;
  title: string;
  text: string;
  read: boolean;
  createdAt: string;
  relatedBooking?: {
    _id: string;
    status: string;
    cancellationConfirmation?: { respondedAt?: string; response?: 'yes' | 'no' };
  };
};

export function fetchClientBookings(tab?: 'upcoming' | 'past' | 'cancelled') {
  const qs = tab ? `?tab=${tab}` : '';
  return apiGet<{ bookings: ClientBooking[] }>(`/client/bookings${qs}`);
}

export function cancelClientBooking(id: string) {
  return apiPost<{ booking: ClientBooking; isLate: boolean; policyHours: number }>(`/client/bookings/${id}/cancel`);
}

export function rescheduleClientBooking(id: string, payload: { date: string; startTime: string; staffId: string }) {
  return apiPost<{ booking: ClientBooking; isLate: boolean; policyHours: number }>(
    `/client/bookings/${id}/reschedule`,
    payload
  );
}

export function confirmCancellation(bookingId: string, response: 'yes' | 'no') {
  return apiPost<{ ok: boolean }>(`/client/bookings/${bookingId}/confirm-cancellation`, { response });
}

export function createReview(bookingId: string, payload: { rating: number; text: string }) {
  return apiPost<{ review: Review; needsModeration: boolean }>(`/client/bookings/${bookingId}/review`, payload);
}

export function respondToReviewDispute(reviewId: string, response: string) {
  return apiPost<{ review: Review }>(`/client/reviews/${reviewId}/dispute-response`, { response });
}

export function fetchBusinessReviewsPublic(businessId: string) {
  return apiGet<{ reviews: Review[] }>(`/catalog/businesses/${businessId}/reviews`);
}

export function fetchFavorites() {
  return apiGet<{ businesses: CatalogBusiness[] }>('/client/favorites');
}

export function addFavorite(businessId: string) {
  return apiPost<{ ok: boolean }>(`/client/favorites/${businessId}`);
}

export function removeFavorite(businessId: string) {
  return apiDelete<{ ok: boolean }>(`/client/favorites/${businessId}`);
}

export function fetchNotifications() {
  return apiGet<{ notifications: ClientNotification[] }>('/client/notifications');
}

export function markNotificationRead(id: string) {
  return apiPost<{ ok: boolean }>(`/client/notifications/${id}/read`);
}

export function updateClientProfile(payload: Partial<{ name: string; phone: string; language: 'uk' | 'en' }>) {
  return apiPatch<{ user: User }>('/client/profile', payload);
}

export function uploadClientAvatar(file: File) {
  const form = new FormData();
  form.append('avatar', file);
  return apiUpload<{ avatarUrl: string }>('/client/profile/avatar', form);
}

export function deleteClientAvatar() {
  return apiDelete<{ ok: boolean }>('/client/profile/avatar');
}

export function changeClientPassword(payload: { currentPassword: string; newPassword: string }) {
  return apiPost<{ ok: boolean }>('/client/profile/password', payload);
}

export type ClientStats = { totalBookings: number; completedBookings: number; totalSpent: number };

export function fetchClientStats() {
  return apiGet<ClientStats>('/client/stats');
}

export type DaySchedule = { start: string; end: string; dayOff?: boolean; breakStart?: string; breakEnd?: string };
export type WeekSchedule = Partial<Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', DaySchedule>>;

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Mirrors backend/utils/availability.js's maxWorkingDayMinutes — the longest single
// non-day-off day in the week, since a service must fit within one day, not a sum/average.
// A lunch break splits a day into two segments a service can't span, so the cap for that
// day is the longer of the two, not the full open-to-close span.
export function maxWorkingDayMinutes(schedule?: WeekSchedule): number {
  if (!schedule) return 0;
  let max = 0;
  for (const day of Object.values(schedule)) {
    if (!day || day.dayOff || !day.start || !day.end) continue;
    const dayStart = hhmmToMinutes(day.start);
    const dayEnd = hhmmToMinutes(day.end);
    if (day.breakStart && day.breakEnd) {
      const breakStart = hhmmToMinutes(day.breakStart);
      const breakEnd = hhmmToMinutes(day.breakEnd);
      max = Math.max(max, breakStart - dayStart, dayEnd - breakEnd);
    } else {
      max = Math.max(max, dayEnd - dayStart);
    }
  }
  return max;
}

export type BusinessStaff = {
  _id: string;
  name: string;
  role?: string;
  bio?: string;
  photoUrl?: string;
  schedule?: WeekSchedule;
  timeOff?: { _id: string; from: string; to: string; note?: string }[];
};

export type BusinessBooking = {
  _id: string;
  clientName: string;
  clientPhone?: string;
  service: { _id: string; name: string; price: number };
  staff: { _id: string; name: string };
  date: string;
  startTime: string;
  durationMinutes: number;
  source: 'platform' | 'manual';
  status: string;
  price: number;
  comment?: string;
  readyAt?: string;
  phoneRevealed?: boolean;
  phoneRevealAt?: string;
  // True when the client booked without picking a specific master and the system
  // auto-assigned whoever was free — the business can confirm/reassign via
  // assignBusinessBookingStaff. `staff` above still points at that auto-pick.
  autoAssignedStaff?: boolean;
};

export type BusinessStats = {
  bookingsToday: number;
  bookingsWeek: number;
  revenueToday: number;
  revenueMonth: number;
  rating: number;
  top?: { active: boolean; until?: string };
};

export function fetchBusinessMe() {
  return apiGet<{ business: BusinessDetail }>('/business/me');
}

export function updateBusinessMe(payload: Partial<{
  description: string;
  address: string;
  district: string;
  phone: string;
  googleMapsUrl: string;
  socials: { instagram?: string; facebook?: string };
}>) {
  return apiPatch<{ business: BusinessDetail }>('/business/me', payload);
}

export function updateBusinessWorkingHours(workingHours: WeekSchedule) {
  return apiPatch<{ business: BusinessDetail }>('/business/me/working-hours', { workingHours });
}

export function uploadBusinessCoverPhoto(file: File) {
  const form = new FormData();
  form.append('photo', file);
  return apiUpload<{ business: BusinessDetail }>('/business/me/cover-photo', form);
}

export function uploadBusinessGalleryPhotos(files: File[]) {
  const form = new FormData();
  files.forEach((f) => form.append('photos', f));
  return apiUpload<{ business: BusinessDetail }>('/business/me/gallery', form);
}

export function deleteBusinessGalleryPhoto(url: string) {
  return apiSend<{ business: BusinessDetail }>('DELETE', '/business/me/gallery', { url });
}

export function fetchBusinessStats() {
  return apiGet<BusinessStats>('/business/stats');
}

export function fetchBusinessBookings(date: string) {
  return apiGet<{ from: string; to: string; bookings: BusinessBooking[] }>(`/business/bookings?date=${date}`);
}

export function createManualBooking(payload: {
  serviceId: string;
  staffId: string;
  date: string;
  startTime: string;
  clientName: string;
  clientPhone?: string;
  comment?: string;
}) {
  return apiPost<{ booking: BusinessBooking }>('/business/bookings', payload);
}

export function cancelBusinessBooking(id: string) {
  return apiPost<{ booking: BusinessBooking }>(`/business/bookings/${id}/cancel`);
}

export function markBusinessBookingReady(id: string) {
  return apiPost<{ booking: BusinessBooking }>(`/business/bookings/${id}/ready`);
}

export function rescheduleBusinessBooking(
  id: string,
  payload: { date: string; startTime: string; staffId?: string }
) {
  return apiPost<{ booking: BusinessBooking; isLate: boolean; policyHours: number }>(
    `/business/bookings/${id}/reschedule`,
    payload
  );
}

export function completeBusinessBooking(id: string) {
  return apiPost<{ booking: BusinessBooking }>(`/business/bookings/${id}/complete`);
}

export function updateBookingDuration(id: string, durationMinutes: number) {
  return apiPatch<{ booking: BusinessBooking }>(`/business/bookings/${id}/duration`, { durationMinutes });
}

export function assignBusinessBookingStaff(id: string, staffId: string) {
  return apiPatch<{ booking: BusinessBooking }>(`/business/bookings/${id}/assign-staff`, { staffId });
}

export function noShowBusinessBooking(id: string) {
  return apiPost<{ booking: BusinessBooking }>(`/business/bookings/${id}/no-show`);
}

export type TopPackageId = '1week' | '2weeks' | '1month';
export type TopPackages = Record<TopPackageId, { days: number; price: number }>;

export type TopPlacement = {
  _id: string;
  business: string | { _id: string; name: string; category: string };
  package: TopPackageId;
  amount: number;
  durationDays: number;
  status: 'PENDING' | 'AWAITING_ACTIVATION' | 'CONFIRMED' | 'REJECTED';
  requestedAt: string;
  receiptUrl?: string;
  paymentConfirmedAt?: string;
  activateAt?: string;
  confirmedAt?: string;
  expiresAt?: string;
  rejectionReason?: string;
};

export function fetchBusinessTopPlacement() {
  return apiGet<{
    top: { active: boolean; until?: string };
    packages: TopPackages;
    pending: TopPlacement | null;
    history: TopPlacement[];
  }>('/business/top-placement');
}

export function purchaseTopPlacement(pkg: TopPackageId) {
  return apiPost<{ placement: TopPlacement }>('/business/top-placement', { package: pkg });
}

export function fetchAdminTopPlacements(params: { status?: string; business?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.business) qs.set('business', params.business);
  return apiGet<{ placements: TopPlacement[] }>(`/admin/top-placements?${qs.toString()}`);
}

export function confirmAdminTopPlacement(id: string) {
  return apiPost<{ placement: TopPlacement }>(`/admin/top-placements/${id}/confirm`);
}

export function rejectAdminTopPlacement(id: string, reason?: string) {
  return apiPost<{ placement: TopPlacement }>(`/admin/top-placements/${id}/reject`, { reason });
}

export type InvoiceItem = {
  booking?: string;
  date: string;
  clientName: string;
  serviceName: string;
  price: number;
  source: 'platform' | 'manual';
  commissionRate: number;
  commissionAmount: number;
};

export type Invoice = {
  _id: string;
  business: string | { _id: string; name: string };
  month: string;
  items: InvoiceItem[];
  totalCommission: number;
  status: 'PENDING' | 'AWAITING_VERIFICATION' | 'PAID' | 'OVERDUE' | 'BLOCKED';
  issuedAt: string;
  dueAt: string;
  paidAt?: string;
  receiptUrl?: string;
  paymentConfirmedAt?: string;
  receiptRejectedReason?: string;
  receiptHistory?: {
    receiptUrl?: string;
    submittedAt?: string;
    status: 'PENDING_REVIEW' | 'REJECTED' | 'ACCEPTED';
    rejectedReason?: string;
    resolvedAt?: string;
  }[];
};

export function fetchBusinessInvoices() {
  return apiGet<{ invoices: Invoice[]; billing: { status: string; unpaidSince?: string } }>('/business/invoices');
}

export function confirmInvoicePayment(id: string, receipt: File) {
  const form = new FormData();
  form.append('receipt', receipt);
  return apiUpload<{ invoice: Invoice }>(`/business/invoices/${id}/confirm-payment`, form);
}

export function confirmTopPlacementPayment(id: string, receipt: File) {
  const form = new FormData();
  form.append('receipt', receipt);
  return apiUpload<{ placement: TopPlacement }>(`/business/top-placement/${id}/confirm-payment`, form);
}

export function fetchAdminInvoices(params: { status?: string; business?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.business) qs.set('business', params.business);
  return apiGet<{ invoices: Invoice[] }>(`/admin/invoices?${qs.toString()}`);
}

export function markAdminInvoicePaid(id: string) {
  return apiPost<{ invoice: Invoice }>(`/admin/invoices/${id}/mark-paid`);
}

export function rejectAdminInvoiceReceipt(id: string, reason?: string) {
  return apiPost<{ invoice: Invoice }>(`/admin/invoices/${id}/reject-receipt`, { reason });
}

export type PaymentRequisites = {
  commissionRequisites: string;
  topPlacementRequisites: string;
};

export function fetchAdminRequisites() {
  return apiGet<PaymentRequisites>('/admin/settings/requisites');
}

export function updateAdminRequisites(payload: Partial<PaymentRequisites>) {
  return apiPatch<PaymentRequisites>('/admin/settings/requisites', payload);
}

export function fetchBusinessPaymentRequisites() {
  return apiGet<PaymentRequisites>('/business/payment-requisites');
}

export type AdminFinanceOverview = {
  overdue: { count: number; total: number };
  pending: { count: number; total: number };
  collectedThisMonth: { count: number; total: number };
};

export function fetchAdminFinanceOverview() {
  return apiGet<AdminFinanceOverview>('/admin/finance/overview');
}

export type StaffEarnings = { staffId: string; name: string; photoUrl?: string; bookings: number; revenue: number };

export type BusinessAnalytics = {
  daily: { date: string; bookings: number; revenue: number }[];
  sourceSplit: { platform: number; manual: number };
  topServices: { serviceId: string; name: string; bookings: number; revenue: number }[];
  staffBreakdown: StaffEarnings[];
  mvpStaffId: string | null;
  summary: {
    totalRevenue: number;
    completedBookings: number;
    averageCheck: number;
    totalCommission: number;
    netEarnings: number;
    previousRevenue: number;
    revenueChangePercent: number;
  };
};

export function fetchBusinessAnalytics(days: 7 | 30 | 90 = 30, staffId?: string) {
  const params = new URLSearchParams({ days: String(days) });
  if (staffId) params.set('staffId', staffId);
  return apiGet<BusinessAnalytics>(`/business/analytics?${params.toString()}`);
}

export type AdminAnalytics = {
  daily: { date: string; newBusinesses: number; newClients: number; completedBookings: number; revenue: number }[];
  categoryBreakdown: { category: string; count: number }[];
  topBusinesses: { name: string; bookings: number; revenue: number }[];
  summary: {
    totalGMV: number;
    totalPlatformRevenue: number;
    outstandingInvoices: number;
    paidThisMonth: number;
    overdueCount: number;
  };
};

export function fetchAdminAnalytics(days: 7 | 30 | 90 = 30) {
  return apiGet<AdminAnalytics>(`/admin/analytics?days=${days}`);
}

export function fetchBusinessOwnReviews() {
  return apiGet<{ reviews: Review[] }>('/business/reviews');
}

export function replyToReview(reviewId: string, text: string) {
  return apiPost<{ review: Review }>(`/business/reviews/${reviewId}/reply`, { text });
}

export function disputeReview(reviewId: string, reason: string) {
  return apiPost<{ review: Review }>(`/business/reviews/${reviewId}/dispute`, { reason });
}

export function fetchBusinessServices() {
  return apiGet<{ services: Service[] }>('/business/services');
}

export function createBusinessService(payload: {
  name: string;
  description?: string;
  price: number;
  isFree?: boolean;
  combinable?: boolean;
  durationMinutes: number;
  category: string;
  customCategoryName?: string;
  staff?: string[];
}) {
  return apiPost<{ service: Service }>('/business/services', payload);
}

export function updateBusinessService(id: string, payload: Partial<{
  name: string;
  description: string;
  price: number;
  isFree: boolean;
  combinable: boolean;
  durationMinutes: number;
  category: string;
  staff: string[];
}>) {
  return apiPatch<{ service: Service }>(`/business/services/${id}`, payload);
}

export function deleteBusinessService(id: string) {
  return apiDelete<{ ok: boolean }>(`/business/services/${id}`);
}

export function uploadServicePhoto(id: string, file: File) {
  const form = new FormData();
  form.append('photo', file);
  return apiUpload<{ service: Service }>(`/business/services/${id}/photo`, form);
}

export function deleteServicePhoto(id: string) {
  return apiDelete<{ service: Service }>(`/business/services/${id}/photo`);
}

export function fetchBusinessStaff() {
  return apiGet<{ staff: BusinessStaff[] }>('/business/staff');
}

export function createBusinessStaff(payload: { name: string; role?: string; bio?: string }) {
  return apiPost<{ staff: BusinessStaff }>('/business/staff', payload);
}

export function updateBusinessStaff(id: string, payload: Partial<{ name: string; role: string; bio: string; schedule: WeekSchedule }>) {
  return apiPatch<{ staff: BusinessStaff }>(`/business/staff/${id}`, payload);
}

export function deleteBusinessStaff(id: string) {
  return apiDelete<{ ok: boolean }>(`/business/staff/${id}`);
}

export function uploadStaffPhoto(id: string, file: File) {
  const form = new FormData();
  form.append('photo', file);
  return apiUpload<{ staff: BusinessStaff }>(`/business/staff/${id}/photo`, form);
}

export function deleteStaffPhoto(id: string) {
  return apiDelete<{ staff: BusinessStaff }>(`/business/staff/${id}/photo`);
}

export function deleteBusinessCoverPhoto() {
  return apiDelete<{ business: BusinessDetail }>('/business/me/cover-photo');
}

export function addStaffTimeOff(id: string, payload: { from: string; to: string; note?: string }) {
  return apiPost<{ staff: BusinessStaff }>(`/business/staff/${id}/time-off`, payload);
}

export function removeStaffTimeOff(id: string, timeOffId: string) {
  return apiDelete<{ staff: BusinessStaff }>(`/business/staff/${id}/time-off/${timeOffId}`);
}

export type BusinessNotification = {
  _id: string;
  type: string;
  title: string;
  text: string;
  read: boolean;
  createdAt: string;
};

export function fetchBusinessNotifications() {
  return apiGet<{ notifications: BusinessNotification[] }>('/business/notifications');
}

export function markBusinessNotificationRead(id: string) {
  return apiPost<{ ok: boolean }>(`/business/notifications/${id}/read`);
}

export type AdminOverview = {
  activeBusinesses: number;
  pendingBusinesses: number;
  clients: number;
  completedBookingsCount: number;
  platformRevenue: number;
};

export type AdminBusiness = {
  _id: string;
  name: string;
  category: string;
  status: string;
  description?: string;
  address?: string;
  phone?: string;
  district?: string;
  city?: { _id: string; name: string };
  rejectionReason?: string;
  owner: { name: string; email: string };
  createdAt: string;
  googleRating?: number;
  googleReviewsCount?: number;
  platformRating?: number;
  platformReviewsCount?: number;
  top?: { active: boolean; until?: string };
  billing?: { status: 'CURRENT' | 'OVERDUE' | 'BLOCKED' };
  blockedUntil?: string | null;
  blockReason?: string;
};

export const ADMIN_PERMISSION_BUCKETS = [
  'businesses',
  'reviews',
  'categories',
  'topPlacements',
  'users',
  'finance',
  'support',
] as const;

export type AdminPermissionBucket = (typeof ADMIN_PERMISSION_BUCKETS)[number];

export type TeamMember = {
  _id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'MODERATOR' | 'FINANCE_ADMIN' | 'ADMIN';
  permissions?: AdminPermissionBucket[];
  createdAt: string;
};

export function fetchAdminTeam() {
  return apiGet<{ team: TeamMember[] }>('/admin/team');
}

export function inviteAdminTeamMember(payload: {
  name: string;
  email: string;
  password: string;
  role: 'MODERATOR' | 'FINANCE_ADMIN' | 'ADMIN';
  permissions?: AdminPermissionBucket[];
}) {
  return apiPost<{ member: TeamMember }>('/admin/team', payload);
}

export function removeAdminTeamMember(id: string) {
  return apiDelete<{ ok: boolean }>(`/admin/team/${id}`);
}

export function updateAdminOwnCredentials(payload: { currentPassword: string; newEmail?: string; newPassword?: string }) {
  return apiPatch<{ user: { id: string; name: string; email: string; role: string } }>('/admin/me/credentials', payload);
}

export function updateAdminTeamMemberCredentials(id: string, payload: { newEmail?: string; newPassword?: string }) {
  return apiPatch<{ member: TeamMember }>(`/admin/team/${id}/credentials`, payload);
}

export function fetchAdminOverview() {
  return apiGet<AdminOverview>('/admin/overview');
}

export type AdminPendingCounts = { pendingBusinesses: number; pendingTopPlacements: number; pendingInvoices: number };

export function fetchAdminPendingCounts() {
  return apiGet<AdminPendingCounts>('/admin/pending-counts');
}

export function fetchAdminBusinesses(status?: string) {
  const qs = status ? `?status=${status}` : '';
  return apiGet<{ businesses: AdminBusiness[] }>(`/admin/businesses${qs}`);
}

export function approveAdminBusiness(id: string) {
  return apiPost<{ business: AdminBusiness }>(`/admin/businesses/${id}/approve`);
}

export function rejectAdminBusiness(id: string, reason?: string) {
  return apiPost<{ business: AdminBusiness }>(`/admin/businesses/${id}/reject`, { reason });
}

export function blockAdminBusiness(id: string, payload?: { reason?: string; durationDays?: number }) {
  return apiPost<{ business: AdminBusiness }>(`/admin/businesses/${id}/block`, payload);
}

export function unblockAdminBusiness(id: string) {
  return apiPost<{ business: AdminBusiness }>(`/admin/businesses/${id}/unblock`);
}

export function grantAdminBusinessTop(id: string, durationDays: number) {
  return apiPost<{ business: AdminBusiness }>(`/admin/businesses/${id}/grant-top`, { durationDays });
}

export function revokeAdminBusinessTop(id: string) {
  return apiPost<{ business: AdminBusiness }>(`/admin/businesses/${id}/revoke-top`);
}

export type AdminBusinessDetail = BusinessDetail & {
  owner: { name: string; email: string; phone?: string };
  blockedUntil?: string | null;
  blockReason?: string;
  createdAt?: string;
  city?: { _id: string; name: string };
};

export type AdminBusinessStats = {
  servicesCount: number;
  staffCount: number;
  completedBookings: number;
  totalRevenue: number;
};

export function fetchAdminBusinessDetail(id: string) {
  return apiGet<{ business: AdminBusinessDetail; stats: AdminBusinessStats }>(`/admin/businesses/${id}`);
}

export function deleteAdminBusiness(id: string) {
  return apiDelete<{ ok: boolean }>(`/admin/businesses/${id}`);
}

export type AdminUser = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'CLIENT' | 'BUSINESS_OWNER';
  rating?: number;
  blockedUntil?: string | null;
  blockReason?: string;
  business?: string;
  createdAt: string;
};

export type AdminCategory = {
  _id: string;
  slug: string;
  name: string;
  nameEn: string;
  status: 'ACTIVE' | 'PENDING' | 'REJECTED';
  requestedByBusiness?: { _id: string; name: string };
  createdAt: string;
};

export function fetchAdminCategories(status?: string) {
  const qs = status ? `?status=${status}` : '';
  return apiGet<{ categories: AdminCategory[] }>(`/admin/categories${qs}`);
}

export function createAdminCategory(payload: { name: string; nameEn: string }) {
  return apiPost<{ category: AdminCategory }>('/admin/categories', payload);
}

export function approveAdminCategory(id: string) {
  return apiPost<{ category: AdminCategory }>(`/admin/categories/${id}/approve`);
}

export function rejectAdminCategory(id: string) {
  return apiPost<{ category: AdminCategory }>(`/admin/categories/${id}/reject`);
}

export type AdminAuditLogEntry = {
  _id: string;
  admin: { _id: string; name: string; email: string } | null;
  adminRole: string;
  action: string;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  meta?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: string;
};

export function fetchAdminAuditLog() {
  return apiGet<{ entries: AdminAuditLogEntry[] }>('/admin/audit-log');
}

export function fetchAdminUsers(params: { role?: 'CLIENT' | 'BUSINESS_OWNER'; q?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.role) qs.set('role', params.role);
  if (params.q) qs.set('q', params.q);
  return apiGet<{ users: AdminUser[] }>(`/admin/users?${qs.toString()}`);
}

export function blockAdminUser(id: string, payload?: { reason?: string; durationDays?: number }) {
  return apiPost<{ ok: boolean }>(`/admin/users/${id}/block`, payload);
}

export function unblockAdminUser(id: string) {
  return apiPost<{ ok: boolean }>(`/admin/users/${id}/unblock`);
}

export function deleteAdminUser(id: string) {
  return apiDelete<{ ok: boolean }>(`/admin/users/${id}`);
}

export function fetchAdminReviews(params: { status?: string; flaggedReplies?: boolean } = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.flaggedReplies) qs.set('flaggedReplies', 'true');
  return apiGet<{ reviews: Review[] }>(`/admin/reviews?${qs.toString()}`);
}

export function approveAdminReview(id: string) {
  return apiPost<{ review: Review }>(`/admin/reviews/${id}/approve`);
}

export function rejectAdminReview(id: string) {
  return apiPost<{ review: Review }>(`/admin/reviews/${id}/reject`);
}

export function resolveAdminReviewDispute(id: string, decision: 'UPHELD' | 'DISMISSED', note?: string) {
  return apiPost<{ review: Review }>(`/admin/reviews/${id}/dispute-resolve`, { decision, note });
}

export function removeAdminReviewReply(id: string) {
  return apiPost<{ review: Review }>(`/admin/reviews/${id}/remove-reply`);
}

export function clearAdminReplyFlag(id: string) {
  return apiPost<{ review: Review }>(`/admin/reviews/${id}/clear-reply-flag`);
}

export type SupportMessage = {
  _id: string;
  thread: string;
  from: 'user' | 'admin';
  author: string;
  authorName: string;
  text: string;
  createdAt: string;
};

export type SupportThread = {
  _id: string;
  user: string;
  userRole: string;
  userName: string;
  userEmail: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  lastMessageFrom?: 'user' | 'admin';
  unreadByAdmin: number;
  unreadByUser: number;
  status: 'ACTIVE' | 'COMPLETED';
  createdAt: string;
};

export function fetchSupportThread() {
  return apiGet<{ thread: SupportThread | null; messages: SupportMessage[] }>('/support/thread');
}

export function sendSupportMessage(text: string) {
  return apiPost<{ message: SupportMessage }>('/support/thread/messages', { text });
}

export function markSupportThreadRead() {
  return apiPost<{ ok: boolean }>('/support/thread/read');
}

export function fetchAdminSupportThreads() {
  return apiGet<{ threads: SupportThread[] }>('/support/admin/threads');
}

export function fetchAdminSupportThread(id: string) {
  return apiGet<{ thread: SupportThread; messages: SupportMessage[] }>(`/support/admin/threads/${id}`);
}

export function sendAdminSupportMessage(id: string, text: string) {
  return apiPost<{ message: SupportMessage }>(`/support/admin/threads/${id}/messages`, { text });
}

export function resolveAdminSupportThread(id: string) {
  return apiPost<{ thread: SupportThread }>(`/support/admin/threads/${id}/resolve`);
}

export function reopenAdminSupportThread(id: string) {
  return apiPost<{ thread: SupportThread }>(`/support/admin/threads/${id}/reopen`);
}

export function markAdminSupportThreadRead(id: string) {
  return apiPost<{ ok: boolean }>(`/support/admin/threads/${id}/read`);
}

export type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'textarea';

export type CustomFieldDefinition = {
  _id: string;
  key: string;
  label: string;
  type: CustomFieldType;
  options: string[];
  order: number;
};

export type BusinessClientSummary = {
  phone: string;
  displayPhone: string;
  name: string;
  visitsCount: number;
  totalSpent: number;
  lastVisitAt: string;
  bookingsCount: number;
};

export type BusinessClientBooking = {
  _id: string;
  date: string;
  startTime: string;
  status: string;
  price: number;
  source: 'platform' | 'manual';
  service: { _id: string; name: string } | null;
  staff: { _id: string; name: string } | null;
  comment?: string;
};

export type BusinessClientDetail = {
  phone: string;
  displayPhone: string;
  name: string;
  notes: string;
  customFieldValues: Record<string, string | number>;
  fieldDefinitions: CustomFieldDefinition[];
  bookings: BusinessClientBooking[];
};

export function fetchBusinessClients(q?: string) {
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  return apiGet<{ clients: BusinessClientSummary[] }>(`/business/clients${qs}`);
}

export function fetchBusinessClientDetail(phone: string) {
  return apiGet<BusinessClientDetail>(`/business/clients/${encodeURIComponent(phone)}`);
}

export function updateBusinessClient(
  phone: string,
  payload: { notes?: string; customFieldValues?: Record<string, unknown> }
) {
  return apiPatch<{ notes: string; customFieldValues: Record<string, unknown> }>(
    `/business/clients/${encodeURIComponent(phone)}`,
    payload
  );
}

export function fetchCustomFields() {
  return apiGet<{ fields: CustomFieldDefinition[] }>('/business/custom-fields');
}

export function createCustomField(payload: { label: string; type: CustomFieldType; options?: string[] }) {
  return apiPost<{ field: CustomFieldDefinition }>('/business/custom-fields', payload);
}

export function updateCustomField(id: string, payload: { label?: string; options?: string[]; order?: number }) {
  return apiPatch<{ field: CustomFieldDefinition }>(`/business/custom-fields/${id}`, payload);
}

export function deleteCustomField(id: string) {
  return apiDelete<{ ok: boolean }>(`/business/custom-fields/${id}`);
}

export type Expense = {
  _id: string;
  category: string;
  amount: number;
  date: string;
  note: string;
  createdAt: string;
};

export function fetchBusinessExpenses(days: 7 | 30 | 90 = 30) {
  return apiGet<{ expenses: Expense[]; total: number }>(`/business/expenses?days=${days}`);
}

export function createExpense(payload: { category: string; amount: number; date: string; note?: string }) {
  return apiPost<{ expense: Expense }>('/business/expenses', payload);
}

export function deleteExpense(id: string) {
  return apiDelete<{ ok: boolean }>(`/business/expenses/${id}`);
}

export type AvailabilitySlotStatus = 'off' | 'free' | 'busy' | 'tight';

export type AvailabilitySlot = {
  time: string;
  status: AvailabilitySlotStatus;
  clientName?: string;
  booking?: BusinessBooking;
};

export type WeekAvailabilityDay = {
  date: string;
  weekday: string;
  working: boolean;
  slots: AvailabilitySlot[];
};

export type WeekAvailability = {
  staffId: string;
  staffName: string;
  serviceId: string | null;
  durationMinutes: number;
  gridStartHour: number;
  gridEndHour: number;
  stepMinutes: number;
  weekStart: string;
  days: WeekAvailabilityDay[];
};

export function fetchWeekAvailability(staffId: string, weekStart: string, serviceId?: string) {
  const qs = new URLSearchParams({ from: weekStart });
  if (serviceId) qs.set('serviceId', serviceId);
  return apiGet<WeekAvailability>(`/business/staff/${staffId}/week-availability?${qs.toString()}`);
}

export type MergedAvailabilitySlot = { time: string; status: 'free' | 'busy' | 'off'; freeStaffIds: string[] };
export type MergedAvailabilityDay = { date: string; weekday: string; slots: MergedAvailabilitySlot[] };

export type ServiceWeekAvailability = {
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  staff: { _id: string; name: string }[];
  gridStartHour: number;
  gridEndHour: number;
  stepMinutes: number;
  weekStart: string;
  days: MergedAvailabilityDay[];
};

export function fetchServiceWeekAvailability(serviceId: string, weekStart: string) {
  const qs = new URLSearchParams({ from: weekStart });
  return apiGet<ServiceWeekAvailability>(`/business/services/${serviceId}/week-availability?${qs.toString()}`);
}

export type MetricGroup = 'revenue' | 'expense' | 'info';
export type MetricUnit = 'currency' | 'number' | 'percent' | 'text';
export type MetricPersistence = 'monthly' | 'recurring';

export type BusinessMetricDefinition = {
  _id: string;
  key: string;
  label: string;
  group: MetricGroup;
  unit: MetricUnit;
  persistence: MetricPersistence;
  order: number;
  archived: boolean;
};

export type LedgerManualField = {
  key: string;
  label: string;
  group: MetricGroup;
  unit: MetricUnit;
  persistence: MetricPersistence;
  value: number | string;
};

export type LedgerInsight = { severity: 'positive' | 'warning' | 'info'; text: string };

export type LedgerAutoStats = {
  revenue: number;
  commission: number;
  expenseTotal: number;
  topExpenseCategory: { category: string; amount: number } | null;
  bookingsCount: number;
  completedCount: number;
  cancelledCount: number;
  noShowCount: number;
  averageCheck: number;
  cancellationRatePercent: number;
};

export type LedgerTotals = {
  grossRevenue: number;
  totalExpenses: number;
  netProfit: number;
  marginPercent: number;
};

export type MonthLedger = {
  month: string;
  auto: LedgerAutoStats;
  manualFields: LedgerManualField[];
  totals: LedgerTotals;
  previousMonth: string;
  insights: LedgerInsight[];
};

export type ReportPeriod = 'month' | 'quarter' | 'half-year' | '9-months' | 'year';

export type LedgerReport = {
  period: ReportPeriod;
  endMonth: string;
  months: MonthLedger[];
  totals: LedgerTotals & { bookingsCount: number; completedCount: number; averageCheck: number };
  insights: LedgerInsight[];
};

export function fetchMetricDefinitions() {
  return apiGet<{ definitions: BusinessMetricDefinition[] }>('/business/metric-definitions');
}

export function createMetricDefinition(payload: { label: string; group: MetricGroup; unit: MetricUnit; persistence: MetricPersistence }) {
  return apiPost<{ definition: BusinessMetricDefinition }>('/business/metric-definitions', payload);
}

export function updateMetricDefinition(
  id: string,
  payload: Partial<{ label: string; group: MetricGroup; unit: MetricUnit; persistence: MetricPersistence; order: number }>
) {
  return apiPatch<{ definition: BusinessMetricDefinition }>(`/business/metric-definitions/${id}`, payload);
}

export function deleteMetricDefinition(id: string) {
  return apiDelete<{ ok: boolean }>(`/business/metric-definitions/${id}`);
}

export function fetchMonthLedger(month: string) {
  return apiGet<MonthLedger>(`/business/ledger/${month}`);
}

export function updateMonthLedger(month: string, values: Record<string, string | number>) {
  return apiPatch<{ ok: boolean }>(`/business/ledger/${month}`, { values });
}

export function fetchLedgerReport(period: ReportPeriod, endMonth?: string) {
  const qs = endMonth ? `?end=${endMonth}` : '';
  return apiGet<LedgerReport>(`/business/reports/${period}${qs}`);
}
