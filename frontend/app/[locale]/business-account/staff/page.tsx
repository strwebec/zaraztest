'use client';

import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useBusinessStaff,
  useCreateBusinessStaff,
  useDeleteBusinessStaff,
  useUpdateBusinessStaff,
  useUploadStaffPhoto,
  useDeleteStaffPhoto,
  useAddStaffTimeOff,
  useRemoveStaffTimeOff,
} from '@/lib/hooks';
import type { BusinessStaff, WeekSchedule } from '@/lib/utils/api';

const WEEKDAYS: { key: keyof WeekSchedule; label: string }[] = [
  { key: 'mon', label: 'Пн' },
  { key: 'tue', label: 'Вт' },
  { key: 'wed', label: 'Ср' },
  { key: 'thu', label: 'Чт' },
  { key: 'fri', label: 'Пт' },
  { key: 'sat', label: 'Сб' },
  { key: 'sun', label: 'Нд' },
];

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function StaffAvatar({ staff }: { staff: BusinessStaff }) {
  const uploadPhoto = useUploadStaffPhoto();
  const deletePhoto = useDeleteStaffPhoto();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploadPhoto.isPending}
        className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-border bg-bg text-sm font-bold text-text-muted transition hover:border-primary"
        title={staff.name}
      >
        {staff.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={staff.photoUrl} alt={staff.name} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center">{initials(staff.name)}</span>
        )}
      </button>
      {staff.photoUrl && (
        <button
          type="button"
          onClick={() => deletePhoto.mutate(staff._id)}
          disabled={deletePhoto.isPending}
          className="text-text-muted transition hover:text-danger"
        >
          <X size={13} />
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadPhoto.mutate({ id: staff._id, file });
          e.target.value = '';
        }}
      />
    </div>
  );
}

