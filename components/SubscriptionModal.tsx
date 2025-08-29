import React, { useState } from 'react';
import PayPalSubscription from './PayPalSubscription';

interface SubscriptionModalProps {
  onClose: () => void;
  onSubscribe: () => void;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ onClose, onSubscribe }) => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handlePayPalSuccess = () => {
    setSuccess(true);
    setError(null);
    // Call the parent's onSubscribe to trigger any additional logic
    onSubscribe();
    // Close modal after a short delay to show success
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  const handlePayPalError = (errorMessage: string) => {
    setError(errorMessage);
    setSuccess(false);
  };

  if (success) {
    return (
      <div 
        className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fade-in"
        aria-modal="true"
        role="dialog"
      >
        <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md text-center text-white">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-600">
            Welcome to Premium!
          </h2>
          <p className="text-gray-300 mb-6">
            Your subscription is now active. Enjoy unlimited access to NSFW battles!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fade-in"
      aria-modal="true"
      role="dialog"
      onClick={onClose}
    >
      <div 
        className="bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md text-center text-white transform transition-all"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <h2 className="text-3xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
          Unlock NSFW Mode
        </h2>
        <p className="text-gray-300 mb-6">
          Get exclusive access to the NSFW battles by becoming a premium member.
        </p>
        <ul className="text-left text-gray-300 mb-8 list-disc list-inside space-y-2">
          <li>Access to all NSFW model battles.</li>
          <li>Support the continued development of the game.</li>
          <li>Ad-free experience (coming soon!).</li>
        </ul>
        
        {error && (
          <div className="mb-4 p-3 bg-red-600/20 border border-red-600 rounded-lg text-red-300">
            {error}
          </div>
        )}

        <div className="mb-4">
          <PayPalSubscription 
            onSuccess={handlePayPalSuccess}
            onError={handlePayPalError}
          />
        </div>

        <button
          onClick={onClose}
          className="mt-4 text-gray-400 hover:text-white transition-colors"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
};

export default SubscriptionModal;
