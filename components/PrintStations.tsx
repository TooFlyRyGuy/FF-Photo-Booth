import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Pause, Play, Printer, RefreshCw } from 'lucide-react';
import { Event } from '../types';
import { formatLastSeen, stationPresence } from '../lib/printStation';
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

  const eventName = (eventId: string | null) => {
    if (!eventId) return 'No event selected';
    return events.find((event) => event.id === eventId)?.name || 'Event not in this list';
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
        {loading && <p className="text-sm text-slate-500">Loading stations...</p>}
        {!loading && stations.length === 0 && (
          <p className="text-sm text-slate-500">No print stations yet.</p>
        )}
        {stations.map((station) => {
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
              </div>
            </article>
          );
        })}
      </section>

      <section className="bg-white p-4 rounded-xl border-2 border-slate-300">
        <h3 className="text-lg font-bold text-black mb-3">Recent jobs</h3>
        {jobs.length === 0 ? (
          <p className="text-sm text-slate-500">No print jobs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Event</th>
                  <th className="py-2 pr-3 font-medium">Size</th>
                  <th className="py-2 pr-3 font-medium">Copies</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3 text-slate-700">{job.createdAt ? new Date(job.createdAt).toLocaleString() : ''}</td>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default PrintStations;
