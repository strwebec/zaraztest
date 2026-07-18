'use client';

import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Rocket, Sparkles, TrendingUp, Zap } from 'lucide-react';
import {
  useBusinessTopPlacement,
  usePurchaseTopPlacement,
  useConfirmTopPlacementPayment,
  useBusinessPaymentRequisites,
} from '@/lib/hooks';
import type { TopPackageId } from '@/lib/utils/api';

const PACKAGE_ORDER: TopPackageId[] = ['1week', '2weeks', '1month'];
const RECOMMENDED_PACKAGE: TopPackageId = '2weeks';
const PACKAGE_ICON = { '1week': Zap, '2weeks': TrendingUp, '1month': Sparkles } as const;

export function TopPromotionCard() {
  const { t } = useTranslation();
  const { data, isLoading } = useBusinessTopPlacement();
  const { data: requisites } = useBusinessPaymentRequisites();
  const purchase = usePurchaseTopPlacement();
  const confirmPayment = useConfirmTopPlacementPayment();
  const fileRef = useRef<HTMLInputElement>(null);

  if (isLoading || !data) return null;

  const { top, packages, pending, history } = data;

  return (
    <div className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-top/30 bg-surface p-5 shadow-md">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-[0.14] blur-2xl"
        style={{ background: 'radial-gradient(circle, var(--color-top) 0%, transparent 70%)' }}
      />

      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-top/15 text-top">
            <Rocket size={16} />
          </span>
          <h3 className="font-display text-base font-bold text-text">{t('biz.topPromotion')}</h3>
        </div>
        {top.active && (
          <span className="flex items-center gap-1.5 rounded-lg bg-top px-2.5 py-1 text-xs font-extrabold text-white shadow-sm">
            <Sparkles size={12} />
            TOP · {t('biz.topUntil', { date: top.until ? new Date(top.until).toLocaleDateString() : '' })}
          </span>
        )}
      </div>

      <p className="relative text-xs leading-relaxed text-text-muted">{t('biz.topExplain')}</p>

      <div className="relative rounded-xl border border-border bg-bg p-3 text-xs text-text-muted">
        <p className="mb-1 font-bold uppercase tracking-wide">{t('biz.paymentRequisitesTitle')}</p>
        <p className="whitespace-pre-line">{requisites?.topPlacementRequisites || t('biz.paymentRequisitesText')}</p>
      </div>

      {pending?.status === 'AWAITING_ACTIVATION' ? (
        <p className="relative text-sm text-primary">{t('biz.topAwaitingActivation')}</p>
      ) : pending ? (
        <div className="relative flex flex-col gap-3">
          <p className="text-sm text-text-muted">{t('biz.topRequestPending', { amount: pending.amount })}</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={confirmPayment.isPending}
            className="self-start rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            {t('biz.confirmPayment')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) confirmPayment.mutate({ id: pending._id, receipt: file });
              e.target.value = '';
            }}
          />
        </div>
      ) : (
        <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PACKAGE_ORDER.map((id) => {
            const pkg = packages[id];
            const Icon = PACKAGE_ICON[id];
            const recommended = id === RECOMMENDED_PACKAGE;
            const perDay = Math.round(pkg.price / pkg.days);
            return (
              <button
                key={id}
                disabled={purchase.isPending}
                onClick={() => purchase.mutate(id)}
                className={`group relative flex flex-col items-start gap-2 rounded-2xl border px-4 py-4 text-left transition hover:-translate-y-1 disabled:opacity-50 ${
                  recommended
                    ? 'border-top bg-top/[0.06] shadow-md hover:shadow-lg'
                    : 'border-border bg-bg hover:border-top/50 hover:shadow-md'
                }`}
              >
                {recommended && (
                  <span className="absolute -top-2.5 left-4 rounded-full bg-top px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-sm">
                    {t('biz.topRecommended')}
                  </span>
                )}
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    recommended ? 'bg-top/20 text-top' : 'bg-surface2 text-text-muted group-hover:text-top'
                  }`}
                >
                  <Icon size={15} />
                </span>
                <span className="text-xs font-semibold text-text-muted">{t(`biz.topPackage.${id}`)}</span>
                <span className="font-mono text-2xl font-bold text-text">{pkg.price}₴</span>
                <span className="font-mono text-[11px] text-text-muted">{t('biz.topPerDay', { amount: perDay })}</span>
                <span
                  className={`mt-1 w-full rounded-lg px-3 py-2 text-center text-xs font-bold transition ${
                    recommended
                      ? 'bg-top text-white group-hover:bg-top/90'
                      : 'bg-surface2 text-text group-hover:bg-primary group-hover:text-white'
                  }`}
                >
                  {t('biz.topCta')}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.topHistory')}</h4>
          <ul className="flex flex-col gap-1.5">
            {history.map((h) => (
              <li key={h._id} className="flex items-center justify-between text-xs text-text-muted">
                <span>
                  {t(`biz.topPackage.${h.package}`)} · {new Date(h.requestedAt).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-text">{h.amount}₴</span>
                  <span
                    className={
                      h.status === 'CONFIRMED'
                        ? 'text-success'
                        : h.status === 'REJECTED'
                          ? 'text-danger'
                          : 'text-text-muted'
                    }
                  >
                    {t(`biz.topStatus.${h.status}`)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
