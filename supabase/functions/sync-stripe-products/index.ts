import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecret) {
      return new Response(JSON.stringify({ error: 'Stripe not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(stripeSecret, {
      appInfo: {
        name: 'Fun Frame Photo AI',
        version: '1.0.0',
      },
    });

    // Fetch all active products and prices from Stripe
    const products = await stripe.products.list({ active: true, limit: 100 });
    const prices = await stripe.prices.list({ active: true, limit: 100 });

    // Create a map of prices by product ID
    const pricesByProduct = new Map<string, Stripe.Price[]>();
    for (const price of prices.data) {
      const productId = typeof price.product === 'string' ? price.product : price.product.id;
      if (!pricesByProduct.has(productId)) {
        pricesByProduct.set(productId, []);
      }
      pricesByProduct.get(productId)!.push(price);
    }

    const syncResults = {
      subscriptions: [] as any[],
      creditTopups: [] as any[],
      eventPasses: [] as any[],
      addOns: [] as any[],
      skipped: [] as any[],
    };

    // Process each product
    for (const product of products.data) {
      const productPrices = pricesByProduct.get(product.id) || [];

      // Skip products with no prices
      if (productPrices.length === 0) {
        syncResults.skipped.push({
          id: product.id,
          name: product.name,
          reason: 'No active prices found',
        });
        continue;
      }

      // Get the primary price (first one)
      const price = productPrices[0];
      const priceCents = price.unit_amount || 0;

      // Determine product type from metadata
      const productType = product.metadata?.type || 'subscription';

      try {
        if (productType === 'subscription') {
          // Sync to subscription_tiers
          const billingPeriod = price.recurring?.interval === 'year' ? 'annual' : 'monthly';
          const tier = product.metadata?.tier || 'starter';
          const creditsPerPeriod = parseInt(product.metadata?.credits_per_period || '100');
          const promptsLimit = product.metadata?.prompts_limit ? parseInt(product.metadata.prompts_limit) : null;
          const rolloverEnabled = product.metadata?.rollover_enabled === 'true';
          const features = product.description ? product.description.split('\n').filter(f => f.trim()) : [];

          const { data, error } = await supabase
            .from('subscription_tiers')
            .upsert({
              name: product.name,
              billing_period: billingPeriod,
              tier: tier,
              price_cents: priceCents,
              credits_per_period: creditsPerPeriod,
              prompts_limit: promptsLimit,
              rollover_enabled: rolloverEnabled,
              features: features,
              stripe_price_id: price.id,
              stripe_product_id: product.id,
              is_active: product.active,
              display_order: parseInt(product.metadata?.display_order || '0'),
            }, {
              onConflict: 'stripe_product_id',
              ignoreDuplicates: false,
            });

          if (error) {
            console.error('Error syncing subscription:', error);
          } else {
            syncResults.subscriptions.push({ name: product.name, priceId: price.id });
          }
        } else if (productType === 'credit_topup') {
          // Sync to credit_topup_products
          const credits = parseInt(product.metadata?.credits || '0');

          const { data, error } = await supabase
            .from('credit_topup_products')
            .upsert({
              name: product.name,
              credits: credits,
              price_cents: priceCents,
              stripe_price_id: price.id,
              stripe_product_id: product.id,
              is_active: product.active,
              display_order: parseInt(product.metadata?.display_order || '0'),
            }, {
              onConflict: 'stripe_product_id',
              ignoreDuplicates: false,
            });

          if (error) {
            console.error('Error syncing credit topup:', error);
          } else {
            syncResults.creditTopups.push({ name: product.name, priceId: price.id });
          }
        } else if (productType === 'event_pass') {
          // Sync to event_passes
          const credits = parseInt(product.metadata?.credits || '0');
          const durationHours = parseInt(product.metadata?.duration_hours || '4');
          const setupIncluded = product.metadata?.setup_included === 'true';
          const promptsLimit = product.metadata?.prompts_limit ? parseInt(product.metadata.prompts_limit) : null;
          const features = product.description ? product.description.split('\n').filter(f => f.trim()) : [];

          const { data, error } = await supabase
            .from('event_passes')
            .upsert({
              name: product.name,
              price_cents: priceCents,
              credits: credits,
              duration_hours: durationHours,
              setup_included: setupIncluded,
              prompts_limit: promptsLimit,
              features: features,
              stripe_price_id: price.id,
              stripe_product_id: product.id,
              is_active: product.active,
              display_order: parseInt(product.metadata?.display_order || '0'),
            }, {
              onConflict: 'stripe_product_id',
              ignoreDuplicates: false,
            });

          if (error) {
            console.error('Error syncing event pass:', error);
          } else {
            syncResults.eventPasses.push({ name: product.name, priceId: price.id });
          }
        } else if (productType === 'add_on') {
          // Sync to add_ons
          const deliveryMethod = product.metadata?.delivery_method || 'zoom';
          const durationMinutes = product.metadata?.duration_minutes ? parseInt(product.metadata.duration_minutes) : null;
          const calendlyLink = product.metadata?.calendly_link || null;

          const { data, error } = await supabase
            .from('add_ons')
            .upsert({
              name: product.name,
              description: product.description || '',
              price_cents: priceCents,
              delivery_method: deliveryMethod,
              duration_minutes: durationMinutes,
              calendly_link: calendlyLink,
              stripe_price_id: price.id,
              stripe_product_id: product.id,
              is_active: product.active,
            }, {
              onConflict: 'stripe_product_id',
              ignoreDuplicates: false,
            });

          if (error) {
            console.error('Error syncing add-on:', error);
          } else {
            syncResults.addOns.push({ name: product.name, priceId: price.id });
          }
        } else {
          syncResults.skipped.push({
            id: product.id,
            name: product.name,
            reason: `Unknown product type: ${productType}`,
          });
        }
      } catch (error: any) {
        console.error(`Error processing product ${product.name}:`, error);
        syncResults.skipped.push({
          id: product.id,
          name: product.name,
          reason: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Stripe products synced successfully',
        results: syncResults,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to sync Stripe products',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
