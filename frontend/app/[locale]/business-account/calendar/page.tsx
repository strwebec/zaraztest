'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Phone, Plus } from 'lucide-react';
import { ManualBookingModal, todayKey } from '@/components/business/ManualBookingModal';
import { WeekAvailabilityGrid } from '@/components/business/WeekAvailabilityGrid';
import { ServiceWeekAvailabilityGrid } from '@/components/business/ServiceWeekAvailabilityGrid';
import { RescheduleModal } from '@/components/shared/RescheduleModal';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useBusinessBookings,
  useBusinessMe,
  useBusinessStaff,
  useBusinessServices,
  useCancelBusinessBooking,
  useCompleteBusinessBooking,
  useMarkBookingReady,
  useNoShowBusinessBooking,
  useRescheduleBusinessBooking,
  useUpdateBookingDuration,
  useAssignBookingStaff,
  ApiError,
} from '@/lib/hooks';
import type { BusinessBooking } from '@/lib/utils/api';
import type { Locale } from '@/lib/i18n';

function addDays(dateKey: string, days: number) {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mondayOf(dateKey: string) {
  const d = new Date(`${dateKey}T00:00:00`);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(dateKey, offset);
}

function weekdayShort(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('uk-UA', { weekday: 'short' });
}

function dayNumber(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`).getDate();
}

const STAFF_COLORS = ['#5E56A8', '#2E9E6D', '#C98A2E', '#4E82C4', '#B9548A', '#7A9B4E', '#C4693F', '#5A9BA8'];

const RANGE_START_HOUR = 7;
const RANGE_END_HOUR = 21;
const HOUR_HEIGHT = 56;
const TIMELINE_HEIGHT = (RANGE_END_HOUR - RANGE_START_HOUR) * HOUR_HEIGHT;

function timeToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

const STATUS_ACCENT: Record<string, string> = {
  confirmed: 'border-primary bg-primary-glow',
  completed: 'border-border bg-surface2',
  cancelled_by_client: 'border-danger/40 bg-danger/5 opacity-60',
  cancelled_by_business: 'border-danger/40 bg-danger/5 opacity-60',
  no_show: 'border-warning/40 bg-warning/10',
};

type BookingPrefill = { date: string; staffId?: string; serviceId?: string; startTime?: string };

export default function BusinessCalendarPage() {
  const { t } = useTranslation();
  const { locale } = useParams<{ locale: Locale }>();
  const [anchorDate, setAnchorDate] = useState(todayKey());
  const [activeDay, setActiveDay] = useState(todayKey());
  const [weekStart, setWeekStart] = useState(mondayOf(todayKey()));
  const [staffFilter, setStaffFilter] = useState<string | null>(null);
  const [serviceFilter, setServiceFilter] = useState<string>('');
  const [bookingPrefill, setBookingPrefill] = useState<BookingPrefill | null>(null);
  // Holds the full booking object rather than an id to look up — the detail modal can
  // be opened from the day-view's own bookings list, but also from the week-availability
  // grid, which loads a completely different week's data and would never find a match
  // by id in `bookings` if this stayed id-based.
  const [selectedBooking, setSelectedBooking] = useState<BusinessBooking | null>(null);
  const [reschedulingBooking, setReschedulingBooking] = useState<BusinessBooking | null>(null);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [editingDuration, setEditingDuration] = useState(false);
  const [durationInput, setDurationInput] = useState('');
  const [durationError, setDurationError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [assigningStaff, setAssigningStaff] = useState(false);
  const [assignStaffId, setAssignStaffId] = useState('');
  const [assignError, setAssignError] = useState<string | null>(null);

  const { data: bizData } = useBusinessMe();
  const { data: staffData } = useBusinessStaff();
  const { data: servicesData } = useBusinessServices();
  const { data, isLoading } = useBusinessBookings(anchorDate);
  const cancelMutation = useCancelBusinessBooking();
  const completeMutation = useCompleteBusinessBooking();
  const noShowMutation = useNoShowBusinessBooking();
  const rescheduleMutation = useRescheduleBusinessBooking();
  const readyMutation = useMarkBookingReady();
  const durationMutation = useUpdateBookingDuration();
  const assignStaffMutation = useAssignBookingStaff();

  const bookings = data?.bookings ?? [];
  const from = data?.from ?? anchorDate;
  const services = servicesData?.services ?? [];

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(from, i)), [from]);
  const byDay = useMemo(() => {
    const map = new Map<string, BusinessBooking[]>();
    for (const day of days) map.set(day, []);
    for (const bk of bookings) map.get(bk.date)?.push(bk);
    return map;
  }, [days, bookings]);

  const staffList = staffData?.staff ?? [];
  const showStaffColumns = staffList.length > 1;
  const staffColor = useMemo(() => {
    const map = new Map<string, string>();
    staffList.forEach((s, i) => map.set(s._id, STAFF_COLORS[i % STAFF_COLORS.length]));
    return map;
  }, [staffList]);

  const dayBookings = byDay.get(activeDay) ?? [];
  const dayBookingCounts = useMemo(() => {
    const counts = new Map<string, number>();
    days.forEach((d) => counts.set(d, (byDay.get(d) ?? []).filter((b) => !b.status.startsWith('cancelled')).length));
    return counts;
  }, [days, byDay]);

  // "All masters" keeps the classic multi-column day timeline (a bird's-eye view of
  // everyone at once). Picking one master switches to the week free/busy grid below —
  // that's the actual "is anyone free next Tuesday for X" question staff need answered
  // fast, and a single stretched-out column of a timeline can't answer it at a glance.
  const columns = staffFilter
    ? staffList.filter((s) => s._id === staffFilter)
    : showStaffColumns
      ? staffList
      : staffList.slice(0, 1);

  const selected = selectedBooking;

  function describeActionError(err: unknown) {
    if (err instanceof ApiError) {
      if (err.code === 'BOOKING_NOT_YET_DUE') return t('biz.bookingNotYetDue') as string;
      if (err.code === 'INVALID_STATE_TRANSITION') return t('biz.invalidStateTransition') as string;
      if (err.code === 'SLOT_TAKEN') return t('business.slotTaken') as string;
      if (err.code === 'OUTSIDE_WORKING_HOURS') return t('business.slotOutsideHours') as string;
      if (err.code === 'ON_BREAK') return t('business.slotOnBreak') as string;
    }
    return t('auth.genericError') as string;
  }

  async function handleReschedule(date: string, startTime: string, staffId: string) {
    if (!reschedulingBooking) return;
    setRescheduleError(null);
    try {
      await rescheduleMutation.mutateAsync({ id: reschedulingBooking._id, payload: { date, startTime, staffId } });
      setReschedulingBooking(null);
    } catch (err) {
      setRescheduleError(describeActionError(err));
    }
  }

  function blockStyle(bk: BusinessBooking) {
    const startMin = timeToMinutes(bk.startTime);
    const clampedStart = Math.max(startMin, RANGE_START_HOUR * 60);
    const top = ((clampedStart - RANGE_START_HOUR * 60) / 60) * HOUR_HEIGHT;
    const height = Math.max((bk.durationMinutes / 60) * HOUR_HEIGHT - 3, 22);
    return { top, height };
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="sticky top-0 z-20 -mx-5 flex flex-col gap-3 bg-bg px-5 pb-3 pt-1 sm:-mx-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold tracking-tight text-text">{t('biz.calendar')}</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setAnchorDate(addDays(from, -7));
                setActiveDay(addDays(activeDay, -7));
              }}
              title={t('biz.previousWeek') as string}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-text-muted transition hover:border-primary hover:text-primary"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => {
                setAnchorDate(todayKey());
                setActiveDay(todayKey());
              }}
              className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-text-muted transition hover:border-primary hover:text-primary"
            >
              {t('home.today')}
            </button>
            <button
              onClick={() => {
                setAnchorDate(addDays(from, 7));
                setActiveDay(addDays(activeDay, 7));
              }}
              title={t('biz.nextWeek') as string}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-text-muted transition hover:border-primary hover:text-primary"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setBookingPrefill({ date: activeDay })}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-primary-hover"
            >
              <Plus size={14} />
              {t('biz.addBooking')}
            </button>
          </div>
        </div>

        {/* week strip */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map((day) => {
            const isToday = day === todayKey();
            const isActive = day === activeDay;
            const count = dayBookingCounts.get(day) ?? 0;
            return (
              <button
                key={day}
                onClick={() => setActiveDay(day)}
                className={`flex flex-none flex-col items-center gap-1 rounded-xl border px-4 py-2.5 transition ${
                  isActive
                    ? 'border-primary bg-primary text-white'
                    : isToday
                      ? 'border-primary bg-primary-glow text-text'
                      : 'border-border bg-surface text-text-muted hover:border-primary'
                }`}
              >
                <span className="text-[10.5px] uppercase opacity-80">{weekdayShort(day)}</span>
                <span className="font-mono font-tabular text-base font-bold">{dayNumber(day)}</span>
                <span className={`text-[10px] font-semibold ${isActive ? 'text-white/80' : 'text-text-muted'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {staffList.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setStaffFilter(null)}
                className={`flex-none rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                  !staffFilter ? 'border-primary bg-primary-glow text-text' : 'border-border text-text-muted hover:border-primary/40'
                }`}
              >
                {t('biz.allStaff')}
              </button>
              {staffList.map((s) => (
                <button
                  key={s._id}
                  onClick={() => setStaffFilter(s._id)}
                  className={`flex flex-none items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                    staffFilter === s._id ? 'border-primary bg-primary-glow text-text' : 'border-border text-text-muted hover:border-primary/40'
                  }`}
                >
                  <span className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: staffColor.get(s._id) }} />
                  {s.name}
                </button>
              ))}
            </div>
            {services.length > 0 && (
              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className="flex-none rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-text-muted outline-none transition hover:border-primary/40 focus:border-primary"
              >
                <option value="">{t('biz.allServices')}</option>
                {services
                  .filter((sv) => !staffFilter || !sv.staff || !sv.staff.length || sv.staff.includes(staffFilter))
                  .map((sv) => (
                    <option key={sv._id} value={sv._id}>
                      {sv.name}
                    </option>
                  ))}
              </select>
            )}
          </div>
        )}
      </div>

      {staffFilter ? (
        <WeekAvailabilityGrid
          staffId={staffFilter}
          serviceId={serviceFilter || undefined}
          weekStart={weekStart}
          onWeekChange={setWeekStart}
          onSlotClick={(date, time) =>
            setBookingPrefill({ date, staffId: staffFilter, serviceId: serviceFilter || undefined, startTime: time })
          }
          onBookingClick={(booking) => {
            setSelectedBooking(booking);
            setEditingDuration(false);
            setActionError(null);
          }}
        />
      ) : serviceFilter ? (
        <ServiceWeekAvailabilityGrid
          serviceId={serviceFilter}
          weekStart={weekStart}
          onWeekChange={setWeekStart}
          onSlotClick={(date, time, staffId) => setBookingPrefill({ date, staffId, serviceId: serviceFilter, startTime: time })}
        />
      ) : isLoading ? (
        <Skeleton className="h-[500px]" />
      ) : (
        <div className="min-w-0 overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
          <div className="flex min-w-full">
            {/* hour gutter */}
            <div className="flex-none border-r border-border" style={{ width: 52 }}>
              <div style={{ height: 40 }} />
              <div className="relative" style={{ height: TIMELINE_HEIGHT }}>
                {Array.from({ length: RANGE_END_HOUR - RANGE_START_HOUR + 1 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute right-2 -translate-y-1/2 font-mono text-[10px] text-text-muted"
                    style={{ top: i * HOUR_HEIGHT }}
                  >
                    {String(RANGE_START_HOUR + i).padStart(2, '0')}:00
                  </div>
                ))}
              </div>
            </div>

            {/* staff / single column(s) */}
            {columns.length === 0 ? (
              <div className="flex flex-1 items-center justify-center py-16 text-sm text-text-muted">
                {t('biz.noStaffYet')}
              </div>
            ) : (
              columns.map((staff) => {
                const colBookings = showStaffColumns
                  ? dayBookings.filter((b) => b.staff._id === staff._id)
                  : dayBookings;
                return (
                  <div key={staff._id} className="min-w-[220px] flex-1 border-r border-border last:border-r-0">
                    {showStaffColumns && (
                      <div
                        className="flex items-center gap-2 border-b border-border px-3"
                        style={{ height: 40 }}
                      >
                        <span
                          className="h-2 w-2 flex-none rounded-full"
                          style={{ backgroundColor: staffColor.get(staff._id) }}
                        />
                        <span className="truncate text-xs font-semibold text-text">{staff.name}</span>
                      </div>
                    )}
                    {!showStaffColumns && <div style={{ height: 40 }} />}
                    <div className="relative" style={{ height: TIMELINE_HEIGHT }}>
                      {Array.from({ length: RANGE_END_HOUR - RANGE_START_HOUR }).map((_, i) => (
                        <div
                          key={i}
                          className="absolute inset-x-0 border-t border-surface2"
                          style={{ top: i * HOUR_HEIGHT }}
                        />
                      ))}
                      {colBookings.map((bk) => {
                        const { top, height } = blockStyle(bk);
                        return (
                          <button
                            key={bk._id}
                            onClick={() => {
                              setSelectedBooking(bk);
                              setEditingDuration(false);
                              setActionError(null);
                            }}
                            className={`absolute inset-x-1 flex flex-col overflow-hidden rounded-lg border-l-2 px-2 py-1 text-left transition hover:brightness-95 ${
                              STATUS_ACCENT[bk.status] ?? 'border-border bg-surface2'
                            }`}
                            style={{
                              top,
                              height,
                              borderLeftColor: showStaffColumns
                                ? staffColor.get(bk.staff._id)
                                : bk.source === 'platform'
                                  ? '#5E56A8'
                                  : '#2E9E6D',
                            }}
                          >
                            <span className="truncate font-mono text-[10px] font-bold text-text">{bk.startTime}</span>
                            <span className="truncate text-[11px] font-semibold text-text">{bk.clientName}</span>
                            {height > 40 && (
                              <span className="truncate text-[10px] text-text-muted">{bk.service.name}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
          onClick={() => {
            setSelectedBooking(null);
            setEditingDuration(false);
            setAssigningStaff(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-full flex-col gap-3 rounded-t-3xl bg-surface p-6 shadow-lg sm:max-w-sm sm:rounded-3xl"
          >
            <h3 className="font-display text-lg font-bold text-text">{selected.clientName}</h3>
            <p className="text-sm text-text-muted">
              {selected.service.name} ·{' '}
              {selected.autoAssignedStaff ? (
                <span className="font-semibold text-warning">{t('biz.staffUnassigned')}</span>
              ) : (
                selected.staff.name
              )}
            </p>
            <p className="font-mono text-sm text-text-muted">
              {selected.date} · {selected.startTime}
            </p>
            <p className="text-xs text-text-muted">
              {selected.source === 'platform' ? t('biz.platform') : t('biz.manual')} · {selected.price}₴
            </p>
            {selected.comment && (
              <p className="rounded-xl bg-bg px-3 py-2 text-xs text-text-muted">
                <span className="font-semibold text-text">{t('biz.clientComment')}: </span>
                {selected.comment}
              </p>
            )}
            {editingDuration ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={durationInput}
                  onChange={(e) => setDurationInput(e.target.value)}
                  className="w-24 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs text-text outline-none focus:border-primary"
                />
                <span className="text-xs text-text-muted">{t('biz.durationMinutesLabel')}</span>
                <button
                  onClick={() => {
                    const minutes = Number(durationInput);
                    if (!Number.isFinite(minutes) || minutes < 5) {
                      setDurationError(t('biz.invalidDuration') as string);
                      return;
                    }
                    setDurationError(null);
                    durationMutation.mutate(
                      { id: selected._id, durationMinutes: minutes },
                      {
                        onSuccess: () => setEditingDuration(false),
                        onError: (err) => setDurationError(describeActionError(err)),
                      }
                    );
                  }}
                  disabled={durationMutation.isPending}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                >
                  {t('biz.save')}
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setDurationInput(String(selected.durationMinutes));
                  setDurationError(null);
                  setEditingDuration(true);
                }}
                className="self-start text-xs font-semibold text-primary"
              >
                {t('biz.editActualDuration', { minutes: selected.durationMinutes })}
              </button>
            )}
            {durationError && <p className="text-xs text-danger">{durationError}</p>}
            {selected.clientPhone && (
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Phone size={14} />
                {selected.phoneRevealed ? (
                  <a href={`tel:${selected.clientPhone}`} className="font-mono text-text underline">
                    {selected.clientPhone}
                  </a>
                ) : (
                  <span className="font-mono">
                    {selected.clientPhone}
                    {selected.phoneRevealAt && (
                      <span className="ml-1 font-sans text-text-muted">
                        · {t('biz.phoneRevealsAt', {
                          time: new Date(selected.phoneRevealAt).toLocaleString('uk-UA', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          }),
                        })}
                      </span>
                    )}
                  </span>
                )}
              </div>
            )}
            {selected.readyAt && (
              <p className="text-xs font-semibold text-success">{t('biz.readyMarked')}</p>
            )}
            {selected.status === 'confirmed' &&
              (assigningStaff ? (
                <div className="flex flex-col gap-2 rounded-xl border border-border bg-bg p-3">
                  <span className="text-xs font-semibold text-text-muted">{t('biz.assignStaffLabel')}</span>
                  <select
                    value={assignStaffId}
                    onChange={(e) => setAssignStaffId(e.target.value)}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text outline-none focus:border-primary"
                  >
                    <option value="" disabled>
                      {t('biz.master')}
                    </option>
                    {staffList.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  {assignError && <p className="text-xs text-danger">{assignError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (!assignStaffId) return;
                        setAssignError(null);
                        assignStaffMutation.mutate(
                          { id: selected._id, staffId: assignStaffId },
                          {
                            onSuccess: (res) => {
                              setSelectedBooking(res.booking);
                              setAssigningStaff(false);
                            },
                            onError: (err) => setAssignError(describeActionError(err)),
                          }
                        );
                      }}
                      disabled={assignStaffMutation.isPending || !assignStaffId}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                    >
                      {t('biz.assignStaffConfirm')}
                    </button>
                    <button
                      onClick={() => {
                        setAssigningStaff(false);
                        setAssignError(null);
                      }}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-text-muted"
                    >
                      {t('biz.cancelBooking')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setAssignStaffId(selected.staff._id);
                    setAssigningStaff(true);
                  }}
                  className="self-start text-xs font-semibold text-primary"
                >
                  {selected.autoAssignedStaff ? t('biz.assignStaffAction') : t('biz.reassignStaffAction')}
                </button>
              ))}
            {actionError && <p className="text-xs text-danger">{actionError}</p>}
            {selected.status === 'confirmed' && (
              <div className="flex flex-col gap-2 pt-2">
                {!selected.readyAt && (
                  <button
                    onClick={() => {
                      setActionError(null);
                      readyMutation.mutate(selected._id, {
                        onSuccess: () => setSelectedBooking(null),
                        onError: (err) => setActionError(describeActionError(err)),
                      });
                    }}
                    disabled={readyMutation.isPending}
                    className="rounded-xl border border-success/40 px-4 py-2.5 text-xs font-bold text-success transition hover:bg-success/10 disabled:opacity-60"
                  >
                    {t('biz.markReady')}
                  </button>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setActionError(null);
                      completeMutation.mutate(selected._id, {
                        onSuccess: () => setSelectedBooking(null),
                        onError: (err) => setActionError(describeActionError(err)),
                      });
                    }}
                    disabled={completeMutation.isPending}
                    className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white transition hover:bg-primary-hover disabled:opacity-60"
                  >
                    {t('biz.complete')}
                  </button>
                  <button
                    onClick={() => {
                      if (!window.confirm(t('biz.noShowConfirm', { name: selected.clientName }) as string)) return;
                      setActionError(null);
                      noShowMutation.mutate(selected._id, {
                        onSuccess: () => setSelectedBooking(null),
                        onError: (err) => setActionError(describeActionError(err)),
                      });
                    }}
                    disabled={noShowMutation.isPending}
                    className="flex-1 rounded-xl border border-warning/40 px-4 py-2.5 text-xs font-bold text-warning transition hover:bg-warning/10 disabled:opacity-60"
                  >
                    {t('biz.noShow')}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setRescheduleError(null);
                      setReschedulingBooking(selected);
                      setSelectedBooking(null);
                    }}
                    className="flex-1 rounded-xl border border-primary/40 px-4 py-2.5 text-xs font-bold text-primary transition hover:bg-primary-glow"
                  >
                    {t('client.reschedule')}
                  </button>
                  <button
                    onClick={() => {
                      if (!window.confirm(t('biz.cancelBookingConfirm', { name: selected.clientName }) as string)) return;
                      setActionError(null);
                      cancelMutation.mutate(selected._id, {
                        onSuccess: () => setSelectedBooking(null),
                        onError: (err) => setActionError(describeActionError(err)),
                      });
                    }}
                    disabled={cancelMutation.isPending}
                    className="flex-1 rounded-xl border border-danger/40 px-4 py-2.5 text-xs font-bold text-danger transition hover:bg-danger/10 disabled:opacity-60"
                  >
                    {t('biz.cancelBooking')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {bookingPrefill && (
        <ManualBookingModal
          date={bookingPrefill.date}
          initialStaffId={bookingPrefill.staffId}
          initialServiceId={bookingPrefill.serviceId}
          initialStartTime={bookingPrefill.startTime}
          onClose={() => setBookingPrefill(null)}
        />
      )}

      {reschedulingBooking && bizData?.business && (
        <RescheduleModal
          locale={locale}
          businessId={bizData.business._id}
          serviceId={reschedulingBooking.service._id}
          cancellationPolicyHours={bizData.business.cancellationPolicyHours}
          currentDate={reschedulingBooking.date}
          currentTime={reschedulingBooking.startTime}
          onConfirm={handleReschedule}
          onClose={() => setReschedulingBooking(null)}
          isPending={rescheduleMutation.isPending}
          error={rescheduleError}
        />
      )}
    </div>
  );
}
