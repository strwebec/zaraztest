'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { LifeBuoy, X } from 'lucide-react';
import {
  useMe,
  useUpdateProfile,
  useUploadClientAvatar,
  useDeleteClientAvatar,
  useChangeClientPassword,
  useClientStats,
  ApiError,
} from '@/lib/hooks';
import { InfoModal } from '@/components/shared/InfoModal';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/i18n/locales';

const PASSWORD_ERROR_KEY: Record<string, string> = {
  INVALID_CREDENTIALS: 'auth.invalidCredentials',
  INVALID_INPUT: 'auth.weakPassword',
};

export default function ClientProfilePage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { locale } = useParams<{ locale: Locale }>();
  const { data } = useMe();
  const { data: stats } = useClientStats();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadClientAvatar();
  const deleteAvatar = useDeleteClientAvatar();
  const changePassword = useChangeClientPassword();
  const avatarRef = useRef<HTMLInputElement>(null);

  const user = data?.user;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saved, setSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [showRatingInfo, setShowRatingInfo] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setPhone(user.phone ?? '');
    }
  }, [user]);

  if (!user) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await updateProfile.mutateAsync({ name, phone });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function switchLanguage(next: Locale) {
    updateProfile.mutate({ language: next });
    i18n.changeLanguage(next);
    router.push(`/${next}/client/profile`);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    changePassword.reset();
    await changePassword.mutateAsync({ currentPassword, newPassword });
    setCurrentPassword('');
    setNewPassword('');
    setPasswordSaved(true);
    setTimeout(() => setPasswordSaved(false), 2000);
  }

  const passwordErrorMessage =
    changePassword.error instanceof ApiError && PASSWORD_ERROR_KEY[changePassword.error.code ?? '']
      ? t(PASSWORD_ERROR_KEY[changePassword.error.code ?? ''])
      : changePassword.error
        ? t('auth.genericError')
        : null;

  return (
    <div className="flex max-w-md flex-col gap-6">
      <h1 className="font-display text-2xl font-bold text-text">{t('client.profile')}</h1>

      <div className="flex items-center gap-4">
        <div className="relative h-14 w-14 shrink-0">
          <button
            type="button"
            onClick={() => avatarRef.current?.click()}
            disabled={uploadAvatar.isPending}
            className="h-14 w-14 overflow-hidden rounded-full bg-primary-glow font-display text-xl font-bold text-primary"
            title={t('client.changeAvatar') as string}
          >
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center">{user.name[0]}</span>
            )}
          </button>
          {user.avatarUrl && (
            <button
              type="button"
              onClick={() => deleteAvatar.mutate()}
              disabled={deleteAvatar.isPending}
              title={t('client.removeAvatar') as string}
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface text-text-muted transition hover:text-danger"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <input
          ref={avatarRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadAvatar.mutate(file);
            e.target.value = '';
          }}
        />
        <div>
          <div className="text-base font-bold text-text">{user.name}</div>
          <div className="text-sm text-text-muted">{user.email}</div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setShowRatingInfo(true)}
          className="flex flex-1 flex-col gap-1 rounded-2xl border border-border bg-surface p-4 text-left shadow-xs transition hover:border-primary"
        >
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-text">{(user.rating ?? 5).toFixed(1)}</span>
            <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('client.myRating')}</span>
          </div>
          <span className="text-xs text-text-muted">{t('client.ratingHint')}</span>
          <span className="text-[11px] font-semibold text-primary">{t('client.ratingHowCalculated')}</span>
        </button>
        <div className="flex flex-1 flex-col gap-1 rounded-2xl border border-border bg-surface p-4 shadow-xs">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-text">{stats?.completedBookings ?? 0}</span>
            <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('client.statsBookings')}</span>
          </div>
          <span className="text-xs text-text-muted">{t('client.statsSpent', { amount: stats?.totalSpent ?? 0 })}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('client.language')}</span>
        <div className="flex w-fit gap-1 rounded-xl border border-border bg-surface p-1">
          {SUPPORTED_LOCALES.map((l) => (
            <button
              key={l}
              onClick={() => switchLanguage(l)}
              className={`rounded-lg px-6 py-2 text-xs font-semibold transition ${
                locale === l ? 'bg-primary text-white' : 'text-text-muted'
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('auth.name') as string}
          className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text outline-none focus:border-primary"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t('auth.phone') as string}
          className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={updateProfile.isPending}
          className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
        >
          {saved ? t('client.profileSaved') : t('client.saveProfile')}
        </button>
      </form>

      <form onSubmit={handleChangePassword} className="flex flex-col gap-3 border-t border-border pt-6">
        <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('client.changePassword')}</span>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder={t('client.currentPassword') as string}
          autoComplete="current-password"
          className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text outline-none focus:border-primary"
        />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder={t('client.newPassword') as string}
          autoComplete="new-password"
          className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text outline-none focus:border-primary"
        />
        {passwordErrorMessage && <p className="text-sm text-danger">{passwordErrorMessage}</p>}
        <button
          type="submit"
          disabled={changePassword.isPending || !currentPassword || newPassword.length < 8}
          className="self-start rounded-xl border border-border px-6 py-3 text-sm font-bold text-text transition hover:bg-surface disabled:opacity-60"
        >
          {passwordSaved ? t('client.passwordChanged') : t('client.savePassword')}
        </button>
      </form>

      <Link
        href={`/${locale}/client/support`}
        className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-text transition hover:border-primary hover:text-primary"
      >
        <LifeBuoy size={18} />
        {t('client.supportLink')}
      </Link>

      {showRatingInfo && (
        <InfoModal title={t('client.ratingInfoTitle') as string} onClose={() => setShowRatingInfo(false)}>
          <p>{t('client.ratingInfoStart')}</p>
          <p>{t('client.ratingInfoPenalty')}</p>
          <p>{t('client.ratingInfoBlock')}</p>
          <p>{t('client.ratingInfoReset')}</p>
        </InfoModal>
      )}
    </div>
  );
}
