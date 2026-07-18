'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useBusinessServices, useBusinessStaff, useCreateManualBooking, ApiError } from '@/lib/hooks';
import { toDateKey } from '@/lib/utils/dates';

export function ManualBookingModal({
  date,
  onClose,
  initialStaffId,
  initialServiceId,
  initialStartTime,
}: {
  date: string;
  onClose: () => void;
  initialStaffId?: string;
  initialServiceId?: string;
  initialStartTime?: string;
}) {
  const { t } = useTranslation();
  const { data: servicesData } = useBusinessServices();
  const { data: staffData } = useBusinessStaff();
  const createManual = useCreateManualBooking();

  const services = servicesData?.services ?? [];
  const allStaff = staffData?.staff ?? [];

  const [serviceId, setServiceId] = useState(initialServiceId ?? '');
  const [staffId, setStaffId] = useState(initialStaffId ?? '');
  const [didInit, setDidInit] = useState(!initialStaffId);

  const selectedService = services.find((s) => s._id === serviceId);
  const staff =
    selectedService?.staff && selectedService.staff.length
      ? allStaff.filter((s) => selectedService.staff.includes(s._id))
      : allStaff;

  useEffect(() => {
    // Skip the auto-reset for the very first render when a slot was clicked
    // directly (initialStaffId set) — the pair came from a live availability
    // grid so it's already consistent, and staff/services may still be
    // mid-fetch at that point, which would otherwise wipe the prefill.
    if (!didInit) {
      setDidInit(true);
      return;
    }
    if (staffId && !staff.some((s) => s._id === staffId)) setStaffId('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  const [bookingDate, setBookingDate] = useState(date);
  const [startTime, setStartTime] = useState(initialStartTime ?? '10:00');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createManual.mutateAsync({ serviceId, staffId, date: bookingDate, startTime, clientName, clientPhone });
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SLOT_TAKEN') setError(t('business.slotTaken'));
      else if (err instanceof ApiError && err.code === 'OUTSIDE_WORKING_HOURS') setError(t('business.slotOutsideHours'));
      else if (err instanceof ApiError && err.code === 'ON_BREAK') setError(t('business.slotOnBreak'));
      else setError(t('auth.genericError'));
    }
  }

  const fieldLabel = 'text-xs font-bold uppercase tracking-wide text-text-muted';
  const fieldInput =
    'w-full rounded-xl border border-border bg-bg px-4 py-3.5 text-[15px] text-text outline-none transition focus:border-primary';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6">
      <div className="flex max-h-[92dvh] w-full flex-col gap-5 overflow-y-auto rounded-t-3xl bg-surface p-6 shadow-lg sm:max-h-[85vh] sm:max-w-2xl sm:rounded-3xl sm:p-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-text">{t('biz.manualBooking')}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-text-muted transition hover:bg-surface2 hover:text-text">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={fieldLabel}>{t('biz.clientName')}</span>
              <input
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className={fieldInput}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={fieldLabel}>{t('biz.clientPhone')}</span>
              <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className={fieldInput} />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>{t('biz.service')}</span>
            <select
              required
              size={1}
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className={`${fieldInput} cursor-pointer`}
            >
              <option value="" disabled>
                {t('biz.service')}
              </option>
              {services.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} · {s.isFree ? t('biz.free') : `${s.price}₴`}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>{t('biz.master')}</span>
            <select
              required
              size={1}
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className={`${fieldInput} cursor-pointer`}
            >
              <option value="" disabled>
                {t('biz.master')}
              </option>
              {staff.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={fieldLabel}>{t('biz.date')}</span>
              <input
                type="date"
                required
                value={bookingDate}
                min={todayKey()}
                onChange={(e) => setBookingDate(e.target.value)}
                className={fieldInput}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={fieldLabel}>{t('biz.time')}</span>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={fieldInput}
              />
            </label>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={createManual.isPending}
            className="mt-1 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {t('biz.create')}
          </button>
        </form>
      </div>
    </div>
  );
}

export function todayKey() {
  return toDateKey(new Date());
}
