import React, { useEffect, useState } from 'react';
import { Ticket, Clock, Calendar, CheckCircle } from 'lucide-react';
import { UserEventPass, UserSubscriptionType } from '../types';
import { getAvailableEventPasses, getUserSubscriptionType } from '../services/backendService';
import { formatDuration, formatDateTimeInTimezone, addHours } from '../services/timezoneService';

interface EventPassSelectorProps {
  timezone: string;
  selectedPassId?: string;
  onSelectPass: (passId: string | undefined, expiresAt?: string) => void;
  startDatetime?: string;
  userRole?: string;
}

export function EventPassSelector({
  timezone,
  selectedPassId,
  onSelectPass,
  startDatetime,
  userRole,
}: EventPassSelectorProps) {
  const [passes, setPasses] = useState<UserEventPass[]>([]);
  const [subscriptionType, setSubscriptionType] = useState<UserSubscriptionType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const subType = await getUserSubscriptionType();
      setSubscriptionType(subType);

      if (!subType.hasActiveSub) {
        const availablePasses = await getAvailableEventPasses();
        setPasses(availablePasses);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
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
          <h3 className="text-lg font-semibold">Event Duration</h3>
        </div>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  // Check if user is admin
  const isAdmin = userRole?.toLowerCase() === 'admin';

  if (isAdmin) {
    return (
      <div className="bg-purple-50 p-6 rounded-lg border-2 border-purple-200">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="text-purple-600" size={24} />
          <h3 className="text-lg font-semibold text-purple-900">Administrator Access</h3>
        </div>
        <p className="text-sm text-purple-800 mb-3">
          As an administrator, you have unlimited event creation privileges.
        </p>
        <div className="bg-white p-4 rounded-lg border border-purple-200">
          <p className="text-sm text-gray-700">
            <strong>Unlimited Access:</strong> You don't need event passes or subscriptions to create events.
            You can create unlimited duration events without any restrictions.
          </p>
        </div>
      </div>
    );
  }

  if (subscriptionType?.hasActiveSub) {
    return (
      <div className="bg-green-50 p-6 rounded-lg border-2 border-green-200">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="text-green-600" size={24} />
          <h3 className="text-lg font-semibold text-green-900">Active Subscription</h3>
        </div>
        <p className="text-sm text-green-800 mb-3">
          You have an active <strong>{subscriptionType.tierName}</strong> subscription.
        </p>
        <div className="bg-white p-4 rounded-lg border border-green-200">
          <p className="text-sm text-gray-700">
            <strong>Unlimited Event Duration:</strong> Your events will run continuously without time restrictions.
            You don't need to use event passes.
          </p>
        </div>
      </div>
    );
  }

  if (passes.length === 0) {
    return (
      <div className="bg-yellow-50 p-6 rounded-lg border-2 border-yellow-200">
        <div className="flex items-center gap-2 mb-4">
          <Ticket className="text-yellow-600" size={20} />
          <h3 className="text-lg font-semibold text-yellow-900">Event Pass Required</h3>
        </div>
        <p className="text-sm text-yellow-800 mb-3">
          You don't have any available event passes.
        </p>
        <div className="bg-white p-4 rounded-lg border border-yellow-200">
          <p className="text-sm text-gray-700 mb-2">
            To create events, you can:
          </p>
          <ul className="text-sm text-gray-700 space-y-1 ml-4 list-disc">
            <li>Purchase an event pass for time-limited events</li>
            <li>Subscribe to a monthly/yearly plan for unlimited event duration</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 p-6 rounded-lg border-2 border-blue-200">
      <div className="flex items-center gap-2 mb-4">
        <Ticket className="text-blue-600" size={20} />
        <h3 className="text-lg font-semibold text-blue-900">Select Event Pass</h3>
      </div>

      <div className="bg-white p-4 rounded-lg border border-blue-200 mb-4">
        <p className="text-sm text-gray-700">
          <strong>Event Pass Events:</strong> Select an event pass to create a time-limited event.
          The event will automatically deactivate when the pass expires. For unlimited event duration,
          consider subscribing to a monthly or yearly plan.
        </p>
      </div>

      <div className="space-y-3">
        {passes.map(pass => {
          const isSelected = pass.id === selectedPassId;
          const expiresAt = calculateExpiration(pass.durationHours);

          return (
            <button
              key={pass.id}
              type="button"
              onClick={() => handleSelectPass(pass.id, pass.durationHours)}
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
        <div className="mt-4 space-y-3">
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
            <strong>Note:</strong> This pass will be activated when you create the event and cannot be reused.
          </div>
          <button
            type="button"
            onClick={handleClearSelection}
            className="w-full py-2 px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Clear Selection
          </button>
        </div>
      )}
    </div>
  );
}
