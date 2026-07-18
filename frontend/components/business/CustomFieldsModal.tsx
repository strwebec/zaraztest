'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus, Trash2, ListChecks } from 'lucide-react';
import { useCustomFields, useCreateCustomField, useDeleteCustomField } from '@/lib/hooks';
import type { CustomFieldType } from '@/lib/utils/api';

const TYPE_KEY: Record<CustomFieldType, string> = {
  text: 'biz.fieldTypeText',
  number: 'biz.fieldTypeNumber',
  date: 'biz.fieldTypeDate',
  select: 'biz.fieldTypeSelect',
  textarea: 'biz.fieldTypeTextarea',
};

export function CustomFieldsModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { data, isLoading } = useCustomFields();
  const createField = useCreateCustomField();
  const deleteField = useDeleteCustomField();

  const [label, setLabel] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [optionsText, setOptionsText] = useState('');

  const fields = data?.fields ?? [];

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    createField.mutate(
      {
        label: label.trim(),
        type,
        options: type === 'select' ? optionsText.split(',').map((o) => o.trim()).filter(Boolean) : undefined,
      },
      {
        onSuccess: () => {
          setLabel('');
          setOptionsText('');
          setType('text');
        },
      }
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full flex-col gap-4 overflow-y-auto rounded-t-3xl bg-surface p-6 shadow-lg sm:max-w-lg sm:rounded-3xl"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-glow text-primary">
              <ListChecks size={16} />
            </span>
            <h2 className="font-display text-lg font-bold text-text">{t('biz.customFieldsTitle')}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-text-muted transition hover:bg-surface2 hover:text-text">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs leading-relaxed text-text-muted">{t('biz.customFieldsHint')}</p>

        {!isLoading && fields.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-text-muted">
            {t('biz.noFieldsYet')}
          </p>
        )}

        {fields.length > 0 && (
          <ul className="flex flex-col gap-2">
            {fields.map((f) => (
              <li
                key={f._id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg px-3.5 py-2.5"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-text">{f.label}</span>
                  <span className="text-xs text-text-muted">
                    {t(TYPE_KEY[f.type])}
                    {f.type === 'select' && f.options.length > 0 ? ` · ${f.options.join(', ')}` : ''}
                  </span>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm(t('biz.deleteFieldConfirm', { label: f.label }) as string)) {
                      deleteField.mutate(f._id);
                    }
                  }}
                  className="rounded-lg p-1.5 text-text-muted transition hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleAdd} className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.fieldLabel')}</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              className="rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-text outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.fieldType')}</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CustomFieldType)}
              className="rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-text outline-none focus:border-primary"
            >
              {(Object.keys(TYPE_KEY) as CustomFieldType[]).map((key) => (
                <option key={key} value={key}>
                  {t(TYPE_KEY[key])}
                </option>
              ))}
            </select>
          </div>
          {type === 'select' && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{t('biz.fieldOptions')}</span>
              <input
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                placeholder={t('biz.fieldOptionsPlaceholder') as string}
                className="rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-text outline-none focus:border-primary"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={createField.isPending || !label.trim()}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            <Plus size={15} />
            {t('biz.addField')}
          </button>
        </form>
      </div>
    </div>
  );
}
