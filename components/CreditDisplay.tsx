import React, { useEffect, useState } from 'react';
import { Zap, Ticket, MessageSquare, AlertCircle } from 'lucide-react';
import { getCreditBalance, CreditBalance } from '../services/creditService';

interface CreditDisplayProps {
  userId: string;
  compact?: boolean;
  sidebar?: boolean;
}

const CreditDisplay: React.FC<CreditDisplayProps> = ({ userId, compact = false, sidebar = false }) => {
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBalance();
  }, [userId]);

  const loadBalance = async () => {
    setLoading(true);
    try {
      const data = await getCreditBalance(userId);
      setBalance(data);
    } catch (error) {
      console.error('Failed to load credit balance:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-600">
        <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
        <span className="text-xs">Loading...</span>
      </div>
    );
  }

  if (!balance) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg">
        <Zap size={18} className="text-green-700" />
        <span className="text-sm font-bold text-slate-900">{balance.image_credits} credits</span>
      </div>
    );
  }

  if (sidebar) {
    const isLowImage = balance.image_credits < 10;
    const isLowSMS = balance.total_sms_credits < 10;

    return (
      <div className="space-y-2">
        {(isLowImage || isLowSMS) && (
          <div className="flex items-center gap-1.5 p-2 bg-amber-50 border border-amber-200 rounded-md">
            <AlertCircle size={14} className="text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-800 font-medium">Low credits</p>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between py-1.5 px-2 bg-green-50/50 rounded-md">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-green-700" />
              <span className="text-xs font-medium text-slate-700">Images</span>
            </div>
            <span className="text-sm font-bold text-green-800">{balance.image_credits}</span>
          </div>

          <div className="flex items-center justify-between py-1.5 px-2 bg-blue-50/50 rounded-md">
            <div className="flex items-center gap-2">
              <Ticket size={14} className="text-blue-700" />
              <span className="text-xs font-medium text-slate-700">Events</span>
            </div>
            <span className="text-sm font-bold text-blue-800">{balance.event_credits}</span>
          </div>

          <div className="flex items-center justify-between py-1.5 px-2 bg-purple-50/50 rounded-md">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-purple-700" />
              <span className="text-xs font-medium text-slate-700">SMS</span>
            </div>
            <span className="text-sm font-bold text-purple-800">{balance.total_sms_credits}</span>
          </div>
        </div>
      </div>
    );
  }

  const isLowImage = balance.image_credits < 10;
  const isLowSMS = balance.total_sms_credits < 10;

  return (
    <div className="bg-white border-2 border-slate-300 rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-bold text-slate-900">Available Credits</h3>

      {(isLowImage || isLowSMS) && (
        <div className="flex items-start gap-3 p-3 bg-amber-50 border-2 border-amber-200 rounded-lg">
          <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">Low Credit Balance</p>
            <p className="text-xs text-amber-700 mt-1">
              {isLowImage && 'Image credits are low. '}
              {isLowSMS && 'SMS credits are low. '}
              Consider purchasing more credits or upgrading your plan.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between py-3 px-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Zap size={20} className="text-green-700" />
            </div>
            <span className="text-sm font-medium text-slate-900">Image Credits</span>
          </div>
          <span className="text-xl font-bold text-green-900">{balance.image_credits}</span>
        </div>

        <div className="flex items-center justify-between py-3 px-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Ticket size={20} className="text-blue-700" />
            </div>
            <span className="text-sm font-medium text-slate-900">Event Credits</span>
          </div>
          <span className="text-xl font-bold text-blue-900">{balance.event_credits}</span>
        </div>

        <div className="flex items-center justify-between py-3 px-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <MessageSquare size={20} className="text-purple-700" />
            </div>
            <span className="text-sm font-medium text-slate-900">SMS Credits</span>
          </div>
          <span className="text-xl font-bold text-purple-900">{balance.total_sms_credits}</span>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-200">
        <p className="text-xs text-slate-500">
          1 image credit = 1 image generation • 1 SMS credit = 1 text message
        </p>
      </div>
    </div>
  );
};

export default CreditDisplay;
