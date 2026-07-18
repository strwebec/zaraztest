// Soft neutral placeholder for businesses without a cover photo — a single
// consistent pattern site-wide (the design system uses one accent, not a
// rainbow of per-category hues).
export function coverGradient(_category?: string) {
  return 'repeating-linear-gradient(45deg, var(--color-surface-2), var(--color-surface-2) 10px, var(--color-primary-glow) 10px, var(--color-primary-glow) 20px)';
}
