import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Check, CreditCard, Crown, Zap, AlertCircle } from 'lucide-react';

interface SubscriptionTier {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  images_limit: number;
  sms_limit: number;
  events_limit: number;
  custom_branding: boolean;
  analytics: boolean;
  priority_support: boolean;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  subscription_tier: string;
  subscription_status: string;
  stripe_customer_id: string;
  subscription_ends_at: string;
}

interface SubscriptionManagerProps {
  onClose: () => void;
}

const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ onClose }) => {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: tiersData } = await supabase
        .from('subscription_tiers')
        .select('*')
        .order('price_monthly', { ascending: true });

      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        setUserProfile(profileData);
      }

      setTiers(tiersData || []);
    } catch (error) {
      console.error('Error loading subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (tierId: string) => {
    alert(
      'Stripe integration is not yet configured. To enable payments:\n\n' +
      '1. Create a Stripe account at https://dashboard.stripe.com/register\n' +
      '2. Get your Stripe secret key from the Developers section\n' +
      '3. Add it to your environment configuration\n\n' +
      'Visit https://bolt.new/setup/stripe for detailed instructions.'
    );
  };

  const getTierIcon = (tierId: string) => {
    switch (tierId) {
      case 'free':
        return <Zap size={24} className="text-slate-400" />;
      case 'starter':
        return <CreditCard size={24} className="text-blue-400" />;
      case 'professional':
        return <Crown size={24} className="text-purple-400" />;
      case 'enterprise':
        return <Crown size={24} className="text-yellow-400" />;
      default:
        return <Zap size={24} />;
    }
  };

  const getTierColor = (tierId: string) => {
    switch (tierId) {
      case 'free':
        return 'border-slate-700';
      case 'starter':
        return 'border-blue-500';
      case 'professional':
        return 'border-purple-500';
      case 'enterprise':
        return 'border-yellow-500';
      default:
        return 'border-slate-700';
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(0)}`;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-white">Choose Your Plan</h2>
              <p className="text-slate-400 mt-1">Select the perfect plan for your needs</p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>

          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                billingCycle === 'yearly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Yearly
              <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                Save 15%
              </span>
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle size={20} className="text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-200">
              <p className="font-medium mb-1">Payment Setup Required</p>
              <p className="text-yellow-300/80">
                To enable subscriptions, configure Stripe by visiting{' '}
                <a
                  href="https://bolt.new/setup/stripe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-yellow-200"
                >
                  the setup guide
                </a>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {tiers.map((tier) => {
              const isCurrentTier = userProfile?.subscription_tier === tier.id;
              const price = billingCycle === 'monthly' ? tier.price_monthly : tier.price_yearly;

              return (
                <div
                  key={tier.id}
                  className={`bg-slate-800 border-2 ${getTierColor(tier.id)} rounded-xl p-6 flex flex-col ${
                    isCurrentTier ? 'ring-2 ring-blue-500/50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    {getTierIcon(tier.id)}
                    {isCurrentTier && (
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
                        Current Plan
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2">{tier.name}</h3>
                  <p className="text-slate-400 text-sm mb-4 flex-grow">{tier.description}</p>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-white">{formatPrice(price)}</span>
                      {price > 0 && (
                        <span className="text-slate-400 text-sm">
                          /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                        </span>
                      )}
                    </div>
                    {billingCycle === 'yearly' && price > 0 && (
                      <p className="text-xs text-slate-500 mt-1">
                        {formatPrice(Math.floor(price / 12))} per month
                      </p>
                    )}
                  </div>

                  <ul className="space-y-3 mb-6">
                    <li className="flex items-start gap-2 text-sm text-slate-300">
                      <Check size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
                      {tier.images_limit === 999999 ? 'Unlimited' : tier.images_limit} images/month
                    </li>
                    <li className="flex items-start gap-2 text-sm text-slate-300">
                      <Check size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
                      {tier.sms_limit === 999999 ? 'Unlimited' : tier.sms_limit} SMS/month
                    </li>
                    <li className="flex items-start gap-2 text-sm text-slate-300">
                      <Check size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
                      {tier.events_limit === 999 ? 'Unlimited' : tier.events_limit} active events
                    </li>
                    {tier.custom_branding && (
                      <li className="flex items-start gap-2 text-sm text-slate-300">
                        <Check size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
                        Custom branding
                      </li>
                    )}
                    {tier.analytics && (
                      <li className="flex items-start gap-2 text-sm text-slate-300">
                        <Check size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
                        Advanced analytics
                      </li>
                    )}
                    {tier.priority_support && (
                      <li className="flex items-start gap-2 text-sm text-slate-300">
                        <Check size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
                        Priority support
                      </li>
                    )}
                  </ul>

                  <button
                    onClick={() => handleSubscribe(tier.id)}
                    disabled={isCurrentTier}
                    className={`w-full py-3 rounded-lg font-medium transition-all ${
                      isCurrentTier
                        ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                  >
                    {isCurrentTier ? 'Current Plan' : tier.id === 'free' ? 'Get Started' : 'Upgrade'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionManager;
