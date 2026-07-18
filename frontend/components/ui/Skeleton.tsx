export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton animate-shimmer rounded-2xl ${className}`} />;
}
