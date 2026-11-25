import { supabase } from '../lib/supabase';
import {
  PRINT_SCHEMA_MISSING_MESSAGE,
  PrintCut,
  PrintPaperSize,
  choosePrintImageSource,
  friendlyPrintError,
  isHttpsUrl,
  isMissingPrintSchema,
} from '../lib/printStation';
import { uploadGeneratedPhoto } from './storageService';

export interface EnqueuePrintInput {
  eventId: string;
  eventPasscode: string;
  generatedImageId: string;
  paperSize: PrintPaperSize | string;
  cut: PrintCut;
  copies: number;
  stationId?: string | null;
}

export interface EnqueuePrintResult {
  ok: boolean;
  unavailable: boolean;
  message: string;
  jobId: string | null;
}

export interface PairingTicket {
  stationId: string;
  code: string;
  expiresAt: string;
}

export interface PrintStationRecord {
  id: string;
  name: string;
  locationLabel: string | null;
  eventId: string | null;
  paused: boolean;
  lastSeenAt: string | null;
  printerName: string | null;
  printerModel: string | null;
  status: string;
  statusDetail: string | null;
  printsRemaining: number | null;
  appVersion: string | null;
  pairedAt: string | null;
}

export interface PrintJobRecord {
  id: string;
  eventId: string | null;
  stationId: string | null;
  paperSize: string;
  cut: string;
  copies: number;
  status: string;
  error: string | null;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  finishedAt: string | null;
}

export interface PrintAdminSnapshot {
  unavailable: boolean;
  stations: PrintStationRecord[];
  jobs: PrintJobRecord[];
  error: string | null;
}

function schemaResult(error: { code?: string; message?: string }): { unavailable: boolean; message: string } {
  if (isMissingPrintSchema(error)) {
    return { unavailable: true, message: PRINT_SCHEMA_MISSING_MESSAGE };
  }
  return { unavailable: false, message: friendlyPrintError(error.message) };
}

export async function enqueuePrintJob(input: EnqueuePrintInput): Promise<EnqueuePrintResult> {
  const { data, error } = await supabase.rpc('enqueue_print_job', {
    p_event_id: input.eventId,
    p_event_passcode: input.eventPasscode,
    p_generated_image_id: input.generatedImageId,
    p_paper_size: input.paperSize,
    p_cut: input.cut,
    p_copies: input.copies,
    p_station_id: input.stationId ?? null,
  });

  if (error) {
    const mapped = schemaResult(error);
    return { ok: false, unavailable: mapped.unavailable, message: mapped.message, jobId: null };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const jobId = row && typeof row === 'object' && typeof (row as { id?: unknown }).id === 'string'
    ? (row as { id: string }).id
    : null;
  if (!jobId) {
    return { ok: false, unavailable: false, message: 'The printer did not accept this photo.', jobId: null };
  }
  return { ok: true, unavailable: false, message: 'Sent to printer', jobId };
}

/**
 * The station downloads an https URL. Prefer a URL that is already the composited
 * photo. Upload only when printing is on and that photo is not already in storage.
 */
export async function resolvePrintableImageUrl(input: {
  printEnabled: boolean;
  overlayApplied: boolean;
  compositedImage: string;
  existingHttpsUrl: string | null;
  cleanHttpsUrl: string | null;
  eventId: string;
}): Promise<string | null> {
  const source = choosePrintImageSource(input);
  if (source === 'skip') return null;
  if (source === 'existing' && isHttpsUrl(input.existingHttpsUrl)) return input.existingHttpsUrl;
  if (source === 'clean' && isHttpsUrl(input.cleanHttpsUrl)) return input.cleanHttpsUrl;
  const uploaded = await uploadGeneratedPhoto(input.compositedImage, input.eventId);
  return isHttpsUrl(uploaded.url) ? uploaded.url : null;
}

function firstRow(data: unknown): Record<string, unknown> | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return null;
  return row as Record<string, unknown>;
}

export async function createStationPairing(name: string, locationLabel: string): Promise<PairingTicket> {
  const { data, error } = await supabase.rpc('create_station_pairing', {
    p_name: name.trim(),
    p_location_label: locationLabel.trim() || null,
    p_expires_minutes: 30,
  });
  if (error) throw new Error(schemaResult(error).message);
  const row = firstRow(data);
  if (!row || typeof row.pairing_code !== 'string' || typeof row.station_id !== 'string') {
    throw new Error('The pairing code could not be created.');
  }
  return {
    stationId: row.station_id,
    code: row.pairing_code,
    expiresAt: typeof row.expires_at === 'string' ? row.expires_at : '',
  };
}

