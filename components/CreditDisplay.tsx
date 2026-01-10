import React, { useEffect, useState } from 'react';
import { Zap, Calendar, Ticket, AlertCircle } from 'lucide-react';
import { getCreditBalance, CreditBalance } from '../services/creditService';

interface CreditDisplayProps {
  userId: string;
  compact?: boolean;
}

const CreditDisplay: React.FC<CreditDisplayProps> = ({ userId, compact = false }) => {
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
        <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
        <span className="text-sm">Loading credits...</span>
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
        <span className="text-sm font-bold text-slate-900">{balance.total} credits</span>
      </div>
    );
  }

  const isLow = balance.total < 10;

  return (
    <div className="bg-white border-2 border-slate-300 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">Credit Balance</h3>
        <div className="flex items-center gap-2 px-3 py-1 bg-green-100 rounded-lg">
          <Zap size={18} className="text-green-700" />
          <span className="text-lg font-bold text-green-900">{balance.total}</span>
        </div>
      </div>

      {isLow && (
        <div className="flex items-start gap-3 p-3 bg-amber-50 border-2 border-amber-200 rounded-lg">
          <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">Low Credit Balance</p>
            <p className="text-xs text-amber-700 mt-1">
              Consider purchasing more credits or upgrading your plan to continue generating images.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between py-2 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-slate-500" />
            <span className="text-sm text-slate-700">Subscription Credits</span>
          </div>
          <span className="text-sm font-bold text-slate-900">{balance.subscription_credits}</span>
        </div>

        <div className="flex items-center justify-between py-2 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-slate-500" />
            <span className="text-sm text-slate-700">Purchased Credits</span>
          </div>
          <span className="text-sm font-bold text-slate-900">{balance.purchased_credits}</span>
        </div>

        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2">
            <Ticket size={16} className="text-slate-500" />
            <span className="text-sm text-slate-700">Event Credits</span>
          </div>
          <span className="text-sm font-bold text-slate-900">{balance.event_credits}</span>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-200">
        <p className="text-xs text-slate-500">
          Credits are consumed in order: Subscription → Purchased → Event
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Purchased credits never expire. 1 credit = 1 image generation.
        </p>
      </div>
    </div>
  );
};

export default CreditDisplay;
