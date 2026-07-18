'use client';

export function CategoryTile({
  name,
  active,
  onClick,
}: {
  id: string;
  name: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center rounded-2xl border px-4 py-2.5 text-center text-sm font-semibold transition ${
        active
          ? 'border-primary bg-primary-glow text-text'
          : 'border-border bg-surface text-text-muted transition hover:-translate-y-0.5 hover:border-primary hover:bg-primary-glow hover:text-text hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)]'
      }`}
    >
      {name}
    </button>
  );
}
