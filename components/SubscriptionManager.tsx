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
  role?: string;
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
        .neq('id', 'admin')
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
        return <Zap size={24} className="text-slate-500" />;
      case 'starter':
        return <CreditCard size={24} className="text-green-700" />;
      case 'professional':
        return <Crown size={24} className="text-green-800" />;
      case 'enterprise':
        return <Crown size={24} className="text-green-900" />;
      default:
        return <Zap size={24} />;
    }
  };

  const getTierColor = (tierId: string) => {
    switch (tierId) {
      case 'free':
        return 'border-slate-300';
      case 'starter':
        return 'border-green-700/30';
      case 'professional':
        return 'border-green-700/30';
      case 'enterprise':
        return 'border-green-700/30';
      default:
        return 'border-slate-300';
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(0)}`;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="text-slate-900 text-xl">Loading...</div>
      </div>
    );
  }

  const isAdmin = userProfile?.role === 'admin';

  if (isAdmin) {
    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white border-2 border-slate-300 rounded-2xl w-full max-w-2xl p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-900">Administrator Account</h2>
            <button
              onClick={onClose}
              className="text-slate-600 hover:text-slate-900 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="bg-green-700/10 border-2 border-green-700/30 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <Crown size={32} className="text-green-800 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Admin Access</h3>
                <p className="text-slate-700 mb-3">
                  As an administrator, you have unlimited access to all features. Subscription plans do not apply to admin accounts.
                </p>
                <p className="text-slate-700">
                  To manage subscription plans offered to users, navigate to the <strong>Plans</strong> section from the admin menu.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 bg-green-700 hover:bg-green-800 text-white rounded-lg font-bold"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border-2 border-slate-300 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b-2 border-slate-300 sticky top-0 bg-white z-10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Choose Your Plan</h2>
              <p className="text-slate-600 mt-1">Select the perfect plan for your needs</p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-600 hover:text-slate-900 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-green-700 hover:bg-green-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                billingCycle === 'yearly'
                  ? 'bg-green-700 hover:bg-green-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              Yearly
              <span className="ml-2 text-xs bg-green-700/20 text-green-800 px-2 py-0.5 rounded-full">
                Save 15%
              </span>
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="bg-green-700/10 border border-green-700/30 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle size={20} className="text-green-800 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-slate-900">
              <p className="font-medium mb-1">Payment Setup Required</p>
              <p className="text-slate-700">
                To enable subscriptions, configure Stripe by visiting{' '}
                <a
                  href="https://bolt.new/setup/stripe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-green-800"
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
                  className={`bg-white border-2 ${getTierColor(tier.id)} rounded-xl p-6 flex flex-col ${
                    isCurrentTier ? 'ring-2 ring-green-700/50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    {getTierIcon(tier.id)}
                    {isCurrentTier && (
                      <span className="text-xs bg-green-700/20 text-green-800 px-2 py-1 rounded-full">
                        Current Plan
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 mb-2">{tier.name}</h3>
                  <p className="text-slate-600 text-sm mb-4 flex-grow">{tier.description}</p>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-slate-900">{formatPrice(price)}</span>
                      {price > 0 && (
                        <span className="text-slate-600 text-sm">
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
                    <li className="flex items-start gap-2 text-sm text-slate-700">
                      <Check size={16} className="text-green-700 flex-shrink-0 mt-0.5" />
                      {tier.images_limit === 999999 ? 'Unlimited' : tier.images_limit} images/month
                    </li>
                    <li className="flex items-start gap-2 text-sm text-slate-700">
                      <Check size={16} className="text-green-700 flex-shrink-0 mt-0.5" />
                      {tier.sms_limit === 999999 ? 'Unlimited' : tier.sms_limit} SMS/month
                    </li>
                    <li className="flex items-start gap-2 text-sm text-slate-700">
                      <Check size={16} className="text-green-700 flex-shrink-0 mt-0.5" />
                      {tier.events_limit === 999 ? 'Unlimited' : tier.events_limit} active events
                    </li>
                    {tier.custom_branding && (
                      <li className="flex items-start gap-2 text-sm text-slate-700">
                        <Check size={16} className="text-green-700 flex-shrink-0 mt-0.5" />
                        Custom branding
                      </li>
                    )}
                    {tier.analytics && (
                      <li className="flex items-start gap-2 text-sm text-slate-700">
                        <Check size={16} className="text-green-700 flex-shrink-0 mt-0.5" />
                        Advanced analytics
                      </li>
                    )}
                    {tier.priority_support && (
                      <li className="flex items-start gap-2 text-sm text-slate-700">
                        <Check size={16} className="text-green-700 flex-shrink-0 mt-0.5" />
                        Priority support
                      </li>
                    )}
                  </ul>

                  <button
                    onClick={() => handleSubscribe(tier.id)}
                    disabled={isCurrentTier}
                    className={`w-full py-3 rounded-lg font-medium transition-all ${
                      isCurrentTier
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                        : 'bg-green-700 hover:bg-green-800 text-white'
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
