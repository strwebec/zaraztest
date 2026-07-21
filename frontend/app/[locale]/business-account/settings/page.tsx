'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useBusinessMe,
  useUpdateBusinessMe,
  useUpdateBusinessWorkingHours,
  useUploadBusinessCoverPhoto,
  useDeleteBusinessCoverPhoto,
  useUploadBusinessGalleryPhotos,
  useDeleteBusinessGalleryPhoto,
  useBackupSheetInfo,
  useConnectBackupSheet,
  useDisconnectBackupSheet,
} from '@/lib/hooks';
import type { BusinessDetail, WeekSchedule } from '@/lib/utils/api';

const WEEKDAYS: { key: keyof WeekSchedule; label: string }[] = [
  { key: 'mon', label: 'Пн' },
  { key: 'tue', label: 'Вт' },
  { key: 'wed', label: 'Ср' },
  { key: 'thu', label: 'Чт' },
  { key: 'fri', label: 'Пт' },
  { key: 'sat', label: 'Сб' },
  { key: 'sun', label: 'Нд' },
];

function WorkingHoursEditor({ business }: { business: BusinessDetail }) {
  const { t } = useTranslation();
  const updateHours = useUpdateBusinessWorkingHours();
  const [schedule, setSchedule] = useState<WeekSchedule>(business.workingHours ?? {});
  const [saved, setSaved] = useState(false);

  function updateDay(
    key: keyof WeekSchedule,
    patch: Partial<{ start: string; end: string; dayOff: boolean; breakStart: string; breakEnd: string }>
  ) {
    setSchedule((prev) => ({
      ...prev,
      [key]: { start: '09:00', end: '19:00', dayOff: false, ...prev[key], ...patch },
    }));
  }

  function toggleBreak(key: keyof WeekSchedule, enabled: boolean) {
    setSchedule((prev) => {
      const day = prev[key] ?? { start: '09:00', end: '19:00', dayOff: false };
      if (!enabled) {
        const { breakStart: _breakStart, breakEnd: _breakEnd, ...rest } = day;
        return { ...prev, [key]: rest };
      }
      return { ...prev, [key]: { ...day, breakStart: '13:00', breakEnd: '14:00' } };
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.workingHoursTitle')}</h2>
      <p className="text-xs text-text-muted">{t('biz.workingHoursHint')}</p>
      <div className="flex flex-col gap-2">
        {WEEKDAYS.map(({ key, label }) => {
          const day = schedule[key] ?? { start: '09:00', end: '19:00', dayOff: false };
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
                      className="rounded-lg border border-border bg-bg px-2 py-1 text-text"
                    />
                    <input
                      type="time"
                      value={day.end}
                      onChange={(e) => updateDay(key, { end: e.target.value })}
                      className="rounded-lg border border-border bg-bg px-2 py-1 text-text"
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
                        className="rounded-lg border border-border bg-bg px-2 py-1 text-text"
                      />
                      <input
                        type="time"
                        value={day.breakEnd}
                        onChange={(e) => updateDay(key, { breakEnd: e.target.value })}
                        className="rounded-lg border border-border bg-bg px-2 py-1 text-text"
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex items-center gap-3">
        <button
          onClick={() => {
            const mon = schedule.mon ?? { start: '09:00', end: '19:00', dayOff: false };
            setSchedule(Object.fromEntries(WEEKDAYS.map(({ key }) => [key, { ...mon }])) as WeekSchedule);
          }}
          className="self-start rounded-lg border border-border px-4 py-1.5 text-xs font-semibold text-text-muted transition hover:border-primary hover:text-primary"
        >
          {t('biz.applyToAllDays')}
        </button>
        <button
          onClick={() =>
            updateHours.mutate(schedule, {
              onSuccess: () => {
                setSaved(true);
                setTimeout(() => setSaved(false), 2500);
              },
            })
          }
          disabled={updateHours.isPending}
          className="rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60"
        >
          {t('biz.save')}
        </button>
        {saved && <span className="text-xs text-success">{t('biz.settingsSaved')}</span>}
      </div>
    </section>
  );
}

const BUFFER_OPTIONS = [0, 5, 10, 15, 20, 30];

function BufferTimeEditor({ business }: { business: BusinessDetail }) {
  const { t } = useTranslation();
  const updateMe = useUpdateBusinessMe();
  const [value, setValue] = useState(business.bufferMinutes ?? 0);
  const [saved, setSaved] = useState(false);

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.bufferTimeTitle')}</h2>
      <p className="text-xs text-text-muted">{t('biz.bufferTimeHint')}</p>
      <div className="flex flex-wrap items-center gap-2">
        {BUFFER_OPTIONS.map((minutes) => (
          <button
            key={minutes}
            type="button"
            onClick={() => setValue(minutes)}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
              value === minutes ? 'bg-primary text-white' : 'border border-border text-text-muted hover:border-primary'
            }`}
          >
            {minutes === 0 ? t('biz.bufferTimeNone') : t('biz.bufferTimeMinutes', { count: minutes })}
          </button>
        ))}
      </div>
      <div className="mt-1 flex items-center gap-3">
        <button
          onClick={() =>
            updateMe.mutate(
              { bufferMinutes: value },
              {
                onSuccess: () => {
                  setSaved(true);
                  setTimeout(() => setSaved(false), 2500);
                },
              }
            )
          }
          disabled={updateMe.isPending}
          className="self-start rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60"
        >
          {t('biz.save')}
        </button>
        {saved && <span className="text-xs text-success">{t('biz.settingsSaved')}</span>}
      </div>
    </section>
  );
}

const CANCELLATION_POLICY_OPTIONS = [24, 48] as const;

function CancellationPolicyEditor({ business }: { business: BusinessDetail }) {
  const { t } = useTranslation();
  const updateMe = useUpdateBusinessMe();
  const [value, setValue] = useState<24 | 48>(business.cancellationPolicyHours === 48 ? 48 : 24);
  const [saved, setSaved] = useState(false);

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.cancellationPolicyTitle')}</h2>
      <p className="text-xs text-text-muted">{t('biz.cancellationPolicyHint')}</p>
      <div className="flex flex-wrap items-center gap-2">
        {CANCELLATION_POLICY_OPTIONS.map((hours) => (
          <button
            key={hours}
            type="button"
            onClick={() => setValue(hours)}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
              value === hours ? 'bg-primary text-white' : 'border border-border text-text-muted hover:border-primary'
            }`}
          >
            {t('biz.cancellationPolicyHours', { count: hours })}
          </button>
        ))}
      </div>
      <div className="mt-1 flex items-center gap-3">
        <button
          onClick={() =>
            updateMe.mutate(
              { cancellationPolicyHours: value },
              {
                onSuccess: () => {
                  setSaved(true);
                  setTimeout(() => setSaved(false), 2500);
                },
              }
            )
          }
          disabled={updateMe.isPending}
          className="self-start rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60"
        >
          {t('biz.save')}
        </button>
        {saved && <span className="text-xs text-success">{t('biz.settingsSaved')}</span>}
      </div>
    </section>
  );
}

const BOOKING_WINDOW_OPTIONS = [7, 14, 21, 30, 60, 90];

function BookingWindowEditor({ business }: { business: BusinessDetail }) {
  const { t } = useTranslation();
  const updateMe = useUpdateBusinessMe();
  const [value, setValue] = useState(business.bookingWindowDays ?? 30);
  const [saved, setSaved] = useState(false);

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.bookingWindowTitle')}</h2>
      <p className="text-xs text-text-muted">{t('biz.bookingWindowHint')}</p>
      <div className="flex flex-wrap items-center gap-2">
        {BOOKING_WINDOW_OPTIONS.map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => setValue(days)}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
              value === days ? 'bg-primary text-white' : 'border border-border text-text-muted hover:border-primary'
            }`}
          >
            {t('biz.bookingWindowDays', { count: days })}
          </button>
        ))}
      </div>
      <div className="mt-1 flex items-center gap-3">
        <button
          onClick={() =>
            updateMe.mutate(
              { bookingWindowDays: value },
              {
                onSuccess: () => {
                  setSaved(true);
                  setTimeout(() => setSaved(false), 2500);
                },
              }
            )
          }
          disabled={updateMe.isPending}
          className="self-start rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60"
        >
          {t('biz.save')}
        </button>
        {saved && <span className="text-xs text-success">{t('biz.settingsSaved')}</span>}
      </div>
    </section>
  );
}

function BackupSheetSection({ business }: { business: BusinessDetail }) {
  const { t } = useTranslation();
  const { data: sheetInfo } = useBackupSheetInfo();
  const connectSheet = useConnectBackupSheet();
  const disconnectSheet = useDisconnectBackupSheet();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const serviceAccountEmail = sheetInfo?.serviceAccountEmail;

  function errorText(code?: string) {
    if (code === 'INVALID_URL') return t('biz.backupSheetErrorInvalidUrl');
    if (code === 'SHEET_NOT_SHARED') return t('biz.backupSheetErrorNotShared');
    return t('biz.backupSheetErrorGeneric');
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.backupSheetTitle')}</h2>
      <p className="text-xs text-text-muted">{t('biz.backupSheetHint')}</p>

      {business.backupSheetUrl ? (
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={business.backupSheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-primary/40 px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary-glow"
          >
            {t('biz.backupSheetOpen')}
          </a>
          <span className="text-xs font-semibold text-success">{t('biz.backupSheetConnected')}</span>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm(t('biz.backupSheetDisconnectConfirm') as string)) return;
              disconnectSheet.mutate();
            }}
            disabled={disconnectSheet.isPending}
            className="ml-auto text-xs font-semibold text-text-muted underline disabled:opacity-60"
          >
            {t('biz.backupSheetDisconnect')}
          </button>
        </div>
      ) : sheetInfo && !sheetInfo.configured ? (
        <p className="text-xs text-text-muted">{t('biz.backupSheetNotConfigured')}</p>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl bg-bg p-4">
          <p className="text-xs font-bold text-text">{t('biz.backupSheetConnectTitle')}</p>
          <p className="text-xs text-text-muted">{t('biz.backupSheetStep1')}</p>
          <div>
            <p className="text-xs text-text-muted">{t('biz.backupSheetStep2')}</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text">
                {serviceAccountEmail || '…'}
              </code>
              {serviceAccountEmail && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(serviceAccountEmail);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="text-xs font-semibold text-primary"
                >
                  {copied ? t('biz.backupSheetCopied') : t('biz.backupSheetCopyEmail')}
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-text-muted">{t('biz.backupSheetStep3')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('biz.backupSheetUrlPlaceholder') as string}
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => {
                setError(null);
                connectSheet.mutate(url, {
                  onSuccess: () => setUrl(''),
                  onError: (err) => setError(errorText((err as { code?: string }).code)),
                });
              }}
              disabled={connectSheet.isPending || !url.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              {connectSheet.isPending ? t('biz.backupSheetConnecting') : t('biz.backupSheetConnectButton')}
            </button>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      )}
    </section>
  );
}

export default function BusinessSettingsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useBusinessMe();
  const updateMe = useUpdateBusinessMe();
  const uploadCover = useUploadBusinessCoverPhoto();
  const deleteCover = useDeleteBusinessCoverPhoto();
  const uploadGallery = useUploadBusinessGalleryPhotos();
  const deleteGalleryPhoto = useDeleteBusinessGalleryPhoto();
  const coverRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const business = data?.business;

  const [form, setForm] = useState({
    description: '',
    address: '',
    district: '',
    phone: '',
    googleMapsUrl: '',
    instagram: '',
    facebook: '',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!business) return;
    setForm({
      description: business.description ?? '',
      address: business.address ?? '',
      district: business.district ?? '',
      phone: business.phone ?? '',
      googleMapsUrl: business.googleMapsUrl ?? '',
      instagram: business.socials?.instagram ?? '',
      facebook: business.socials?.facebook ?? '',
    });
  }, [business]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    updateMe.mutate(
      {
        description: form.description,
        address: form.address,
        district: form.district,
        phone: form.phone,
        googleMapsUrl: form.googleMapsUrl,
        socials: { instagram: form.instagram, facebook: form.facebook },
      },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        },
      }
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="font-display text-2xl font-bold text-text">{t('biz.settings')}</h1>

      {business && <BackupSheetSection business={business} />}

      {business && <WorkingHoursEditor business={business} />}

      {business && <BufferTimeEditor business={business} />}

      {business && <CancellationPolicyEditor business={business} />}

      {business && <BookingWindowEditor business={business} />}

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.settingsCoverPhoto')}</h2>
        <div className="flex items-center gap-4">
          <div className="h-20 w-32 shrink-0 overflow-hidden rounded-xl border border-border bg-bg">
            {business?.coverPhotoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={business.coverPhotoUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <button
            type="button"
            onClick={() => coverRef.current?.click()}
            disabled={uploadCover.isPending}
            className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-text-muted transition hover:border-primary hover:text-primary"
          >
            {t('biz.settingsUploadCover')}
          </button>
          {business?.coverPhotoUrl && (
            <button
              type="button"
              onClick={() => deleteCover.mutate()}
              disabled={deleteCover.isPending}
              className="rounded-xl border border-danger/40 px-4 py-2 text-xs font-semibold text-danger"
            >
              {t('biz.settingsRemoveCover')}
            </button>
          )}
          <input
            ref={coverRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadCover.mutate(file);
              e.target.value = '';
            }}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.settingsGallery')}</h2>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            disabled={uploadGallery.isPending}
            className="text-xs font-semibold text-primary"
          >
            {t('biz.settingsAddPhotos')}
          </button>
          <input
            ref={galleryRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) uploadGallery.mutate(files);
              e.target.value = '';
            }}
          />
        </div>
        {business?.galleryUrls && business.galleryUrls.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {business.galleryUrls.map((url) => (
              <div key={url} className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-bg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => deleteGalleryPhoto.mutate(url)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">{t('biz.noGalleryPhotos')}</p>
        )}
      </section>

      <form onSubmit={handleSave} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('business.about')}</h2>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder={t('biz.settingsDescription') as string}
          rows={3}
          className="resize-none rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
        />
        <input
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          placeholder={t('biz.settingsAddress') as string}
          className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
        />
        <input
          value={form.district}
          onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
          placeholder={t('biz.settingsDistrict') as string}
          className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
        />
        <input
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          placeholder={t('biz.settingsPhone') as string}
          className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
        />
        <input
          value={form.googleMapsUrl}
          onChange={(e) => setForm((f) => ({ ...f, googleMapsUrl: e.target.value }))}
          placeholder={t('biz.settingsGoogleMaps') as string}
          className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
        />
        <input
          value={form.instagram}
          onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))}
          placeholder={t('biz.settingsInstagram') as string}
          className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
        />
        <input
          value={form.facebook}
          onChange={(e) => setForm((f) => ({ ...f, facebook: e.target.value }))}
          placeholder={t('biz.settingsFacebook') as string}
          className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={updateMe.isPending}
            className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {t('biz.save')}
          </button>
          {saved && <span className="text-sm text-success">{t('biz.settingsSaved')}</span>}
        </div>
      </form>
    </div>
  );
}
