import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eventLimitBlocks } from './eventCredits.ts';

test('eventLimitBlocks returns false when creditLimit is null', () => {
  assert.equal(eventLimitBlocks(null, 5, 1), false);
});

test('eventLimitBlocks returns false when creditLimit is undefined', () => {
  assert.equal(eventLimitBlocks(undefined, 5, 1), false);
});

test('eventLimitBlocks returns false when under the limit', () => {
  assert.equal(eventLimitBlocks(10, 3, 2), false);
});

test('eventLimitBlocks returns false when used + cost equals the limit exactly', () => {
  assert.equal(eventLimitBlocks(10, 8, 2), false);
});

test('eventLimitBlocks returns true when used + cost exceeds the limit', () => {
  assert.equal(eventLimitBlocks(10, 9, 2), true);
});

test('eventLimitBlocks treats undefined creditsUsed as 0', () => {
  assert.equal(eventLimitBlocks(5, undefined, 3), false);
  assert.equal(eventLimitBlocks(5, undefined, 6), true);
});

import { readFileSync } from 'node:fs';
import { hasEventCreditLimit, creditCostForResolution, parseCreditLimitInput } from './eventCredits.ts';

test('hasEventCreditLimit: null/undefined is unlimited, 0 is a real limit', () => {
  assert.equal(hasEventCreditLimit(null), false);
  assert.equal(hasEventCreditLimit(undefined), false);
  assert.equal(hasEventCreditLimit(0), true);
  assert.equal(hasEventCreditLimit(4), true);
});

test('creditCostForResolution charges 1 / 2 / 4 credits', () => {
  assert.equal(creditCostForResolution('1K'), 1);
  assert.equal(creditCostForResolution('2K'), 2);
  assert.equal(creditCostForResolution('4K'), 4);
  assert.equal(creditCostForResolution(undefined), 1);
});

test('parseCreditLimitInput: empty/invalid is unlimited, negatives clamp to 0', () => {
  assert.equal(parseCreditLimitInput(''), null);
  assert.equal(parseCreditLimitInput('abc'), null);
  assert.equal(parseCreditLimitInput('12'), 12);
  assert.equal(parseCreditLimitInput('-3'), 0);
});

const kiosk = readFileSync(new URL('../components/KioskMode.tsx', import.meta.url), 'utf8');
const between = (src: string, start: string, end: string) => {
  const i = src.indexOf(start);
  assert.ok(i >= 0, `missing ${start}`);
  const j = src.indexOf(end, i + start.length);
  return src.slice(i, j < 0 ? undefined : j);
};

test('kiosk does not reserve event credits at session start', () => {
  const tap = between(kiosk, 'const handleTapToStart', 'const handleDisclaimerAgree');
  assert.ok(!tap.includes('reserveEventCredits('));
});

test('kiosk reserves right before generating, keeps on success, refunds on failure', () => {
  const gen = between(kiosk, 'const handleGenerate', '// --- SMS LOGIC ---');
  const reserve = gen.indexOf('reserveEventCredits(event.id, creditCost)');
  const generate = gen.indexOf('generateBoothImage(');
  assert.ok(reserve > 0 && reserve < generate, 'reservation must come right before generation');
  assert.ok(gen.includes("setView('event-limit-reached')"));
  const ok = gen.indexOf('finishEventCreditReservation(reservationId, true)');
  assert.ok(ok > gen.indexOf('consumeCredit(event.userId, creditCost)'), 'keep credits where the owner is charged');
  const catchBlock = gen.slice(gen.lastIndexOf('} catch (err: any) {'));
  assert.ok(catchBlock.includes('finishEventCreditReservation(reservationId, false)'), 'refund on failure');
});

test('finishEventCreditReservation passes p_success', () => {
  const svc = readFileSync(new URL('../services/creditService.ts', import.meta.url), 'utf8');
  assert.match(svc, /p_success: success/);
});
