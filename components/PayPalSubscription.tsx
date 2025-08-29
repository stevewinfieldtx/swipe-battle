import React from 'react';
import { PayPalButtons, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import { supabase } from '../supabaseClient';

interface PayPalSubscriptionProps {
  onSuccess: () => void;
  onError: (error: string) => void;
}

const PayPalSubscription: React.FC<PayPalSubscriptionProps> = ({ onSuccess, onError }) => {
  const [{ options, isPending }, dispatch] = usePayPalScriptReducer();

  const createSubscription = (data: any, actions: any) => {
    return actions.subscription.create({
      plan_id: import.meta.env.VITE_PAYPAL_PLAN_ID || 'P-1AE73499FY9355503NCZCCLY', // Your PayPal subscription plan
    });
  };

  const onApprove = async (data: any, actions: any) => {
    try {
      console.log('PayPal subscription approved:', data);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Update user metadata to grant premium access
      const { error } = await supabase.auth.updateUser({
        data: { 
          is_premium: true,
          paypal_subscription_id: data.subscriptionID
        }
      });

      if (error) throw error;

      console.log('User upgraded to premium successfully');
      onSuccess();
    } catch (error: any) {
      console.error('Error processing PayPal subscription:', error);
      onError(error.message || 'Failed to process subscription');
    }
  };

  const onErrorHandler = (err: any) => {
    console.error('PayPal error:', err);
    onError('PayPal payment failed. Please try again.');
  };

  const onCancel = (data: any) => {
    console.log('PayPal subscription cancelled:', data);
    onError('Payment was cancelled');
  };

  if (isPending) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
        <span className="ml-2 text-gray-300">Loading PayPal...</span>
      </div>
    );
  }

  return (
    <div className="w-full">
      <PayPalButtons
        createSubscription={createSubscription}
        onApprove={onApprove}
        onError={onErrorHandler}
        onCancel={onCancel}
        style={{
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'subscribe'
        }}
      />
    </div>
  );
};

export default PayPalSubscription;
