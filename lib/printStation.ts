// Booth-side print station rules. Pure logic so it can run before the SQL exists.

export const PRINT_PAPER_SIZES = [
  { id: '4x6', label: '4×6' },
  { id: '2x6', label: '2×6 strips' },
  { id: '6x4', label: '6×4' },
  { id: '5x7', label: '5×7' },
  { id: '6x8', label: '6×8' },
  { id: '6x6', label: '6×6' },
  { id: '6x9', label: '6×9' },
] as const;

export type PrintPaperSize = (typeof PRINT_PAPER_SIZES)[number]['id'];
export type PrintCut = 'none' | '2inch';
export type PrintDelivery = 'button' | 'auto';

export const PRINT_PAPER_SIZE_IDS: readonly PrintPaperSize[] = PRINT_PAPER_SIZES.map((size) => size.id);

export const STATION_QUIET_MS = 2 * 60 * 1000;
export const PRINT_COPY_MAX = 20;

export const PRINT_SCHEMA_MISSING_MESSAGE =
  'Print stations are not in the database yet. Apply the print station migration, then try again.';

export interface EventPrintSettings {
  printEnabled: boolean;
  printPaperSize: PrintPaperSize;
  printCut: PrintCut;
  printDelivery: PrintDelivery;
  printMaxCopies: number;
  printEventLimit: number | null;
}

export const DEFAULT_PRINT_SETTINGS: EventPrintSettings = {
  printEnabled: false,
  printPaperSize: '4x6',
  printCut: 'none',
  printDelivery: 'button',
  printMaxCopies: 1,
  printEventLimit: null,
};

const BILLABLE_JOB_STATUSES = new Set(['queued', 'claimed', 'printing', 'done']);

export function isPrintPaperSize(value: string): value is PrintPaperSize {
  return (PRINT_PAPER_SIZE_IDS as readonly string[]).includes(value);
}

export function normalizePaperSize(value: unknown): PrintPaperSize {
  const text = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/×/g, 'x')
    .replace(/\s+/g, '');
  return isPrintPaperSize(text) ? text : DEFAULT_PRINT_SETTINGS.printPaperSize;
}

/** 2×6 is one strip per copy. The station cuts a 4×6 sheet. Every other size is uncut. */
export function cutForPaperSize(value: unknown): PrintCut {
  return normalizePaperSize(value) === '2x6' ? '2inch' : 'none';
}

export function parsePrintMaxCopies(value: string): number {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return 1;
  return Math.min(PRINT_COPY_MAX, Math.max(1, n));
}

/** Empty or anything below 1 means the event has no print cap. */
export function parsePrintEventLimit(value: string): number | null {
  if (value.trim() === '') return null;
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n < 1) return null;
  return Math.min(n, 100000);
}

function readBoolean(source: Record<string, unknown>, camel: string, snake: string): boolean | undefined {
  const value = source[camel] ?? source[snake];
  if (typeof value === 'boolean') return value;
  return undefined;
}

function readNumber(source: Record<string, unknown>, camel: string, snake: string): number | null | undefined {
  if (!(camel in source) && !(snake in source)) return undefined;
  const value = source[camel] ?? source[snake];
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  return Number.isNaN(n) ? null : n;
}

export function readEventPrintSettings(source: object | null | undefined): EventPrintSettings {
  if (!source) return { ...DEFAULT_PRINT_SETTINGS };
  const row = source as Record<string, unknown>;
  const enabled = readBoolean(row, 'printEnabled', 'print_enabled') === true;
  const paperSize = normalizePaperSize(row.printPaperSize ?? row.print_paper_size);
  const deliveryRaw = String(row.printDelivery ?? row.print_delivery ?? 'button');
  const delivery: PrintDelivery = deliveryRaw === 'auto' ? 'auto' : 'button';
  const maxRaw = readNumber(row, 'printMaxCopies', 'print_max_copies');
  const limitRaw = readNumber(row, 'printEventLimit', 'print_event_limit');
  const maxCopies = maxRaw === undefined || maxRaw === null
    ? DEFAULT_PRINT_SETTINGS.printMaxCopies
    : Math.min(PRINT_COPY_MAX, Math.max(1, maxRaw));
  const eventLimit = limitRaw === undefined || limitRaw === null || limitRaw < 1 ? null : Math.min(100000, limitRaw);

  return {
    printEnabled: enabled,
    printPaperSize: paperSize,
    printCut: cutForPaperSize(paperSize),
    printDelivery: delivery,
    printMaxCopies: maxCopies,
    printEventLimit: eventLimit,
  };
}

export function eventPrintColumns(settings: EventPrintSettings): {
  print_enabled: boolean;
  print_paper_size: PrintPaperSize;
  print_cut: PrintCut;
  print_delivery: PrintDelivery;
  print_max_copies: number;
  print_event_limit: number | null;
} {
  const paperSize = normalizePaperSize(settings.printPaperSize);
  return {
    print_enabled: settings.printEnabled === true,
    print_paper_size: paperSize,
    print_cut: cutForPaperSize(paperSize),
    print_delivery: settings.printDelivery === 'auto' ? 'auto' : 'button',
    print_max_copies: Math.min(PRINT_COPY_MAX, Math.max(1, settings.printMaxCopies || 1)),
    print_event_limit: settings.printEventLimit && settings.printEventLimit >= 1
      ? Math.min(100000, Math.floor(settings.printEventLimit))
      : null,
  };
}

