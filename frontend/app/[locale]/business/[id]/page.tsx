'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { BusinessCover } from '@/components/business/BusinessCover';
import { ServiceRow } from '@/components/business/ServiceRow';
import { MasterCard } from '@/components/business/MasterCard';
import { BookingPanel } from '@/components/business/BookingPanel';
import { ReviewsSection } from '@/components/business/ReviewsSection';
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

  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [selectedSlot, setSelectedSlot] = useState<{ time: string; staffId: string } | null>(null);
  const [comment, setComment] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const services = data?.services ?? [];
  const staff = data?.staff ?? [];

  useEffect(() => {
    if (!selectedServiceIds.length && services.length) setSelectedServiceIds([services[0]._id]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services]);

  function toggleService(serviceId: string) {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((sid) => sid !== serviceId) : [...prev, serviceId]
    );
  }

  const selectedServices = useMemo(
    () => services.filter((s) => selectedServiceIds.includes(s._id)),
    [services, selectedServiceIds]
  );
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);

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
            count: selectedServices.length,
            minutes: totalDuration,
            price: totalPrice,
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
                selected={selectedServiceIds.includes(svc._id)}
                onSelect={() => toggleService(svc._id)}
              />
            ))}
          </section>

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
                {business.galleryUrls.map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={url}
                    src={url}
                    alt={business.name}
                    className="mb-3 w-full rounded-2xl border border-border object-cover"
                  />
                ))}
              </div>
            </section>
          )}

          <ReviewsSection businessId={id} />

          <section className="flex flex-col gap-8 lg:hidden">{bookingPanel}</section>
        </div>

        <div className="hidden flex-1 self-start rounded-[20px] border border-border bg-surface p-6 lg:sticky lg:top-24 lg:flex lg:max-w-sm lg:flex-col">
          {bookingPanel}
        </div>
      </div>
    </div>
  );
}
