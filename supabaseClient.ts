import { createClient } from '@supabase/supabase-js';
import { loadStripe } from '@stripe/stripe-js';
import type { Stripe } from '@stripe/stripe-js';

// IMPORTANT: The key you need is your project's PUBLIC ANON KEY.
// An S3 Access Key will not work here and will cause an authentication error.
//
// How to find your anon key:
// 1. Go to your Supabase project dashboard.
// 2. Click the 'Settings' icon (the gear).
// 3. Click 'API' in the menu.
// 4. Under 'Project API keys', find the key labeled 'public' or 'anon' and copy it.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qmclolibbzaeewssqycy.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtY2xvbGliYnphZWV3c3NxeWN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNjQzOTksImV4cCI6MjA3MDk0MDM5OX0.CDn_kCXJ1h5qnd3OkcX2f8P_98PKbteiwsDO7DL2To4';

// === STRIPE CONFIGURATION - FILL THESE IN ===
// 1. Find your PUBLISHABLE key in your Stripe dashboard: Developers > API keys
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_51RdgxfK9saWlF7A0tlfgjBAUjQl46ViLMW61Na9F7yjKd2oZaVcRwcNHx61yY48ibpfscz7W7GJHs3Pr5soIaREa00nvifuqx8';
// 2. Create a Product in your Stripe dashboard, add a recurring Price, and copy its ID.
export const STRIPE_PRICE_ID = import.meta.env.VITE_STRIPE_PRICE_ID || 'prod_SbVXKcRghtsVwA'; 
// 3. The following keys are used in Supabase Edge Functions. You will need to set them as environment variables in your Supabase project settings.
//    - STRIPE_SECRET_KEY: Your Stripe SECRET key.
//    - STRIPE_WEBHOOK_SECRET: The signing secret for your Stripe webhook endpoint.

// ==========================================

export const IS_CONFIGURED = supabaseUrl && supabaseAnonKey && !supabaseAnonKey.includes('YOUR_SUPABASE');
export const IS_STRIPE_CONFIGURED = STRIPE_PUBLISHABLE_KEY && !STRIPE_PUBLISHABLE_KEY.includes('YOUR_STRIPE');


if (!IS_CONFIGURED) {
  console.error("Supabase credentials are not configured. Please open supabaseClient.ts and add your project's public anon key.");
}

if (!IS_STRIPE_CONFIGURED) {
    console.error("Stripe is not configured. Please add your Stripe Publishable Key to supabaseClient.ts.");
}


export const supabase = createClient(supabaseUrl, supabaseAnonKey);

let stripePromise: Promise<Stripe | null>;
export const getStripe = () => {
  if (!stripePromise && IS_STRIPE_CONFIGURED) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
};


export const BUCKET_NAME = 'model-images';
export const NSFW_BUCKET_NAME = 'model-images-nsfw';