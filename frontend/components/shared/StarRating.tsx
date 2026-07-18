'use client';

export function StarRating({
  value,
  onChange,
  size = 'md',
}: {
  value: number;
  onChange?: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-sm' : 'text-lg';
  const stars = [1, 2, 3, 4, 5];

  return (
    <div className={`flex gap-0.5 ${sizeClass}`}>
      {stars.map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={`leading-none transition ${n <= value ? 'text-warning' : 'text-border'} ${
            onChange ? 'cursor-pointer hover:scale-110' : 'cursor-default'
          }`}
        >
          {n <= value ? '★' : '☆'}
        </button>
      ))}
    </div>
  );
}
