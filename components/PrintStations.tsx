import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Pause, Play, Printer, RefreshCw, Search, X } from 'lucide-react';
import { Event } from '../types';
import { formatLastSeen, stationPresence, STATION_QUIET_MS } from '../lib/printStation';
import {
  PairingTicket,
  PrintJobRecord,
  PrintStationRecord,
  cancelPrintJob,
  createStationPairing,
  loadPrintAdmin,
  refreshStationPairing,
  retryPrintJob,
  setStationPausedByOwner,
  unpairStation,
} from '../services/printStationService';

interface PrintStationsProps {
  events: Event[];
}

type StatusKey = 'all' | 'online' | 'offline' | 'paused' | 'error' | 'unpaired';
type SortKey = 'name' | 'status' | 'heartbeat' | 'event' | 'newest';

const STATION_PAGE_SIZE = 25;
const COMPACT_THRESHOLD = 10;

const STATUS_LABELS: Record<Exclude<StatusKey, 'all'>, string> = {
  online: 'Online',
  offline: 'Offline',
  paused: 'Paused',
  error: 'Printer error',
  unpaired: 'Unpaired',
};

const STATUS_DOT_COLORS: Record<Exclude<StatusKey, 'all'>, string> = {
  online: 'bg-green-600',
  offline: 'bg-slate-400',
  paused: 'bg-amber-500',
  error: 'bg-red-500',
  unpaired: 'bg-slate-300',
};

function stationStatusKey(station: PrintStationRecord, now = Date.now()): Exclude<StatusKey, 'all'> {
  const status = (station.status || '').toLowerCase();
  if (status === 'unpaired' || status === '') return 'unpaired';
  if (station.paused || status === 'paused') return 'paused';
  const seen = station.lastSeenAt ? new Date(station.lastSeenAt).getTime() : NaN;
  const quiet = !station.lastSeenAt || Number.isNaN(seen) || now - seen > STATION_QUIET_MS;
  if (quiet) return 'offline';
  if (status === 'error') return 'error';
  return 'online';
}

