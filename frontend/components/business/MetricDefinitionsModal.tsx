'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus, Trash2, Settings2 } from 'lucide-react';
import { useMetricDefinitions, useCreateMetricDefinition, useDeleteMetricDefinition } from '@/lib/hooks';
import type { MetricGroup, MetricUnit, MetricPersistence } from '@/lib/utils/api';

const GROUP_KEY: Record<MetricGroup, string> = {
  revenue: 'biz.ledgerGroupRevenue',
  expense: 'biz.ledgerGroupExpense',
  info: 'biz.ledgerGroupInfo',
};

const UNIT_KEY: Record<MetricUnit, string> = {
  currency: 'biz.metricUnitCurrency',
  number: 'biz.metricUnitNumber',
  percent: 'biz.metricUnitPercent',
  text: 'biz.metricUnitText',
};

const PERSISTENCE_KEY: Record<MetricPersistence, string> = {
  monthly: 'biz.metricPersistenceMonthly',
  recurring: 'biz.metricPersistenceRecurring',
};

export function MetricDefinitionsModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { data, isLoading } = useMetricDefinitions();
  const createDefinition = useCreateMetricDefinition();
  const deleteDefinition = useDeleteMetricDefinition();

  const [label, setLabel] = useState('');
  const [group, setGroup] = useState<MetricGroup>('expense');
  const [unit, setUnit] = useState<MetricUnit>('currency');
  const [persistence, setPersistence] = useState<MetricPersistence>('monthly');
  const [error, setError] = useState<string | null>(null);

  const definitions = data?.definitions ?? [];

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setError(null);
    createDefinition.mutate(
      { label: label.trim(), group, unit, persistence },
      { onSuccess: () => setLabel(''), onError: () => setError(t('auth.genericError') as string) }
    );
  }

  function handleDelete(id: string, label: string) {
    if (!window.confirm(t('biz.archiveMetricConfirm', { label }) as string)) return;
    setError(null);
    deleteDefinition.mutate(id, { onError: () => setError(t('auth.genericError') as string) });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full flex-col gap-4 overflow-y-auto rounded-t-3xl bg-surface p-6 shadow-lg sm:max-w-lg sm:rounded-3xl"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-glow text-primary">
              <Settings2 size={16} />
            </span>
            <h2 className="font-display text-lg font-bold text-text">{t('biz.metricDefTitle')}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-text-muted transition hover:bg-surface2 hover:text-text">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs leading-relaxed text-text-muted">{t('biz.metricDefHint')}</p>

        {!isLoading && definitions.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-text-muted">
            {t('biz.noMetricsYet')}
          </p>
        )}

        {definitions.length > 0 && (
          <ul className="flex flex-col gap-2">
            {definitions.map((d) => (
              <li
                key={d._id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg px-3.5 py-2.5"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-text">{d.label}</span>
                  <span className="text-xs text-text-muted">
                    {t(GROUP_KEY[d.group])} · {t(UNIT_KEY[d.unit])} · {t(PERSISTENCE_KEY[d.persistence])}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(d._id, d.label)}
                  disabled={deleteDefinition.isPending}
                  className="rounded-lg p-1.5 text-text-muted transition hover:bg-danger/10 hover:text-danger disabled:opacity-60"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleAdd} className="flex flex-col gap-3 border-t border-border pt-4">
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.metricLabel')}</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              className="rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-text outline-none focus:border-primary"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.metricGroup')}</span>
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value as MetricGroup)}
                className="rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-primary"
              >
                {(Object.keys(GROUP_KEY) as MetricGroup[]).map((key) => (
                  <option key={key} value={key}>
                    {t(GROUP_KEY[key])}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.metricUnit')}</span>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as MetricUnit)}
                className="rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-primary"
              >
                {(Object.keys(UNIT_KEY) as MetricUnit[]).map((key) => (
                  <option key={key} value={key}>
                    {t(UNIT_KEY[key])}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.metricPersistence')}</span>
              <select
                value={persistence}
                onChange={(e) => setPersistence(e.target.value as MetricPersistence)}
                className="rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-primary"
              >
                {(Object.keys(PERSISTENCE_KEY) as MetricPersistence[]).map((key) => (
                  <option key={key} value={key}>
                    {t(PERSISTENCE_KEY[key])}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={createDefinition.isPending || !label.trim()}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            <Plus size={15} />
            {t('biz.addMetric')}
          </button>
        </form>
      </div>
    </div>
  );
}
