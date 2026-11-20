export const eventLimitBlocks = (
  creditLimit: number | null | undefined,
  creditsUsed: number | undefined,
  creditCost: number
): boolean => {
  if (creditLimit === null || creditLimit === undefined) return false;
  const used = creditsUsed ?? 0;
  return used + creditCost > creditLimit;
};
