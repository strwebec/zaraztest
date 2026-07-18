'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/Skeleton';
import { RequireAdminRole } from '@/components/admin/RequireAdminRole';
import { useAdminBusinesses, useUnblockBusiness } from '@/lib/hooks';
import type { Locale } from '@/lib/i18n';

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-success/10 text-success',
  PENDING: 'bg-warning/10 text-warning',
  HIDDEN: 'bg-surface2 text-text-muted',
  BLOCKED: 'bg-danger/10 text-danger',
};

function rating(biz: { googleRating?: number; platformRating?: number }) {
  const g = biz.googleRating ?? 0;
  const p = biz.platformRating ?? g;
  return g * 0.6 + p * 0.4;
}

export default function AdminBusinessesPage() {
  const { t } = useTranslation();
  const { locale } = useParams<{ locale: Locale }>();
  const { data, isLoading } = useAdminBusinesses();
  const unblock = useUnblockBusiness();

  const businesses = data?.businesses ?? [];

  return (
    <RequireAdminRole roles={['SUPER_ADMIN', 'MODERATOR']} permission="businesses">
      <div className="flex flex-col gap-5">
        <div className="flex items-baseline justify-between">
          <h1 className="font-display text-2xl font-bold tracking-tight text-text">{t('admin.allBusinesses')}</h1>
          <span className="text-sm text-text-muted">{t('admin.businessesCount', { count: businesses.length })}</span>
        </div>

        <div className="flex flex-col gap-3">
          {isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}

          {!isLoading &&
            businesses.map((biz) => {
              const reviews = (biz.googleReviewsCount ?? 0) + (biz.platformReviewsCount ?? 0);
              const isOverdue = biz.billing?.status === 'OVERDUE' || biz.billing?.status === 'BLOCKED';
              return (
                <Link
                  key={biz._id}
                  href={`/${locale}/admin/businesses/${biz._id}`}
                  className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-text">{biz.name}</span>
                      {biz.top?.active && (
                        <span className="flex-none rounded-full bg-top/10 px-2 py-0.5 text-[10px] font-bold text-top">
                          TOP
                        </span>
                      )}
                      {isOverdue && (
                        <span className="flex-none rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-bold text-danger">
                          {t('admin.billingOverdueBadge')}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-text-muted">
                      {biz.category} · {biz.owner?.name} · {biz.owner?.email}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-tabular text-xs text-text-muted">
                      <span>
                        {biz.city?.name ?? ''}
                        {biz.district ? ` · ${biz.district}` : ''}
                      </span>
                      <span>★ {rating(biz).toFixed(1)} ({reviews})</span>
                      <span>{t('admin.joinedOn', { date: new Date(biz.createdAt).toLocaleDateString() })}</span>
                    </div>
                  </div>
                  <div className="flex flex-none items-center gap-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[biz.status] ?? 'bg-surface2 text-text-muted'}`}>
                      {t(`admin.businessStatus.${biz.status}`)}
                    </span>
                    {biz.status === 'BLOCKED' && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          unblock.mutate(biz._id);
                        }}
                        className="text-xs font-semibold text-secondary"
                      >
                        {t('admin.unblock')}
                      </button>
                    )}
                  </div>
                </Link>
              );
            })}
        </div>
      </div>
    </RequireAdminRole>
  );
}
