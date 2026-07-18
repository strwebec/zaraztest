'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useBusinessServices,
  useCreateBusinessService,
  useUpdateBusinessService,
  useDeleteBusinessService,
  useBusinessStaff,
  useCategories,
  useBusinessMe,
} from '@/lib/hooks';
import { ApiError, maxWorkingDayMinutes, type Service, type Staff } from '@/lib/utils/api';

function StaffPicker({
  staffList,
  selected,
  onToggle,
}: {
  staffList: Staff[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const { t } = useTranslation();

  if (staffList.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-text-muted">{t('biz.assignedStaffLabel')}</span>
      <p className="text-[11px] text-text-muted">{t('biz.assignedStaffHint')}</p>
      <div className="flex flex-wrap gap-2">
        {staffList.map((s) => {
          const active = selected.includes(s._id);
          return (
            <button
              key={s._id}
              type="button"
              onClick={() => onToggle(s._id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                active ? 'border-primary bg-primary-glow text-text' : 'border-border text-text-muted hover:border-primary'
              }`}
            >
              {s.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ServiceEditForm({
  service,
  staffList,
  maxDuration,
  onDone,
}: {
  service: Service;
  staffList: Staff[];
  maxDuration: number;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const updateService = useUpdateBusinessService();
  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description ?? '');
  const [price, setPrice] = useState(String(service.price));
  const [isFree, setIsFree] = useState(!!service.isFree);
  const [durationMinutes, setDurationMinutes] = useState(String(service.durationMinutes));
  const [staffIds, setStaffIds] = useState<string[]>(service.staff ?? []);
  const [error, setError] = useState('');

  function toggleStaff(id: string) {
    setStaffIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-bg p-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('biz.serviceName') as string}
        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t('biz.serviceDescription') as string}
        rows={2}
        className="resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
      />
      <label className="flex items-center gap-2 text-xs font-semibold text-text-muted">
        <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
        {t('biz.freeService')}
      </label>
      <div className="flex gap-2">
        {!isFree && (
          <input
            type="number"
            min={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={t('biz.price') as string}
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
          />
        )}
        <input
          type="number"
          min={1}
          max={maxDuration || undefined}
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(e.target.value)}
          placeholder={t('biz.duration') as string}
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
        />
      </div>
      {maxDuration > 0 && <p className="text-[11px] text-text-muted">{t('biz.maxDurationHint', { minutes: maxDuration })}</p>}
      {error && <p className="text-[11px] text-danger">{error}</p>}
      <StaffPicker staffList={staffList} selected={staffIds} onToggle={toggleStaff} />
      <button
        onClick={async () => {
          setError('');
          try {
            await updateService.mutateAsync({
              id: service._id,
              payload: {
                name,
                description,
                price: isFree ? 0 : Number(price),
                isFree,
                durationMinutes: Number(durationMinutes),
                staff: staffIds,
              },
            });
            onDone();
          } catch (err) {
            if (err instanceof ApiError && err.code === 'SERVICE_TOO_LONG') {
              setError(t('biz.serviceTooLong', { minutes: err.data?.maxDurationMinutes }) as string);
            } else {
              setError(t('auth.genericError') as string);
            }
          }
        }}
        disabled={updateService.isPending}
        className="self-start rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-white transition hover:bg-primary-hover disabled:opacity-60"
      >
        {t('biz.save')}
      </button>
    </div>
  );
}

export default function BusinessServicesPage() {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useBusinessServices();
  const { data: staffData } = useBusinessStaff();
  const { data: categoriesData } = useCategories();
  const { data: businessMeData } = useBusinessMe();
  const createService = useCreateBusinessService();
  const deleteService = useDeleteBusinessService();

  const categories = categoriesData?.categories ?? [];
  const staffList = staffData?.staff ?? [];
  const maxDuration = maxWorkingDayMinutes(businessMeData?.business?.workingHours);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [price, setPrice] = useState('');
  const [isFree, setIsFree] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState('');
  const [staffIds, setStaffIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createError, setCreateError] = useState('');

  const services = data?.services ?? [];

  useEffect(() => {
    if (!category && categories.length) setCategory(categories[0].id);
  }, [categories, category]);

  function toggleNewStaff(id: string) {
    setStaffIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function staffNames(ids: string[]) {
    return ids.map((id) => staffList.find((s) => s._id === id)?.name).filter(Boolean).join(', ');
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError('');
    try {
      await createService.mutateAsync({
        name,
        description: description || undefined,
        category,
        customCategoryName: category === 'other' ? customCategoryName : undefined,
        price: isFree ? 0 : Number(price),
        isFree,
        durationMinutes: Number(durationMinutes),
        staff: staffIds.length ? staffIds : undefined,
      });
      setName('');
      setDescription('');
      setCustomCategoryName('');
      setPrice('');
      setIsFree(false);
      setDurationMinutes('');
      setStaffIds([]);
      setShowForm(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SERVICE_TOO_LONG') {
        setCreateError(t('biz.serviceTooLong', { minutes: err.data?.maxDurationMinutes }) as string);
      } else {
        setCreateError(t('auth.genericError') as string);
      }
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight text-text">{t('biz.services')}</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-primary-hover"
        >
          {t('biz.addService')}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:max-w-md">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('biz.serviceName') as string}
            className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('biz.serviceDescription') as string}
            rows={2}
            className="resize-none rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {i18n.language === 'en' ? c.nameEn : c.name}
              </option>
            ))}
            <option value="other">{t('auth.otherCategory')}</option>
          </select>
          {category === 'other' && (
            <input
              required
              value={customCategoryName}
              onChange={(e) => setCustomCategoryName(e.target.value)}
              placeholder={t('auth.otherCategoryPlaceholder') as string}
              className="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
            />
          )}
          <label className="flex items-center gap-2 text-sm font-semibold text-text-muted">
            <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
            {t('biz.freeService')}
          </label>
          <div className="flex gap-3">
            {!isFree && (
              <input
                required
                type="number"
                min={1}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={t('biz.price') as string}
                className="flex-1 rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
              />
            )}
            <input
              required
              type="number"
              min={1}
              max={maxDuration || undefined}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              placeholder={t('biz.duration') as string}
              className="flex-1 rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary"
            />
          </div>
          {maxDuration > 0 && <p className="text-[11px] text-text-muted">{t('biz.maxDurationHint', { minutes: maxDuration })}</p>}
          {createError && <p className="text-xs text-danger">{createError}</p>}
          <StaffPicker staffList={staffList} selected={staffIds} onToggle={toggleNewStaff} />
          <button
            type="submit"
            disabled={createService.isPending}
            className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:bg-primary-hover disabled:opacity-60"
          >
            {t('biz.create')}
          </button>
        </form>
      )}

      <div className="flex flex-col">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="mb-2 h-16" />)}

        {!isLoading && services.length === 0 && <p className="py-10 text-center text-sm text-text-muted">{t('biz.noServices')}</p>}

        {!isLoading &&
          services.map((svc) => (
            <div key={svc._id} className="border-b border-border py-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-text">{svc.name}</div>
                  <div className="mt-0.5 text-xs text-text-muted">{svc.durationMinutes} хв</div>
                  {svc.description && <p className="mt-1 max-w-md text-xs text-text-muted">{svc.description}</p>}
                  {svc.staff && svc.staff.length > 0 && (
                    <p className="mt-1 text-xs text-primary">{t('biz.assignedStaffList', { names: staffNames(svc.staff) })}</p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-sm font-semibold ${svc.isFree ? 'text-success' : 'font-mono text-text'}`}>
                    {svc.isFree ? t('biz.free') : `${svc.price}₴`}
                  </span>
                  <button
                    onClick={() => setEditingId(editingId === svc._id ? null : svc._id)}
                    className="text-xs font-semibold text-primary"
                  >
                    {t('biz.edit')}
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(t('biz.deleteServiceConfirm', { name: svc.name }) as string)) {
                        deleteService.mutate(svc._id);
                      }
                    }}
                    className="text-xs font-semibold text-danger"
                  >
                    {t('biz.delete')}
                  </button>
                </div>
              </div>
              {editingId === svc._id && (
                <div className="mt-3">
                  <ServiceEditForm
                    service={svc}
                    staffList={staffList}
                    maxDuration={maxDuration}
                    onDone={() => setEditingId(null)}
                  />
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