export async function refreshStationPairing(stationId: string): Promise<PairingTicket> {
  const { data, error } = await supabase.rpc('refresh_station_pairing', {
    p_station_id: stationId,
    p_expires_minutes: 30,
  });
  if (error) throw new Error(schemaResult(error).message);
  const row = firstRow(data);
  if (!row || typeof row.pairing_code !== 'string') {
    throw new Error('A new pairing code could not be created.');
  }
  return {
    stationId,
    code: row.pairing_code,
    expiresAt: typeof row.expires_at === 'string' ? row.expires_at : '',
  };
}

export async function unpairStation(stationId: string): Promise<void> {
  const { error } = await supabase.rpc('unpair_station', { p_station_id: stationId });
  if (error) throw new Error(schemaResult(error).message);
}

export async function setStationPausedByOwner(stationId: string, paused: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_station_paused_by_owner', {
    p_station_id: stationId,
    p_paused: paused,
  });
  if (error) throw new Error(schemaResult(error).message);
}

export async function retryPrintJob(jobId: string): Promise<void> {
  const { error } = await supabase.rpc('retry_print_job', { p_job_id: jobId });
  if (error) throw new Error(schemaResult(error).message);
}

export async function cancelPrintJob(jobId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_print_job', { p_job_id: jobId });
  if (error) throw new Error(schemaResult(error).message);
}

function mapStation(row: Record<string, unknown>): PrintStationRecord {
  return {
    id: String(row.id),
    name: String(row.name || 'Print station'),
    locationLabel: typeof row.location_label === 'string' ? row.location_label : null,
    eventId: typeof row.event_id === 'string' ? row.event_id : null,
    paused: row.paused === true,
    lastSeenAt: typeof row.last_seen_at === 'string' ? row.last_seen_at : null,
    printerName: typeof row.printer_name === 'string' ? row.printer_name : null,
    printerModel: typeof row.printer_model === 'string' ? row.printer_model : null,
    status: typeof row.status === 'string' ? row.status : 'unpaired',
    statusDetail: typeof row.status_detail === 'string' ? row.status_detail : null,
    printsRemaining: typeof row.prints_remaining === 'number' ? row.prints_remaining : null,
    appVersion: typeof row.app_version === 'string' ? row.app_version : null,
    pairedAt: typeof row.paired_at === 'string' ? row.paired_at : null,
  };
}

function mapJob(row: Record<string, unknown>): PrintJobRecord {
  return {
    id: String(row.id),
    eventId: typeof row.event_id === 'string' ? row.event_id : null,
    stationId: typeof row.station_id === 'string' ? row.station_id : null,
    paperSize: typeof row.paper_size === 'string' ? row.paper_size : '',
    cut: typeof row.cut === 'string' ? row.cut : 'none',
    copies: typeof row.copies === 'number' ? row.copies : 1,
    status: typeof row.status === 'string' ? row.status : 'queued',
    error: typeof row.error === 'string' ? row.error : null,
    attempts: typeof row.attempts === 'number' ? row.attempts : 0,
    maxAttempts: typeof row.max_attempts === 'number' ? row.max_attempts : 3,
    createdAt: typeof row.created_at === 'string' ? row.created_at : '',
    finishedAt: typeof row.finished_at === 'string' ? row.finished_at : null,
  };
}

export async function loadPrintAdmin(): Promise<PrintAdminSnapshot> {
  const stationsResult = await supabase
    .from('print_stations')
    .select('id, name, location_label, event_id, paused, last_seen_at, printer_name, printer_model, status, status_detail, prints_remaining, app_version, paired_at')
    .order('created_at', { ascending: false });

  if (stationsResult.error) {
    const mapped = schemaResult(stationsResult.error);
    return { unavailable: mapped.unavailable, stations: [], jobs: [], error: mapped.message };
  }

  const jobsResult = await supabase
    .from('print_jobs')
    .select('id, event_id, station_id, paper_size, cut, copies, status, error, attempts, max_attempts, created_at, finished_at')
    .order('created_at', { ascending: false })
    .limit(40);

  if (jobsResult.error) {
    const mapped = schemaResult(jobsResult.error);
    return {
      unavailable: mapped.unavailable,
      stations: (stationsResult.data || []).map((row) => mapStation(row as Record<string, unknown>)),
      jobs: [],
      error: mapped.message,
    };
  }

  return {
    unavailable: false,
    stations: (stationsResult.data || []).map((row) => mapStation(row as Record<string, unknown>)),
    jobs: (jobsResult.data || []).map((row) => mapJob(row as Record<string, unknown>)),
    error: null,
  };
}
