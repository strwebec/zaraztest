'use client';

import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useWeekAvailability } from '@/lib/hooks';
import type { AvailabilitySlotStatus, BusinessBooking } from '@/lib/utils/api';

function addDaysKey(dateKey: string, days: number) {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayKeyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mondayOf(dateKey: string) {
  const d = new Date(`${dateKey}T00:00:00`);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDaysKey(dateKey, offset);
}

function weekdayShort(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('uk-UA', { weekday: 'short' });
}

function dayNumber(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`).getDate();
}

const STATUS_STYLE: Record<AvailabilitySlotStatus, string> = {
  free: 'bg-success/10 text-success hover:bg-success/25 cursor-pointer',
  busy: 'bg-primary text-white cursor-default',
  tight: 'bg-warning/10 text-warning cursor-not-allowed',
  off: 'bg-surface2/40 cursor-not-allowed',
};

export function WeekAvailabilityGrid({
  staffId,
  serviceId,
  weekStart,
  onWeekChange,
  onSlotClick,
  onBookingClick,
}: {
  staffId: string;
  serviceId?: string;
  weekStart: string;
  onWeekChange: (weekStart: string) => void;
  onSlotClick: (date: string, time: string) => void;
  onBookingClick?: (booking: BusinessBooking) => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading } = useWeekAvailability(staffId, weekStart, serviceId);

  if (isLoading || !data) return <Skeleton className="h-[560px]" />;

  const timeLabels = data.days[0]?.slots.map((s) => s.time) ?? [];
  const today = todayKeyLocal();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onWeekChange(addDaysKey(weekStart, -7))}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-surface text-text-muted transition hover:border-primary hover:text-primary"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => onWeekChange(mondayOf(today))}
            className="rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:border-primary hover:text-primary"
          >
            {t('home.today')}
          </button>
          <button
            onClick={() => onWeekChange(addDaysKey(weekStart, 7))}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-surface text-text-muted transition hover:border-primary hover:text-primary"
          >
            <ChevronRight size={15} />
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-success/20" />
            {t('biz.slotFree')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
            {t('biz.slotBusy')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-warning/20" />
            {t('biz.slotTight')}
          </span>
          <span>· {data.durationMinutes} {t('biz.durationMinutesLabel')}</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
        <div className="grid min-w-[720px]" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
          <div className="border-b border-border" />
          {data.days.map((day) => (
            <div
              key={day.date}
              className={`flex flex-col items-center border-b border-l border-border px-2 py-2 ${
                day.date === today ? 'bg-primary-glow' : ''
              }`}
            >
              <span className="text-[10px] uppercase text-text-muted">{weekdayShort(day.date)}</span>
              <span className="font-mono text-sm font-bold text-text">{dayNumber(day.date)}</span>
            </div>
          ))}

          {timeLabels.map((time, rowIdx) => (
            <div key={time} className="contents">
              <div className="flex items-start justify-end border-r border-border pr-2 pt-0.5 text-[10px] text-text-muted">
                {time.endsWith(':00') ? time : ''}
              </div>
              {data.days.map((day) => {
                const slot = day.slots[rowIdx];
                const clickable = slot.status === 'free' || (slot.status === 'busy' && !!slot.booking);
                return (
                  <button
                    key={day.date + time}
                    type="button"
                    disabled={!clickable}
                    onClick={() => {
                      if (slot.status === 'free') onSlotClick(day.date, slot.time);
                      else if (slot.status === 'busy' && slot.booking) onBookingClick?.(slot.booking);
                    }}
                    title={slot.status === 'busy' ? slot.clientName : undefined}
                    className={`h-[22px] truncate border-b border-l border-border px-1 text-[9px] font-semibold transition ${STATUS_STYLE[slot.status]} ${
                      slot.status === 'busy' && slot.booking ? 'cursor-pointer hover:brightness-110' : ''
                    }`}
                  >
                    {slot.status === 'busy' ? slot.clientName : ''}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
