'use client';

import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/Skeleton';
import { RequireAdminRole } from '@/components/admin/RequireAdminRole';
import { useAdminCategories, useApproveCategory, useRejectCategory } from '@/lib/hooks';

export default function AdminCategoriesPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useAdminCategories('PENDING');
  const approve = useApproveCategory();
  const reject = useRejectCategory();

  const categories = data?.categories ?? [];

  return (
    <RequireAdminRole roles={['SUPER_ADMIN', 'MODERATOR']}>
      <div className="flex flex-col gap-5">
        <h1 className="font-display text-2xl font-bold text-text">{t('admin.categories')}</h1>
        <p className="text-xs text-text-muted">{t('admin.categoriesHint')}</p>

        <div className="flex flex-col gap-3">
          {isLoading && Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16" />)}

          {!isLoading && categories.length === 0 && (
            <p className="py-10 text-center text-sm text-text-muted">{t('admin.noPendingCategories')}</p>
          )}

          {!isLoading &&
            categories.map((cat) => (
              <div
                key={cat._id}
                className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4 shadow-xs"
              >
                <div>
                  <div className="text-sm font-bold text-text">{cat.name}</div>
                  <div className="text-xs text-text-muted">
                    {cat.nameEn} · {t('admin.requestedBy')}: {cat.requestedByBusiness?.name ?? '—'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => approve.mutate(cat._id)}
                    className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white"
                  >
                    {t('admin.approve')}
                  </button>
                  <button
                    onClick={() => reject.mutate(cat._id)}
                    className="rounded-lg border border-danger/40 px-4 py-1.5 text-xs font-semibold text-danger"
                  >
                    {t('admin.reject')}
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </RequireAdminRole>
  );
}
