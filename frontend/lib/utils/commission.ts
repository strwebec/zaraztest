export const FREE_COMMISSION_MONTHS = 6;

/** Days left in a business's 0%-commission introductory period, or null once it's over. */
export function freeCommissionDaysLeft(createdAt?: string): number | null {
  if (!createdAt) return null;
  const freeUntil = new Date(createdAt);
  freeUntil.setMonth(freeUntil.getMonth() + FREE_COMMISSION_MONTHS);
  const msLeft = freeUntil.getTime() - Date.now();
  if (msLeft <= 0) return null;
  return Math.ceil(msLeft / (24 * 60 * 60 * 1000));
}
