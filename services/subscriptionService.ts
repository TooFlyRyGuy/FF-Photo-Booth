import { supabase } from '../lib/supabase';

export interface SubscriptionTier {
  id: string;
  name: string;
  plan_type: 'monthly' | 'annual';
  tier: 'starter' | 'pro' | 'premium' | 'agency';
  price_cents: number;
  credits_per_period: number;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  is_active: boolean;
  display_order: number;
  description: string | null;
  features: string[];
}

export interface UserSubscription {
  id: string;
  user_id: string;
  tier_id: string;
  stripe_subscription_id: string | null;
  status: 'active' | 'cancelled' | 'expired' | 'past_due';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  tier?: SubscriptionTier;
}

export interface PurchasedEventPass {
  id: string;
  user_id: string;
  event_id: string | null;
  event_pass_tier_id: string;
  stripe_payment_intent_id: string | null;
  credits_allocated: number;
  credits_used: number;
  prompt_limit: number;
  prompts_used: number;
  purchased_at: string;
  expires_at: string;
  is_active: boolean;
}

export interface UserCredits {
  id: string;
  user_id: string;
  images_limit: number;
  images_used: number;
  plan_type: 'free' | 'monthly' | 'annual' | 'event' | 'topup';
  subscription_tier_id: string | null;
  purchased_event_pass_id: string | null;
  expires_at: string | null;
  annual_credits_total: number | null;
  annual_credits_used: number;
  billing_period_start: string | null;
  billing_period_end: string | null;
}

export const getSubscriptionTiers = async (): Promise<SubscriptionTier[]> => {
  const { data, error } = await supabase
    .from('subscription_tiers')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch subscription tiers: ${error.message}`);
  }

  return data || [];
};

export const getUserSubscription = async (userId: string): Promise<UserSubscription | null> => {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select(`
      *,
      tier:subscription_tiers(*)
    `)
    .eq('user_id', userId)
    .in('status', ['active', 'past_due'])
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch user subscription: ${error.message}`);
  }

  return data;
};

export const getUserEventPasses = async (userId: string): Promise<PurchasedEventPass[]> => {
  const { data, error } = await supabase
    .from('purchased_event_passes')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .gte('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch event passes: ${error.message}`);
  }

  return data || [];
};

export const checkCreditAvailability = async (userId: string): Promise<{
  available: boolean;
  remaining: number;
  reason?: string;
}> => {
  const { data: credits, error } = await supabase
    .from('user_credits')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !credits) {
    return { available: false, remaining: 0, reason: 'Unable to fetch credit information' };
  }

  if (credits.expires_at) {
    const expiresAt = new Date(credits.expires_at);
    if (expiresAt < new Date()) {
      return { available: false, remaining: 0, reason: 'Credits have expired' };
    }
  }

  const remaining = credits.images_limit - credits.images_used;

  if (remaining <= 0) {
    return { available: false, remaining: 0, reason: 'No credits remaining' };
  }

  if (credits.plan_type === 'annual' && credits.annual_credits_total) {
    const softMonthlyLimit = Math.ceil(credits.annual_credits_total / 12);
    const currentMonthUsage = credits.images_used;

    const now = new Date();
    const billingStart = credits.billing_period_start ? new Date(credits.billing_period_start) : new Date(now.getFullYear(), 0, 1);
    const monthsSinceBillingStart = (now.getFullYear() - billingStart.getFullYear()) * 12 + (now.getMonth() - billingStart.getMonth());
    const allowedUsage = softMonthlyLimit * (monthsSinceBillingStart + 1);

    if (currentMonthUsage >= allowedUsage && currentMonthUsage >= credits.annual_credits_total) {
      return {
        available: false,
        remaining: 0,
        reason: 'Annual credit limit reached. Soft pacing enforced.'
      };
    }
  }

  return { available: true, remaining };
};

