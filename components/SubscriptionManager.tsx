import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Check, CreditCard, Crown, Zap, CircleAlert as AlertCircle, Ticket, Package, DollarSign, Users } from 'lucide-react';

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
  stripe_price_id: string | null;
  stripe_product_id: string | null;
}

interface EventPass {
  id: string;
  name: string;
  price_cents: number;
  credits: number;
  sms_credits: number;
  duration_hours: number;
  prompts_limit: number | null;
  max_guests: number | null;
  features: string[] | null;
  is_active: boolean;
  display_order: number;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
}

interface AddOn {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  is_active: boolean;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
}

interface CreditTopup {
  id: string;
  name: string;
  credits: number;
  sms_credits: number;
  price_cents: number;
  is_active: boolean;
  display_order: number;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
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
  initialTab?: 'subscriptions' | 'eventPasses' | 'addOns' | 'credits';
}

const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ onClose, initialTab }) => {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [eventPasses, setEventPasses] = useState<EventPass[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [creditTopups, setCreditTopups] = useState<CreditTopup[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'eventPasses' | 'addOns' | 'credits'>(initialTab ?? 'eventPasses');

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
    try {
      const tier = tiers.find(t => t.id === tierId);
      const pass = eventPasses.find(p => p.id === tierId);
      const addon = addOns.find(a => a.id === tierId);
      const topup = creditTopups.find(t => t.id === tierId);

      let priceId: string | null = null;
      let mode: 'subscription' | 'payment' = 'subscription';

      if (tier) {
        priceId = tier.stripe_price_id;
        mode = 'subscription';
      } else if (pass) {
        priceId = pass.stripe_price_id;
        mode = 'payment';
      } else if (addon) {
        priceId = addon.stripe_price_id;
        mode = 'payment';
      } else if (topup) {
        priceId = topup.stripe_price_id;
        mode = 'payment';
      }

      if (!priceId) {
        alert(
          'Stripe integration is not yet configured for this product.\n\n' +
          'To enable payments:\n' +
          '1. Create a Stripe product in your dashboard\n' +
          '2. Update the database with the Stripe Price ID\n\n' +
          'See STRIPE_TESTING_GUIDE.md for detailed instructions.'
        );
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Please log in to subscribe');
        return;
      }

      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        alert('Authentication error. Please log in again.');
        return;
      }

      const requestBody: any = {
        price_id: priceId,
        mode: mode,
        success_url: `${window.location.origin}?checkout=success`,
        cancel_url: `${window.location.origin}?checkout=cancelled`
      };

      // Add metadata for event passes
      if (pass) {
        requestBody.metadata = {
          purchase_type: 'event_pass',
          event_pass_id: pass.id,
          credits: pass.credits.toString(),
          sms_credits: (pass.sms_credits || 0).toString(),
          expiration_hours: pass.duration_hours.toString(),
          prompt_limit: (pass.prompts_limit || 0).toString()
        };
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();

      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      alert(`Failed to start checkout: ${error.message}`);
    }
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
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center overflow-y-auto">
      <div className="bg-white border-0 sm:border-2 sm:border-slate-300 rounded-none sm:rounded-2xl w-full sm:max-w-7xl min-h-screen sm:min-h-0 sm:max-h-[90vh] sm:my-4 overflow-y-auto">
        <div className="p-4 sm:p-6 border-b-2 border-slate-200 sticky top-0 bg-white z-10">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Choose Your Plan</h2>
              <p className="text-sm sm:text-base text-slate-600 mt-1">Select the perfect plan for your needs</p>
            </div>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 sm:static text-slate-600 hover:text-slate-900 text-2xl w-10 h-10 flex items-center justify-center"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="flex flex-wrap gap-1 sm:gap-2 mt-4 sm:mt-6 border-b border-slate-200 sm:justify-center">
            <button
              onClick={() => setActiveTab('eventPasses')}
              className={`px-4 sm:px-6 py-2 sm:py-3 font-medium text-sm sm:text-base transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === 'eventPasses'
                  ? 'border-b-2 border-green-700 text-green-700'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Ticket size={16} className="sm:w-[18px] sm:h-[18px]" />
                <span className="hidden xs:inline">Event </span>Passes
              </div>
            </button>
            <button
              onClick={() => setActiveTab('subscriptions')}
              className={`px-4 sm:px-6 py-2 sm:py-3 font-medium text-sm sm:text-base transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === 'subscriptions'
                  ? 'border-b-2 border-green-700 text-green-700'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Subscriptions
            </button>
            <button
              onClick={() => setActiveTab('addOns')}
              className={`px-4 sm:px-6 py-2 sm:py-3 font-medium text-sm sm:text-base transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === 'addOns'
                  ? 'border-b-2 border-green-700 text-green-700'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Package size={16} className="sm:w-[18px] sm:h-[18px]" />
                Add-Ons
              </div>
            </button>
            <button
              onClick={() => setActiveTab('credits')}
              className={`px-4 sm:px-6 py-2 sm:py-3 font-medium text-sm sm:text-base transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === 'credits'
                  ? 'border-b-2 border-green-700 text-green-700'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Zap size={16} className="sm:w-[18px] sm:h-[18px]" />
                Credits
              </div>
            </button>
          </div>

          {activeTab === 'subscriptions' && (
            <div className="flex items-center justify-center gap-3 mt-4 sm:mt-6">
              <div className="flex items-center gap-3 bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    billingCycle === 'monthly'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle('annual')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    billingCycle === 'annual'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Yearly
                  <span className="ml-1.5 text-xs text-green-700 font-semibold">Save 15%</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === 'subscriptions' && (
            <>
              {userProfile && tiers.find(t => t.id === userProfile.subscription_tier_id)?.price_cents === 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 flex items-start gap-2 sm:gap-3">
                  <AlertCircle size={18} className="sm:w-5 sm:h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                  <div className="text-xs sm:text-sm text-slate-900">
                    <p className="font-medium mb-1 text-amber-800">You are on the Free plan</p>
                    <p className="text-slate-700">Upgrade for ongoing monthly access to more AI images, SMS credits, and concurrent events.</p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
                {tiers.map((tier) => {
              const isCurrentTier = userProfile?.subscription_tier_id === tier.id;
              const isEnterprise = tier.price_cents === -1;

              console.log(`Tier: ${tier.name}, ID: ${tier.id}, User Tier ID: ${userProfile?.subscription_tier_id}, Is Current: ${isCurrentTier}`);

              return (
                <div
                  key={tier.id}
                  className={`border-2 ${getTierColor(tier.name)} rounded-xl p-4 sm:p-5 lg:p-6 flex flex-col min-h-[400px] sm:min-h-[450px] ${
                    isCurrentTier ? 'ring-2 ring-green-700/50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    {getTierIcon(tier.name)}
                    {isCurrentTier && (
                      <span className="text-xs bg-green-700/20 text-green-800 px-2 py-1 rounded-full font-medium">
                        Current
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-1 sm:mb-2">{tier.name}</h3>
                  <p className="text-slate-600 text-xs mb-3 sm:mb-4">
                    {tier.billing_period === 'monthly' ? 'Billed monthly' : 'Billed annually'}
                  </p>

                  <div className="mb-4 sm:mb-6 pb-4 border-b border-slate-200">
                    {isEnterprise ? (
                      <div className="text-center py-2 sm:py-3">
                        <span className="text-xl sm:text-2xl font-bold text-green-900">CONTACT US</span>
                        <p className="text-xs text-slate-600 mt-1">Custom pricing</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl sm:text-3xl font-bold text-slate-900">
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

                  <ul className="space-y-2.5 sm:space-y-3 mb-5 sm:mb-6 flex-grow">
                    <li className="flex items-start gap-2 text-sm text-slate-700">
                      <Check size={16} className="text-green-700 flex-shrink-0 mt-0.5" />
                      <span className="leading-snug">{tier.credits_per_period >= 999999 ? 'Unlimited' : tier.credits_per_period} credits/
                      {tier.billing_period === 'monthly' ? 'month' : 'year'}</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-slate-700">
                      <Check size={16} className="text-green-700 flex-shrink-0 mt-0.5" />
                      <span className="leading-snug">{tier.prompts_limit === null ? 'Unlimited' : tier.prompts_limit} prompts per event</span>
                    </li>
                    {tier.rollover_enabled && (
                      <li className="flex items-start gap-2 text-sm text-slate-700">
                        <Check size={16} className="text-green-700 flex-shrink-0 mt-0.5" />
                        <span className="leading-snug">Credit rollover enabled</span>
                      </li>
                    )}
                    {tier.features && Array.isArray(tier.features) && tier.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                        <Check size={16} className="text-green-700 flex-shrink-0 mt-0.5" />
                        <span className="leading-snug">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSubscribe(tier.id)}
                    disabled={isCurrentTier || isEnterprise}
                    className={`w-full py-3 sm:py-3.5 rounded-lg font-medium text-sm sm:text-base transition-all min-h-[48px] ${
                      isCurrentTier
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                        : isEnterprise
                        ? 'bg-green-900 hover:bg-green-950 text-white'
                        : 'bg-green-700 hover:bg-green-800 text-white active:bg-green-900'
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
              <div className="bg-green-700/10 border border-green-700/30 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 flex items-start gap-2 sm:gap-3">
                <Ticket size={18} className="sm:w-5 sm:h-5 text-green-800 flex-shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-slate-900">
                  <p className="font-medium mb-1">Event Passes — No Subscription Required</p>
                  <p className="text-slate-700">
                    Buy a one-time pass for your next event. Perfect for weddings, parties, conferences, and any single occasion.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
                {eventPasses.map((pass) => {
                  const isPopular = pass.name === 'Pro Event';
                  return (
                  <div
                    key={pass.id}
                    className={`border-2 rounded-xl p-4 sm:p-5 lg:p-6 flex flex-col relative ${isPopular ? 'border-green-600 shadow-lg' : 'border-green-700/30'}`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow">MOST POPULAR</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-3 sm:mb-4 mt-1">
                      <Ticket size={20} className="sm:w-6 sm:h-6 text-green-700" />
                      <span className="text-xs bg-green-100 text-green-800 px-2.5 sm:px-3 py-1 rounded-full font-medium">
                        {pass.duration_hours}h Access
                      </span>
                    </div>

                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-1 sm:mb-2">{pass.name}</h3>

                    <div className="mb-3 pb-3 border-b border-slate-200">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl sm:text-3xl font-bold text-slate-900">
                          {formatPrice(pass.price_cents)}
                        </span>
                      </div>
                    </div>

                    {/* Guest Capacity — Primary Feature */}
                    {pass.max_guests && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 mb-0.5">
                          <Users size={16} className="text-green-700" />
                          <span className="text-xl font-extrabold text-green-800">Up to {pass.max_guests} Guests</span>
                        </div>
                        <p className="text-xs text-green-700 font-medium">Guest Capacity</p>
                      </div>
                    )}

                    <ul className="space-y-2.5 sm:space-y-3 mb-5 sm:mb-6 flex-grow">
                      <li className="flex items-start gap-2 text-sm text-slate-700">
                        <Check size={16} className="text-green-700 flex-shrink-0 mt-0.5" />
                        <span className="leading-snug">{pass.duration_hours} hours of access</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-slate-700">
                        <Check size={16} className="text-green-700 flex-shrink-0 mt-0.5" />
                        <span className="leading-snug">{pass.prompts_limit === null ? 'Unlimited' : pass.prompts_limit} prompts</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-slate-500">
                        <Check size={14} className="text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="leading-snug">{pass.credits >= 999999 ? 'Unlimited' : pass.credits} AI image credits</span>
                      </li>
                      {pass.sms_credits > 0 && (
                        <li className="flex items-start gap-2 text-sm text-slate-500">
                          <Check size={14} className="text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="leading-snug">{pass.sms_credits} SMS credits</span>
                        </li>
                      )}
                      {pass.features && Array.isArray(pass.features) && pass.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                          <Check size={16} className="text-green-700 flex-shrink-0 mt-0.5" />
                          <span className="leading-snug">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => handleSubscribe(pass.id)}
                      className={`w-full py-3 sm:py-3.5 rounded-lg font-medium text-sm sm:text-base transition-all text-white min-h-[48px] ${isPopular ? 'bg-green-600 hover:bg-green-700 active:bg-green-800' : 'bg-green-700 hover:bg-green-800 active:bg-green-900'}`}
                    >
                      Purchase Pass
                    </button>
                  </div>
                  );
                })}
              </div>
            </>
          )}

          {activeTab === 'addOns' && (
            <>
              <div className="bg-green-700/10 border border-green-700/30 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 flex items-start gap-2 sm:gap-3">
                <AlertCircle size={18} className="sm:w-5 sm:h-5 text-green-800 flex-shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-slate-900">
                  <p className="font-medium mb-1">Premium Add-Ons</p>
                  <p className="text-slate-700">
                    Enhance your events with professional services and premium features.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
                {addOns.map((addon) => (
                  <div
                    key={addon.id}
                    className="border-2 border-green-700/30 rounded-xl p-4 sm:p-5 lg:p-6 flex flex-col relative min-h-[320px]"
                  >
                    <div className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-orange-600 text-white px-2.5 sm:px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                      CONTACT US
                    </div>

                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <Package size={20} className="sm:w-6 sm:h-6 text-green-700" />
                    </div>

                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 pr-20">{addon.name}</h3>
                    <p className="text-sm text-slate-600 mb-4">{addon.description}</p>

                    <div className="mb-4 sm:mb-6 pb-4 border-b border-slate-200">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl sm:text-3xl font-bold text-slate-900">
                          {formatPrice(addon.price_cents)}
                        </span>
                      </div>
                    </div>

                    <button
                      disabled
                      className="w-full py-3 sm:py-3.5 rounded-lg font-medium text-sm sm:text-base transition-all bg-slate-300 text-slate-500 cursor-not-allowed mt-auto min-h-[48px]"
                      title="Please contact us to purchase this add-on"
                    >
                      Contact Us to Purchase
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'credits' && (
            <>
              <div className="bg-green-700/10 border border-green-700/30 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 flex items-start gap-2 sm:gap-3">
                <AlertCircle size={18} className="sm:w-5 sm:h-5 text-green-800 flex-shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-slate-900">
                  <p className="font-medium mb-1">Credit Top-Ups</p>
                  <p className="text-slate-700">
                    Need more credits? Purchase additional credits anytime to generate more photos.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
                {creditTopups.map((topup) => (
                  <div
                    key={topup.id}
                    className="border-2 border-green-700/30 rounded-xl p-4 sm:p-5 lg:p-6 flex flex-col min-h-[380px]"
                  >
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <DollarSign size={20} className="sm:w-6 sm:h-6 text-green-700" />
                      <span className="text-xs bg-green-100 text-green-800 px-2.5 sm:px-3 py-1 rounded-full font-medium">
                        {topup.credits} Credits
                      </span>
                    </div>

                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-1 sm:mb-2">{topup.name}</h3>

                    <div className="mb-4 sm:mb-6 pb-4 border-b border-slate-200">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl sm:text-3xl font-bold text-slate-900">
                          {formatPrice(topup.price_cents)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">
                        ${(topup.price_cents / topup.credits / 100).toFixed(2)} per credit
                      </p>
                    </div>

                    <ul className="space-y-2.5 sm:space-y-3 mb-5 sm:mb-6 flex-grow">
                      <li className="flex items-start gap-2 text-sm text-slate-700">
                        <Check size={16} className="text-green-700 flex-shrink-0 mt-0.5" />
                        <span className="leading-snug">{topup.credits} image credits</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-slate-700">
                        <Check size={16} className="text-green-700 flex-shrink-0 mt-0.5" />
                        <span className="leading-snug">{topup.sms_credits} SMS credits</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-slate-700">
                        <Check size={16} className="text-green-700 flex-shrink-0 mt-0.5" />
                        <span className="leading-snug">Never expires</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-slate-700">
                        <Check size={16} className="text-green-700 flex-shrink-0 mt-0.5" />
                        <span className="leading-snug">Use across all events</span>
                      </li>
                    </ul>

                    <button
                      onClick={() => handleSubscribe(topup.id)}
                      className="w-full py-3 sm:py-3.5 rounded-lg font-medium text-sm sm:text-base transition-all bg-green-700 hover:bg-green-800 text-white active:bg-green-900 min-h-[48px]"
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
