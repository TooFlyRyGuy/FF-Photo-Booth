import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createDateTimeInTimezone,
  dateToLocalInputValue,
  formatDateTimeInTimezone,
} from './timezoneService.ts';

function iso(dateStr: string, timeStr: string, timezone: string): string {
  return createDateTimeInTimezone(dateStr, timeStr, timezone).toISOString();
}

test('2026-11-17 00:00 in America/Los_Angeles is 08:00 UTC (PST, UTC-8)', () => {
  const utc = createDateTimeInTimezone('2026-11-17', '00:00', 'America/Los_Angeles');
  assert.equal(utc.toISOString(), '2026-11-17T08:00:00.000Z');
  assert.equal(dateToLocalInputValue(utc, 'America/Los_Angeles'), '2026-11-17T00:00');
  assert.equal(formatDateTimeInTimezone(utc, 'America/Los_Angeles'), '11/17/2026, 12:00 AM PST');
});

test('a summer Pacific time is PDT (UTC-7)', () => {
  const utc = createDateTimeInTimezone('2026-07-17', '00:00', 'America/Los_Angeles');
  assert.equal(utc.toISOString(), '2026-07-17T07:00:00.000Z');
  assert.equal(dateToLocalInputValue(utc, 'America/Los_Angeles'), '2026-07-17T00:00');
  assert.equal(formatDateTimeInTimezone(utc, 'America/Los_Angeles'), '7/17/2026, 12:00 AM PDT');

  assert.equal(iso('2026-06-15', '15:30', 'America/Los_Angeles'), '2026-06-15T22:30:00.000Z');
});

test('America/New_York uses EST in November and EDT in July', () => {
  const winter = createDateTimeInTimezone('2026-11-17', '00:00', 'America/New_York');
  assert.equal(winter.toISOString(), '2026-11-17T05:00:00.000Z');
  assert.equal(dateToLocalInputValue(winter, 'America/New_York'), '2026-11-17T00:00');
  assert.equal(formatDateTimeInTimezone(winter, 'America/New_York'), '11/17/2026, 12:00 AM EST');

  const summer = createDateTimeInTimezone('2026-07-17', '00:00', 'America/New_York');
  assert.equal(summer.toISOString(), '2026-07-17T04:00:00.000Z');
  assert.equal(formatDateTimeInTimezone(summer, 'America/New_York'), '7/17/2026, 12:00 AM EDT');
});

test('UTC wall time is the same instant', () => {
  const utc = createDateTimeInTimezone('2026-11-17', '00:00', 'UTC');
  assert.equal(utc.toISOString(), '2026-11-17T00:00:00.000Z');
  assert.equal(dateToLocalInputValue(utc, 'UTC'), '2026-11-17T00:00');
  assert.equal(formatDateTimeInTimezone(utc, 'UTC'), '11/17/2026, 12:00 AM UTC');
});

test('Asia/Tokyo is UTC+9, including a previous-day UTC instant', () => {
  const midnight = createDateTimeInTimezone('2026-11-17', '00:00', 'Asia/Tokyo');
  assert.equal(midnight.toISOString(), '2026-11-16T15:00:00.000Z');
  assert.equal(dateToLocalInputValue(midnight, 'Asia/Tokyo'), '2026-11-17T00:00');
  assert.equal(formatDateTimeInTimezone(midnight, 'Asia/Tokyo'), '11/17/2026, 12:00 AM GMT+9');

  const morning = createDateTimeInTimezone('2026-11-17', '09:00', 'Asia/Tokyo');
  assert.equal(morning.toISOString(), '2026-11-17T00:00:00.000Z');
  assert.equal(dateToLocalInputValue(morning, 'Asia/Tokyo'), '2026-11-17T09:00');
});

test('a 30-minute offset is preserved (Asia/Kolkata, UTC+5:30)', () => {
  const utc = createDateTimeInTimezone('2026-11-17', '00:00', 'Asia/Kolkata');
  assert.equal(utc.toISOString(), '2026-11-16T18:30:00.000Z');
  assert.equal(dateToLocalInputValue(utc, 'Asia/Kolkata'), '2026-11-17T00:00');
});

test('seconds in the time string are kept', () => {
  assert.equal(
    iso('2026-11-17', '00:00:30', 'America/Los_Angeles'),
    '2026-11-17T08:00:30.000Z'
  );
});

test('US spring-forward keeps the valid times on either side of the gap', () => {
  // 2026-03-08: 02:00 PST does not exist; clocks jump to 03:00 PDT.
  const before = createDateTimeInTimezone('2026-03-08', '01:30', 'America/Los_Angeles');
  assert.equal(before.toISOString(), '2026-03-08T09:30:00.000Z');
  assert.equal(dateToLocalInputValue(before, 'America/Los_Angeles'), '2026-03-08T01:30');
  assert.equal(formatDateTimeInTimezone(before, 'America/Los_Angeles'), '3/8/2026, 1:30 AM PST');

  const after = createDateTimeInTimezone('2026-03-08', '03:00', 'America/Los_Angeles');
  assert.equal(after.toISOString(), '2026-03-08T10:00:00.000Z');
  assert.equal(dateToLocalInputValue(after, 'America/Los_Angeles'), '2026-03-08T03:00');
  assert.equal(formatDateTimeInTimezone(after, 'America/Los_Angeles'), '3/8/2026, 3:00 AM PDT');

  const nyAfter = createDateTimeInTimezone('2026-03-08', '03:00', 'America/New_York');
  assert.equal(nyAfter.toISOString(), '2026-03-08T07:00:00.000Z');
  assert.equal(dateToLocalInputValue(nyAfter, 'America/New_York'), '2026-03-08T03:00');
});

