'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMe } from '@/lib/hooks';
import type { Locale } from '@/lib/i18n';

export function RequireAdminRole({
  roles,
  children,
}: {
  roles: Array<'SUPER_ADMIN' | 'MODERATOR' | 'FINANCE_ADMIN'>;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { locale } = useParams<{ locale: Locale }>();
  const { data, isLoading } = useMe();
  const allowed = !!data?.user && roles.includes(data.user.role as (typeof roles)[number]);

  useEffect(() => {
    if (!isLoading && !allowed) {
      router.replace(`/${locale}/admin/dashboard`);
    }
  }, [isLoading, allowed, router, locale]);

  if (isLoading || !allowed) return null;
  return <>{children}</>;
}
