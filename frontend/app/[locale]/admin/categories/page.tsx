'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/Skeleton';
import { RequireAdminRole } from '@/components/admin/RequireAdminRole';
import { useMe, useAdminCategories, useApproveCategory, useRejectCategory, useCreateCategory, useDeleteCategory, ApiError } from '@/lib/hooks';

type Tab = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'ALL';

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'text-success bg-success/10',
  PENDING: 'text-warning bg-warning/10',
  REJECTED: 'text-danger bg-danger/10',
};

export default function AdminCategoriesPage() {
  const { t } = useTranslation();
  const { data: meData } = useMe();
  const isSuperAdmin = meData?.user?.role === 'SUPER_ADMIN';
  const [tab, setTab] = useState<Tab>('PENDING');
  const { data, isLoading } = useAdminCategories(tab);
  const { data: activeCategoriesData } = useAdminCategories('ACTIVE');
  const approve = useApproveCategory();
  const reject = useRejectCategory();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteErrorById, setDeleteErrorById] = useState<Record<string, string>>({});
  const [mergeTargetById, setMergeTargetById] = useState<Record<string, string>>({});

  function handleDelete(id: string, name: string, reassignTo?: string) {
    if (!reassignTo && !window.confirm(t('admin.deleteCategoryConfirm', { name }) as string)) return;
    setDeleteErrorById((prev) => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
    deleteCategory.mutate(
      { id, reassignTo },
      {
        onError: (err) => {
          const message =
            err instanceof ApiError && err.code === 'CATEGORY_IN_USE'
              ? (t('admin.categoryInUse', {
                  businesses: (err.data?.businessCount as number) ?? 0,
                  services: (err.data?.serviceCount as number) ?? 0,
                }) as string)
              : (t('auth.genericError') as string);
          setDeleteErrorById((prev) => ({ ...prev, [id]: message }));
        },
      }
    );
  }

  const categories = data?.categories ?? [];

  const tabs: { key: Tab; label: string }[] = [
    { key: 'PENDING', label: t('admin.categoryTabPending') },
    { key: 'ACTIVE', label: t('admin.categoryTabActive') },
    { key: 'REJECTED', label: t('admin.categoryTabRejected') },
    { key: 'ALL', label: t('admin.categoryTabAll') },
  ];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    try {
      await createCategory.mutateAsync({ name: name.trim(), nameEn: nameEn.trim() });
      setName('');
      setNameEn('');
      setShowForm(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CATEGORY_ALREADY_EXISTS') {
        setCreateError(t('biz.categoryAlreadyExists') as string);
      } else {
        setCreateError(t('auth.genericError') as string);
      }
    }
  }

  return (
    <RequireAdminRole roles={['SUPER_ADMIN', 'MODERATOR']} permission="categories">
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-text">{t('admin.categories')}</h1>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition hover:-translate-y-0.5"
          >
            {t('admin.addCategory')}
          </button>
        </div>
        <p className="text-xs text-text-muted">{t('admin.categoriesHint')}</p>

        {showForm && (
          <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:max-w-md">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('admin.categoryNameUk') as string}
              className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
            />
            <input
              required
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder={t('admin.categoryNameEn') as string}
              className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
            />
            {createError && <p className="text-xs text-danger">{createError}</p>}
            <button
              type="submit"
              disabled={createCategory.isPending}
              className="self-start rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {t('admin.addCategory')}
            </button>
          </form>
        )}

        <div className="flex gap-1.5 rounded-xl border border-border bg-surface p-1 sm:w-fit">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none ${
                tab === tb.key ? 'bg-primary text-white' : 'text-text-muted'
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {isLoading && Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16" />)}

          {!isLoading && categories.length === 0 && (
            <p className="py-10 text-center text-sm text-text-muted">{t('admin.noCategoriesInTab')}</p>
          )}

          {!isLoading &&
            categories.map((cat) => (
              <div key={cat._id} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-text">{cat.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[cat.status] ?? 'bg-surface2 text-text-muted'}`}>
                        {t(`admin.categoryStatus.${cat.status}`)}
                      </span>
                    </div>
                    <div className="text-xs text-text-muted">
                      {cat.nameEn}
                      {cat.requestedByBusiness && ` · ${t('admin.requestedBy')}: ${cat.requestedByBusiness.name}`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {cat.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => approve.mutate(cat._id)}
                          className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white"
                        >
                          {t('admin.approve')}
                        </button>
                        <button
                          onClick={() => reject.mutate(cat._id)}
                          className="rounded-lg border border-danger/40 px-4 py-1.5 text-xs font-semibold text-danger"
                        >
                          {t('admin.reject')}
                        </button>
                      </>
                    )}
                    {isSuperAdmin && (
                      <button
                        onClick={() => handleDelete(cat._id, cat.name)}
                        disabled={deleteCategory.isPending}
                        className="rounded-lg border border-danger/40 px-4 py-1.5 text-xs font-semibold text-danger disabled:opacity-60"
                      >
                        {t('admin.deleteCategory')}
                      </button>
                    )}
                  </div>
                </div>
                {deleteErrorById[cat._id] && (
                  <div className="flex flex-col gap-2 rounded-xl bg-danger/5 p-3">
                    <p className="text-xs text-danger">{deleteErrorById[cat._id]}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={mergeTargetById[cat._id] ?? ''}
                        onChange={(e) => setMergeTargetById((prev) => ({ ...prev, [cat._id]: e.target.value }))}
                        className="rounded-lg border border-border bg-bg px-3 py-1.5 text-xs text-text outline-none focus:border-primary"
                      >
                        <option value="">{t('admin.mergeTargetPlaceholder')}</option>
                        {(activeCategoriesData?.categories ?? [])
                          .filter((c) => c._id !== cat._id)
                          .map((c) => (
                            <option key={c._id} value={c.slug}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                      <button
                        onClick={() => mergeTargetById[cat._id] && handleDelete(cat._id, cat.name, mergeTargetById[cat._id])}
                        disabled={!mergeTargetById[cat._id] || deleteCategory.isPending}
                        className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {t('admin.mergeAndDelete')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </RequireAdminRole>
  );
}
