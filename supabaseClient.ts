import { createClient } from '@supabase/supabase-js';

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

// === PAYPAL CONFIGURATION ===
// PayPal is now used for subscriptions instead of Stripe

export const IS_CONFIGURED = supabaseUrl && supabaseAnonKey && !supabaseAnonKey.includes('YOUR_SUPABASE');

if (!IS_CONFIGURED) {
  console.error("Supabase credentials are not configured. Please open supabaseClient.ts and add your project's public anon key.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);


export const BUCKET_NAME = 'model-images';
export const NSFW_BUCKET_NAME = 'model-images-nsfw';