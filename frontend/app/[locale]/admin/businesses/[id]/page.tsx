'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Receipt, Rocket } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { RequireAdminRole } from '@/components/admin/RequireAdminRole';
import { BlockBusinessModal } from '@/components/admin/BlockBusinessModal';
import {
  useAdminBusinessDetail,
  useDeleteAdminBusiness,
  useBlockBusiness,
  useUnblockBusiness,
  useMe,
} from '@/lib/hooks';
import { ApiError } from '@/lib/utils/api';
import type { Locale } from '@/lib/i18n';

export default function AdminBusinessDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { locale, id } = useParams<{ locale: Locale; id: string }>();
  const { data: meData } = useMe();
  const { data, isLoading } = useAdminBusinessDetail(id);
  const deleteBusiness = useDeleteAdminBusiness();
  const block = useBlockBusiness();
  const unblock = useUnblockBusiness();
  const [showBlockModal, setShowBlockModal] = useState(false);

  const isSuperAdmin = meData?.user?.role === 'SUPER_ADMIN';

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) return null;
  const { business, stats } = data;

  async function handleDelete() {
    if (!window.confirm(t('admin.deleteBusinessConfirm', { name: business.name }) as string)) return;
    try {
      await deleteBusiness.mutateAsync(business._id);
      router.push(`/${locale}/admin/businesses`);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'HAS_UPCOMING_BOOKINGS') {
        window.alert(t('admin.deleteHasBookings') as string);
      } else {
        window.alert(t('auth.genericError') as string);
      }
    }
  }

  return (
    <RequireAdminRole roles={['SUPER_ADMIN', 'MODERATOR']}>
      <div className="flex max-w-2xl flex-col gap-5">
        <button
          onClick={() => router.push(`/${locale}/admin/businesses`)}
          className="flex w-fit items-center gap-1.5 text-xs font-semibold text-text-muted"
        >
          <ArrowLeft size={14} /> {t('admin.allBusinesses')}
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-text">{business.name}</h1>
            <p className="text-sm text-text-muted">
              {business.category} · {t(`admin.businessStatus.${business.status}`)}
            </p>
          </div>
          {business.status === 'BLOCKED' ? (
            <button
              onClick={() => unblock.mutate(business._id)}
              className="rounded-xl border border-secondary/40 px-4 py-2 text-xs font-bold text-secondary"
            >
              {t('admin.unblock')}
            </button>
          ) : (
            <button
              onClick={() => setShowBlockModal(true)}
              className="rounded-xl border border-danger/40 px-4 py-2 text-xs font-bold text-danger"
            >
              {t('admin.block')}
            </button>
          )}
        </div>

        {business.status === 'BLOCKED' && (business.blockReason || business.blockedUntil) && (
          <div className="flex flex-col gap-1 rounded-2xl border border-danger/40 bg-danger/5 p-4 text-sm">
            {business.blockReason && (
              <div className="flex justify-between gap-4">
                <span className="text-text-muted">{t('admin.blockedReasonShown')}</span>
                <span className="text-right text-danger">{business.blockReason}</span>
              </div>
            )}
            {business.blockedUntil && (
              <div className="flex justify-between gap-4">
                <span className="text-text-muted">{t('admin.blockedUntilShown')}</span>
                <span className="font-tabular text-danger">{new Date(business.blockedUntil).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: t('biz.services'), value: stats.servicesCount },
            { label: t('biz.staff'), value: stats.staffCount },
            { label: t('admin.completedBookings'), value: stats.completedBookings },
            { label: t('admin.platformRevenue'), value: `${stats.totalRevenue.toFixed(0)}₴` },
          ].map((c) => (
            <div key={c.label} className="flex flex-col gap-1 rounded-2xl border border-border bg-surface p-3 shadow-xs">
              <span className="text-[11px] text-text-muted">{c.label}</span>
              <span className="font-mono text-lg font-bold text-text">{c.value}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${locale}/admin/invoices?business=${business._id}`}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2 text-xs font-semibold text-text-muted transition hover:border-primary hover:text-primary"
          >
            <Receipt size={14} /> {t('admin.viewBusinessInvoices')}
          </Link>
          <Link
            href={`/${locale}/admin/top-placements?business=${business._id}`}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2 text-xs font-semibold text-text-muted transition hover:border-primary hover:text-primary"
          >
            <Rocket size={14} /> {t('admin.viewBusinessTopRequests')}
          </Link>
        </div>

        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5 text-sm shadow-sm">
          <div className="flex justify-between">
            <span className="text-text-muted">{t('admin.owner')}</span>
            <span className="text-text">
              {business.owner.name} · {business.owner.email}
              {business.owner.phone ? ` · ${business.owner.phone}` : ''}
            </span>
          </div>
          {business.description && (
            <div className="flex justify-between gap-4">
              <span className="shrink-0 text-text-muted">{t('business.about')}</span>
              <span className="text-right text-text">{business.description}</span>
            </div>
          )}
          {(business.city?.name || business.district) && (
            <div className="flex justify-between">
              <span className="text-text-muted">{t('admin.locationLabel')}</span>
              <span className="text-text">
                {[business.city?.name, business.district].filter(Boolean).join(' · ')}
              </span>
            </div>
          )}
          {business.address && (
            <div className="flex justify-between">
              <span className="text-text-muted">{t('biz.settingsAddress')}</span>
              <span className="text-text">{business.address}</span>
            </div>
          )}
          {business.phone && (
            <div className="flex justify-between">
              <span className="text-text-muted">{t('biz.settingsPhone')}</span>
              <span className="text-text">{business.phone}</span>
            </div>
          )}
          {business.rejectionReason && (
            <div className="flex justify-between gap-4">
              <span className="shrink-0 text-text-muted">{t('admin.reject')}</span>
              <span className="text-right text-danger">{business.rejectionReason}</span>
            </div>
          )}
          {business.createdAt && (
            <div className="flex justify-between">
              <span className="text-text-muted">{t('admin.joinedDate')}</span>
              <span className="font-tabular text-text">{new Date(business.createdAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {isSuperAdmin && (
          <div className="flex flex-col gap-2 rounded-2xl border border-danger/40 bg-danger/5 p-5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-danger">{t('admin.dangerZone')}</h2>
            <p className="text-xs text-text-muted">{t('admin.deleteBusinessHint')}</p>
            <button
              onClick={handleDelete}
              disabled={deleteBusiness.isPending}
              className="self-start rounded-xl bg-danger px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              {t('admin.deleteBusiness')}
            </button>
          </div>
        )}
      </div>

      {showBlockModal && (
        <BlockBusinessModal
          businessName={business.name}
          isPending={block.isPending}
          onClose={() => setShowBlockModal(false)}
          onConfirm={(payload) =>
            block.mutate(
              { id: business._id, ...payload },
              { onSuccess: () => setShowBlockModal(false) }
            )
          }
        />
      )}
    </RequireAdminRole>
  );
}