export const consumeCredit = async (userId: string): Promise<boolean> => {
  const { available } = await checkCreditAvailability(userId);

  if (!available) {
    return false;
  }

  const { error } = await supabase
    .from('user_credits')
    .update({
      images_used: supabase.raw('images_used + 1'),
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to consume credit:', error);
    return false;
  }

  return true;
};

export const resetMonthlyCredits = async (userId: string): Promise<void> => {
  const subscription = await getUserSubscription(userId);

  if (!subscription || subscription.status !== 'active') {
    return;
  }

  if (subscription.tier?.plan_type !== 'monthly') {
    return;
  }

  const { error } = await supabase
    .from('user_credits')
    .update({
      images_used: 0,
      billing_period_start: subscription.current_period_start,
      billing_period_end: subscription.current_period_end,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('plan_type', 'monthly');

  if (error) {
    console.error('Failed to reset monthly credits:', error);
    throw error;
  }
};

export const activateSubscription = async (
  userId: string,
  tierId: string,
  stripeSubscriptionId: string,
  currentPeriodStart: Date,
  currentPeriodEnd: Date
): Promise<void> => {
  const { data: tier, error: tierError } = await supabase
    .from('subscription_tiers')
    .select('*')
    .eq('id', tierId)
    .maybeSingle();

  if (tierError || !tier) {
    throw new Error('Subscription tier not found');
  }

  const { error: subError } = await supabase
    .from('user_subscriptions')
    .upsert({
      user_id: userId,
      tier_id: tierId,
      stripe_subscription_id: stripeSubscriptionId,
      status: 'active',
      current_period_start: currentPeriodStart.toISOString(),
      current_period_end: currentPeriodEnd.toISOString(),
      cancel_at_period_end: false,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,tier_id'
    });

  if (subError) {
    throw new Error(`Failed to activate subscription: ${subError.message}`);
  }

  const isAnnual = tier.plan_type === 'annual';

  const { error: creditsError } = await supabase
    .from('user_credits')
    .update({
      plan_type: tier.plan_type,
      subscription_tier_id: tierId,
      images_limit: tier.credits_per_period,
      images_used: 0,
      annual_credits_total: isAnnual ? tier.credits_per_period : null,
      annual_credits_used: 0,
      billing_period_start: currentPeriodStart.toISOString(),
      billing_period_end: currentPeriodEnd.toISOString(),
      expires_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  if (creditsError) {
    throw new Error(`Failed to update credits: ${creditsError.message}`);
  }
};

export const purchaseEventPass = async (
  userId: string,
  eventPassTierId: string,
  eventId: string | null,
  stripePaymentIntentId: string,
  expirationHours: number
): Promise<string> => {
  const { data: tier, error: tierError } = await supabase
    .from('event_passes')
    .select('*')
    .eq('id', eventPassTierId)
    .maybeSingle();

  if (tierError || !tier) {
    throw new Error('Event pass tier not found');
  }

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expirationHours);

  const { data: purchasedPass, error: passError } = await supabase
    .from('purchased_event_passes')
    .insert({
      user_id: userId,
      event_id: eventId,
      event_pass_tier_id: eventPassTierId,
      stripe_payment_intent_id: stripePaymentIntentId,
      credits_allocated: tier.credits,
      credits_used: 0,
      prompt_limit: tier.prompts_limit || 0,
      prompts_used: 0,
      expires_at: expiresAt.toISOString(),
      is_active: true
    })
    .select()
    .single();

  if (passError || !purchasedPass) {
    throw new Error(`Failed to create event pass: ${passError?.message}`);
  }

  const { error: creditsError } = await supabase
    .from('user_credits')
    .update({
      plan_type: 'event',
      purchased_event_pass_id: purchasedPass.id,
      images_limit: tier.credits,
      images_used: 0,
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  if (creditsError) {
    throw new Error(`Failed to update credits: ${creditsError.message}`);
  }

  return purchasedPass.id;
};
