'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/Skeleton';
import { RequireAdminRole } from '@/components/admin/RequireAdminRole';
import { useAdminTeam, useInviteTeamMember, useRemoveTeamMember, useMe, ApiError } from '@/lib/hooks';

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  MODERATOR: 'Moderator',
  FINANCE_ADMIN: 'Finance',
};

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
              <div key={member._id} className="flex items-center justify-between border-b border-border py-4">
                <div>
                  <div className="text-sm font-semibold text-text">{member.name}</div>
                  <div className="text-xs text-text-muted">{member.email}</div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-bold text-text-muted">{ROLE_LABEL[member.role] ?? member.role}</span>
                  {member.role !== 'SUPER_ADMIN' && member._id !== meData?.user?.id && (
                    <button
                      onClick={() => remove.mutate(member._id)}
                      className="text-xs font-semibold text-danger"
                    >
                      {t('admin.removeMember')}
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    </RequireAdminRole>
  );
}