export function showGuestPrintButton(source: object | null | undefined): boolean {
  const settings = readEventPrintSettings(source);
  return settings.printEnabled && settings.printDelivery !== 'auto';
}

export function shouldAutoPrint(source: object | null | undefined): boolean {
  const settings = readEventPrintSettings(source);
  return settings.printEnabled && settings.printDelivery === 'auto';
}

export interface PrintJobCopy {
  status: string;
  copies: number;
}

export function billableCopies(jobs: PrintJobCopy[]): number {
  return jobs.reduce((sum, job) => {
    if (!BILLABLE_JOB_STATUSES.has(job.status)) return sum;
    const copies = Number.isFinite(job.copies) ? job.copies : 0;
    return sum + Math.max(0, copies);
  }, 0);
}

export type PrintBlockReason = 'off' | 'guest' | 'event' | 'copies';

export function printEnqueueDecision(input: {
  printEnabled: boolean;
  maxCopies: number;
  eventLimit: number | null;
  requested: number;
  imageCopiesUsed: number;
  eventCopiesUsed: number;
}): { ok: true; copies: number } | { ok: false; reason: PrintBlockReason } {
  if (!input.printEnabled) return { ok: false, reason: 'off' };
  const maxCopies = Math.min(PRINT_COPY_MAX, Math.max(1, input.maxCopies || 1));
  const requested = Math.floor(input.requested);
  if (requested < 1 || requested > maxCopies) return { ok: false, reason: 'copies' };
  if (input.imageCopiesUsed + requested > maxCopies) return { ok: false, reason: 'guest' };
  if (input.eventLimit !== null && input.eventLimit !== undefined) {
    if (input.eventCopiesUsed + requested > input.eventLimit) return { ok: false, reason: 'event' };
  }
  return { ok: true, copies: requested };
}

export function isHttpsUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}

/** Which already-uploaded URL can be printed, or whether a new upload is required. */
export function choosePrintImageSource(input: {
  printEnabled: boolean;
  overlayApplied: boolean;
  existingHttpsUrl: string | null;
  cleanHttpsUrl: string | null;
}): 'skip' | 'existing' | 'clean' | 'upload' {
  if (!input.printEnabled) return 'skip';
  if (isHttpsUrl(input.existingHttpsUrl)) return 'existing';
  if (!input.overlayApplied && isHttpsUrl(input.cleanHttpsUrl)) return 'clean';
  return 'upload';
}

export function isMissingPrintSchema(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const code = error.code || '';
  if (['PGRST202', 'PGRST204', 'PGRST205', '42P01', '42703', '42883'].includes(code)) return true;
  const message = (error.message || '').toLowerCase();
  return (
    message.includes('print_stations')
    || message.includes('print_jobs')
    || message.includes('print_enabled')
    || message.includes('enqueue_print_job')
    || message.includes('create_station_pairing')
    || message.includes('schema cache')
    || message.includes('could not find the function')
  );
}

export function friendlyPrintError(message: string | null | undefined): string {
  const text = (message || '').toLowerCase();
  if (text.includes('guest copy limit')) return 'This photo has already used its print copies.';
  if (text.includes('event print limit')) return 'This event has reached its print limit.';
  if (text.includes('printing is off')) return 'Printing is turned off for this event.';
  if (text.includes('image is not ready')) return 'The photo is not ready to print yet.';
  if (text.includes('copies must be')) return 'That many copies is not allowed for this event.';
  if (text.includes('not allowed')) return 'This kiosk cannot print for that event.';
  if (text.includes('event is not active')) return 'This event is not active.';
  if (text.includes('unsupported paper')) return 'That print size is not supported.';
  return message?.trim() || 'The printer did not accept this photo.';
}

export interface StationPresenceInput {
  status: string | null | undefined;
  paused: boolean;
  lastSeenAt: string | null | undefined;
}

export interface StationPresence {
  online: boolean;
  label: string;
}

export function stationPresence(station: StationPresenceInput, now = Date.now()): StationPresence {
  const status = (station.status || '').toLowerCase();
  if (status === 'unpaired' || !station.lastSeenAt) {
    if (status === 'unpaired' || status === '') {
      return { online: false, label: 'Unpaired' };
    }
  }

  const seen = station.lastSeenAt ? new Date(station.lastSeenAt).getTime() : Number.NaN;
  const quiet = !station.lastSeenAt || Number.isNaN(seen) || now - seen > STATION_QUIET_MS;

  if (station.paused || status === 'paused') {
    return { online: !quiet, label: quiet ? 'Paused · offline' : 'Paused' };
  }
  if (quiet) return { online: false, label: 'Offline' };
  if (status === 'error') return { online: true, label: 'Online · printer error' };
  if (status === 'printing') return { online: true, label: 'Printing' };
  if (status === 'offline') return { online: true, label: 'Online · printer offline' };
  return { online: true, label: 'Online' };
}

export function formatLastSeen(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'No heartbeat yet';
  const seen = new Date(iso).getTime();
  if (Number.isNaN(seen)) return 'No heartbeat yet';
  const seconds = Math.max(0, Math.round((now - seen) / 1000));
  if (seconds < 45) return 'Just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hr ago`;
  return new Date(iso).toLocaleString();
}
