'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/Skeleton';
import { RequireAdminRole } from '@/components/admin/RequireAdminRole';
import {
  useAdminUsers,
  useBlockAdminUser,
  useUnblockAdminUser,
  useDeleteAdminUser,
  useMe,
} from '@/lib/hooks';
import { ApiError } from '@/lib/utils/api';

type RoleFilter = 'ALL' | 'CLIENT' | 'BUSINESS_OWNER';

export default function AdminUsersPage() {
  const { t } = useTranslation();
  const { data: meData } = useMe();
  const [role, setRole] = useState<RoleFilter>('ALL');
  const [q, setQ] = useState('');
  const { data, isLoading } = useAdminUsers({ role: role === 'ALL' ? undefined : role, q: q || undefined });
  const block = useBlockAdminUser();
  const unblock = useUnblockAdminUser();
  const del = useDeleteAdminUser();

  const isSuperAdmin = meData?.user?.role === 'SUPER_ADMIN';
  const users = data?.users ?? [];

  function isBlocked(u: { blockedUntil?: string | null }) {
    return !!u.blockedUntil && new Date(u.blockedUntil) > new Date();
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(t('admin.deleteUserConfirm', { name }) as string)) return;
    try {
      await del.mutateAsync(id);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DELETE_BUSINESS_FIRST') {
        window.alert(t('admin.deleteUserBusinessFirst') as string);
      } else {
        window.alert(t('auth.genericError') as string);
      }
    }
  }

  return (
    <RequireAdminRole roles={['SUPER_ADMIN', 'MODERATOR']}>
      <div className="flex flex-col gap-5">
        <h1 className="font-display text-2xl font-bold text-text">{t('admin.users')}</h1>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
            {(['ALL', 'CLIENT', 'BUSINESS_OWNER'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  role === r ? 'bg-primary text-white' : 'text-text-muted'
                }`}
              >
                {r === 'ALL' ? t('admin.allUsers') : r === 'CLIENT' ? t('admin.clients') : t('admin.businessOwners')}
              </button>
            ))}
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('admin.searchUsers') as string}
            className="flex-1 rounded-xl border border-border bg-surface px-4 py-2 text-sm text-text outline-none focus:border-primary sm:max-w-xs"
          />
        </div>

        <div className="flex flex-col">
          {isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="mb-2 h-16" />)}

          {!isLoading && users.length === 0 && (
            <p className="py-10 text-center text-sm text-text-muted">{t('admin.noUsers')}</p>
          )}

          {!isLoading &&
            users.map((u) => (
              <div key={u._id} className="flex items-center justify-between border-b border-border py-4">
                <div>
                  <div className="text-sm font-semibold text-text">{u.name}</div>
                  <div className="text-xs text-text-muted">
                    {u.email} {u.phone ? `· ${u.phone}` : ''} · {u.role === 'CLIENT' ? t('admin.clients') : t('admin.businessOwners')}
                  </div>
                  {isBlocked(u) && u.blockReason && (
                    <div className="mt-0.5 text-xs text-danger">{u.blockReason}</div>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {isBlocked(u) ? (
                    <span className="text-xs font-bold text-danger">{t('admin.block')}</span>
                  ) : null}
                  {isBlocked(u) ? (
                    <button onClick={() => unblock.mutate(u._id)} className="text-xs font-semibold text-secondary">
                      {t('admin.unblock')}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const reason = window.prompt(t('admin.blockUserReasonPrompt') as string) ?? undefined;
                        block.mutate({ id: u._id, reason: reason || undefined });
                      }}
                      className="text-xs font-semibold text-danger"
                    >
                      {t('admin.block')}
                    </button>
                  )}
                  {isSuperAdmin && (
                    <button
                      onClick={() => handleDelete(u._id, u.name)}
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
