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
