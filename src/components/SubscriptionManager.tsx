import React, { useState, useEffect } from 'react';
import { X, CreditCard, Check, Loader as Loader2, Crown, Zap, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SubscriptionManagerProps {
  onClose: () => void;
}

interface SubscriptionData {
  subscription_status: string;
  price_id: string | null;
  current_period_end: number | null;
  cancel_at_period_end: boolean;
}

interface SubscriptionTier {
  id: string;
  name: string;
  billing_period: 'monthly' | 'annual';
  tier: string;
  price_cents: number;
  credits_per_period: number;
  prompts_limit: number | null;
  rollover_enabled: boolean;
  features: string[];
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  is_active: boolean;
  display_order: number;
}

const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ onClose }) => {
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadSubscription(), loadTiers()]);
    setLoading(false);
  };

  const loadSubscription = async () => {
    try {
      const { data, error } = await supabase
        .from('stripe_user_subscriptions')
        .select('subscription_status, price_id, current_period_end, cancel_at_period_end')
        .maybeSingle();

      if (error) {
        console.error('Error loading subscription:', error);
      } else {
        setSubscription(data);
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
    }
  };

  const loadTiers = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('is_active', true)
        .not('stripe_price_id', 'is', null)
        .order('display_order');

      if (error) {
        console.error('Error loading subscription tiers:', error);
      } else {
        setTiers(data || []);
      }
    } catch (error) {
      console.error('Error loading subscription tiers:', error);
    }
  };

  const handleCheckout = async (priceId: string) => {
    setCheckoutLoading(priceId);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          price_id: priceId,
          success_url: `${window.location.origin}/success`,
          cancel_url: window.location.href,
          mode: 'subscription',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      alert(`Failed to start checkout: ${error.message}`);
    } finally {
      setCheckoutLoading(null);
    }
  };

  const formatPrice = (priceCents: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(priceCents / 100);
  };

  const currentTier = subscription?.price_id
    ? tiers.find(tier => tier.stripe_price_id === subscription.price_id)
    : null;
  const isActive = subscription?.subscription_status === 'active';

  const filteredTiers = tiers.filter(tier =>
    tier.billing_period === (billingCycle === 'monthly' ? 'monthly' : 'annual')
  );

  const getTierIcon = (tierName: string) => {
    const lowerName = tierName.toLowerCase();
    if (lowerName.includes('enterprise') || lowerName.includes('agency')) return <Crown className="w-5 h-5" />;
    if (lowerName.includes('professional') || lowerName.includes('pro') || lowerName.includes('premium')) return <Star className="w-5 h-5" />;
    return <Zap className="w-5 h-5" />;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Manage Subscription</h2>
            {currentTier && isActive && (
              <p className="text-gray-600 mt-1">
                Current plan: <span className="font-medium text-green-700">{currentTier.name}</span>
                {subscription?.current_period_end && (
                  <span className="text-sm text-gray-500 ml-2">
                    (Renews {new Date(subscription.current_period_end * 1000).toLocaleDateString()})
                  </span>
                )}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-green-700" />
            </div>
          ) : (
            <>
              {/* Billing Cycle Toggle */}
              <div className="flex justify-center mb-8">
                <div className="bg-gray-100 p-1 rounded-lg flex">
                  <button
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      billingCycle === 'monthly'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingCycle('yearly')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      billingCycle === 'yearly'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Yearly
                    <span className="ml-1 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                      Save 17%
                    </span>
                  </button>
                </div>
              </div>

              {/* Pricing Cards */}
              {filteredTiers.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600 mb-4">No subscription plans available at this time.</p>
                  <p className="text-sm text-gray-500">Please check back later or contact support.</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-3 gap-6">
                  {filteredTiers.map((tier) => {
                    const isCurrentPlan = currentTier?.stripe_price_id === tier.stripe_price_id;
                    const isLoadingThis = checkoutLoading === tier.stripe_price_id;
                    const isPopular = tier.tier === 'pro' || tier.tier === 'premium';

                    return (
                      <div
                        key={tier.id}
                        className={`relative rounded-xl border-2 p-6 ${
                          isPopular
                            ? 'border-green-500 bg-green-50'
                            : isCurrentPlan
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        {isPopular && !isCurrentPlan && (
                          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                            <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                              Most Popular
                            </span>
                          </div>
                        )}

                        {isCurrentPlan && (
                          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                            <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                              Current Plan
                            </span>
                          </div>
                        )}

                        <div className="text-center">
                          <div className="flex items-center justify-center gap-2 mb-2">
                            {getTierIcon(tier.tier)}
                            <h3 className="text-xl font-bold text-gray-900">{tier.name}</h3>
                          </div>

                          <div className="mb-4">
                            <span className="text-3xl font-bold text-gray-900">
                              {formatPrice(tier.price_cents)}
                            </span>
                            <span className="text-gray-600">
                              /{tier.billing_period === 'annual' ? 'year' : 'month'}
                            </span>
                          </div>

                          <p className="text-gray-600 text-sm mb-2">
                            {tier.credits_per_period >= 999999
                              ? 'Unlimited'
                              : tier.credits_per_period.toLocaleString()}{' '}
                            credits per {tier.billing_period === 'annual' ? 'year' : 'month'}
                          </p>

                          <button
                            onClick={() => handleCheckout(tier.stripe_price_id!)}
                            disabled={isCurrentPlan || isLoadingThis || !tier.stripe_price_id}
                            className={`w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                              isCurrentPlan
                                ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                : isPopular
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'bg-gray-900 hover:bg-gray-800 text-white'
                            }`}
                          >
                            {isLoadingThis ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : isCurrentPlan ? (
                              'Current Plan'
                            ) : (
                              <>
                                <CreditCard size={16} />
                                Subscribe
                              </>
                            )}
                          </button>
                        </div>

                        <div className="mt-6 space-y-3">
                          {tier.features.map((feature, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                              <span className="text-sm text-gray-600">{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Current Subscription Status */}
              {subscription && (
                <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Subscription Status</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Status: <span className="capitalize font-medium">{subscription.subscription_status}</span></p>
                    {subscription.current_period_end && (
                      <p>
                        {subscription.cancel_at_period_end ? 'Expires' : 'Renews'}: {' '}
                        {new Date(subscription.current_period_end * 1000).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionManager;