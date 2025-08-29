// Fix: Replaced invalid Deno types reference with a global `Deno` declaration to resolve TypeScript errors.
declare const Deno: any;

// Follow this guide to deploy: https://supabase.com/docs/guides/functions/deploy
//
// 1. Set up the Supabase CLI: `npm i -g supabase`
// 2. Link your project: `supabase link --project-ref <your-project-ref>`
// 3. Set secrets: 
//    `supabase secrets set STRIPE_SECRET_KEY=<your-stripe-secret-key>`
// 4. Deploy: `supabase functions deploy create-checkout-session --no-verify-jwt`

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@12.12.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Get environment variables
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const stripePriceId = Deno.env.get('STRIPE_PRICE_ID') || 'price_1RgIWqK9saWlF7A0QFPDZwOC'; // Use default if not set
const siteUrl = Deno.env.get('SITE_URL') || 'http://localhost:3000'; // Use default if not set

// Validate required environment variables
if (!stripeSecretKey) {
  console.error('STRIPE_SECRET_KEY is not set. Please set it using: supabase secrets set STRIPE_SECRET_KEY=your_stripe_secret_key');
  throw new Error('STRIPE_SECRET_KEY is not set');
}

const stripe = new Stripe(stripeSecretKey, {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: '2022-11-15',
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    } });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${siteUrl}`, // Your app's URL
      cancel_url: `${siteUrl}`,
      // Pass the user's Supabase ID to the webhook
      client_reference_id: user.id, 
    });

    return new Response(JSON.stringify({ sessionId: session.id }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
       },
    });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});