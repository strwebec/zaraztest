'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { BusinessCover } from '@/components/business/BusinessCover';
import { ServiceRow } from '@/components/business/ServiceRow';
import { MasterCard } from '@/components/business/MasterCard';
import { BookingPanel } from '@/components/business/BookingPanel';
import { ReviewsSection } from '@/components/business/ReviewsSection';
import { GalleryLightbox } from '@/components/business/GalleryLightbox';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useBusinessDetail,
  useAvailabilityMulti,
  useMe,
  useCreateGroupBooking,
  useFavorites,
  useAddFavorite,
  useRemoveFavorite,
  ApiError,
} from '@/lib/hooks';
import { toDateKey } from '@/lib/utils/dates';
import type { Locale } from '@/lib/i18n';

export default function BusinessProfilePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { locale, id } = useParams<{ locale: Locale; id: string }>();

  const { data, isLoading } = useBusinessDetail(id);
  const { data: meData } = useMe();
  const createGroupBooking = useCreateGroupBooking();
  const isClient = meData?.user?.role === 'CLIENT';
  const { data: favoritesData } = useFavorites(isClient);
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();
  const isFavorite = !!favoritesData?.businesses.some((b) => b.id === id);

  // serviceId -> quantity (only entries with qty > 0 count as selected). A quantity
  // above 1 books the same service multiple times in a row (e.g. a sauna for 3 hours
  // instead of 1) in a single flow, instead of making the client repeat the whole
  // booking process three times.
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [selectedSlot, setSelectedSlot] = useState<{ time: string; staffId: string } | null>(null);
  const [comment, setComment] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const MAX_QUANTITY = 10;

  const services = data?.services ?? [];
  const staff = data?.staff ?? [];

  useEffect(() => {
    if (!Object.keys(quantities).length && services.length) setQuantities({ [services[0]._id]: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services]);

  function toggleService(serviceId: string) {
    setQuantities((prev) => {
      if (prev[serviceId] > 0) {
        const { [serviceId]: _removed, ...rest } = prev;
        return rest;
      }

      const service = services.find((s) => s._id === serviceId);
      const currentHasNonCombinable = Object.keys(prev).some(
        (sid) => services.find((s) => s._id === sid)?.combinable === false
      );
      // A non-combinable service must be booked alone — selecting one replaces
      // the whole selection, and selecting anything while one is already
      // selected also starts a fresh selection with just the new pick.
      if (service?.combinable === false || currentHasNonCombinable) return { [serviceId]: 1 };
      return { ...prev, [serviceId]: 1 };
    });
  }

  function changeQuantity(serviceId: string, delta: number) {
    setQuantities((prev) => {
      const next = Math.max(0, Math.min(MAX_QUANTITY, (prev[serviceId] ?? 0) + delta));
      if (next === 0) {
        const { [serviceId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [serviceId]: next };
    });
  }

  // Expanded with repeats — this is what the booking API actually receives, so
  // requesting quantity 3 of a service sends its id three times in a row.
  const selectedServiceIds = useMemo(
    () => Object.entries(quantities).flatMap(([id, qty]) => Array(qty).fill(id)),
    [quantities]
  );

  const selectedServices = useMemo(
    () => services.filter((s) => quantities[s._id] > 0),
    [services, quantities]
  );
  const totalPrice = selectedServiceIds.reduce((sum, sid) => sum + (services.find((s) => s._id === sid)?.price ?? 0), 0);
  const totalDuration = selectedServiceIds.reduce(
    (sum, sid) => sum + (services.find((s) => s._id === sid)?.durationMinutes ?? 0),
    0
  );

  const { data: availability, isLoading: slotsLoading } = useAvailabilityMulti(id, selectedServiceIds, selectedDate);
  const slots = useMemo(() => availability?.slots ?? [], [availability]);

  useEffect(() => {
    setSelectedSlot(null);
  }, [selectedServiceIds, selectedDate]);

  async function handleConfirm() {
    if (!meData?.user) {
      router.push(`/${locale}/login?redirect=/${locale}/business/${id}`);
      return;
    }
    if (!selectedServiceIds.length || !selectedSlot) return;

    setFeedback(null);
    try {
      await createGroupBooking.mutateAsync({
        businessId: id,
        serviceIds: selectedServiceIds,
        staffId: selectedSlot.staffId,
        date: selectedDate,
        startTime: selectedSlot.time,
        comment: comment.trim() || undefined,
      });
      setFeedback({ type: 'success', message: t('business.bookingConfirmed') });
      setSelectedSlot(null);
      setComment('');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SLOT_TAKEN') {
        setFeedback({ type: 'error', message: t('business.slotTaken') });
      } else if (err instanceof ApiError && err.code === 'SLOT_IN_PAST') {
        setFeedback({ type: 'error', message: t('business.slotInPast') });
      } else if (err instanceof ApiError && err.code === 'OUTSIDE_WORKING_HOURS') {
        setFeedback({ type: 'error', message: t('business.slotOutsideHours') });
      } else if (err instanceof ApiError && err.code === 'ON_BREAK') {
        setFeedback({ type: 'error', message: t('business.slotOnBreak') });
      } else if (err instanceof ApiError && err.code === 'CLIENT_TIME_CONFLICT') {
        const conflict = (err.data?.conflict ?? {}) as { businessName?: string; serviceName?: string; startTime?: string };
        setFeedback({
          type: 'error',
          message: t('business.clientTimeConflict', {
            time: conflict.startTime ?? '',
            business: conflict.businessName ?? '',
            service: conflict.serviceName ?? '',
          }),
        });
      } else if (err instanceof ApiError && err.code === 'STAFF_CANNOT_PERFORM') {
        setFeedback({ type: 'error', message: t('business.staffCannotPerformCombo') });
      } else if (err instanceof ApiError && err.code === 'SERVICE_NOT_COMBINABLE') {
        setFeedback({ type: 'error', message: t('biz.serviceNotCombinable') });
      } else if (err instanceof ApiError && err.code === 'SERVICE_NOT_REPEATABLE') {
        setFeedback({ type: 'error', message: t('business.serviceNotRepeatable') });
      } else if (err instanceof ApiError && err.code === 'DATE_TOO_FAR') {
        const days = (err.data?.bookingWindowDays as number | undefined) ?? business.bookingWindowDays ?? 30;
        setFeedback({ type: 'error', message: t('business.dateTooFar', { days }) });
      } else if (err instanceof ApiError && err.code === 'ACCOUNT_BLOCKED') {
        const until = err.data?.until ? new Date(err.data.until as string).toLocaleString() : '';
        setFeedback({ type: 'error', message: t('auth.accountBlocked', { until }) });
      } else {
        setFeedback({ type: 'error', message: t('auth.genericError') });
      }
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] px-6 py-10">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) return null;
  const { business } = data;

  const confirmLabel = !meData?.user
    ? t('business.loginToBook')
    : !selectedServiceIds.length
      ? t('business.selectServiceFirst')
      : t('business.confirmBooking');

  const confirmDisabled = createGroupBooking.isPending || (!!meData?.user && (!selectedServiceIds.length || !selectedSlot));

  const bookingPanel = (
    <>
      {selectedServices.length > 0 && (
        <div className="rounded-xl border border-border bg-bg px-3.5 py-2.5 text-xs text-text-muted">
          {t('business.selectedServicesSummary', {
            count: selectedServiceIds.length,
            minutes: totalDuration,
            price: totalPrice === 0 ? t('business.free') : `${totalPrice}₴`,
          })}
        </div>
      )}
      <BookingPanel
        locale={locale}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        slots={slots}
        slotsLoading={slotsLoading}
        selectedSlot={selectedSlot}
        onSelectSlot={setSelectedSlot}
        onConfirm={handleConfirm}
        confirmDisabled={confirmDisabled}
        confirmLabel={confirmLabel}
        cancellationHours={business.cancellationPolicyHours}
        bookingWindowDays={business.bookingWindowDays ?? 30}
        comment={comment}
        onCommentChange={setComment}
      />
      {feedback && (
        <p className={`text-sm ${feedback.type === 'success' ? 'text-success' : 'text-danger'}`}>{feedback.message}</p>
      )}
    </>
  );

  return (
    <div className="flex flex-col pb-28 lg:pb-0">
      <BusinessCover
        business={business}
        backHref={`/${locale}/catalog`}
        isFavorite={isFavorite}
        onToggleFavorite={
          isClient ? () => (isFavorite ? removeFavorite.mutate(id) : addFavorite.mutate(id)) : undefined
        }
      />

      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-5 py-7 sm:px-10 lg:flex-row lg:gap-12 lg:py-9">
        <div className="flex flex-1 flex-col gap-8">
          {business.description && (
            <section className="flex flex-col gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('business.about')}</h2>
              <p className="max-w-xl text-sm leading-relaxed text-text-muted sm:text-[15px]">{business.description}</p>
            </section>
          )}

          <section className="flex flex-col">
            <div className="mb-1 flex items-baseline justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('business.services')}</h2>
              <span className="text-[11px] text-text-muted">{t('business.selectMultipleHint')}</span>
            </div>
            {services.map((svc) => (
              <ServiceRow
                key={svc._id}
                service={svc}
                quantity={quantities[svc._id] ?? 0}
                onToggle={() => toggleService(svc._id)}
                onIncrement={() => changeQuantity(svc._id, 1)}
                onDecrement={() => changeQuantity(svc._id, -1)}
              />
            ))}
          </section>

          {/* On mobile, picking a time is the natural next step right after choosing
              services — the sidebar copy (below, lg:flex) already covers desktop, so
              this inline copy only needs to render before the supplementary sections
              (masters/gallery/reviews), not after them. */}
          <section className="flex flex-col gap-8 lg:hidden">{bookingPanel}</section>

          {staff.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('business.masters')}</h2>
              <div className="flex gap-3 overflow-x-auto">
                {staff.map((m) => (
                  <MasterCard key={m._id} master={m} />
                ))}
              </div>
            </section>
          )}

          {!!business.galleryUrls?.length && (
            <section className="flex flex-col gap-3">
              <h2 className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('business.gallery')}</h2>
              <div className="columns-2 gap-3 sm:columns-3">
                {business.galleryUrls.map((url, i) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setLightboxIndex(i)}
                    className="mb-3 block w-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={business.name}
                      className="w-full rounded-2xl border border-border object-cover transition hover:opacity-90"
                    />
                  </button>
                ))}
              </div>
            </section>
          )}

          {lightboxIndex !== null && business.galleryUrls && (
            <GalleryLightbox
              urls={business.galleryUrls}
              index={lightboxIndex}
              alt={business.name}
              onClose={() => setLightboxIndex(null)}
              onIndexChange={setLightboxIndex}
            />
          )}

          <ReviewsSection businessId={id} />
        </div>

        <div className="hidden flex-1 self-start rounded-[20px] border border-border bg-surface p-6 lg:sticky lg:top-24 lg:flex lg:max-w-sm lg:flex-col">
          {bookingPanel}
        </div>
      </div>
    </div>
  );
}
