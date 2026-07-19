'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/Skeleton';
import { RescheduleModal } from '@/components/shared/RescheduleModal';
import { ReviewModal } from '@/components/client/ReviewModal';
import {
  useClientBookings,
  useCancelBooking,
  useRescheduleBooking,
  useCreateReview,
  useRespondToReviewDispute,
  ApiError,
} from '@/lib/hooks';
import type { Locale } from '@/lib/i18n';
import type { ClientBooking } from '@/lib/utils/api';

function ReviewDisputeBanner({ review }: { review: NonNullable<ClientBooking['review']> }) {
  const { t } = useTranslation();
  const respondMutation = useRespondToReviewDispute();
  const [response, setResponse] = useState('');

  const dispute = review.dispute;
  if (!dispute) return null;

  if (dispute.status === 'UPHELD' || dispute.status === 'DISMISSED') {
    return (
      <p className="rounded-lg bg-surface2 px-3 py-2 text-xs text-text-muted">
        {dispute.status === 'UPHELD' ? t('client.reviewDisputeUpheld') : t('client.reviewDisputeDismissed')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3">
      <p className="text-xs font-semibold text-warning">{t('client.reviewDisputedLabel')}</p>
      <p className="text-xs text-text-muted">{dispute.reason}</p>
      {dispute.clientResponse ? (
        <p className="text-xs text-text-muted">
          <span className="font-semibold text-text">{t('client.yourResponse')}:</span> {dispute.clientResponse}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder={t('client.reviewDisputeResponsePlaceholder') as string}
            rows={2}
            maxLength={1000}
            className="resize-none rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text outline-none focus:border-primary"
          />
          <button
            disabled={respondMutation.isPending || !response.trim()}
            onClick={() => respondMutation.mutate({ reviewId: review._id, response: response.trim() })}
            className="self-start rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {t('client.reviewDisputeRespond')}
          </button>
        </div>
      )}
    </div>
  );
}

type Tab = 'upcoming' | 'past' | 'cancelled';

const STATUS_STYLE: Record<string, string> = {
  confirmed: 'text-success bg-success/10',
  completed: 'text-text-muted bg-surface2',
  cancelled_by_client: 'text-danger bg-danger/10',
  cancelled_by_business: 'text-danger bg-danger/10',
  no_show: 'text-warning bg-warning/10',
};

export default function ClientBookingsPage() {
  const { t } = useTranslation();
  const { locale } = useParams<{ locale: Locale }>();
  const [tab, setTab] = useState<Tab>('upcoming');
  const { data, isLoading } = useClientBookings(tab);
  const cancelMutation = useCancelBooking();
  const rescheduleMutation = useRescheduleBooking();
  const reviewMutation = useCreateReview();
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState<string | null>(null);
  const [reviewModalError, setReviewModalError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'upcoming', label: t('client.upcoming') },
    { key: 'past', label: t('client.past') },
    { key: 'cancelled', label: t('client.cancelled') },
  ];

  const bookings = data?.bookings ?? [];
  const reschedulingBooking = bookings.find((b) => b._id === reschedulingId) ?? null;
  const reviewingBooking = bookings.find((b) => b._id === reviewingId) ?? null;

  // Sibling bookings from the same multi-service checkout (e.g. manicure + brows) share
  // a groupId — cluster them into one card instead of showing disconnected entries.
  const groups: { key: string; items: typeof bookings }[] = [];
  const groupIndex = new Map<string, number>();
  for (const bk of bookings) {
    const key = bk.groupId || bk._id;
    if (groupIndex.has(key)) {
      groups[groupIndex.get(key)!].items.push(bk);
    } else {
      groupIndex.set(key, groups.length);
      groups.push({ key, items: [bk] });
    }
  }

  async function handleCancel(id: string) {
    if (!window.confirm(t('client.cancelConfirm') as string)) return;
    setActionFeedback(null);
    try {
      const result = await cancelMutation.mutateAsync(id);
      setActionFeedback((result.isLate ? t('client.cancelledLate') : t('client.cancelledOk')) as string);
    } catch {
      setActionFeedback(t('auth.genericError') as string);
    }
  }

  async function handleSubmitReview(rating: number, text: string) {
    if (!reviewingId) return;
    setReviewModalError(null);
    try {
      const result = await reviewMutation.mutateAsync({ bookingId: reviewingId, payload: { rating, text } });
      setReviewingId(null);
      setReviewFeedback(
        (result.needsModeration ? t('client.reviewPendingModeration') : t('client.reviewPublished')) as string
      );
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ALREADY_REVIEWED') setReviewModalError(t('client.alreadyReviewed') as string);
      else if (err instanceof ApiError && err.code === 'INVALID_INPUT') setReviewModalError(t('client.reviewInvalid') as string);
      else setReviewModalError(t('auth.genericError') as string);
    }
  }

  async function handleReschedule(date: string, startTime: string, staffId: string) {
    if (!reschedulingId) return;
    setRescheduleError(null);
    try {
      const result = await rescheduleMutation.mutateAsync({ id: reschedulingId, payload: { date, startTime, staffId } });
      setReschedulingId(null);
      setActionFeedback((result.isLate ? t('client.rescheduledLate') : t('client.rescheduledOk')) as string);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SLOT_TAKEN') setRescheduleError(t('business.slotTaken'));
      else if (err instanceof ApiError && err.code === 'OUTSIDE_WORKING_HOURS') setRescheduleError(t('business.slotOutsideHours'));
      else if (err instanceof ApiError && err.code === 'ON_BREAK') setRescheduleError(t('business.slotOnBreak'));
      else if (err instanceof ApiError && err.code === 'CLIENT_TIME_CONFLICT') {
        const conflict = (err.data?.conflict ?? {}) as { businessName?: string; serviceName?: string; startTime?: string };
        setRescheduleError(
          t('business.clientTimeConflict', {
            time: conflict.startTime ?? '',
            business: conflict.businessName ?? '',
            service: conflict.serviceName ?? '',
          })
        );
      } else if (err instanceof ApiError && err.code === 'DATE_TOO_FAR') {
        const days = (err.data?.bookingWindowDays as number | undefined) ?? reschedulingBooking?.business.bookingWindowDays ?? 30;
        setRescheduleError(t('business.dateTooFar', { days }));
      } else setRescheduleError(t('auth.genericError'));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-bold text-text">{t('client.bookings')}</h1>

      <div className="flex gap-1.5 rounded-xl border border-border bg-surface p-1 sm:w-fit">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none ${
              tab === tb.key ? 'bg-primary text-white' : 'text-text-muted'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {reviewFeedback && <p className="text-sm text-text-muted">{reviewFeedback}</p>}
      {actionFeedback && <p className="text-sm text-text-muted">{actionFeedback}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {isLoading &&
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32" />)}

        {!isLoading && bookings.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-text-muted">{t('client.noBookings')}</p>
        )}

        {!isLoading &&
          groups.map(({ key, items }) => (
            <div
              key={key}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-text">{items[0].business.name}</span>
                {items.length === 1 && (
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[items[0].status] ?? 'bg-surface2 text-text-muted'}`}
                  >
                    {t(`client.status.${items[0].status}`)}
                  </span>
                )}
              </div>
              {items.length > 1 && (
                <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                  {t('client.multiServiceVisit', { count: items.length })}
                </span>
              )}

              {items.map((bk, i) => (
                <div
                  key={bk._id}
                  className={items.length > 1 ? 'flex flex-col gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0' : 'contents'}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-text-muted">
                      {bk.service.name} · {bk.staff.name}
                    </div>
                    {items.length > 1 && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[bk.status] ?? 'bg-surface2 text-text-muted'}`}
                      >
                        {t(`client.status.${bk.status}`)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-xl font-bold text-text">{bk.startTime}</span>
                    <span className="font-mono text-xs text-text-muted">{bk.date}</span>
                  </div>
                  {bk.readyAt && (
                    <p className="rounded-lg bg-success/10 px-3 py-2 text-xs font-semibold text-success">
                      {t('client.orderReady')}
                    </p>
                  )}
                  {tab === 'upcoming' && bk.status === 'confirmed' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setRescheduleError(null);
                          setReschedulingId(bk._id);
                        }}
                        className="self-start rounded-xl border border-primary/40 px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary-glow"
                      >
                        {t('client.reschedule')}
                      </button>
                      <button
                        onClick={() => handleCancel(bk._id)}
                        disabled={cancelMutation.isPending}
                        className="self-start rounded-xl border border-danger/40 px-4 py-2 text-xs font-semibold text-danger transition hover:bg-danger/10 disabled:opacity-50"
                      >
                        {t('client.cancel')}
                      </button>
                    </div>
                  )}
                  {tab === 'past' && bk.status === 'completed' && (
                    <div className="flex flex-col gap-2">
                      {bk.hasReview ? (
                        <>
                          <span className="text-xs font-semibold text-text-muted">{t('client.reviewSubmitted')}</span>
                          {bk.review && <ReviewDisputeBanner review={bk.review} />}
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            setReviewFeedback(null);
                            setReviewModalError(null);
                            setReviewingId(bk._id);
                          }}
                          className="self-start rounded-xl border border-primary/40 px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary-glow"
                        >
                          {t('client.leaveReview')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
      </div>

      {reschedulingBooking && (
        <RescheduleModal
          locale={locale}
          businessId={reschedulingBooking.business._id}
          serviceId={reschedulingBooking.service._id}
          cancellationPolicyHours={reschedulingBooking.business.cancellationPolicyHours}
          bookingWindowDays={reschedulingBooking.business.bookingWindowDays ?? 30}
          currentDate={reschedulingBooking.date}
          currentTime={reschedulingBooking.startTime}
          onConfirm={handleReschedule}
          onClose={() => setReschedulingId(null)}
          isPending={rescheduleMutation.isPending}
          error={rescheduleError}
        />
      )}

      {reviewingBooking && (
        <ReviewModal
          businessName={reviewingBooking.business.name}
          onSubmit={handleSubmitReview}
          onClose={() => {
            setReviewingId(null);
            setReviewModalError(null);
          }}
          isPending={reviewMutation.isPending}
          error={reviewModalError}
        />
      )}
    </div>
  );
}
