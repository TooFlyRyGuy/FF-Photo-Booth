import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Bolt Integration',
    version: '1.0.0',
  },
});

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response('No signature found', { status: 400 });
    }

    const body = await req.text();

    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
    } catch (error: any) {
      console.error(`Webhook signature verification failed: ${error.message}`);
      return new Response(`Webhook signature verification failed: ${error.message}`, { status: 400 });
    }

    EdgeRuntime.waitUntil(handleEvent(event));

    return Response.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function handleEvent(event: Stripe.Event) {
  const stripeData = event?.data?.object ?? {};

  if (!stripeData) {
    return;
  }

  if (!('customer' in stripeData)) {
    return;
  }

  if (event.type === 'payment_intent.succeeded' && event.data.object.invoice === null) {
    return;
  }

  const { customer: customerId } = stripeData;

  if (!customerId || typeof customerId !== 'string') {
    console.error(`No customer received on event: ${JSON.stringify(event)}`);
  } else {
    let isSubscription = true;

    if (event.type === 'checkout.session.completed') {
      const { mode } = stripeData as Stripe.Checkout.Session;

      isSubscription = mode === 'subscription';

      console.info(`Processing ${isSubscription ? 'subscription' : 'one-time payment'} checkout session`);
    }

    const { mode, payment_status } = stripeData as Stripe.Checkout.Session;

    if (isSubscription) {
      console.info(`Starting subscription sync for customer: ${customerId}`);
      await syncCustomerFromStripe(customerId);
    } else if (mode === 'payment' && payment_status === 'paid') {
      try {
        await handleOneTimePayment(stripeData as Stripe.Checkout.Session, customerId);
      } catch (error) {
        console.error('Error processing one-time payment:', error);
      }
    }
  }
}

async function handleOneTimePayment(session: Stripe.Checkout.Session, customerId: string) {
  const {
    id: checkout_session_id,
    payment_intent,
    amount_subtotal,
    amount_total,
    currency,
    payment_status,
    metadata,
  } = session;

  const { data: customer } = await supabase
    .from('stripe_customers')
    .select('user_id')
    .eq('customer_id', customerId)
    .maybeSingle();

  if (!customer) {
    console.error('Customer not found in database');
    return;
  }

  const userId = customer.user_id;

  if (metadata?.purchase_type === 'event_pass') {
    const eventPassTierId = metadata.event_pass_tier_id;
    const eventId = metadata.event_id || null;
    const expirationHours = parseInt(metadata.expiration_hours || '24');

    const { error: passError } = await supabase
      .from('purchased_event_passes')
      .insert({
        user_id: userId,
        event_id: eventId,
        event_pass_tier_id: eventPassTierId,
        stripe_payment_intent_id: payment_intent as string,
        credits_allocated: parseInt(metadata.credits || '0'),
        credits_used: 0,
        prompt_limit: parseInt(metadata.prompt_limit || '0'),
        prompts_used: 0,
        expires_at: new Date(Date.now() + expirationHours * 60 * 60 * 1000).toISOString(),
        is_active: true,
      });

    if (passError) {
      console.error('Error creating event pass:', passError);
      return;
    }

    console.info(`Successfully created event pass for user ${userId}`);
  } else if (metadata?.purchase_type === 'credit_topup') {
    const credits = parseInt(metadata.credits || '0');

    const { error: creditError } = await supabase.rpc('add_topup_credits', {
      p_user_id: userId,
      p_credits: credits,
    });

    if (creditError) {
      console.error('Error adding topup credits:', creditError);
      return;
    }

    console.info(`Successfully added ${credits} topup credits for user ${userId}`);
  }

  const { error: orderError } = await supabase.from('stripe_orders').insert({
    checkout_session_id,
    payment_intent_id: payment_intent,
    customer_id: customerId,
    amount_subtotal,
    amount_total,
    currency,
    payment_status,
    status: 'completed',
  });

  if (orderError) {
    console.error('Error inserting order:', orderError);
    return;
  }

  console.info(`Successfully processed one-time payment for session: ${checkout_session_id}`);
}

async function syncCustomerFromStripe(customerId: string) {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: 'all',
      expand: ['data.default_payment_method'],
    });

    const { data: customer } = await supabase
      .from('stripe_customers')
      .select('user_id')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (!customer) {
      console.error('Customer not found in database');
      return;
    }

    const userId = customer.user_id;

    if (subscriptions.data.length === 0) {
      console.info(`No active subscriptions found for customer: ${customerId}`);
      const { error: noSubError } = await supabase.from('stripe_subscriptions').upsert(
        {
          customer_id: customerId,
          subscription_status: 'not_started',
        },
        {
          onConflict: 'customer_id',
        },
      );

      if (noSubError) {
        console.error('Error updating subscription status:', noSubError);
        throw new Error('Failed to update subscription status in database');
      }
      return;
    }

    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0].price.id;

    const { data: tier } = await supabase
      .from('subscription_tiers')
      .select('*')
      .eq('stripe_price_id', priceId)
      .maybeSingle();

    if (tier) {
      const isActive = subscription.status === 'active' || subscription.status === 'trialing';
      const currentPeriodStart = new Date(subscription.current_period_start * 1000);
      const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

      const { error: userSubError } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: userId,
          tier_id: tier.id,
          stripe_subscription_id: subscription.id,
          status: isActive ? 'active' : subscription.status as any,
          current_period_start: currentPeriodStart.toISOString(),
          current_period_end: currentPeriodEnd.toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (userSubError) {
        console.error('Error updating user subscription:', userSubError);
      }

      if (isActive) {
        const isAnnual = tier.plan_type === 'annual';

        const { error: creditsError } = await supabase
          .from('user_credits')
          .update({
            plan_type: tier.plan_type,
            subscription_tier_id: tier.id,
            images_limit: tier.credits_per_period,
            annual_credits_total: isAnnual ? tier.credits_per_period : null,
            billing_period_start: currentPeriodStart.toISOString(),
            billing_period_end: currentPeriodEnd.toISOString(),
            expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        if (creditsError) {
          console.error('Error updating user credits:', creditsError);
        }
      }

      console.info(`Successfully synced subscription for user ${userId} with tier ${tier.name}`);
    }

    const { error: subError } = await supabase.from('stripe_subscriptions').upsert(
      {
        customer_id: customerId,
        subscription_id: subscription.id,
        price_id: priceId,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        ...(subscription.default_payment_method && typeof subscription.default_payment_method !== 'string'
          ? {
              payment_method_brand: subscription.default_payment_method.card?.brand ?? null,
              payment_method_last4: subscription.default_payment_method.card?.last4 ?? null,
            }
          : {}),
        status: subscription.status,
      },
      {
        onConflict: 'customer_id',
      },
    );

    if (subError) {
      console.error('Error syncing subscription:', subError);
      throw new Error('Failed to sync subscription in database');
    }

    console.info(`Successfully synced subscription for customer: ${customerId}`);
  } catch (error) {
    console.error(`Failed to sync subscription for customer ${customerId}:`, error);
    throw error;
  }
}
