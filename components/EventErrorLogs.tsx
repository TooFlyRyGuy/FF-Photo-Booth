import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, TriangleAlert as AlertTriangle, Circle as XCircle, Wifi, Cloud, MessageSquare, CircleAlert as AlertCircle } from 'lucide-react';
import { getEventErrorLogs, EventErrorLog } from '../services/backendService';
import { Event } from '../types';

interface Props {
  events: Event[];
  isAdmin: boolean;
}

const ERROR_TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  gemini_generation: {
    label: 'AI Generation',
    icon: <AlertTriangle size={14} />,
    color: 'bg-red-100 text-red-700',
  },
  smugmug_upload: {
    label: 'SmugMug Upload',
    icon: <Cloud size={14} />,
    color: 'bg-orange-100 text-orange-700',
  },
  dropbox_upload: {
    label: 'Dropbox Upload',
    icon: <Cloud size={14} />,
    color: 'bg-blue-100 text-blue-700',
  },
  sms: {
    label: 'SMS',
    icon: <MessageSquare size={14} />,
    color: 'bg-yellow-100 text-yellow-700',
  },
  storage: {
    label: 'Storage',
    icon: <Wifi size={14} />,
    color: 'bg-purple-100 text-purple-700',
  },
};

const getTypeMeta = (type: string) =>
  ERROR_TYPE_META[type] ?? {
    label: type,
    icon: <AlertCircle size={14} />,
    color: 'bg-slate-100 text-slate-700',
  };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const EventErrorLogs: React.FC<Props> = ({ events, isAdmin }) => {
  const [logs, setLogs] = useState<EventErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getEventErrorLogs({ eventId: selectedEventId || undefined });
      setLogs(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load error logs');
    } finally {
      setLoading(false);
    }
  }, [selectedEventId]);

  useEffect(() => {
    load();
  }, [load]);

  const groupedEvents = isAdmin ? events : events;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-black">Error Logs</h2>
          <p className="text-slate-600 mt-1">
            Processing errors from the kiosk — AI generation, uploads, and delivery failures
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </header>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={selectedEventId}
          onChange={e => setSelectedEventId(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All events</option>
          {events.map(ev => (
            <option key={ev.id} value={ev.id}>{ev.name}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <XCircle size={16} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <AlertCircle size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No errors logged</p>
          <p className="text-sm mt-1">Errors from AI generation, uploads, and SMS will appear here</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-600 w-36">Time</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 w-32">Type</th>
                {isAdmin && (
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Event</th>
                )}
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Message</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 w-28">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map(log => {
                const meta = getTypeMeta(log.error_type);
                const hasContext = log.context && Object.keys(log.context).length > 0;
                const isExpanded = expandedId === log.id;
                return (
                  <React.Fragment key={log.id}>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
                          {meta.icon}
                          {meta.label}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-slate-700 font-medium">
                          {log.events?.name ?? <span className="text-slate-400 italic">Unknown</span>}
                        </td>
                      )}
                      <td className="px-4 py-3 text-slate-800 max-w-md">
                        <span className="line-clamp-2">{log.error_message}</span>
                      </td>
                      <td className="px-4 py-3">
                        {hasContext && (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : log.id)}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                          >
                            {isExpanded ? 'Hide' : 'View'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && hasContext && (
                      <tr className="bg-slate-50">
                        <td colSpan={isAdmin ? 5 : 4} className="px-4 py-3">
                          <pre className="text-xs text-slate-600 bg-white border border-slate-200 rounded p-3 overflow-auto max-h-40">
                            {JSON.stringify(log.context, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
            Showing {logs.length} most recent error{logs.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
};

export default EventErrorLogs;