test('a spring-forward gap time resolves to the previous valid hour', () => {
  // 02:00 and 02:30 do not exist. The offset re-check lands one hour earlier.
  assert.equal(iso('2026-03-08', '02:00', 'America/Los_Angeles'), '2026-03-08T09:00:00.000Z');
  assert.equal(
    dateToLocalInputValue('2026-03-08T09:00:00.000Z', 'America/Los_Angeles'),
    '2026-03-08T01:00'
  );
  assert.equal(iso('2026-03-08', '02:30', 'America/Los_Angeles'), '2026-03-08T09:30:00.000Z');
  assert.equal(iso('2026-03-08', '02:30', 'America/New_York'), '2026-03-08T06:30:00.000Z');
});

test('US fall-back picks the first occurrence of an ambiguous hour and the later offset after it', () => {
  // 2026-11-01: 02:00 PDT falls back to 01:00 PST. 01:30 happens twice.
  const before = createDateTimeInTimezone('2026-11-01', '00:30', 'America/Los_Angeles');
  assert.equal(before.toISOString(), '2026-11-01T07:30:00.000Z');
  assert.equal(formatDateTimeInTimezone(before, 'America/Los_Angeles'), '11/1/2026, 12:30 AM PDT');

  const ambiguous = createDateTimeInTimezone('2026-11-01', '01:30', 'America/Los_Angeles');
  assert.equal(ambiguous.toISOString(), '2026-11-01T08:30:00.000Z');
  assert.equal(dateToLocalInputValue(ambiguous, 'America/Los_Angeles'), '2026-11-01T01:30');
  assert.equal(formatDateTimeInTimezone(ambiguous, 'America/Los_Angeles'), '11/1/2026, 1:30 AM PDT');

  const after = createDateTimeInTimezone('2026-11-01', '02:00', 'America/Los_Angeles');
  assert.equal(after.toISOString(), '2026-11-01T10:00:00.000Z');
  assert.equal(dateToLocalInputValue(after, 'America/Los_Angeles'), '2026-11-01T02:00');
  assert.equal(formatDateTimeInTimezone(after, 'America/Los_Angeles'), '11/1/2026, 2:00 AM PST');

  assert.equal(iso('2026-11-01', '03:00', 'America/Los_Angeles'), '2026-11-01T11:00:00.000Z');
  assert.equal(iso('2026-11-01', '01:30', 'America/New_York'), '2026-11-01T05:30:00.000Z');
  assert.equal(iso('2026-11-01', '03:00', 'America/New_York'), '2026-11-01T08:00:00.000Z');
});

test('entered wall times round-trip through the picker helpers', () => {
  const cases: Array<[string, string, string]> = [
    ['2026-11-17', '00:00', 'America/Los_Angeles'],
    ['2026-07-17', '15:45', 'America/Los_Angeles'],
    ['2026-01-15', '09:05', 'America/New_York'],
    ['2026-11-17', '23:59', 'UTC'],
    ['2026-11-17', '00:00', 'Asia/Tokyo'],
    ['2026-12-31', '23:30', 'Asia/Kolkata'],
  ];

  for (const [dateStr, timeStr, timezone] of cases) {
    const utc = createDateTimeInTimezone(dateStr, timeStr, timezone);
    assert.equal(dateToLocalInputValue(utc, timezone), `${dateStr}T${timeStr}`);
    const formatted = formatDateTimeInTimezone(utc, timezone);
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hour, minute] = timeStr.split(':').map(Number);
    const clock = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(Date.UTC(year, month - 1, day, hour, minute)));
    assert.ok(
      formatted.startsWith(`${clock} `),
      `${timezone} ${dateStr} ${timeStr} formatted as ${formatted}, expected to start with ${clock}`
    );
  }
});

test('Intl hour 24 is treated as midnight when measuring the zone offset', () => {
  const RealDateTimeFormat = Intl.DateTimeFormat;
  class Hour24DateTimeFormat extends RealDateTimeFormat {
    formatToParts(date?: Date | number): Intl.DateTimeFormatPart[] {
      return super.formatToParts(date).map(part =>
        part.type === 'hour' && part.value === '00' ? { ...part, value: '24' } : part
      );
    }
  }

  Intl.DateTimeFormat = Hour24DateTimeFormat as typeof Intl.DateTimeFormat;
  try {
    assert.equal(iso('2026-11-17', '00:00', 'America/Los_Angeles'), '2026-11-17T08:00:00.000Z');
    assert.equal(iso('2026-11-17', '00:00', 'Asia/Tokyo'), '2026-11-16T15:00:00.000Z');
    assert.equal(iso('2026-07-17', '00:00', 'America/Los_Angeles'), '2026-07-17T07:00:00.000Z');
    const utc = createDateTimeInTimezone('2026-11-17', '00:00', 'America/Los_Angeles');
    assert.equal(dateToLocalInputValue(utc, 'America/Los_Angeles'), '2026-11-17T00:00');
  } finally {
    Intl.DateTimeFormat = RealDateTimeFormat;
  }
});
