'use client';

import { useTranslation } from 'react-i18next';
import { nextDays, toDateKey, weekdayShort, dayNumber } from '@/lib/utils/dates';
import type { Locale } from '@/lib/i18n';

type Slot = { time: string; staffId: string };

export function BookingPanel({
  locale,
  selectedDate,
  onSelectDate,
  slots,
  slotsLoading,
  selectedSlot,
  onSelectSlot,
  onConfirm,
  confirmDisabled,
  confirmLabel,
  cancellationHours,
  comment,
  onCommentChange,
  className = '',
}: {
  locale: Locale;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  slots: Slot[];
  slotsLoading: boolean;
  selectedSlot: Slot | null;
  onSelectSlot: (slot: Slot) => void;
  onConfirm: () => void;
  confirmDisabled: boolean;
  confirmLabel: string;
  cancellationHours?: number;
  comment: string;
  onCommentChange: (value: string) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const dates = nextDays(7);

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('business.chooseTime')}</div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {dates.map((d) => {
          const key = toDateKey(d);
          const active = key === selectedDate;
          return (
            <button
              key={key}
              onClick={() => onSelectDate(key)}
              className={`flex flex-none flex-col items-center gap-0.5 rounded-xl border px-3.5 py-2.5 transition ${
                active ? 'border-primary bg-primary-glow text-text' : 'border-border bg-surface text-text-muted'
              }`}
            >
              <span className="text-[10.5px] opacity-70">{weekdayShort(d, locale)}</span>
              <span className="font-mono text-[15px] font-bold">{dayNumber(d)}</span>
            </button>
          );
        })}
      </div>

      {slotsLoading ? (
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-10 animate-shimmer rounded-xl" />
          ))}
        </div>
      ) : slots.length === 0 ? (
        <p className="py-3 text-sm text-text-muted">{t('business.noSlots')}</p>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {slots.map((slot) => {
            const active = selectedSlot?.time === slot.time;
            return (
              <button
                key={slot.time}
                onClick={() => onSelectSlot(slot)}
                className={`rounded-xl border py-2.5 font-tabular text-sm font-semibold transition ${
                  active
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-surface text-text hover:border-primary'
                }`}
              >
                {slot.time}
              </button>
            );
          })}
        </div>
      )}

      <textarea
        value={comment}
        onChange={(e) => onCommentChange(e.target.value)}
        placeholder={t('business.commentPlaceholder') as string}
        rows={2}
        className="resize-none rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary"
      />

      {cancellationHours && (
        <p className="text-xs text-text-muted">{t('business.cancellationPolicy', { hours: cancellationHours })}</p>
      )}

      <button
        onClick={onConfirm}
        disabled={confirmDisabled}
        className="rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        {confirmLabel}
      </button>
    </div>
  );
}
