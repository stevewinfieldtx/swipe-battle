# Stripe Integration Setup Guide

This guide will help you properly set up the Stripe integration for the Swipe Battle application.

## Prerequisites

1. A Stripe account (https://dashboard.stripe.com/register)
2. A Supabase account (https://app.supabase.com/)
3. Supabase CLI installed (`npm install -g supabase`)

## Step 1: Configure Stripe

1. Log in to your Stripe dashboard
2. Navigate to Developers > API Keys
3. Copy your **Publishable key** (starts with `pk_`)
4. Copy your **Secret key** (starts with `sk_`)

## Step 2: Create a Product and Price

1. In your Stripe dashboard, go to Products
2. Create a new product (e.g., "Swipe Battle Premium")
3. Add a pricing plan (e.g., $4.99/month)
4. Copy the Price ID (starts with `price_`)

## Step 3: Configure Environment Variables

### For Local Development

Create or update your `.env.local` file with the following variables:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
VITE_STRIPE_PRICE_ID=price_your_stripe_price_id
```

### For Supabase Edge Functions

Set the following secrets in your Supabase project:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
supabase secrets set STRIPE_PRICE_ID=price_your_stripe_price_id
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
supabase secrets set SITE_URL=https://yourdomain.com
```

## Step 4: Set up Webhook

1. In your Stripe dashboard, go to Developers > Webhooks
2. Add a new endpoint with the URL: `https://your-supabase-project.supabase.co/functions/v1/stripe-webhook`
3. Select the `checkout.session.completed` event
4. Copy the webhook signing secret

## Step 5: Deploy Supabase Functions

```bash
supabase functions deploy create-checkout-session --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
```

## Step 6: Configure Redirect URLs

In your Supabase Auth settings, add your domain to the "Redirect URLs" list:
- `http://localhost:3000` (for local development)
- `https://yourdomain.com` (for production)

## Testing

1. Start your development server: `npm run dev`
2. Sign up for an account in the app
3. Try to access the NSFW mode to trigger the subscription flow
4. Use Stripe's test cards (e.g., 4242 4242 4242 4242) for testing

## Troubleshooting

### "Stripe is not configured" error

Make sure you've set the `VITE_STRIPE_PUBLISHABLE_KEY` in your `.env.local` file.

### "Could not initiate subscription" error

Check the browser console and Supabase function logs for detailed error messages.

### Webhook not working

1. Verify the webhook URL is correct
2. Ensure the `STRIPE_WEBHOOK_SECRET` is set correctly
3. Check the Supabase function logs for errors

## Security Notes

- Never commit your secret keys to version control
- Use environment variables for all sensitive information
- Regularly rotate your API keys
- Use test keys during development