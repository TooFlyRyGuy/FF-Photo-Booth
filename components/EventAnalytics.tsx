import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Camera, TrendingUp, Image as ImageIcon, Phone, Download, MessageSquare, CircleCheck as CheckCircle, Circle as XCircle, Clock } from 'lucide-react';
import { getEventAnalytics, EventAnalytics as Analytics, getEventChartData, ChartDataPoint, getEventPhoneNumbers, EventPhoneEntry } from '../services/backendService';

interface EventAnalyticsProps {
  eventId: string;
  eventName: string;
}

const COLORS = ['#15803d', '#166534', '#14532d', '#16a34a', '#22c55e', '#4ade80', '#86efac'];

type ReportTab = 'overview' | 'phones';

const EventAnalytics: React.FC<EventAnalyticsProps> = ({ eventId, eventName }) => {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [dateChartData, setDateChartData] = useState<ChartDataPoint[]>([]);
  const [phoneEntries, setPhoneEntries] = useState<EventPhoneEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');

  useEffect(() => {
    loadAnalytics();
  }, [eventId]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const [analyticsData, chartDataResult, phoneData] = await Promise.all([
        getEventAnalytics(eventId),
        getEventChartData(eventId),
        getEventPhoneNumbers(eventId),
      ]);
      setAnalytics(analyticsData);
      setDateChartData(chartDataResult);
      setPhoneEntries(phoneData);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const exportPhonesCsv = () => {
    const uniquePhones = dedupePhones(phoneEntries);
    const header = 'Phone Number,Times Sent,Last Sent,Status\n';
    const rows = uniquePhones
      .map(e => `"${e.phoneNumber}","${e.count}","${formatDate(e.lastSent)}","${e.lastStatus}"`)
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${eventName.replace(/[^a-z0-9]/gi, '_')}_phone_numbers.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPhonesPlaintext = () => {
    const uniquePhones = dedupePhones(phoneEntries);
    const text = uniquePhones.map(e => e.phoneNumber).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${eventName.replace(/[^a-z0-9]/gi, '_')}_phone_numbers.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 text-red-800">
        <p>{error}</p>
      </div>
    );
  }

  if (!analytics) return null;

  const chartData = analytics.promptStats.map((stat) => ({
    name: stat.promptName,
    count: stat.count,
    percentage: stat.percentage,
  }));

  const uniquePhones = dedupePhones(phoneEntries);
  const deliveredCount = phoneEntries.filter(e => e.status === 'delivered' || e.status === 'sent').length;
  const failedCount = phoneEntries.filter(e => e.status === 'failed').length;

  return (
    <div className="space-y-6">
      {/* Tab Nav */}
      <div className="flex border-b-2 border-slate-200">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-[2px] ${
            activeTab === 'overview'
              ? 'border-green-700 text-green-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('phones')}
          className={`px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-[2px] flex items-center gap-2 ${
            activeTab === 'phones'
              ? 'border-green-700 text-green-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Phone size={14} />
          Phone Numbers
          {phoneEntries.length > 0 && (
            <span className="bg-green-700 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
              {uniquePhones.length}
            </span>
          )}
        </button>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border-2 border-slate-300 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Total Photos</p>
                  <p className="text-4xl font-bold text-slate-900">{analytics.totalPhotos}</p>
                </div>
                <div className="bg-green-100 p-4 rounded-lg">
                  <Camera className="text-green-700" size={32} />
                </div>
              </div>
            </div>

            <div className="bg-white border-2 border-slate-300 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">AI Themes Used</p>
                  <p className="text-4xl font-bold text-slate-900">{analytics.promptStats.length}</p>
                </div>
                <div className="bg-green-100 p-4 rounded-lg">
                  <ImageIcon className="text-green-700" size={32} />
                </div>
              </div>
            </div>

            <div className="bg-white border-2 border-slate-300 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Most Popular</p>
                  <p className="text-2xl font-bold text-slate-900 truncate">
                    {analytics.promptStats[0]?.promptName || 'N/A'}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">
                    {analytics.promptStats[0]?.count || 0} photos
                  </p>
                </div>
                <div className="bg-green-100 p-4 rounded-lg">
                  <TrendingUp className="text-green-700" size={32} />
                </div>
              </div>
            </div>
          </div>

          {dateChartData.length > 0 && (
            <div className="bg-white rounded-xl border-2 border-slate-300 p-6">
              <h3 className="text-xl font-bold text-slate-900 mb-6">Generation Activity (Last 30 Days)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dateChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                  <XAxis dataKey="date" stroke="#475569" />
                  <YAxis stroke="#475569" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', border: '2px solid #cbd5e1', borderRadius: '8px' }}
                    labelStyle={{ color: '#0f172a' }}
                  />
                  <Bar dataKey="generations" fill="#15803d" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {analytics.promptStats.length > 0 && (
            <div className="bg-white rounded-xl border-2 border-slate-300 p-6">
              <h3 className="text-xl font-bold text-slate-900 mb-6">AI Theme Popularity</h3>

              <div className="mb-8">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                    <XAxis dataKey="name" stroke="#475569" angle={-45} textAnchor="end" height={100} interval={0} />
                    <YAxis stroke="#475569" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', border: '2px solid #cbd5e1', borderRadius: '8px' }}
                      labelStyle={{ color: '#0f172a' }}
                    />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                      {chartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                <h4 className="text-lg font-semibold text-slate-900 mb-4">Detailed Breakdown</h4>
                {analytics.promptStats.map((stat, index) => (
                  <div key={stat.promptId} className="bg-slate-50 rounded-lg p-4 border-2 border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="font-medium text-slate-900">{stat.promptName}</span>
                      </div>
                      <span className="text-slate-600">{stat.count} {stat.count === 1 ? 'photo' : 'photos'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${stat.percentage}%`, backgroundColor: COLORS[index % COLORS.length] }}
                        />
                      </div>
                      <span className="text-sm font-medium text-slate-700 w-12 text-right">{stat.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analytics.promptStats.length === 0 && (
            <div className="bg-white rounded-xl border-2 border-slate-300 p-12 text-center">
              <Camera className="mx-auto mb-4 text-slate-400" size={48} />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No Photos Yet</h3>
              <p className="text-slate-600">Analytics will appear here once guests start taking photos at this event.</p>
            </div>
          )}
        </div>
      )}

      {/* PHONE NUMBERS TAB */}
      {activeTab === 'phones' && (
        <div className="space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border-2 border-slate-300 rounded-xl p-5 flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-lg">
                <Phone className="text-green-700" size={24} />
              </div>
              <div>
                <p className="text-sm text-slate-500">Unique Numbers</p>
                <p className="text-3xl font-bold text-slate-900">{uniquePhones.length}</p>
              </div>
            </div>
            <div className="bg-white border-2 border-slate-300 rounded-xl p-5 flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-lg">
                <MessageSquare className="text-green-700" size={24} />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total SMS Sent</p>
                <p className="text-3xl font-bold text-slate-900">{phoneEntries.length}</p>
              </div>
            </div>
            <div className="bg-white border-2 border-slate-300 rounded-xl p-5 flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-lg">
                <CheckCircle className="text-green-700" size={24} />
              </div>
              <div>
                <p className="text-sm text-slate-500">Delivered / Failed</p>
                <p className="text-3xl font-bold text-slate-900">
                  {deliveredCount}
                  {failedCount > 0 && <span className="text-lg text-red-500 ml-1">/ {failedCount}</span>}
                </p>
              </div>
            </div>
          </div>

          {uniquePhones.length > 0 ? (
            <div className="bg-white border-2 border-slate-300 rounded-xl overflow-hidden">
              {/* Table header */}
              <div className="flex items-center justify-between px-6 py-4 border-b-2 border-slate-200">
                <h3 className="text-lg font-bold text-slate-900">
                  Phone Numbers ({uniquePhones.length})
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportPhonesPlaintext}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border-2 border-slate-300 rounded-lg hover:border-slate-400 hover:text-slate-800 transition-colors"
                  >
                    <Download size={14} />
                    .txt
                  </button>
                  <button
                    onClick={exportPhonesCsv}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg transition-colors"
                  >
                    <Download size={14} />
                    Export CSV
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-left">
                      <th className="px-6 py-3 font-semibold text-slate-600">#</th>
                      <th className="px-6 py-3 font-semibold text-slate-600">Phone Number</th>
                      <th className="px-6 py-3 font-semibold text-slate-600">SMS Sent</th>
                      <th className="px-6 py-3 font-semibold text-slate-600">Last Sent</th>
                      <th className="px-6 py-3 font-semibold text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {uniquePhones.map((entry, index) => (
                      <tr key={entry.phoneNumber} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3 text-slate-400 font-mono text-xs">{index + 1}</td>
                        <td className="px-6 py-3 font-mono font-medium text-slate-900">{entry.phoneNumber}</td>
                        <td className="px-6 py-3 text-slate-600">{entry.count}</td>
                        <td className="px-6 py-3 text-slate-500">{formatDate(entry.lastSent)}</td>
                        <td className="px-6 py-3">
                          <StatusBadge status={entry.lastStatus} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border-2 border-slate-300 p-12 text-center">
              <Phone className="mx-auto mb-4 text-slate-400" size={48} />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No Phone Numbers Yet</h3>
              <p className="text-slate-600">
                Phone numbers will appear here once guests send SMS messages during this event.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface DeduplicatedPhone {
  phoneNumber: string;
  count: number;
  lastSent: string;
  lastStatus: string;
}

function dedupePhones(entries: EventPhoneEntry[]): DeduplicatedPhone[] {
  const map = new Map<string, DeduplicatedPhone>();
  for (const entry of entries) {
    const existing = map.get(entry.phoneNumber);
    if (!existing) {
      map.set(entry.phoneNumber, { phoneNumber: entry.phoneNumber, count: 1, lastSent: entry.sentAt, lastStatus: entry.status });
    } else {
      existing.count++;
      if (entry.sentAt > existing.lastSent) {
        existing.lastSent = entry.sentAt;
        existing.lastStatus = entry.status;
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.lastSent.localeCompare(a.lastSent));
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'delivered':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
          <CheckCircle size={10} /> Delivered
        </span>
      );
    case 'sent':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-0.5">
          <CheckCircle size={10} /> Sent
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5">
          <XCircle size={10} /> Failed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-0.5">
          <Clock size={10} /> {status || 'Queued'}
        </span>
      );
  }
}

export default EventAnalytics;
