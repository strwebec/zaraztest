type LogoZarazProps = {
  variant?: 'full' | 'compact' | 'icon';
  className?: string;
};

export function LogoZaraz({ variant = 'full', className }: LogoZarazProps) {
  if (variant === 'icon') {
    return (
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-xl bg-primary font-display text-base font-bold text-white ${className ?? ''}`}
      >
        z
      </span>
    );
  }

  return (
    <span className={`font-display text-xl font-bold tracking-tight text-text lg:text-[28px] ${className ?? ''}`}>
      zaraz
      {variant === 'full' && (
        <span className="ml-1 align-middle font-body text-[11px] font-medium tracking-normal text-text-muted">
          — запис без дзвінків
        </span>
      )}
    </span>
  );
}
