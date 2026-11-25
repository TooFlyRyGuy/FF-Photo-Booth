import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  STATION_QUIET_MS,
  billableCopies,
  choosePrintImageSource,
  cutForPaperSize,
  eventPrintColumns,
  formatLastSeen,
  friendlyPrintError,
  isMissingPrintSchema,
  parsePrintEventLimit,
  parsePrintMaxCopies,
  printEnqueueDecision,
  readEventPrintSettings,
  shouldAutoPrint,
  showGuestPrintButton,
  stationPresence,
} from './printStation.ts';

test('missing print fields mean printing is off', () => {
  const settings = readEventPrintSettings({});
  assert.equal(settings.printEnabled, false);
  assert.equal(settings.printPaperSize, '4x6');
  assert.equal(settings.printDelivery, 'button');
  assert.equal(settings.printMaxCopies, 1);
  assert.equal(settings.printEventLimit, null);
  assert.equal(showGuestPrintButton(settings), false);
  assert.equal(shouldAutoPrint(settings), false);
});

test('snake_case event columns map onto the booth settings', () => {
  const settings = readEventPrintSettings({
    print_enabled: true,
    print_paper_size: '2x6',
    print_delivery: 'auto',
    print_max_copies: 3,
    print_event_limit: 40,
  });
  assert.equal(settings.printEnabled, true);
  assert.equal(settings.printPaperSize, '2x6');
  assert.equal(settings.printCut, '2inch');
  assert.equal(settings.printDelivery, 'auto');
  assert.equal(settings.printMaxCopies, 3);
  assert.equal(settings.printEventLimit, 40);
  assert.equal(showGuestPrintButton(settings), false);
  assert.equal(shouldAutoPrint(settings), true);
});

test('the guest Print button shows only when printing is on and delivery is the button', () => {
  assert.equal(showGuestPrintButton({ printEnabled: true, printDelivery: 'button' }), true);
  assert.equal(showGuestPrintButton({ printEnabled: true, printDelivery: 'auto' }), false);
  assert.equal(showGuestPrintButton({ printEnabled: false, printDelivery: 'button' }), false);
});

test('2x6 is a strip and every other size is uncut', () => {
  assert.equal(cutForPaperSize('2x6'), '2inch');
  assert.equal(cutForPaperSize('4x6'), 'none');
  assert.equal(cutForPaperSize('5x7'), 'none');
  assert.equal(cutForPaperSize('not-a-size'), 'none');
  const columns = eventPrintColumns(readEventPrintSettings({ printEnabled: true, printPaperSize: '2x6' }));
  assert.equal(columns.print_cut, '2inch');
  assert.equal(columns.print_paper_size, '2x6');
});

test('copy and event limits ignore failed and cancelled jobs', () => {
  const used = billableCopies([
    { status: 'done', copies: 2 },
    { status: 'queued', copies: 1 },
    { status: 'failed', copies: 4 },
    { status: 'cancelled', copies: 5 },
  ]);
  assert.equal(used, 3);
});

test('enqueue decision respects the guest cap and the event cap', () => {
  assert.deepEqual(printEnqueueDecision({
    printEnabled: false,
    maxCopies: 2,
    eventLimit: null,
    requested: 1,
    imageCopiesUsed: 0,
    eventCopiesUsed: 0,
  }), { ok: false, reason: 'off' });

  assert.deepEqual(printEnqueueDecision({
    printEnabled: true,
    maxCopies: 2,
    eventLimit: null,
    requested: 1,
    imageCopiesUsed: 2,
    eventCopiesUsed: 0,
  }), { ok: false, reason: 'guest' });

  assert.deepEqual(printEnqueueDecision({
    printEnabled: true,
    maxCopies: 4,
    eventLimit: 10,
    requested: 2,
    imageCopiesUsed: 0,
    eventCopiesUsed: 9,
  }), { ok: false, reason: 'event' });

  assert.deepEqual(printEnqueueDecision({
    printEnabled: true,
    maxCopies: 4,
    eventLimit: null,
    requested: 2,
    imageCopiesUsed: 1,
    eventCopiesUsed: 0,
  }), { ok: true, copies: 2 });
});

test('print limit inputs: empty event limit is unlimited, copies stay in 1..20', () => {
  assert.equal(parsePrintEventLimit(''), null);
  assert.equal(parsePrintEventLimit('0'), null);
  assert.equal(parsePrintEventLimit('12'), 12);
  assert.equal(parsePrintMaxCopies(''), 1);
  assert.equal(parsePrintMaxCopies('0'), 1);
  assert.equal(parsePrintMaxCopies('25'), 20);
});

