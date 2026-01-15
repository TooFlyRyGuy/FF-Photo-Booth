import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Check, CreditCard, Crown, Zap, AlertCircle, Ticket, Package, DollarSign } from 'lucide-react';

interface SubscriptionTier {
  id: string;
  name: string;
  billing_period: string;
  price_cents: number;
  credits_per_period: number;
  sms_credits_per_period: number;
  rollover_enabled: boolean;
  features: string[] | null;
  prompts_limit: number | null;
  is_active: boolean;
  display_order: number;
}

interface EventPass {
  id: string;
  name: string;
  price_cents: number;
  credits: number;
  sms_credits: number;
  duration_hours: number;
  prompts_limit: number | null;
  features: string[] | null;
  is_active: boolean;
  display_order: number;
}

interface AddOn {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  is_active: boolean;
}

interface CreditTopup {
  id: string;
  name: string;
  credits: number;
  sms_credits: number;
  price_cents: number;
  is_active: boolean;
  display_order: number;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role?: string;
  subscription_tier_id: string;
  subscription_status: string;
  stripe_customer_id: string;
  subscription_ends_at: string;
}

interface SubscriptionManagerProps {
  onClose: () => void;
}

const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ onClose }) => {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [eventPasses, setEventPasses] = useState<EventPass[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [creditTopups, setCreditTopups] = useState<CreditTopup[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'eventPasses' | 'addOns' | 'credits'>('subscriptions');

  useEffect(() => {
    loadData();
  }, [billingCycle]);

  const loadData = async () => {
    try {
      console.log('Starting to load data...');

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('Auth user:', user, 'Error:', userError);

      if (user) {
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        console.log('User profile loaded:', profileData, 'Error:', profileError);
        setUserProfile(profileData);
      } else {
        console.log('No user found - user is not authenticated');
      }

      const [tiersData, passesData, addOnsData, topupsData] = await Promise.all([
        supabase
          .from('subscription_tiers_new')
          .select('*')
          .eq('is_active', true)
          .eq('billing_period', billingCycle)
          .order('display_order', { ascending: true }),
        supabase
          .from('event_passes')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true }),
        supabase
          .from('add_ons')
          .select('*')
          .eq('is_active', true)
          .order('name', { ascending: true }),
        supabase
          .from('credit_topup_products')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true })
      ]);

      setTiers(tiersData.data || []);
      setEventPasses(passesData.data || []);
      setAddOns(addOnsData.data || []);
      setCreditTopups(topupsData.data || []);
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

  const getTierIcon = (tierName: string) => {
    const name = tierName.toLowerCase();
    if (name === 'starter') {
      return <CreditCard size={24} className="text-green-700" />;
    } else if (name === 'pro') {
      return <Zap size={24} className="text-green-800" />;
    } else if (name === 'premium') {
      return <Crown size={24} className="text-green-800" />;
    } else if (name === 'enterprise') {
      return <Crown size={24} className="text-green-900" />;
    }
    return <Zap size={24} className="text-slate-500" />;
  };

  const getTierColor = (tierName: string) => {
    const name = tierName.toLowerCase();
    if (name === 'enterprise') {
      return 'border-green-900/50 bg-gradient-to-br from-green-50 to-white';
    }
    return 'border-green-700/30';
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

          <div className="flex justify-center gap-2 mt-6 border-b border-slate-200">
            <button
              onClick={() => setActiveTab('subscriptions')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'subscriptions'
                  ? 'border-b-2 border-green-700 text-green-700'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Subscription Plans
            </button>
            <button
              onClick={() => setActiveTab('eventPasses')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'eventPasses'
                  ? 'border-b-2 border-green-700 text-green-700'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Ticket size={18} />
                Event Passes
              </div>
            </button>
            <button
              onClick={() => setActiveTab('addOns')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'addOns'
                  ? 'border-b-2 border-green-700 text-green-700'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Package size={18} />
                Add-Ons
              </div>
            </button>
            <button
              onClick={() => setActiveTab('credits')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'credits'
                  ? 'border-b-2 border-green-700 text-green-700'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Zap size={18} />
                Credit Top-ups
              </div>
            </button>
          </div>

          {activeTab === 'subscriptions' && (
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
              onClick={() => setBillingCycle('annual')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                billingCycle === 'annual'
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
          )}
        </div>

        <div className="p-6">
          {activeTab === 'subscriptions' && (
            <>
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
              const isCurrentTier = userProfile?.subscription_tier_id === tier.id;
              const isEnterprise = tier.price_cents === -1;

              console.log(`Tier: ${tier.name}, ID: ${tier.id}, User Tier ID: ${userProfile?.subscription_tier_id}, Is Current: ${isCurrentTier}`);

              return (
                <div
                  key={tier.id}
                  className={`border-2 ${getTierColor(tier.name)} rounded-xl p-6 flex flex-col ${
                    isCurrentTier ? 'ring-2 ring-green-700/50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    {getTierIcon(tier.name)}
                    {isCurrentTier && (
                      <span className="text-xs bg-green-700/20 text-green-800 px-2 py-1 rounded-full">
                        Current Plan
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 mb-2">{tier.name}</h3>
                  <p className="text-slate-600 text-xs mb-4">
                    {tier.billing_period === 'monthly' ? 'Billed monthly' : 'Billed annually'}
                  </p>

                  <div className="mb-6">
                    {isEnterprise ? (
                      <div className="text-center py-3">
                        <span className="text-2xl font-bold text-green-900">CONTACT US</span>
                        <p className="text-xs text-slate-600 mt-1">Custom pricing</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold text-slate-900">
                            {formatPrice(tier.price_cents)}
                          </span>
                          <span className="text-slate-600 text-sm">
                            /{tier.billing_period === 'monthly' ? 'mo' : 'yr'}
                          </span>
                        </div>
                        {tier.billing_period === 'annual' && (
                          <p className="text-xs text-slate-500 mt-1">
                            {formatPrice(Math.floor(tier.price_cents / 12))} per month
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  <ul className="space-y-3 mb-6 flex-grow">
                    <li className="flex items-start gap-2 text-sm text-slate-700">
                      <Check size={16} className="text-green-700 flex-shrink-0 mt-0.5" />
                      {tier.credits_per_period >= 999999 ? 'Unlimited' : tier.credits_per_period} credits/
                      {tier.billing_period === 'monthly' ? 'month' : 'year'}
                    </li>
                    <li className="flex items-start gap-2 text-sm text-slate-700">
                      <Check size={16} className="text-green-700 flex-shrink-0 mt-0.5" />
                      {tier.prompts_limit === null ? 'Unlimited' : tier.prompts_limit} prompts per event
                    </li>
                    {tier.rollover_enabled && (
                      <li className="flex items-start gap-2 text-sm text-slate-700">
                        <Check size={16} className="text-green-700 flex-shrink-0 mt-0.5" />
                        Credit rollover enabled
                      </li>
                    )}
                    {tier.features && Array.isArray(tier.features) && tier.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                        <Check size={16} className="text-green-700 flex-shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSubscribe(tier.id)}
                    disabled={isCurrentTier || isEnterprise}
                    className={`w-full py-3 rounded-lg font-medium transition-all ${
                      isCurrentTier
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                        : isEnterprise
                        ? 'bg-green-900 hover:bg-green-950 text-white'
                        : 'bg-green-700 hover:bg-green-800 text-white'
                    }`}
                  >
                    {isCurrentTier ? 'Current Plan' : isEnterprise ? 'Contact Sales' : 'Subscribe'}
                  </button>
                </div>
              );
            })}
              </div>
            </>
          )}

          {activeTab === 'eventPasses' && (
            <>
              <div className="bg-green-700/10 border border-green-700/30 rounded-lg p-4 mb-6 flex items-start gap-3">
                <AlertCircle size={20} className="text-green-800 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-slate-900">
                  <p className="font-medium mb-1">Event Passes</p>
                  <p className="text-slate-700">
                    Purchase a one-time pass for a single event with temporary access and credits.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {eventPasses.map((pass) => (
                  <div
                    key={pass.id}
                    className="border-2 border-green-700/30 rounded-xl p-6 flex flex-col"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <Ticket size={24} className="text-green-700" />
                      <span className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">
                        {pass.duration_hours}h Access
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-slate-900 mb-2">{pass.name}</h3>

                    <div className="mb-6">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-slate-900">
                          {formatPrice(pass.price_cents)}
                        </span>
                      </div>
                    </div>

                    <ul className="space-y-3 mb-6 flex-grow">
                      <li className="flex items-start gap-2 text-sm text-slate-700">
                        <Check size={16} className="text-green-700 flex-shrink-0 mt-0.5" />
                        {pass.credits >= 999999 ? 'Unlimited' : pass.credits} credits
                      </li>
                      <li className="flex items-start gap-2 text-sm text-slate-700">
                        <Check size={16} className="text-green-700 flex-shrink-0 mt-0.5" />
                        {pass.prompts_limit === null ? 'Unlimited' : pass.prompts_limit} prompts
                      </li>
                      <li className="flex items-start gap-2 text-sm text-slate-700">
                        <Check size={16} className="text-green-700 flex-shrink-0 mt-0.5" />
                        {pass.duration_hours} hours of access
                      </li>
                      {pass.features && Array.isArray(pass.features) && pass.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                          <Check size={16} className="text-green-700 flex-shrink-0 mt-0.5" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => handleSubscribe(pass.id)}
                      className="w-full py-3 rounded-lg font-medium transition-all bg-green-700 hover:bg-green-800 text-white"
                    >
                      Purchase Pass
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'addOns' && (
            <>
              <div className="bg-green-700/10 border border-green-700/30 rounded-lg p-4 mb-6 flex items-start gap-3">
                <AlertCircle size={20} className="text-green-800 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-slate-900">
                  <p className="font-medium mb-1">Premium Add-Ons</p>
                  <p className="text-slate-700">
                    Enhance your events with professional services and premium features.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {addOns.map((addon) => (
                  <div
                    key={addon.id}
                    className="border-2 border-green-700/30 rounded-xl p-6 flex flex-col"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <Package size={24} className="text-green-700" />
                    </div>

                    <h3 className="text-xl font-bold text-slate-900 mb-2">{addon.name}</h3>
                    <p className="text-sm text-slate-600 mb-4">{addon.description}</p>

                    <div className="mb-6">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-slate-900">
                          {formatPrice(addon.price_cents)}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleSubscribe(addon.id)}
                      className="w-full py-3 rounded-lg font-medium transition-all bg-green-700 hover:bg-green-800 text-white mt-auto"
                    >
                      Purchase Add-On
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'credits' && (
            <>
              <div className="bg-green-700/10 border border-green-700/30 rounded-lg p-4 mb-6 flex items-start gap-3">
                <AlertCircle size={20} className="text-green-800 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-slate-900">
                  <p className="font-medium mb-1">Credit Top-Ups</p>
                  <p className="text-slate-700">
                    Need more credits? Purchase additional credits anytime to generate more photos.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {creditTopups.map((topup) => (
                  <div
                    key={topup.id}
                    className="border-2 border-green-700/30 rounded-xl p-6 flex flex-col"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <DollarSign size={24} className="text-green-700" />
                      <span className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">
                        {topup.credits} Credits
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-slate-900 mb-2">{topup.name}</h3>

                    <div className="mb-6">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-slate-900">
                          {formatPrice(topup.price_cents)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">
                        ${(topup.price_cents / topup.credits / 100).toFixed(2)} per credit
                      </p>
                    </div>

                    <ul className="space-y-3 mb-6 flex-grow">
                      <li className="flex items-start gap-2 text-sm text-slate-700">
                        <Check size={16} className="text-green-700 flex-shrink-0 mt-0.5" />
                        {topup.credits} image credits
                      </li>
                      <li className="flex items-start gap-2 text-sm text-slate-700">
                        <Check size={16} className="text-green-700 flex-shrink-0 mt-0.5" />
                        {topup.sms_credits} SMS credits
                      </li>
                      <li className="flex items-start gap-2 text-sm text-slate-700">
                        <Check size={16} className="text-green-700 flex-shrink-0 mt-0.5" />
                        Never expires
                      </li>
                      <li className="flex items-start gap-2 text-sm text-slate-700">
                        <Check size={16} className="text-green-700 flex-shrink-0 mt-0.5" />
                        Use across all events
                      </li>
                    </ul>

                    <button
                      onClick={() => handleSubscribe(topup.id)}
                      className="w-full py-3 rounded-lg font-medium transition-all bg-green-700 hover:bg-green-800 text-white"
                    >
                      Buy Credits
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionManager;
