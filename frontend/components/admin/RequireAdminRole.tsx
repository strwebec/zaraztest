'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMe } from '@/lib/hooks';
import type { Locale } from '@/lib/i18n';
import type { AdminPermissionBucket } from '@/lib/utils/api';
import { hasAdminPermission } from '@/lib/utils/adminPermissions';

export function RequireAdminRole({
  roles,
  permission,
  children,
}: {
  roles: Array<'SUPER_ADMIN' | 'MODERATOR' | 'FINANCE_ADMIN' | 'ADMIN'>;
  // When set, an ADMIN-role user is let through if they were granted this
  // specific bucket, even though 'ADMIN' isn't itself listed in `roles`.
  permission?: AdminPermissionBucket;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { locale } = useParams<{ locale: Locale }>();
  const { data, isLoading } = useMe();
  const user = data?.user;
  const allowed =
    !!user &&
    (roles.includes(user.role as (typeof roles)[number]) ||
      (!!permission && hasAdminPermission(user.role, user.permissions, permission)));

  useEffect(() => {
    if (!isLoading && !allowed) {
      router.replace(`/${locale}/admin/dashboard`);
    }
  }, [isLoading, allowed, router, locale]);

  if (isLoading || !allowed) return null;
  return <>{children}</>;
}
