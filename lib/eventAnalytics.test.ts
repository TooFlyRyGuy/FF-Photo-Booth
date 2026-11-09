import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  aggregateDocumentedChartData,
  aggregateDocumentedEventAnalytics,
  confirmationMatchesEvent,
  filterImageIdsForDocumentedStats,
  isCountedInDocumentedStats,
} from './eventAnalytics.ts';

const baseline = '2026-11-01T12:00:00.000Z';

test('without a baseline every generation counts', () => {
  const stats = aggregateDocumentedEventAnalytics(
    [
      { createdAt: '2026-10-01T00:00:00.000Z', promptId: 'a', promptName: 'Oil' },
      { createdAt: '2026-11-02T00:00:00.000Z', promptId: 'a', promptName: 'Oil' },
      { createdAt: '2026-11-02T01:00:00.000Z', promptId: 'b', promptName: 'Pop' },
    ],
    null
  );
  assert.equal(stats.totalPhotos, 3);
  assert.equal(stats.promptStats[0].promptName, 'Oil');
  assert.equal(stats.promptStats[0].count, 2);
  assert.equal(stats.promptStats[0].percentage, 67);
  assert.equal(stats.promptStats[1].count, 1);
  assert.equal(stats.analyticsResetAt, null);
});

test('a baseline drops earlier generations and keeps later ones', () => {
  const stats = aggregateDocumentedEventAnalytics(
    [
      { createdAt: '2026-10-31T00:00:00.000Z', promptId: 'test', promptName: 'Test theme' },
      { createdAt: baseline, promptId: 'test', promptName: 'Test theme' },
      { createdAt: '2026-11-01T12:00:01.000Z', promptId: 'live', promptName: 'Guest theme' },
    ],
    baseline
  );
  assert.equal(stats.totalPhotos, 1);
  assert.equal(stats.promptStats.length, 1);
  assert.equal(stats.promptStats[0].promptId, 'live');
  assert.equal(stats.promptStats[0].percentage, 100);
  assert.equal(isCountedInDocumentedStats(baseline, baseline), false);
});

test('chart and phone ids use the same baseline and stay inside the event window', () => {
  const now = new Date('2026-11-09T00:00:00.000Z');
  const points = aggregateDocumentedChartData(
    [
      '2026-10-01T00:00:00.000Z',
      '2026-11-08T15:00:00.000Z',
      '2026-09-01T00:00:00.000Z',
    ],
    baseline,
    now
  );
  assert.deepEqual(points, [{ date: '2026-11-08', generations: 1 }]);

  const ids = filterImageIdsForDocumentedStats(
    [
      { id: 'old', createdAt: '2026-10-01T00:00:00.000Z' },
      { id: 'new', createdAt: '2026-11-08T15:00:00.000Z' },
    ],
    baseline
  );
  assert.deepEqual(ids, ['new']);
});

test('another event baseline does not change this event when the caller passes null', () => {
  const otherEventImages = [
    { createdAt: '2026-10-01T00:00:00.000Z', promptId: 'a', promptName: 'Oil' },
  ];
  const stats = aggregateDocumentedEventAnalytics(otherEventImages, null);
  assert.equal(stats.totalPhotos, 1);
});

test('typed confirmation must match the event name', () => {
  assert.equal(confirmationMatchesEvent('  Harbor Lights  ', 'Harbor Lights'), true);
  assert.equal(confirmationMatchesEvent('harbor lights', 'Harbor Lights'), false);
  assert.equal(confirmationMatchesEvent('Harbor', 'Harbor Lights'), false);
  assert.equal(confirmationMatchesEvent('   ', '   '), false);
});

test('migration only baselines one event and does not delete photos or credits', () => {
  const sql = readFileSync(
    new URL('../supabase/migrations/20261109120000_add_event_analytics_reset_at.sql', import.meta.url),
    'utf8'
  );
  const executable = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '');
  assert.match(sql, /ADD COLUMN IF NOT EXISTS analytics_reset_at/);
  assert.match(executable, /SET analytics_reset_at = now\(\)/);
  assert.match(executable, /WHERE id = p_event_id/);
  assert.match(executable, /user_is_admin\(\)/);
  assert.match(executable, /GRANT EXECUTE ON FUNCTION public.clear_event_documentation_stats\(uuid\) TO authenticated/);
  assert.match(executable, /REVOKE EXECUTE ON FUNCTION public.clear_event_documentation_stats\(uuid\) FROM anon/);
  assert.doesNotMatch(executable, /DELETE FROM/i);
  assert.doesNotMatch(executable, /user_credits/);
  assert.doesNotMatch(executable, /generated_images/);
  assert.doesNotMatch(executable, /sms_logs/);
  assert.doesNotMatch(executable, /event_photos/);
  assert.doesNotMatch(executable, /total_generations/);
  assert.doesNotMatch(executable, /usage_count/);
  assert.doesNotMatch(executable, /REVOKE ALL ON FUNCTION public.protect_event_analytics_reset_at/);
});

function extractConstFunction(source: string, name: string): string {
  const marker = `export const ${name} = `;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing ${name}`);
  const nextExport = source.indexOf('\nexport const ', start + marker.length);
  return source.slice(start, nextExport === -1 ? source.length : nextExport);
}

test('account, billing, and save paths do not apply the documentation baseline', () => {
  const source = readFileSync(new URL('../services/backendService.ts', import.meta.url), 'utf8');
  for (const name of [
    'getDashboardStats',
    'getDashboardChartData',
    'getGenerationsByDateAndEvent',
    'getAdminStats',
    'getAllUsers',
    'saveEvent',
    'saveGeneratedImage',
  ]) {
    const body = extractConstFunction(source, name);
    assert.equal(body.includes('analytics_reset_at'), false, name);
    assert.equal(body.includes('clear_event_documentation_stats'), false, name);
  }

  const clearFn = extractConstFunction(source, 'clearEventDocumentationStats');
  assert.match(clearFn, /clear_event_documentation_stats/);
  assert.match(clearFn, /p_event_id: eventId/);
});

test('mobile menu is a right-side touch target and the desktop sidebar stays on the left', () => {
  const source = readFileSync(new URL('../components/AdminDashboard.tsx', import.meta.url), 'utf8');
  const buttonStart = source.indexOf('aria-label={mobileMenuOpen');
  assert.notEqual(buttonStart, -1);
  const button = source.slice(buttonStart, buttonStart + 700);
  assert.match(button, /fixed top-3 right-3/);
  assert.match(button, /h-14 w-14/);
  assert.match(button, /md:hidden/);
  assert.doesNotMatch(button, /left-4/);
  assert.match(source, /translate-x-full md:translate-x-0/);
  assert.match(source, /md:relative md:inset-auto/);
  assert.match(source, /max-md:border-l/);
  assert.match(source, /md:border-r/);
});
