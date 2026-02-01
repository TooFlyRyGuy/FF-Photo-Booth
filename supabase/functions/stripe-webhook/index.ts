import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

if (!stripeSecret) {
  throw new Error('STRIPE_SECRET_KEY environment variable is not set');
}

if (!stripeWebhookSecret) {
  console.error('STRIPE_WEBHOOK_SECRET environment variable is not set');
}

const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'FunFrame Photo AI',
    version: '2.0.0',
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
      console.error('No Stripe signature found in request headers');
      return new Response(
        JSON.stringify({ error: 'No signature found in request' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (!stripeWebhookSecret) {
      console.error('CRITICAL: STRIPE_WEBHOOK_SECRET is not configured. Please set it in Supabase project settings.');
      console.error('Instructions: https://docs.stripe.com/webhooks/quickstart');
      return new Response(
        JSON.stringify({
          error: 'Webhook secret not configured',
          message: 'STRIPE_WEBHOOK_SECRET environment variable is missing. Please configure it in Supabase project settings.'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate webhook secret format
    if (!stripeWebhookSecret.startsWith('whsec_')) {
      console.error(`Invalid STRIPE_WEBHOOK_SECRET format. Expected format: whsec_xxx, Got: ${stripeWebhookSecret.substring(0, 10)}...`);
      console.error('Please verify you copied the webhook signing secret (not the webhook ID) from Stripe Dashboard > Developers > Webhooks');
      return new Response(
        JSON.stringify({
          error: 'Invalid webhook secret format',
          message: 'STRIPE_WEBHOOK_SECRET should start with "whsec_". Please verify you copied the correct signing secret from Stripe.'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const body = await req.text();
    let event: Stripe.Event;

    console.log('Webhook verification details:');
    console.log(`- Body length: ${body.length} bytes`);
    console.log(`- Signature: ${signature.substring(0, 50)}...`);
    console.log(`- Secret prefix: ${stripeWebhookSecret.substring(0, 10)}...`);

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
      console.log(`✓ Successfully verified webhook event: ${event.type} (${event.id})`);
    } catch (error: any) {
      console.error(`✗ Webhook signature verification failed: ${error.message}`);
      console.error('Troubleshooting:');
      console.error('1. Verify STRIPE_WEBHOOK_SECRET matches the signing secret in Stripe Dashboard');
      console.error('2. Check that the webhook endpoint URL in Stripe points to this function');
      console.error('3. Ensure no proxy or firewall is modifying the request body');
      console.error(`Full error: ${JSON.stringify(error, null, 2)}`);
      return new Response(
        JSON.stringify({
          error: 'Signature verification failed',
          message: error.message,
          troubleshooting: [
            'Verify STRIPE_WEBHOOK_SECRET matches the signing secret shown in Stripe Dashboard > Developers > Webhooks',
            'Ensure the webhook URL in Stripe is correct and points to this function',
            'Check that no proxy is modifying the request'
          ]
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Log webhook event to database for tracking and debugging
    await logWebhookEvent(event);

    // Process the event asynchronously
    EdgeRuntime.waitUntil(handleEvent(event));

    return Response.json({ received: true, event_id: event.id });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function logWebhookEvent(event: Stripe.Event) {
  try {
    const stripeData = event?.data?.object ?? {};
    const customerId = ('customer' in stripeData) ? stripeData.customer as string : null;

    // Try to find user_id from customer_id
    let userId = null;
    if (customerId) {
      const { data: customer } = await supabase
        .from('stripe_customers')
        .select('user_id')
        .eq('customer_id', customerId)
        .maybeSingle();

      userId = customer?.user_id || null;
    }

    // Check if event already exists (for deduplication)
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id, processing_status')
      .eq('event_id', event.id)
      .maybeSingle();

    if (existingEvent) {
      console.log(`Webhook event ${event.id} already exists with status: ${existingEvent.processing_status}`);

      // If it was failed before, we can retry
      if (existingEvent.processing_status === 'failed') {
        await supabase
          .from('webhook_events')
          .update({
            processing_status: 'pending',
            retry_count: existingEvent.retry_count + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingEvent.id);
        console.log(`Marking failed event ${event.id} for retry (attempt ${existingEvent.retry_count + 1})`);
      }
      return;
    }

    // Insert new webhook event
    const { error: insertError } = await supabase
      .from('webhook_events')
      .insert({
        event_id: event.id,
        event_type: event.type,
        payload: event as any,
        processing_status: 'pending',
        user_id: userId,
        customer_id: customerId,
        received_at: new Date().toISOString(),
        retry_count: 0,
      });

    if (insertError) {
      console.error('Error logging webhook event:', insertError);
      // Don't fail the webhook processing if logging fails
    } else {
      console.log(`Successfully logged webhook event ${event.id}`);
    }
  } catch (error) {
    console.error('Error in logWebhookEvent:', error);
    // Don't fail the webhook processing if logging fails
  }
}

async function updateWebhookEventStatus(
  eventId: string,
  status: 'processing' | 'completed' | 'failed' | 'skipped',
  errorMessage?: string
) {
  try {
    const updates: any = {
      processing_status: status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'processing') {
      updates.processing_started_at = new Date().toISOString();
    } else if (status === 'completed' || status === 'failed' || status === 'skipped') {
      updates.processing_completed_at = new Date().toISOString();
    }

    if (errorMessage) {
      updates.error_message = errorMessage;
    }

    await supabase
      .from('webhook_events')
      .update(updates)
      .eq('event_id', eventId);
  } catch (error) {
    console.error('Error updating webhook event status:', error);
  }
}

async function handleEvent(event: Stripe.Event) {
  try {
    await updateWebhookEventStatus(event.id, 'processing');

    const stripeData = event?.data?.object ?? {};

    if (!stripeData) {
      await updateWebhookEventStatus(event.id, 'skipped', 'No data in event');
      return;
    }

    if (!('customer' in stripeData)) {
      await updateWebhookEventStatus(event.id, 'skipped', 'No customer in event data');
      return;
    }

    // Skip payment intents that are part of a subscription invoice
    if (event.type === 'payment_intent.succeeded' && event.data.object.invoice !== null) {
      await updateWebhookEventStatus(event.id, 'skipped', 'Payment intent is part of subscription invoice');
      return;
    }

    const { customer: customerId } = stripeData;

    if (!customerId || typeof customerId !== 'string') {
      await updateWebhookEventStatus(event.id, 'failed', `Invalid customer ID: ${JSON.stringify(customerId)}`);
      console.error(`No valid customer received on event: ${JSON.stringify(event)}`);
      return;
    }

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
      await updateWebhookEventStatus(event.id, 'completed');
    } else if (mode === 'payment' && payment_status === 'paid') {
      try {
        await handleOneTimePayment(stripeData as Stripe.Checkout.Session, customerId);
        await updateWebhookEventStatus(event.id, 'completed');
      } catch (error: any) {
        console.error('Error processing one-time payment:', error);
        await updateWebhookEventStatus(event.id, 'failed', error.message);
        throw error;
      }
    } else {
      await updateWebhookEventStatus(event.id, 'skipped', `Unhandled event type or payment status: ${event.type}, mode: ${mode}, payment_status: ${payment_status}`);
    }
  } catch (error: any) {
    console.error('Error in handleEvent:', error);
    await updateWebhookEventStatus(event.id, 'failed', error.message);
    throw error;
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

  console.log(`Processing one-time payment for session: ${checkout_session_id}`);
  console.log(`Metadata:`, JSON.stringify(metadata, null, 2));

  // Check for duplicate payment processing
  const { data: existingOrder } = await supabase
    .from('stripe_orders')
    .select('id')
    .eq('checkout_session_id', checkout_session_id)
    .maybeSingle();

  if (existingOrder) {
    console.warn(`Order already processed for session ${checkout_session_id}. Skipping duplicate processing.`);
    return;
  }

  const { data: customer } = await supabase
    .from('stripe_customers')
    .select('user_id')
    .eq('customer_id', customerId)
    .maybeSingle();

  if (!customer) {
    throw new Error(`Customer ${customerId} not found in database`);
  }

  const userId = customer.user_id;
  console.log(`Processing payment for user: ${userId}`);

  // Verify user exists in user_profiles
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (!userProfile) {
    throw new Error(`User profile not found for user ${userId}`);
  }

  // Handle Event Pass Purchase
  if (metadata?.purchase_type === 'event_pass') {
    console.log('Processing event pass purchase...');
    const eventPassId = metadata.event_pass_id || metadata.event_pass_tier_id;
    const eventId = metadata.event_id || null;
    const expirationHours = parseInt(metadata.expiration_hours || '24');
    const smsCredits = parseInt(metadata.sms_credits || '0');
    const creditsAllocated = parseInt(metadata.credits || '0');
    const promptLimit = parseInt(metadata.prompt_limit || '0');

    console.log(`Event Pass Details: ${creditsAllocated} credits, ${smsCredits} SMS credits, ${expirationHours}h duration`);

    // Insert into user_event_passes (the active table)
    const { error: passError } = await supabase
      .from('user_event_passes')
      .insert({
        user_id: userId,
        event_pass_id: eventPassId,
        stripe_payment_id: payment_intent as string,
        credits_allocated: creditsAllocated,
        credits_used: 0,
        activated_at: null,
        expires_at: null,
        is_active: false,
        event_id: null,
      });

    if (passError) {
      console.error('Error creating event pass:', passError);
      throw new Error(`Failed to create event pass: ${passError.message}`);
    }

    // Also insert into purchased_event_passes for historical tracking
    const { error: purchaseError } = await supabase
      .from('purchased_event_passes')
      .insert({
        user_id: userId,
        event_id: eventId,
        event_pass_tier_id: eventPassId,
        stripe_payment_intent_id: payment_intent as string,
        credits_allocated: creditsAllocated,
        credits_used: 0,
        sms_credits_allocated: smsCredits,
        sms_credits_used: 0,
        prompt_limit: promptLimit,
        prompts_used: 0,
        expires_at: new Date(Date.now() + expirationHours * 60 * 60 * 1000).toISOString(),
        is_active: true,
      });

    if (purchaseError) {
      console.error('Error recording purchased event pass:', purchaseError);
      // Don't throw - this is for historical tracking only
    }

    // Grant image credits from event pass
    if (creditsAllocated > 0) {
      const { data: currentCredits } = await supabase
        .from('user_credits')
        .select('event_credits')
        .eq('user_id', userId)
        .maybeSingle();

      const newEventCredits = (currentCredits?.event_credits || 0) + creditsAllocated;

      const { error: creditsError } = await supabase
        .from('user_credits')
        .update({
          event_credits: newEventCredits,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (creditsError) {
        console.error('Error granting event pass image credits:', creditsError);
        throw new Error(`Failed to grant image credits: ${creditsError.message}`);
      }

      // Log to credit ledger
      const { data: totalCredits } = await supabase.rpc('get_total_credits', { p_user_id: userId });

      await supabase.from('credit_ledger').insert({
        user_id: userId,
        source: 'event',
        amount: creditsAllocated,
        balance_after: totalCredits || newEventCredits,
        stripe_session_id: checkout_session_id,
        stripe_payment_intent_id: payment_intent as string,
        metadata: {
          type: 'event_pass',
          event_pass_id: eventPassId,
          description: 'Event pass image credits'
        }
      });

      console.info(`✓ Granted ${creditsAllocated} image credits from event pass to user ${userId}`);
    }

    // Grant SMS credits if included in the event pass
    if (smsCredits > 0) {
      const { data: currentCredits } = await supabase
        .from('user_credits')
        .select('event_sms_credits')
        .eq('user_id', userId)
        .maybeSingle();

      const newSmsCredits = (currentCredits?.event_sms_credits || 0) + smsCredits;

      const { error: smsError } = await supabase
        .from('user_credits')
        .update({
          event_sms_credits: newSmsCredits,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (smsError) {
        console.error('Error granting event pass SMS credits:', smsError);
        throw new Error(`Failed to grant SMS credits: ${smsError.message}`);
      }

      // Log SMS credits to ledger
      await supabase.from('credit_ledger').insert({
        user_id: userId,
        source: 'event',
        amount: 0,
        sms_amount: smsCredits,
        balance_after: 0,
        sms_balance_after: newSmsCredits,
        stripe_session_id: checkout_session_id,
        stripe_payment_intent_id: payment_intent as string,
        metadata: {
          type: 'event_pass',
          event_pass_id: eventPassId,
          credit_type: 'sms',
          description: 'Event pass SMS credits'
        }
      });

      console.info(`✓ Granted ${smsCredits} SMS credits from event pass to user ${userId}`);
    }

    console.info(`✓ Successfully created event pass for user ${userId}`);
  }
  // Handle Credit Top-Up Purchase
  else if (metadata?.purchase_type === 'credit_topup' || metadata?.type === 'credit_topup') {
    console.log('Processing credit top-up purchase...');
    const creditsGranted = parseInt(metadata.credits_granted || metadata.credits || '0');
    const smsCreditsGranted = parseInt(metadata.sms_credits_granted || metadata.sms_credits || '0');

    console.log(`Credit Top-Up Details: ${creditsGranted} image credits, ${smsCreditsGranted} SMS credits`);

    // Check for duplicate credit grants using payment_intent_id
    if (payment_intent) {
      const { data: existingLedger } = await supabase
        .from('credit_ledger')
        .select('id')
        .eq('stripe_payment_intent_id', payment_intent as string)
        .eq('source', 'credit_pack')
        .maybeSingle();

      if (existingLedger) {
        console.warn(`Credits already granted for payment_intent ${payment_intent}. Skipping duplicate grant.`);
        return;
      }
    }

    // Add image credits
    if (creditsGranted > 0) {
      const { error: creditError } = await supabase.rpc('add_purchased_credits', {
        p_user_id: userId,
        p_credits: creditsGranted,
        p_stripe_session_id: checkout_session_id,
        p_stripe_payment_intent_id: payment_intent as string,
      });

      if (creditError) {
        console.error('Error adding purchased credits:', creditError);
        throw new Error(`Failed to add purchased credits: ${creditError.message}`);
      }

      console.info(`✓ Successfully added ${creditsGranted} purchased credits for user ${userId}`);
    }

    // Add SMS credits
    if (smsCreditsGranted > 0) {
      const { error: smsError } = await supabase.rpc('add_purchased_sms_credits', {
        p_user_id: userId,
        p_sms_credits: smsCreditsGranted,
        p_stripe_session_id: checkout_session_id,
        p_stripe_payment_intent_id: payment_intent as string,
      });

      if (smsError) {
        console.error('Error adding purchased SMS credits:', smsError);
        throw new Error(`Failed to add purchased SMS credits: ${smsError.message}`);
      }

      console.info(`✓ Successfully added ${smsCreditsGranted} purchased SMS credits for user ${userId}`);
    }
  } else {
    console.warn(`Unknown purchase type in metadata: ${JSON.stringify(metadata)}`);
  }

  // Record the order
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
    // Don't throw - order recording is for tracking only
  }

  console.info(`✓ Successfully processed one-time payment for session: ${checkout_session_id}`);
}

async function syncCustomerFromStripe(customerId: string) {
  try {
    console.log(`Syncing customer ${customerId} from Stripe...`);

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
      throw new Error(`Customer ${customerId} not found in database`);
    }

    const userId = customer.user_id;

    if (subscriptions.data.length === 0) {
      console.info(`No active subscriptions found for customer: ${customerId}`);
      const { error: noSubError } = await supabase.from('stripe_subscriptions').upsert(
        {
          customer_id: customerId,
          status: 'not_started',
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

    console.log(`Found subscription ${subscription.id} with price ${priceId}, status: ${subscription.status}`);

    const { data: tier } = await supabase
      .from('subscription_tiers_new')
      .select('*')
      .eq('stripe_price_id', priceId)
      .maybeSingle();

    if (!tier) {
      console.warn(`No tier found for price ${priceId}. Syncing subscription status only.`);
    } else {
      const isActive = subscription.status === 'active' || subscription.status === 'trialing';
      const currentPeriodStart = new Date(subscription.current_period_start * 1000);
      const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

      console.log(`Tier found: ${tier.name}, Active: ${isActive}`);

      // Update user_subscriptions table
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
        throw new Error(`Failed to update user subscription: ${userSubError.message}`);
      }

      if (isActive) {
        const isAnnual = tier.billing_period === 'annual';

        // Reset subscription credits and grant new period credits
        const { error: creditsError } = await supabase
          .from('user_credits')
          .update({
            plan_type: tier.billing_period,
            subscription_tier_id: tier.id,
            images_limit: tier.credits_per_period,
            subscription_credits: tier.credits_per_period,
            subscription_sms_credits: tier.sms_credits_per_period || 0,
            annual_credits_total: isAnnual ? tier.credits_per_period : null,
            billing_period_start: currentPeriodStart.toISOString(),
            billing_period_end: currentPeriodEnd.toISOString(),
            expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        if (creditsError) {
          console.error('Error updating user credits:', creditsError);
          throw new Error(`Failed to update user credits: ${creditsError.message}`);
        }

        // Log subscription credit allocation
        const { data: totalCredits } = await supabase.rpc('get_total_credits', { p_user_id: userId });

        await supabase.from('credit_ledger').insert({
          user_id: userId,
          source: 'subscription',
          amount: tier.credits_per_period,
          sms_amount: tier.sms_credits_per_period || 0,
          balance_after: totalCredits || tier.credits_per_period,
          sms_balance_after: tier.sms_credits_per_period || 0,
          metadata: {
            tier: tier.name,
            billing_period: tier.billing_period,
            subscription_id: subscription.id,
            description: `${tier.name} subscription credits`
          }
        });

        console.info(`✓ Granted ${tier.credits_per_period} image credits and ${tier.sms_credits_per_period || 0} SMS credits for subscription`);

        // Update user_profiles with subscription tier
        const { error: profileError } = await supabase
          .from('user_profiles')
          .update({
            subscription_tier_id: tier.id,
            subscription_status: 'active',
            subscription_start_date: currentPeriodStart.toISOString(),
            subscription_end_date: currentPeriodEnd.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        if (profileError) {
          console.error('Error updating user profile:', profileError);
          throw new Error(`Failed to update user profile: ${profileError.message}`);
        }

        console.info(`✓ Updated user profile with tier ${tier.name}`);
      }

      console.info(`✓ Successfully synced subscription for user ${userId} with tier ${tier.name}`);
    }

    // Update stripe_subscriptions table
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

    console.info(`✓ Successfully synced subscription for customer: ${customerId}`);
  } catch (error: any) {
    console.error(`Failed to sync subscription for customer ${customerId}:`, error);
    throw error;
  }
}
