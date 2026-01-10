import { supabase } from '../lib/supabase';

export interface CreditBalance {
  subscription_credits: number;
  purchased_credits: number;
  event_credits: number;
  total: number;
}

export interface CreditLedgerEntry {
  id: string;
  user_id: string;
  source: 'subscription' | 'credit_pack' | 'event' | 'admin_grant' | 'consumption';
  amount: number;
  balance_after: number;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface CreditTopupProduct {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  is_active: boolean;
  display_order: number;
}

export const getCreditBalance = async (userId: string): Promise<CreditBalance> => {
  const { data, error } = await supabase
    .from('user_credits')
    .select('subscription_credits, purchased_credits, event_credits')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch credit balance:', error);
    return {
      subscription_credits: 0,
      purchased_credits: 0,
      event_credits: 0,
      total: 0,
    };
  }

  if (!data) {
    return {
      subscription_credits: 0,
      purchased_credits: 0,
      event_credits: 0,
      total: 0,
    };
  }

  return {
    subscription_credits: data.subscription_credits || 0,
    purchased_credits: data.purchased_credits || 0,
    event_credits: data.event_credits || 0,
    total: (data.subscription_credits || 0) + (data.purchased_credits || 0) + (data.event_credits || 0),
  };
};

export const consumeCredit = async (userId: string, amount: number = 1): Promise<{
  success: boolean;
  consumed_from?: string;
  balance_after?: number;
  error?: string;
  available?: number;
}> => {
  const { data, error } = await supabase.rpc('consume_credit', {
    p_user_id: userId,
    p_amount: amount,
  });

  if (error) {
    console.error('Failed to consume credit:', error);
    return {
      success: false,
      error: 'Failed to consume credit',
    };
  }

  return data;
};

export const addPurchasedCredits = async (
  userId: string,
  credits: number,
  stripeSessionId?: string,
  stripePaymentIntentId?: string
): Promise<{
  success: boolean;
  credits_added?: number;
  new_balance?: number;
  error?: string;
}> => {
  const { data, error } = await supabase.rpc('add_purchased_credits', {
    p_user_id: userId,
    p_credits: credits,
    p_stripe_session_id: stripeSessionId || null,
    p_stripe_payment_intent_id: stripePaymentIntentId || null,
  });

  if (error) {
    console.error('Failed to add purchased credits:', error);
    return {
      success: false,
      error: 'Failed to add purchased credits',
    };
  }

  return data;
};

export const getCreditLedger = async (
  userId: string,
  limit: number = 50
): Promise<CreditLedgerEntry[]> => {
  const { data, error } = await supabase
    .from('credit_ledger')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch credit ledger:', error);
    return [];
  }

  return data || [];
};

export const getCreditTopupProducts = async (): Promise<CreditTopupProduct[]> => {
  const { data, error } = await supabase
    .from('credit_topup_products')
    .select('*')
    .eq('is_active', true)
    .order('display_order');

  if (error) {
    console.error('Failed to fetch credit topup products:', error);
    return [];
  }

  return data || [];
};

export const checkCreditAvailability = async (userId: string): Promise<{
  available: boolean;
  remaining: number;
  breakdown: CreditBalance;
  reason?: string;
}> => {
  const balance = await getCreditBalance(userId);

  if (balance.total <= 0) {
    return {
      available: false,
      remaining: 0,
      breakdown: balance,
      reason: 'No credits available. Please purchase credits or upgrade your plan.',
    };
  }

  return {
    available: true,
    remaining: balance.total,
    breakdown: balance,
  };
};

export const getTotalCredits = async (userId: string): Promise<number> => {
  const { data, error } = await supabase.rpc('get_total_credits', {
    p_user_id: userId,
  });

  if (error) {
    console.error('Failed to get total credits:', error);
    return 0;
  }

  return data || 0;
};
