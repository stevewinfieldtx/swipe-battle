import React from 'react';

interface SubscriptionModalProps {
  onClose: () => void;
  onSubscribe: () => void;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ onClose, onSubscribe }) => {
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
        <button
          onClick={onSubscribe}
          className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-4 px-8 rounded-full text-xl transition-transform duration-300 transform hover:scale-105 shadow-lg shadow-pink-500/50"
        >
          Subscribe Now
        </button>
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