test('a composited photo is uploaded only when printing is on and it is not already https', () => {
  assert.equal(choosePrintImageSource({
    printEnabled: false,
    overlayApplied: true,
    existingHttpsUrl: null,
    cleanHttpsUrl: 'https://cdn.example/clean.jpg',
  }), 'skip');
  assert.equal(choosePrintImageSource({
    printEnabled: true,
    overlayApplied: true,
    existingHttpsUrl: 'https://cdn.example/overlay.jpg',
    cleanHttpsUrl: 'https://cdn.example/clean.jpg',
  }), 'existing');
  assert.equal(choosePrintImageSource({
    printEnabled: true,
    overlayApplied: false,
    existingHttpsUrl: null,
    cleanHttpsUrl: 'https://cdn.example/clean.jpg',
  }), 'clean');
  assert.equal(choosePrintImageSource({
    printEnabled: true,
    overlayApplied: true,
    existingHttpsUrl: null,
    cleanHttpsUrl: 'https://cdn.example/clean.jpg',
  }), 'upload');
});

test('a station is offline when the heartbeat is older than two minutes', () => {
  const now = Date.parse('2026-11-25T12:00:00Z');
  const recent = new Date(now - 30_000).toISOString();
  const stale = new Date(now - STATION_QUIET_MS - 1000).toISOString();
  assert.equal(stationPresence({ status: 'online', paused: false, lastSeenAt: recent }, now).label, 'Online');
  assert.equal(stationPresence({ status: 'online', paused: false, lastSeenAt: stale }, now).online, false);
  assert.equal(stationPresence({ status: 'unpaired', paused: false, lastSeenAt: null }, now).label, 'Unpaired');
  assert.equal(stationPresence({ status: 'printing', paused: true, lastSeenAt: recent }, now).label, 'Paused');
  assert.equal(formatLastSeen(null, now), 'No heartbeat yet');
  assert.equal(formatLastSeen(recent, now), 'Just now');
});

test('missing print schema errors are recognized and print errors stay readable', () => {
  assert.equal(isMissingPrintSchema({ code: 'PGRST205', message: 'print_stations' }), true);
  assert.equal(isMissingPrintSchema({ message: 'Could not find the function public.enqueue_print_job' }), true);
  assert.equal(isMissingPrintSchema({ message: 'permission denied' }), false);
  assert.equal(friendlyPrintError('guest copy limit reached'), 'This photo has already used its print copies.');
  assert.equal(friendlyPrintError('event print limit reached'), 'This event has reached its print limit.');
});

const between = (src: string, start: string, end: string) => {
  const i = src.indexOf(start);
  assert.ok(i >= 0, `missing ${start}`);
  const j = src.indexOf(end, i + start.length);
  return src.slice(i, j < 0 ? undefined : j);
};

test('printing controls live in Sharing Settings, behind Enable printing', () => {
  const admin = readFileSync(new URL('../components/AdminDashboard.tsx', import.meta.url), 'utf8');
  const sharing = between(admin, 'Sharing Settings', 'SmugMug Gallery Management');
  assert.ok(sharing.includes('Enable printing'));
  assert.ok(sharing.includes('editingEvent.printEnabled === true'));
  assert.ok(sharing.includes('Print size'));
  assert.ok(sharing.includes('Guest taps a Print button'));
  assert.ok(sharing.includes('Print automatically when the photo is ready'));
  assert.ok(sharing.includes('Max copies per guest'));
  assert.ok(sharing.includes('Event print limit'));
});

test('the kiosk print button is gated on printing and calls enqueue_print_job', () => {
  const kiosk = readFileSync(new URL('../components/KioskMode.tsx', import.meta.url), 'utf8');
  const controls = between(kiosk, 'const renderPrintControls', 'const renderView');
  assert.ok(controls.includes('if (!settings.printEnabled) return null'));
  assert.ok(controls.includes('showGuestPrintButton(settings)'));
  assert.ok(controls.includes("t('kiosk.sentToPrinter')"));
  assert.ok(kiosk.includes('enqueuePrintJob('));
  assert.ok(kiosk.includes('shouldAutoPrint(printSettings)'));
  assert.ok(kiosk.includes('printSettings.printEnabled ? printableUrl : null'));
});

test('the print SQL is additive and keeps the station contract', () => {
  const sql = readFileSync(new URL('../docs/print-station/print_station_schema.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(sql, /drop\s+table/i);
  assert.doesNotMatch(sql, /drop\s+column/i);
  assert.doesNotMatch(sql, /drop\s+policy[^;]*anon_update_events/i);
  assert.doesNotMatch(sql, /create\s+policy\s+anon_update_events/i);
  assert.match(sql, /print_enabled boolean not null default false/);
  assert.match(sql, /enqueue_print_job/);
  assert.match(sql, /create_station_pairing/);
  assert.match(sql, /claim_print_job/);
  assert.match(sql, /guest copy limit reached/);
  assert.match(sql, /event print limit reached/);
  assert.match(sql, /retry_print_job/);
  assert.match(sql, /cancel_print_job/);
  assert.match(sql, /grant execute on function public\.enqueue_print_job\(uuid, text, uuid, text, text, integer, uuid\) to anon, authenticated/);
});
