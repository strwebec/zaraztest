'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useAvailability } from '@/lib/hooks';
import { nextDays, toDateKey, weekdayShort, dayNumber } from '@/lib/utils/dates';
import type { Locale } from '@/lib/i18n';

export function RescheduleModal({
  locale,
  businessId,
  serviceId,
  cancellationPolicyHours,
  currentDate,
  currentTime,
  onConfirm,
  onClose,
  isPending,
  error,
}: {
  locale: Locale;
  businessId: string;
  serviceId: string;
  cancellationPolicyHours?: number;
  currentDate?: string;
  currentTime?: string;
  onConfirm: (date: string, startTime: string, staffId: string) => void;
  onClose: () => void;
  isPending?: boolean;
  error?: string | null;
}) {
  const { t } = useTranslation();
  const [date, setDate] = useState(() => toDateKey(new Date()));
  const [slot, setSlot] = useState<{ time: string; staffId: string } | null>(null);

  const { data: availability, isLoading } = useAvailability(businessId, serviceId, date);
  const slots = availability?.slots ?? [];
  const dates = nextDays(7);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[100dvh] w-full flex-col gap-4 overflow-y-auto rounded-t-3xl bg-surface p-6 shadow-lg sm:max-w-md sm:rounded-3xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-text">{t('business.reschedule')}</h2>
          <button onClick={onClose} className="text-text-muted">
            <X size={18} />
          </button>
        </div>

        {currentDate && currentTime && (
          <p className="rounded-xl bg-bg px-3.5 py-2.5 text-xs text-text-muted">
            {t('business.currentAppointment', { date: currentDate, time: currentTime })}
          </p>
        )}

        <div className="flex gap-2 overflow-x-auto pb-1">
          {dates.map((d) => {
            const key = toDateKey(d);
            const active = key === date;
            return (
              <button
                key={key}
                onClick={() => {
                  setDate(key);
                  setSlot(null);
                }}
                className={`flex flex-none flex-col items-center gap-0.5 rounded-xl border px-3.5 py-2.5 transition ${
                  active ? 'border-primary bg-primary-glow text-text' : 'border-border bg-bg text-text-muted'
                }`}
              >
                <span className="text-[10.5px] opacity-70">{weekdayShort(d, locale)}</span>
                <span className="font-mono text-[15px] font-bold">{dayNumber(d)}</span>
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-10 animate-shimmer rounded-xl" />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <p className="py-3 text-sm text-text-muted">{t('business.noSlots')}</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {slots.map((s) => {
              const active = slot?.time === s.time;
              return (
                <button
                  key={s.time}
                  onClick={() => setSlot(s)}
                  className={`rounded-xl border py-2.5 font-tabular text-sm font-semibold transition ${
                    active
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-surface text-text hover:border-primary'
                  }`}
                >
                  {s.time}
                </button>
              );
            })}
          </div>
        )}

        {cancellationPolicyHours && (
          <p className="text-xs text-text-muted">{t('business.cancellationPolicy', { hours: cancellationPolicyHours })}</p>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          onClick={() => slot && onConfirm(date, slot.time, slot.staffId)}
          disabled={!slot || isPending}
          className="rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('business.confirmReschedule')}
        </button>
      </div>
    </div>
  );
}
