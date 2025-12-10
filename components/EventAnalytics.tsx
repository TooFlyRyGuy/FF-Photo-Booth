import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Camera, TrendingUp, Image as ImageIcon } from 'lucide-react';
import { getEventAnalytics, EventAnalytics as Analytics } from '../services/backendService';

interface EventAnalyticsProps {
  eventId: string;
  eventName: string;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1'];

const EventAnalytics: React.FC<EventAnalyticsProps> = ({ eventId, eventName }) => {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAnalytics();
  }, [eventId]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getEventAnalytics(eventId);
      setAnalytics(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 text-red-400">
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
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400 mb-1">Total Photos</p>
              <p className="text-4xl font-bold text-white">{analytics.totalPhotos}</p>
            </div>
            <div className="bg-blue-500/20 p-4 rounded-lg">
              <Camera className="text-blue-400" size={32} />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400 mb-1">AI Themes Used</p>
              <p className="text-4xl font-bold text-white">{analytics.promptStats.length}</p>
            </div>
            <div className="bg-purple-500/20 p-4 rounded-lg">
              <ImageIcon className="text-purple-400" size={32} />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-pink-500/20 to-pink-600/20 border border-pink-500/30 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400 mb-1">Most Popular</p>
              <p className="text-2xl font-bold text-white truncate">
                {analytics.promptStats[0]?.promptName || 'N/A'}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {analytics.promptStats[0]?.count || 0} photos
              </p>
            </div>
            <div className="bg-pink-500/20 p-4 rounded-lg">
              <TrendingUp className="text-pink-400" size={32} />
            </div>
          </div>
        </div>
      </div>

      {analytics.promptStats.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-xl font-bold mb-6">AI Theme Popularity</h3>

          <div className="mb-8">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="name"
                  stroke="#9ca3af"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  interval={0}
                />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#f1f5f9' }}
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
            <h4 className="text-lg font-semibold mb-4">Detailed Breakdown</h4>
            {analytics.promptStats.map((stat, index) => (
              <div
                key={stat.promptId}
                className="bg-slate-900/50 rounded-lg p-4 border border-slate-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="font-medium">{stat.promptName}</span>
                  </div>
                  <span className="text-slate-400">
                    {stat.count} {stat.count === 1 ? 'photo' : 'photos'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${stat.percentage}%`,
                        backgroundColor: COLORS[index % COLORS.length],
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium text-slate-300 w-12 text-right">
                    {stat.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {analytics.promptStats.length === 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
          <Camera className="mx-auto mb-4 text-slate-600" size={48} />
          <h3 className="text-xl font-semibold mb-2">No Photos Yet</h3>
          <p className="text-slate-400">
            Analytics will appear here once guests start taking photos at this event.
          </p>
        </div>
      )}
    </div>
  );
};

export default EventAnalytics;
