import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  buildEventPromptRows,
  normalizeOverlayMode,
  promptOverlayFieldsFromRow,
  resolveOverlayForPrompt,
} from './overlayResolve.ts';

const event = { overlayImageUrl: 'https://cdn/event.png' };

test('default (event) mode uses the event overlay', () => {
  assert.equal(resolveOverlayForPrompt(event, { eventOverlayMode: 'event' }), 'https://cdn/event.png');
  assert.equal(resolveOverlayForPrompt(event, {}), 'https://cdn/event.png');
  assert.equal(resolveOverlayForPrompt(event, null), 'https://cdn/event.png');
});

test('custom mode uses the prompt overlay', () => {
  assert.equal(
    resolveOverlayForPrompt(event, { eventOverlayMode: 'custom', eventOverlayUrl: 'https://cdn/cyclist.png' }),
    'https://cdn/cyclist.png'
  );
  assert.equal(
    resolveOverlayForPrompt({ overlayImageUrl: '' }, { eventOverlayMode: 'custom', eventOverlayUrl: 'data:image/png;base64,xx' }),
    'data:image/png;base64,xx'
  );
});

test('custom mode with no image yet falls back to the event overlay', () => {
  assert.equal(resolveOverlayForPrompt(event, { eventOverlayMode: 'custom', eventOverlayUrl: null }), 'https://cdn/event.png');
  assert.equal(resolveOverlayForPrompt(event, { eventOverlayMode: 'custom', eventOverlayUrl: '  ' }), 'https://cdn/event.png');
});

test('none mode gives no overlay even when the event has one', () => {
  assert.equal(resolveOverlayForPrompt(event, { eventOverlayMode: 'none', eventOverlayUrl: 'https://cdn/x.png' }), null);
});

test('sticker mode never gets an overlay', () => {
  assert.equal(resolveOverlayForPrompt(event, { eventOverlayMode: 'custom', eventOverlayUrl: 'https://cdn/x.png' }, true), null);
  assert.equal(resolveOverlayForPrompt(event, {}, true), null);
});

test('no event overlay and default mode gives no overlay', () => {
  assert.equal(resolveOverlayForPrompt({ overlayImageUrl: '' }, {}), null);
  assert.equal(resolveOverlayForPrompt({}, { eventOverlayMode: 'event' }), null);
  assert.equal(resolveOverlayForPrompt(null, null), null);
});

test('unknown modes are treated as event default', () => {
  assert.equal(normalizeOverlayMode('inherit'), 'event');
  assert.equal(normalizeOverlayMode(undefined), 'event');
  assert.equal(normalizeOverlayMode('custom'), 'custom');
  assert.equal(normalizeOverlayMode('none'), 'none');
});

test('event_prompts rows map onto prompt fields', () => {
  assert.deepEqual(promptOverlayFieldsFromRow({ overlay_mode: 'custom', overlay_url: 'https://cdn/c.png' }), {
    eventOverlayMode: 'custom',
    eventOverlayUrl: 'https://cdn/c.png',
  });
  // Rows from before the migration (columns missing) load as event default.
  assert.deepEqual(promptOverlayFieldsFromRow({}), { eventOverlayMode: 'event', eventOverlayUrl: null });
});

test('saveEvent rows carry each prompt overlay choice in order', () => {
  const rows = buildEventPromptRows('evt-1', [
    { id: 'p-main' },
    { id: 'p-cyclist', eventOverlayMode: 'custom', eventOverlayUrl: 'https://cdn/cyclist.png' },
    { id: 'p-plain', eventOverlayMode: 'none', eventOverlayUrl: 'https://cdn/stale.png' },
  ]);
  assert.deepEqual(rows, [
    { event_id: 'evt-1', prompt_id: 'p-main', display_order: 0, overlay_mode: 'event', overlay_url: null },
    { event_id: 'evt-1', prompt_id: 'p-cyclist', display_order: 1, overlay_mode: 'custom', overlay_url: 'https://cdn/cyclist.png' },
    { event_id: 'evt-1', prompt_id: 'p-plain', display_order: 2, overlay_mode: 'none', overlay_url: null },
  ]);
});

test('load then save round-trips the overlay fields (mock rows)', () => {
  const stored = [
    { prompt_id: 'a', display_order: 0, overlay_mode: 'event', overlay_url: null },
    { prompt_id: 'b', display_order: 1, overlay_mode: 'custom', overlay_url: 'https://cdn/b.png' },
    { prompt_id: 'c', display_order: 2, overlay_mode: 'none', overlay_url: null },
  ];
  const loaded = stored.map(r => ({ id: r.prompt_id, name: r.prompt_id, ...promptOverlayFieldsFromRow(r) }));
  // A duplicate or an unrelated edit re-saves the same prompt objects.
  const resaved = buildEventPromptRows('evt-2', loaded).map(({ event_id, ...rest }) => rest);
  assert.deepEqual(resaved, stored);
});

test('backend loaders select and saveEvent writes the overlay columns', () => {
  const src = readFileSync(new URL('../services/backendService.ts', import.meta.url), 'utf8');
  assert.equal(src.includes(".select('prompt_id, display_order')"), false, 'no loader drops the overlay columns');
  assert.equal((src.match(/select\('prompt_id, display_order, overlay_mode, overlay_url'\)/g) || []).length, 2);
  assert.equal((src.match(/\.\.\.promptOverlayFieldsFromRow\(ep\)/g) || []).length, 2);
  const saveAt = src.indexOf('export const saveEvent');
  const nextExport = src.indexOf('export const', saveAt + 10);
  const saveBody = src.slice(saveAt, nextExport);
  assert.match(saveBody, /buildEventPromptRows\(eventId, event\.prompts\)/);
  assert.equal(saveBody.includes('display_order: index'), false);
});

test('kiosk composites with the per-prompt overlay', () => {
  const kiosk = readFileSync(new URL('../components/KioskMode.tsx', import.meta.url), 'utf8');
  assert.match(kiosk, /resolveOverlayForPrompt\(event, selectedPrompt, isStickerMode\)/);
  assert.equal(kiosk.includes('applyOverlayToImage(genImage, event.overlayImageUrl)'), false);
});
