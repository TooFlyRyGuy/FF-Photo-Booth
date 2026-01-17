import React, { useEffect, useState } from 'react';
import { Ticket, Clock, Calendar } from 'lucide-react';
import { UserEventPass } from '../types';
import { getAvailableEventPasses } from '../services/backendService';
import { formatDuration, formatDateTimeInTimezone, addHours } from '../services/timezoneService';

interface EventPassSelectorProps {
  timezone: string;
  selectedPassId?: string;
  onSelectPass: (passId: string | undefined, expiresAt?: string) => void;
  startDatetime?: string;
}

export function EventPassSelector({
  timezone,
  selectedPassId,
  onSelectPass,
  startDatetime,
}: EventPassSelectorProps) {
  const [passes, setPasses] = useState<UserEventPass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPasses();
  }, []);

  const loadPasses = async () => {
    setLoading(true);
    setError(null);

    try {
      const availablePasses = await getAvailableEventPasses();
      setPasses(availablePasses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load passes');
    } finally {
      setLoading(false);
    }
  };

  const calculateExpiration = (durationHours: number): string => {
    const startDate = startDatetime ? new Date(startDatetime) : new Date();
    return addHours(startDate, durationHours).toISOString();
  };

  const handleSelectPass = (passId: string, durationHours: number) => {
    const expiresAt = calculateExpiration(durationHours);
    onSelectPass(passId, expiresAt);
  };

  const handleClearSelection = () => {
    onSelectPass(undefined);
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Ticket className="text-blue-600" size={20} />
          <h3 className="text-lg font-semibold">Event Pass</h3>
        </div>
        <p className="text-sm text-gray-500">Loading available passes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Ticket className="text-blue-600" size={20} />
          <h3 className="text-lg font-semibold">Event Pass</h3>
        </div>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (passes.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Ticket className="text-blue-600" size={20} />
          <h3 className="text-lg font-semibold">Event Pass</h3>
        </div>
        <p className="text-sm text-gray-600">
          You don't have any available event passes. Event passes can be purchased separately or included with certain subscription tiers.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <Ticket className="text-blue-600" size={20} />
        <h3 className="text-lg font-semibold">Event Pass (Optional)</h3>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Use an event pass to create a time-limited event. The event will automatically deactivate when the pass expires.
      </p>

      <div className="space-y-3">
        {passes.map(pass => {
          const isSelected = pass.id === selectedPassId;
          const expiresAt = calculateExpiration(pass.durationHours);

          return (
            <button
              key={pass.id}
              type="button"
              onClick={() => isSelected ? handleClearSelection() : handleSelectPass(pass.id, pass.durationHours)}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                isSelected
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-400 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Ticket
                      size={16}
                      className={isSelected ? 'text-blue-600' : 'text-gray-400'}
                    />
                    <span className="font-semibold text-gray-900">{pass.tierName}</span>
                  </div>

                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock size={14} />
                      <span>Duration: {formatDuration(pass.durationHours)}</span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar size={14} />
                      <span>Purchased: {formatDateTimeInTimezone(pass.purchasedAt, timezone)}</span>
                    </div>

                    {isSelected && startDatetime && (
                      <div className="mt-2 p-2 bg-blue-100 rounded text-blue-900">
                        <span className="font-medium">Expires: </span>
                        {formatDateTimeInTimezone(expiresAt, timezone)}
                      </div>
                    )}
                  </div>
                </div>

                {isSelected && (
                  <div className="ml-4">
                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path d="M5 13l4 4L19 7"></path>
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selectedPassId && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
          <strong>Note:</strong> This pass will be activated when you create the event and cannot be reused.
        </div>
      )}
    </div>
  );
}