const PrintStations: React.FC<PrintStationsProps> = ({ events }) => {
  const [stations, setStations] = useState<PrintStationRecord[]>([]);
  const [jobs, setJobs] = useState<PrintJobRecord[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [ticket, setTicket] = useState<PairingTicket | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Station list controls
  const [stationSearch, setStationSearch] = useState('');
  const [stationStatusFilter, setStationStatusFilter] = useState<StatusKey>('all');
  const [stationEventFilter, setStationEventFilter] = useState<string>('all');
  const [stationSort, setStationSort] = useState<SortKey>('name');
  const [stationPage, setStationPage] = useState(0);

  // Recent jobs controls
  const [jobStationFilter, setJobStationFilter] = useState<string>('all');

  const eventName = (eventId: string | null) => {
    if (!eventId) return 'No event selected';
    return events.find((event) => event.id === eventId)?.name || 'Event not in this list';
  };

  const stationNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of stations) map.set(s.id, s.name);
    return map;
  }, [stations]);

  const stationName = (stationId: string | null) => {
    if (!stationId) return 'Unassigned';
    return stationNameMap.get(stationId) || 'Unknown station';
  };

  const load = useCallback(async () => {
    const snapshot = await loadPrintAdmin();
    setStations(snapshot.stations);
    setJobs(snapshot.jobs);
    setUnavailable(snapshot.unavailable);
    setError(snapshot.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { void load(); }, 20000);
    return () => window.clearInterval(timer);
  }, [load]);

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That print station action failed.');
    } finally {
      setBusy(null);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      setError('Select the code and copy it. The clipboard is not available.');
    }
  };

  // ---- Station list filtering / sorting ----

  const statusCounts = useMemo(() => {
    const counts: Record<Exclude<StatusKey, 'all'>, number> = {
      online: 0, offline: 0, paused: 0, error: 0, unpaired: 0,
    };
    for (const s of stations) counts[stationStatusKey(s)]++;
    return counts;
  }, [stations]);

  const filteredStations = useMemo(() => {
    let result = stations;

    if (stationSearch.trim()) {
      const q = stationSearch.trim().toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.locationLabel || '').toLowerCase().includes(q),
      );
    }

    if (stationStatusFilter !== 'all') {
      result = result.filter((s) => stationStatusKey(s) === stationStatusFilter);
    }

    if (stationEventFilter !== 'all') {
      result = result.filter((s) => s.eventId === stationEventFilter);
    }

    const sorted = [...result];
    switch (stationSort) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'status':
        sorted.sort((a, b) => stationStatusKey(a).localeCompare(stationStatusKey(b)) || a.name.localeCompare(b.name));
        break;
      case 'heartbeat':
        sorted.sort((a, b) => {
          const aT = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
          const bT = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
          return bT - aT;
        });
        break;
      case 'event':
        sorted.sort((a, b) => eventName(a.eventId).localeCompare(eventName(b.eventId)) || a.name.localeCompare(b.name));
        break;
      case 'newest':
        sorted.sort((a, b) => {
          const aT = a.pairedAt ? new Date(a.pairedAt).getTime() : 0;
          const bT = b.pairedAt ? new Date(b.pairedAt).getTime() : 0;
          return bT - aT;
        });
        break;
    }
    return sorted;
  }, [stations, stationSearch, stationStatusFilter, stationEventFilter, stationSort]);

  const useCompactTable = stations.length >= COMPACT_THRESHOLD;
  const totalPages = Math.max(1, Math.ceil(filteredStations.length / STATION_PAGE_SIZE));
  const currentPage = Math.min(stationPage, totalPages - 1);
  const pagedStations = useCompactTable
    ? filteredStations.slice(currentPage * STATION_PAGE_SIZE, (currentPage + 1) * STATION_PAGE_SIZE)
    : filteredStations;

  const filtersActive =
    stationSearch.trim() !== '' ||
    stationStatusFilter !== 'all' ||
    stationEventFilter !== 'all' ||
    stationSort !== 'name';

  const clearStationFilters = () => {
    setStationSearch('');
    setStationStatusFilter('all');
    setStationEventFilter('all');
    setStationSort('name');
    setStationPage(0);
  };

  // ---- Recent jobs filtering ----

  const filteredJobs = useMemo(() => {
    if (jobStationFilter === 'all') return jobs;
    if (jobStationFilter === 'unassigned') return jobs.filter((j) => !j.stationId);
    return jobs.filter((j) => j.stationId === jobStationFilter);
  }, [jobs, jobStationFilter]);

  // ---- Shared action buttons ----

  const renderStationActions = (station: PrintStationRecord) => (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={busy === station.id}
        onClick={() => {
          void run(station.id, async () => {
            setTicket(await refreshStationPairing(station.id));
          });
        }}
        className="px-3 py-2 text-sm border-2 border-slate-300 rounded-lg text-slate-800"
      >
        New code
      </button>
      <button
        type="button"
        disabled={busy === station.id}
        onClick={() => {
          void run(station.id, () => setStationPausedByOwner(station.id, !station.paused));
        }}
        className="px-3 py-2 text-sm border-2 border-slate-300 rounded-lg text-slate-800 inline-flex items-center gap-1"
      >
        {station.paused ? <Play size={14} /> : <Pause size={14} />}
        {station.paused ? 'Resume' : 'Pause'}
      </button>
      <button
        type="button"
        disabled={busy === station.id}
        onClick={() => {
          if (!window.confirm(`Unpair ${station.name}? The PC will stop seeing jobs until it is paired again.`)) return;
          void run(station.id, () => unpairStation(station.id));
        }}
        className="px-3 py-2 text-sm border-2 border-red-200 rounded-lg text-red-700"
      >
        Unpair
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-bold text-black">Print Stations</h2>
        <p className="text-slate-600 mt-2">
          Pair a Windows PC once to this account. The person at that PC chooses the event. A station only prints jobs for the event it has selected.
        </p>
      </header>

      {error && (
        <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg text-red-800 text-sm">{error}</div>
      )}

      <section className="bg-white p-6 rounded-xl border-2 border-slate-300 space-y-4">
        <h3 className="text-lg font-bold text-black flex items-center gap-2">
          <Printer size={18} /> New pairing code
        </h3>
        <p className="text-sm text-slate-600">
          The code is shown once and expires in 30 minutes. It pairs the PC to this account, not to one event.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block text-sm font-medium text-slate-700">
            Station name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Front desk"
              className="mt-1 w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-4 py-2 text-black focus:ring-2 focus:ring-green-700 focus:outline-none"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Location
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Optional"
              className="mt-1 w-full bg-slate-50 border-2 border-slate-300 rounded-lg px-4 py-2 text-black focus:ring-2 focus:ring-green-700 focus:outline-none"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={unavailable || busy === 'create' || name.trim() === ''}
          onClick={() => {
            void run('create', async () => {
              const created = await createStationPairing(name, location);
              setTicket(created);
              setName('');
              setLocation('');
            });
          }}
          className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white px-4 py-2 rounded-md font-medium text-sm"
        >
          {busy === 'create' ? 'Creating...' : 'Generate pairing code'}
        </button>
        {ticket && (
          <div className="border-2 border-green-700 bg-green-50 rounded-lg p-4">
            <p className="text-sm font-medium text-green-900">Give this code to the print station. It will not be shown again.</p>
            <div className="mt-2 flex items-center gap-3">
              <p className="text-3xl font-mono font-bold tracking-widest text-black">{ticket.code}</p>
              <button
                type="button"
                onClick={() => { void copyCode(ticket.code); }}
                className="inline-flex items-center gap-1 text-sm font-medium text-green-800"
              >
                <Copy size={16} /> Copy
              </button>
            </div>
            {ticket.expiresAt && (
              <p className="text-xs text-slate-600 mt-2">Expires {new Date(ticket.expiresAt).toLocaleString()}</p>
            )}
          </div>
        )}
      </section>

      {/* ---- Station list ---- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-black">Stations</h3>
          <button
            type="button"
            onClick={() => { void load(); }}
            className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Summary bar */}
        {!loading && stations.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 bg-white border-2 border-slate-200 rounded-lg px-4 py-2">
            <span className="text-sm font-bold text-black">{stations.length} total</span>
            <span className="text-slate-300">|</span>
            {(Object.keys(STATUS_LABELS) as Exclude<StatusKey, 'all'>[]).map((key) => {
              const count = statusCounts[key];
              if (count === 0) return null;
              const active = stationStatusFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStationStatusFilter(active ? 'all' : key)}
                  className={`inline-flex items-center gap-1.5 text-sm rounded-md px-2 py-1 transition-colors ${
                    active ? 'bg-slate-200 text-black font-medium' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className={`inline-block w-2 h-2 rounded-full ${STATUS_DOT_COLORS[key]}`} />
                  {STATUS_LABELS[key]} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Search / filter / sort controls */}
        {!loading && stations.length > 0 && (
          <div className="flex flex-col md:flex-row md:items-end gap-3 bg-white border-2 border-slate-200 rounded-lg px-4 py-3">
            <label className="block text-sm flex-1">
              <span className="font-medium text-slate-700">Search</span>
              <div className="relative mt-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={stationSearch}
                  onChange={(e) => { setStationSearch(e.target.value); setStationPage(0); }}
                  placeholder="Name or location..."
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm text-black focus:ring-2 focus:ring-green-700 focus:outline-none"
                />
              </div>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Status</span>
              <select
                value={stationStatusFilter}
                onChange={(e) => { setStationStatusFilter(e.target.value as StatusKey); setStationPage(0); }}
                className="mt-1 bg-slate-50 border-2 border-slate-300 rounded-lg px-3 py-2 text-sm text-black focus:ring-2 focus:ring-green-700 focus:outline-none"
              >
                <option value="all">All statuses</option>
                {(Object.keys(STATUS_LABELS) as Exclude<StatusKey, 'all'>[]).map((key) => (
                  <option key={key} value={key}>{STATUS_LABELS[key]}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Event</span>
              <select
                value={stationEventFilter}
                onChange={(e) => { setStationEventFilter(e.target.value); setStationPage(0); }}
                className="mt-1 bg-slate-50 border-2 border-slate-300 rounded-lg px-3 py-2 text-sm text-black focus:ring-2 focus:ring-green-700 focus:outline-none"
              >
                <option value="all">All events</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Sort by</span>
              <select
                value={stationSort}
                onChange={(e) => { setStationSort(e.target.value as SortKey); setStationPage(0); }}
                className="mt-1 bg-slate-50 border-2 border-slate-300 rounded-lg px-3 py-2 text-sm text-black focus:ring-2 focus:ring-green-700 focus:outline-none"
              >
                <option value="name">Name (A-Z)</option>
                <option value="status">Status</option>
                <option value="heartbeat">Last heartbeat</option>
                <option value="event">Event</option>
                <option value="newest">Newest first</option>
              </select>
            </label>
            {filtersActive && (
              <button
                type="button"
                onClick={clearStationFilters}
                className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 border-2 border-slate-200 rounded-lg px-3 py-2"
              >
                <X size={14} /> Clear
              </button>
            )}
          </div>
        )}

        {loading && <p className="text-sm text-slate-500">Loading stations...</p>}
        {!loading && stations.length === 0 && (
          <p className="text-sm text-slate-500">No print stations yet.</p>
        )}
        {!loading && stations.length > 0 && filteredStations.length === 0 && (
          <div className="bg-white border-2 border-slate-200 rounded-lg p-8 text-center">
            <p className="text-sm text-slate-500 mb-3">No stations match your search or filters.</p>
            <button
              type="button"
              onClick={clearStationFilters}
              className="text-sm text-green-800 font-medium"
            >
              Clear all filters
            </button>
          </div>
        )}

        {/* Compact table for 10+ stations */}
        {!loading && useCompactTable && filteredStations.length > 0 && (
          <div className="space-y-3">
            <div className="overflow-x-auto bg-white border-2 border-slate-200 rounded-lg">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-200 bg-slate-50">
                    <th className="py-2 px-3 font-medium">Station</th>
                    <th className="py-2 px-3 font-medium">Location</th>
                    <th className="py-2 px-3 font-medium">Status</th>
                    <th className="py-2 px-3 font-medium">Last seen</th>
                    <th className="py-2 px-3 font-medium">Event</th>
                    <th className="py-2 px-3 font-medium">Printer</th>
                    <th className="py-2 px-3 font-medium">Prints</th>
                    <th className="py-2 px-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedStations.map((station) => {
                    const presence = stationPresence(station);
                    const key = stationStatusKey(station);
                    return (
                      <tr key={station.id} className="border-b border-slate-100 align-top">
                        <td className="py-2 px-3 font-medium text-black">{station.name}</td>
                        <td className="py-2 px-3 text-slate-600">{station.locationLabel || '—'}</td>
                        <td className="py-2 px-3">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`inline-block w-2 h-2 rounded-full ${STATUS_DOT_COLORS[key]}`} />
                            <span className="text-slate-800">{presence.label}</span>
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{formatLastSeen(station.lastSeenAt)}</td>
                        <td className="py-2 px-3 text-slate-700">{eventName(station.eventId)}</td>
                        <td className="py-2 px-3 text-slate-700">
                          {station.printerModel || 'Unknown'}
                          {station.printerName ? ` (${station.printerName})` : ''}
                        </td>
                        <td className="py-2 px-3 text-slate-700">
                          {station.printsRemaining !== null ? station.printsRemaining : '—'}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              disabled={busy === station.id}
                              onClick={() => {
                                void run(station.id, async () => {
                                  setTicket(await refreshStationPairing(station.id));
                                });
                              }}
                              className="px-2 py-1 text-xs border border-slate-300 rounded text-slate-800"
                            >
                              New code
                            </button>
                            <button
                              type="button"
                              disabled={busy === station.id}
                              onClick={() => {
                                void run(station.id, () => setStationPausedByOwner(station.id, !station.paused));
                              }}
                              className="px-2 py-1 text-xs border border-slate-300 rounded text-slate-800 inline-flex items-center gap-1"
                            >
                              {station.paused ? <Play size={12} /> : <Pause size={12} />}
                              {station.paused ? 'Resume' : 'Pause'}
                            </button>
                            <button
                              type="button"
                              disabled={busy === station.id}
                              onClick={() => {
                                if (!window.confirm(`Unpair ${station.name}? The PC will stop seeing jobs until it is paired again.`)) return;
                                void run(station.id, () => unpairStation(station.id));
                              }}
                              className="px-2 py-1 text-xs border border-red-200 rounded text-red-700"
                            >
                              Unpair
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  {currentPage * STATION_PAGE_SIZE + 1}–{Math.min((currentPage + 1) * STATION_PAGE_SIZE, filteredStations.length)} of {filteredStations.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage === 0}
                    onClick={() => setStationPage((p) => Math.max(0, p - 1))}
                    className="px-3 py-1.5 border-2 border-slate-300 rounded-lg text-slate-800 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span className="text-slate-600">Page {currentPage + 1} / {totalPages}</span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages - 1}
                    onClick={() => setStationPage((p) => Math.min(totalPages - 1, p + 1))}
                    className="px-3 py-1.5 border-2 border-slate-300 rounded-lg text-slate-800 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Card layout for under 10 stations */}
        {!loading && !useCompactTable && filteredStations.length > 0 && (
          pagedStations.map((station) => {
            const presence = stationPresence(station);
            return (
              <article key={station.id} className="bg-white p-4 rounded-xl border-2 border-slate-300">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-black">{station.name}</h4>
                    <p className="text-sm text-slate-600">{station.locationLabel || 'No location'}</p>
                    <p className="text-sm mt-2">
                      <span className={presence.online ? 'text-green-800 font-medium' : 'text-slate-700 font-medium'}>
                        {presence.label}
                      </span>
                      <span className="text-slate-500"> · last seen {formatLastSeen(station.lastSeenAt)}</span>
                    </p>
                    <p className="text-sm text-slate-700 mt-1">Event: {eventName(station.eventId)}</p>
                    <p className="text-sm text-slate-700">
                      Printer: {station.printerModel || 'Unknown model'}
                      {station.printerName ? ` (${station.printerName})` : ''}
                      {station.statusDetail ? ` · ${station.statusDetail}` : ''}
                      {station.printsRemaining !== null ? ` · ${station.printsRemaining} prints remaining` : ''}
                    </p>
                    {station.appVersion && (
                      <p className="text-xs text-slate-500 mt-1">App {station.appVersion}</p>
                    )}
                  </div>
                  {renderStationActions(station)}
                </div>
              </article>
            );
          })
        )}
      </section>

      {/* ---- Recent jobs ---- */}
      <section className="bg-white p-4 rounded-xl border-2 border-slate-300">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
          <h3 className="text-lg font-bold text-black">Recent jobs</h3>
          {jobs.length > 0 && (
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Station</span>
              <select
                value={jobStationFilter}
                onChange={(e) => setJobStationFilter(e.target.value)}
                className="ml-2 bg-slate-50 border-2 border-slate-300 rounded-lg px-3 py-1.5 text-sm text-black focus:ring-2 focus:ring-green-700 focus:outline-none"
              >
                <option value="all">All stations</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
                <option value="unassigned">Unassigned</option>
              </select>
            </label>
          )}
        </div>

        {jobs.length === 0 ? (
          <p className="text-sm text-slate-500">No print jobs yet.</p>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-slate-500 mb-2">No jobs match this station filter.</p>
            <button
              type="button"
              onClick={() => setJobStationFilter('all')}
              className="text-sm text-green-800 font-medium"
            >
              Show all jobs
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Station</th>
                  <th className="py-2 pr-3 font-medium">Event</th>
                  <th className="py-2 pr-3 font-medium">Size</th>
                  <th className="py-2 pr-3 font-medium">Copies</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => {
                  const sName = stationName(job.stationId);
                  const stationClickable = !!job.stationId && stationNameMap.has(job.stationId);
                  return (
                    <tr key={job.id} className="border-b border-slate-100 align-top">
                      <td className="py-2 pr-3 text-slate-700 whitespace-nowrap">{job.createdAt ? new Date(job.createdAt).toLocaleString() : ''}</td>
                      <td className="py-2 pr-3">
                        {stationClickable ? (
                          <button
                            type="button"
                            onClick={() => setJobStationFilter(job.stationId!)}
                            className="text-slate-800 font-medium hover:text-green-800 hover:underline"
                          >
                            {sName}
                          </button>
                        ) : (
                          <span className={job.stationId ? 'text-slate-500 italic' : 'text-slate-500'}>{sName}</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-slate-800">{eventName(job.eventId)}</td>
                      <td className="py-2 pr-3 text-slate-800">{job.paperSize}{job.cut === '2inch' ? ' strips' : ''}</td>
                      <td className="py-2 pr-3 text-slate-800">{job.copies}</td>
                      <td className="py-2 pr-3">
                        <span className="capitalize text-slate-900">{job.status}</span>
                        {job.error && <p className="text-xs text-red-700">{job.error}</p>}
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        {job.status === 'failed' && (
                          <button
                            type="button"
                            disabled={busy === job.id}
                            onClick={() => { void run(job.id, () => retryPrintJob(job.id)); }}
                            className="mr-2 text-green-800 font-medium"
                          >
                            Retry
                          </button>
                        )}
                        {(job.status === 'failed' || job.status === 'queued') && (
                          <button
                            type="button"
                            disabled={busy === job.id}
                            onClick={() => { void run(job.id, () => cancelPrintJob(job.id)); }}
                            className="text-red-700 font-medium"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default PrintStations;
