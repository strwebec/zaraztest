import type { Staff } from '@/lib/utils/api';

export function MasterCard({ master }: { master: Staff }) {
  return (
    <div className="flex w-24 flex-none flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-3 text-center shadow-xs sm:w-28">
      {master.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={master.photoUrl}
          alt={master.name}
          className="h-12 w-12 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-glow font-display text-lg font-bold text-primary">
          {master.name[0]}
        </div>
      )}
      <span className="text-xs font-semibold text-text sm:text-[13.5px]">{master.name}</span>
      {master.role && <span className="text-[10px] text-text-muted sm:text-[11px]">{master.role}</span>}
    </div>
  );
}
