'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Plus, X } from 'lucide-react';
import { useBusinessServices, useBusinessStaff, useCreateManualBooking, ApiError } from '@/lib/hooks';
import { toDateKey } from '@/lib/utils/dates';

const MAX_QUANTITY = 10;
const AUTO_ASSIGN_VALUE = '';

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
  const [staffId, setStaffId] = useState(initialStaffId ?? AUTO_ASSIGN_VALUE);
  const [quantity, setQuantity] = useState(1);
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
    if (staffId && !staff.some((s) => s._id === staffId)) setStaffId(AUTO_ASSIGN_VALUE);
    if (selectedService?.repeatable === false) setQuantity(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  const [bookingDate, setBookingDate] = useState(date);
  const [startTime, setStartTime] = useState(initialStartTime ?? '10:00');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState(false);

  const canRepeat = selectedService?.repeatable !== false;
  const totalPrice = selectedService ? (selectedService.isFree ? 0 : selectedService.price * quantity) : 0;
  const totalDuration = selectedService ? selectedService.durationMinutes * quantity : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createManual.mutateAsync({
        serviceId,
        staffId: staffId || undefined,
        date: bookingDate,
        startTime,
        clientName,
        clientPhone,
        quantity,
      });
      setJustCreated(true);
      setTimeout(onClose, 1400);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SLOT_TAKEN') setError(t('business.slotTaken'));
      else if (err instanceof ApiError && err.code === 'OUTSIDE_WORKING_HOURS') setError(t('business.slotOutsideHours'));
      else if (err instanceof ApiError && err.code === 'ON_BREAK') setError(t('business.slotOnBreak'));
      else if (err instanceof ApiError && err.code === 'SERVICE_TOO_LONG') {
        setError(t('biz.serviceTooLong', { minutes: err.data?.maxDurationMinutes }) as string);
      } else setError(t('auth.genericError'));
    }
  }

  const fieldLabel = 'text-xs font-bold uppercase tracking-wide text-text-muted';
  const fieldInput =
    'w-full rounded-xl border border-border bg-bg px-4 py-3.5 text-[15px] text-text outline-none transition focus:border-primary';

  if (justCreated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-surface px-8 py-10 text-center shadow-lg">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="font-display text-lg font-bold text-text">{t('biz.manualBookingCreated')}</p>
        </div>
      </div>
    );
  }

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
                  {s.name} · {s.isFree ? t('biz.free') : `${s.price}₴`} · {s.durationMinutes} хв
                </option>
              ))}
            </select>
            {selectedService?.description && (
              <p className="text-xs text-text-muted">{selectedService.description}</p>
            )}
          </label>

          {canRepeat && (
            <label className="flex flex-col gap-1.5">
              <span className={fieldLabel}>{t('biz.quantity')}</span>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-bg px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition hover:bg-surface2 hover:text-text"
                  aria-label={t('business.decreaseQuantity') as string}
                >
                  <Minus size={14} />
                </button>
                <span className="w-6 text-center font-mono text-sm font-semibold text-text">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition hover:bg-surface2 hover:text-text"
                  aria-label={t('business.increaseQuantity') as string}
                >
                  <Plus size={14} />
                </button>
                {selectedService && quantity > 1 && (
                  <span className="ml-auto text-xs text-text-muted">
                    {t('biz.quantityTotal', { minutes: totalDuration, price: totalPrice })}
                  </span>
                )}
              </div>
            </label>
          )}

          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>{t('biz.master')}</span>
            <select
              size={1}
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className={`${fieldInput} cursor-pointer`}
            >
              <option value={AUTO_ASSIGN_VALUE}>{t('biz.autoAssignStaff')}</option>
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
