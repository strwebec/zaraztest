import type { Locale } from '@/lib/i18n';

export const ADMIN_ROLES = ['SUPER_ADMIN', 'MODERATOR', 'FINANCE_ADMIN'];

export function roleHomeHref(locale: Locale, role: string) {
  if (role === 'BUSINESS_OWNER') return `/${locale}/business-account/dashboard`;
  if (ADMIN_ROLES.includes(role)) return `/${locale}/admin/dashboard`;
  return `/${locale}/client/bookings`;
}

// A `?redirect=` param is only safe to honor after login if it points into the
// area the resolved role actually has access to — otherwise a role-gated layout's
// own auth guard (which appends `?redirect=<path>`) immediately bounces the user
// back to login, looping (e.g. an admin login redirected into /business-account).
export function isRedirectAllowedForRole(redirect: string, locale: Locale, role: string) {
  if (redirect.startsWith(`/${locale}/business-account`)) return role === 'BUSINESS_OWNER';
  if (redirect.startsWith(`/${locale}/admin`)) return ADMIN_ROLES.includes(role);
  if (redirect.startsWith(`/${locale}/client`)) return !ADMIN_ROLES.includes(role) && role !== 'BUSINESS_OWNER';
  return true;
}
