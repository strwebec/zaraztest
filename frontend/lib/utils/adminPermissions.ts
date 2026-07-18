import type { AdminPermissionBucket } from './api';

// Mirrors backend/middleware/adminPermission.js — MODERATOR and FINANCE_ADMIN keep
// their fixed bundles; only ADMIN is checked against the account's own permissions.
const MODERATOR_BUCKETS: AdminPermissionBucket[] = [
  'businesses',
  'reviews',
  'categories',
  'topPlacements',
  'users',
  'support',
];

export function hasAdminPermission(
  role: string | undefined,
  permissions: AdminPermissionBucket[] | undefined,
  bucket: AdminPermissionBucket
): boolean {
  if (role === 'SUPER_ADMIN') return true;
  if (role === 'MODERATOR') return MODERATOR_BUCKETS.includes(bucket);
  if (role === 'FINANCE_ADMIN') return bucket === 'finance';
  if (role === 'ADMIN') return (permissions || []).includes(bucket);
  return false;
}
