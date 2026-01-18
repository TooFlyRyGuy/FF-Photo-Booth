import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Camera, TrendingUp, Image as ImageIcon } from 'lucide-react';
import { getEventAnalytics, EventAnalytics as Analytics, getEventChartData, ChartDataPoint } from '../services/backendService';

interface EventAnalyticsProps {
  eventId: string;
  eventName: string;
}

const COLORS = ['#15803d', '#166534', '#14532d', '#16a34a', '#22c55e', '#4ade80', '#86efac'];

const EventAnalytics: React.FC<EventAnalyticsProps> = ({ eventId, eventName }) => {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [dateChartData, setDateChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAnalytics();
  }, [eventId]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const [analyticsData, chartDataResult] = await Promise.all([
        getEventAnalytics(eventId),
        getEventChartData(eventId)
      ]);
      setAnalytics(analyticsData);
      setDateChartData(chartDataResult);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
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

  if (!analytics) {
    return null;
  }

  const chartData = analytics.promptStats.map((stat) => ({
    name: stat.promptName,
    count: stat.count,
    percentage: stat.percentage,
  }));

  return (
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
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '2px solid #cbd5e1',
                  borderRadius: '8px',
                }}
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
                <XAxis
                  dataKey="name"
                  stroke="#475569"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  interval={0}
                />
                <YAxis stroke="#475569" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '2px solid #cbd5e1',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#0f172a' }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-slate-900 mb-4">Detailed Breakdown</h4>
            {analytics.promptStats.map((stat, index) => (
              <div
                key={stat.promptId}
                className="bg-slate-50 rounded-lg p-4 border-2 border-slate-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="font-medium text-slate-900">{stat.promptName}</span>
                  </div>
                  <span className="text-slate-600">
                    {stat.count} {stat.count === 1 ? 'photo' : 'photos'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${stat.percentage}%`,
                        backgroundColor: COLORS[index % COLORS.length],
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium text-slate-700 w-12 text-right">
                    {stat.percentage}%
                  </span>
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
          <p className="text-slate-600">
            Analytics will appear here once guests start taking photos at this event.
          </p>
        </div>
      )}
    </div>
  );
};

export default EventAnalytics;
