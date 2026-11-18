/**
 * Documented event statistics are counted from generated_images rows.
 * A per-event baseline hides generations from before an admin reset without
 * deleting those rows, so galleries, slideshows, and billing stay intact.
 */

export interface DocumentedImageRow {
  createdAt: string;
  promptId: string;
  promptName: string;
}

export interface DocumentedPromptStat {
  promptId: string;
  promptName: string;
  count: number;
  percentage: number;
}

export interface DocumentedEventAnalytics {
  totalPhotos: number;
  promptStats: DocumentedPromptStat[];
  analyticsResetAt: string | null;
}

export interface DocumentedChartPoint {
  date: string;
  generations: number;
}

export function isCountedInDocumentedStats(
  createdAt: string,
  analyticsResetAt: string | null | undefined
): boolean {
  if (!analyticsResetAt) return true;
  const created = Date.parse(createdAt);
  const baseline = Date.parse(analyticsResetAt);
  if (Number.isNaN(created) || Number.isNaN(baseline)) return false;
  return created > baseline;
}

export function aggregateDocumentedEventAnalytics(
  images: DocumentedImageRow[],
  analyticsResetAt: string | null | undefined
): DocumentedEventAnalytics {
  const baseline = analyticsResetAt || null;
  const counted = images.filter((image) => isCountedInDocumentedStats(image.createdAt, baseline));
  const totalPhotos = counted.length;
  const promptCounts = new Map<string, { promptId: string; promptName: string; count: number }>();

  counted.forEach((image) => {
    const promptId = image.promptId || 'unknown';
    const promptName = image.promptName || 'Unknown';
    const existing = promptCounts.get(promptId);
    if (existing) {
      existing.count += 1;
    } else {
      promptCounts.set(promptId, { promptId, promptName, count: 1 });
    }
  });

  const promptStats = Array.from(promptCounts.values())
    .map(({ promptId, promptName, count }) => ({
      promptId,
      promptName,
      count,
      percentage: totalPhotos > 0 ? Math.round((count / totalPhotos) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalPhotos,
    promptStats,
    analyticsResetAt: baseline,
  };
}

export function aggregateDocumentedChartData(
  createdAts: string[],
  analyticsResetAt: string | null | undefined,
  now: Date = new Date()
): DocumentedChartPoint[] {
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - 30);
  const windowStartMs = windowStart.getTime();
  const dateCounts = new Map<string, number>();

  createdAts.forEach((createdAt) => {
    if (!isCountedInDocumentedStats(createdAt, analyticsResetAt)) return;
    const createdMs = Date.parse(createdAt);
    if (Number.isNaN(createdMs) || createdMs < windowStartMs) return;
    const date = new Date(createdMs).toISOString().split('T')[0];
    dateCounts.set(date, (dateCounts.get(date) || 0) + 1);
  });

  return Array.from(dateCounts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, generations]) => ({ date, generations }));
}

export function filterImageIdsForDocumentedStats<T extends { id: string; createdAt: string }>(
  images: T[],
  analyticsResetAt: string | null | undefined
): string[] {
  return images
    .filter((image) => isCountedInDocumentedStats(image.createdAt, analyticsResetAt))
    .map((image) => image.id);
}

/** Typed confirmation must match the event name, ignoring surrounding whitespace. */
export function confirmationMatchesEvent(typed: string, eventName: string): boolean {
  const expected = eventName.trim();
  if (!expected) return false;
  return typed.trim() === expected;
}