function TimeOffEditor({ staff }: { staff: BusinessStaff }) {
  const { t } = useTranslation();
  const addTimeOff = useAddStaffTimeOff();
  const removeTimeOff = useRemoveStaffTimeOff();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');

  const timeOff = staff.timeOff ?? [];

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-bg p-3">
      <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.timeOff')}</span>

      {timeOff.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {timeOff.map((off) => (
            <li key={off._id} className="flex items-center justify-between text-xs text-text-muted">
              <span>
                {new Date(off.from).toLocaleDateString()} – {new Date(off.to).toLocaleDateString()}
                {off.note ? ` · ${off.note}` : ''}
              </span>
              <button onClick={() => removeTimeOff.mutate({ id: staff._id, timeOffId: off._id })} className="text-danger">
                {t('biz.delete')}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-text outline-none focus:border-primary"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-text outline-none focus:border-primary"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('biz.timeOffNotePlaceholder') as string}
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-text outline-none focus:border-primary"
        />
        <button
          onClick={() => {
            if (!from || !to) return;
            addTimeOff.mutate(
              { id: staff._id, payload: { from, to, note: note || undefined } },
              { onSuccess: () => { setFrom(''); setTo(''); setNote(''); } }
            );
          }}
          disabled={addTimeOff.isPending || !from || !to}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
        >
          {t('biz.addTimeOff')}
        </button>
      </div>
    </div>
  );
}

function ScheduleEditor({ staff }: { staff: BusinessStaff }) {
  const { t } = useTranslation();
  const updateStaff = useUpdateBusinessStaff();
  const [schedule, setSchedule] = useState<WeekSchedule>(staff.schedule ?? {});

  function updateDay(
    key: keyof WeekSchedule,
    patch: Partial<{ start: string; end: string; dayOff: boolean; breakStart: string; breakEnd: string }>
  ) {
    setSchedule((prev) => ({
      ...prev,
      [key]: { start: '09:00', end: '18:00', dayOff: false, ...prev[key], ...patch },
    }));
  }

  function toggleBreak(key: keyof WeekSchedule, enabled: boolean) {
    setSchedule((prev) => {
      const day = prev[key] ?? { start: '09:00', end: '18:00', dayOff: false };
      if (!enabled) {
        const { breakStart: _breakStart, breakEnd: _breakEnd, ...rest } = day;
        return { ...prev, [key]: rest };
      }
      return { ...prev, [key]: { ...day, breakStart: '13:00', breakEnd: '14:00' } };
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-bg p-3">
      {WEEKDAYS.map(({ key, label }) => {
        const day = schedule[key] ?? { start: '09:00', end: '18:00', dayOff: false };
        const hasBreak = !!(day.breakStart && day.breakEnd);
        return (
          <div key={key} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-7 font-semibold text-text-muted">{label}</span>
              <label className="flex items-center gap-1.5 text-text-muted">
                <input
                  type="checkbox"
                  checked={!!day.dayOff}
                  onChange={(e) => updateDay(key, { dayOff: e.target.checked })}
                />
                {t('biz.dayOff')}
              </label>
              {!day.dayOff && (
                <>
                  <input
                    type="time"
                    value={day.start}
                    onChange={(e) => updateDay(key, { start: e.target.value })}
                    className="rounded-lg border border-border bg-surface px-2 py-1 text-text"
                  />
                  <input
                    type="time"
                    value={day.end}
                    onChange={(e) => updateDay(key, { end: e.target.value })}
                    className="rounded-lg border border-border bg-surface px-2 py-1 text-text"
                  />
                </>
              )}
            </div>
            {!day.dayOff && (
              <div className="ml-9 flex items-center gap-2 text-xs">
                <label className="flex items-center gap-1.5 text-text-muted">
                  <input type="checkbox" checked={hasBreak} onChange={(e) => toggleBreak(key, e.target.checked)} />
                  {t('biz.lunchBreak')}
                </label>
                {hasBreak && (
                  <>
                    <input
                      type="time"
                      value={day.breakStart}
                      onChange={(e) => updateDay(key, { breakStart: e.target.value })}
                      className="rounded-lg border border-border bg-surface px-2 py-1 text-text"
                    />
                    <input
                      type="time"
                      value={day.breakEnd}
                      onChange={(e) => updateDay(key, { breakEnd: e.target.value })}
                      className="rounded-lg border border-border bg-surface px-2 py-1 text-text"
                    />
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
      <div className="mt-1 flex gap-2">
        <button
          onClick={() => {
            const mon = schedule.mon ?? { start: '09:00', end: '18:00', dayOff: false };
            setSchedule(Object.fromEntries(WEEKDAYS.map(({ key }) => [key, { ...mon }])) as WeekSchedule);
          }}
          className="self-start rounded-lg border border-border px-4 py-1.5 text-xs font-semibold text-text-muted transition hover:border-primary hover:text-primary"
        >
          {t('biz.applyToAllDays')}
        </button>
        <button
          onClick={() => updateStaff.mutate({ id: staff._id, payload: { schedule } })}
          disabled={updateStaff.isPending}
          className="self-start rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60"
        >
          {t('biz.save')}
        </button>
      </div>
    </div>
  );
}

function StaffEditForm({ staff, onDone }: { staff: BusinessStaff; onDone: () => void }) {
  const { t } = useTranslation();
  const updateStaff = useUpdateBusinessStaff();
  const [name, setName] = useState(staff.name);
  const [role, setRole] = useState(staff.role ?? '');
  const [bio, setBio] = useState(staff.bio ?? '');

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-bg p-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('biz.staffName') as string}
        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
      />
      <input
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder={t('biz.role') as string}
        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
      />
      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder={t('biz.bioPlaceholder') as string}
        rows={3}
        className="resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
      />
      <button
        onClick={() => {
          updateStaff.mutate({ id: staff._id, payload: { name, role, bio } });
          onDone();
        }}
        disabled={updateStaff.isPending}
        className="self-start rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60"
      >
        {t('biz.save')}
      </button>
    </div>
  );
}

export default function BusinessStaffPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useBusinessStaff();
  const createStaff = useCreateBusinessStaff();
  const deleteStaff = useDeleteBusinessStaff();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [bio, setBio] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const staffList = data?.staff ?? [];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await createStaff.mutateAsync({ name, role, bio: bio || undefined });
    setName('');
    setRole('');
    setBio('');
    setShowForm(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-text">{t('biz.staff')}</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition hover:-translate-y-0.5"
        >
          {t('biz.addStaff')}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:max-w-md">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('biz.staffName') as string}
            className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
          />
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder={t('biz.role') as string}
            className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
          />
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={t('biz.bioPlaceholder') as string}
            rows={3}
            className="resize-none rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={createStaff.isPending}
            className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {t('biz.create')}
          </button>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {isLoading && Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20" />)}

        {!isLoading && staffList.length === 0 && <p className="py-10 text-center text-sm text-text-muted">{t('biz.noStaff')}</p>}

        {!isLoading &&
          staffList.map((s) => (
            <div key={s._id} className="rounded-2xl border border-border bg-surface p-4 shadow-xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <StaffAvatar staff={s} />
                  <div className="text-left">
                    <div className="text-sm font-semibold text-text">{s.name}</div>
                    {s.role && <div className="text-xs text-text-muted">{s.role}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setEditingId(editingId === s._id ? null : s._id);
                      setExpandedId(null);
                    }}
                    className="text-xs font-semibold text-primary"
                  >
                    {t('biz.edit')}
                  </button>
                  <button
                    onClick={() => {
                      setExpandedId(expandedId === s._id ? null : s._id);
                      setEditingId(null);
                    }}
                    className="text-xs font-semibold text-primary"
                  >
                    {t('biz.schedule')}
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(t('biz.deleteStaffConfirm', { name: s.name }) as string)) {
                        deleteStaff.mutate(s._id);
                      }
                    }}
                    className="text-xs font-semibold text-danger"
                  >
                    {t('biz.delete')}
                  </button>
                </div>
              </div>
              {editingId === s._id && (
                <div className="mt-3">
                  <StaffEditForm staff={s} onDone={() => setEditingId(null)} />
                </div>
              )}
              {expandedId === s._id && (
                <div className="mt-3 flex flex-col gap-3">
                  <ScheduleEditor staff={s} />
                  <TimeOffEditor staff={s} />
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
