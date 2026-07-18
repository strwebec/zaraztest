'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { RequireAdminRole } from '@/components/admin/RequireAdminRole';
import { useAdminAuditLog } from '@/lib/hooks';
import type { AdminAuditLogEntry } from '@/lib/utils/api';

// meta shapes vary per action (block reason, invoice amount, assigned role, ...) — rather
// than hardcode formatting per action, render whatever keys are actually present so any
// future action's meta shows up here for free.
function formatMeta(meta: Record<string, unknown> | undefined) {
  if (!meta) return [];
  return Object.entries(meta)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`);
}

function AuditEntryRow({ entry }: { entry: AdminAuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const metaLines = formatMeta(entry.meta);
  const hasDetail = metaLines.length > 0 || entry.ip || entry.userAgent;

  return (
    <div className="border-b border-border py-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {hasDetail && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex-none rounded p-0.5 text-text-muted transition hover:text-primary"
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}
          <span className="font-mono text-xs font-semibold text-primary">{entry.action}</span>
          {entry.targetLabel && <span className="truncate text-text">{entry.targetLabel}</span>}
        </div>
        <div className="flex-none text-xs text-text-muted">
          {entry.admin ? `${entry.admin.name} (${entry.admin.email})` : '—'} ·{' '}
          {new Date(entry.createdAt).toLocaleString()}
        </div>
      </div>
      {expanded && hasDetail && (
        <div className="ml-6 mt-2 flex flex-col gap-1 rounded-xl bg-bg px-3 py-2 text-xs text-text-muted">
          {metaLines.map((line) => (
            <span key={line}>{line}</span>
          ))}
          {entry.ip && <span>IP: {entry.ip}</span>}
          {entry.userAgent && <span className="truncate">User-Agent: {entry.userAgent}</span>}
        </div>
      )}
    </div>
  );
}

export default function AdminAuditLogPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useAdminAuditLog();

  const entries = data?.entries ?? [];

  return (
    <RequireAdminRole roles={['SUPER_ADMIN']}>
      <div className="flex flex-col gap-5">
        <h1 className="font-display text-2xl font-bold text-text">{t('admin.auditLog')}</h1>
        <p className="text-xs text-text-muted">{t('admin.auditLogHint')}</p>

        <div className="flex flex-col">
          {isLoading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="mb-2 h-12" />)}

          {!isLoading && entries.length === 0 && (
            <p className="py-10 text-center text-sm text-text-muted">{t('admin.noAuditEntries')}</p>
          )}

          {!isLoading && entries.map((e) => <AuditEntryRow key={e._id} entry={e} />)}
        </div>
      </div>
    </RequireAdminRole>
  );
}
