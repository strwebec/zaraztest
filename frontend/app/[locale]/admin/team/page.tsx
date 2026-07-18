'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/Skeleton';
import { RequireAdminRole } from '@/components/admin/RequireAdminRole';
import {
  useAdminTeam,
  useInviteTeamMember,
  useRemoveTeamMember,
  useUpdateAdminOwnCredentials,
  useUpdateAdminTeamMemberCredentials,
  useMe,
  ApiError,
} from '@/lib/hooks';

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  MODERATOR: 'Moderator',
  FINANCE_ADMIN: 'Finance',
};

function OwnCredentialsForm() {
  const { t } = useTranslation();
  const updateOwn = useUpdateAdminOwnCredentials();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    try {
      await updateOwn.mutateAsync({
        currentPassword,
        newEmail: newEmail.trim() || undefined,
        newPassword: newPassword.trim() || undefined,
      });
      setCurrentPassword('');
      setNewEmail('');
      setNewPassword('');
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_CREDENTIALS') setError(t('auth.invalidCredentials'));
      else if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') setError(t('auth.emailTaken'));
      else if (err instanceof ApiError && err.code === 'WEAK_PASSWORD') setError(t('auth.weakPassword'));
      else setError(t('auth.genericError'));
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:max-w-md"
    >
      <h2 className="text-sm font-bold text-text">{t('admin.myCredentials')}</h2>
      <input
        required
        type="password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        placeholder={t('client.currentPassword') as string}
        className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
      />
      <input
        type="email"
        value={newEmail}
        onChange={(e) => setNewEmail(e.target.value)}
        placeholder={t('admin.newEmailOptional') as string}
        className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
      />
      <input
        type="password"
        minLength={8}
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder={t('admin.newPasswordOptional') as string}
        className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      {success && <p className="text-sm text-success">{t('admin.credentialsUpdated')}</p>}
      <button
        type="submit"
        disabled={updateOwn.isPending || !currentPassword}
        className="self-start rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
      >
        {t('admin.saveCredentials')}
      </button>
    </form>
  );
}

function MemberCredentialsForm({ memberId, onDone }: { memberId: string; onDone: () => void }) {
  const { t } = useTranslation();
  const updateMember = useUpdateAdminTeamMemberCredentials();
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await updateMember.mutateAsync({
        id: memberId,
        payload: { newEmail: newEmail.trim() || undefined, newPassword: newPassword.trim() || undefined },
      });
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') setError(t('auth.emailTaken'));
      else if (err instanceof ApiError && err.code === 'WEAK_PASSWORD') setError(t('auth.weakPassword'));
      else setError(t('auth.genericError'));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-2 rounded-xl border border-border bg-bg p-3">
      <input
        type="email"
        value={newEmail}
        onChange={(e) => setNewEmail(e.target.value)}
        placeholder={t('admin.newEmailOptional') as string}
        className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text outline-none focus:border-primary"
      />
      <input
        type="password"
        minLength={8}
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder={t('admin.newPasswordOptional') as string}
        className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text outline-none focus:border-primary"
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      <button
        type="submit"
        disabled={updateMember.isPending}
        className="self-start rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60"
      >
        {t('admin.resetCredentials')}
      </button>
    </form>
  );
}

export default function AdminTeamPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useAdminTeam();
  const { data: meData } = useMe();
  const invite = useInviteTeamMember();
  const remove = useRemoveTeamMember();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'MODERATOR' | 'FINANCE_ADMIN'>('MODERATOR');
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const team = data?.team ?? [];

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await invite.mutateAsync({ name, email, password, role });
      setName('');
      setEmail('');
      setPassword('');
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'EMAIL_TAKEN' ? t('auth.emailTaken') : t('auth.genericError'));
    }
  }

  return (
    <RequireAdminRole roles={['SUPER_ADMIN']}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-text">{t('admin.team')}</h1>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition hover:-translate-y-0.5"
          >
            {t('admin.inviteMember')}
          </button>
        </div>

        <OwnCredentialsForm />

        {showForm && (
          <form
            onSubmit={handleInvite}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:max-w-md"
          >
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('auth.name') as string}
              className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
            />
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.email') as string}
              className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
            />
            <input
              required
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.password') as string}
              className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'MODERATOR' | 'FINANCE_ADMIN')}
              className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
            >
              <option value="MODERATOR">{t('admin.roleModerator')}</option>
              <option value="FINANCE_ADMIN">{t('admin.roleFinance')}</option>
            </select>
            <p className="text-xs text-text-muted">
              {role === 'MODERATOR' ? t('admin.roleModeratorHint') : t('admin.roleFinanceHint')}
            </p>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={invite.isPending}
              className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {t('admin.inviteMember')}
            </button>
          </form>
        )}

        <div className="flex flex-col">
          {isLoading && Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="mb-2 h-16" />)}

          {!isLoading &&
            team.map((member) => (
              <div key={member._id} className="border-b border-border py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-text">{member.name}</div>
                    <div className="text-xs text-text-muted">{member.email}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-text-muted">{ROLE_LABEL[member.role] ?? member.role}</span>
                    {member.role !== 'SUPER_ADMIN' && member._id !== meData?.user?.id && (
                      <>
                        <button
                          onClick={() => setEditingId(editingId === member._id ? null : member._id)}
                          className="text-xs font-semibold text-primary"
                        >
                          {t('admin.editCredentials')}
                        </button>
                        <button onClick={() => remove.mutate(member._id)} className="text-xs font-semibold text-danger">
                          {t('admin.removeMember')}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {editingId === member._id && (
                  <MemberCredentialsForm memberId={member._id} onDone={() => setEditingId(null)} />
                )}
              </div>
            ))}
        </div>
      </div>
    </RequireAdminRole>
  );
}
