export const eventLimitBlocks = (
  creditLimit: number | null | undefined,
  creditsUsed: number | undefined,
  creditCost: number
): boolean => {
  if (creditLimit === null || creditLimit === undefined) return false;
  const used = creditsUsed ?? 0;
  return used + creditCost > creditLimit;
};

// NULL / undefined credit_limit means the event is unlimited (no reservation needed).
export const hasEventCreditLimit = (creditLimit: number | null | undefined): creditLimit is number =>
  creditLimit !== null && creditLimit !== undefined;

// Booth photos cost 1, 2 or 4 credits for 1K / 2K / 4K.
export const creditCostForResolution = (resolution: string | null | undefined): number =>
  resolution === '4K' ? 4 : resolution === '2K' ? 2 : 1;

// Admin form input -> credit_limit value. Empty or invalid = unlimited (null); never negative.
export const parseCreditLimitInput = (value: string): number | null => {
  if (value.trim() === '') return null;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? null : Math.max(0, n);
};
