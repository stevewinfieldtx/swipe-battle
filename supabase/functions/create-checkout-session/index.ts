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

const stripe = Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: '2022-11-15',
});

// This is the Price ID of the product you want to sell. 
// You can find it in your Stripe dashboard.
const STRIPE_PRICE_ID = Deno.env.get('STRIPE_PRICE_ID')!;

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
          price: STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${Deno.env.get('SITE_URL')}`, // Your app's URL
      cancel_url: `${Deno.env.get('SITE_URL')}`,
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
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});