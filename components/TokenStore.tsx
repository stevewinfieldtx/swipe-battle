import React, { useState } from 'react';
import { TokenPurchaseOption } from '../types';

interface TokenStoreProps {
  currentBalance: number;
  onPurchase: (tokens: number) => void;
  onClose: () => void;
}

const TokenStore: React.FC<TokenStoreProps> = ({ currentBalance, onPurchase, onClose }) => {
  const [selectedPackage, setSelectedPackage] = useState<TokenPurchaseOption | null>(null);
  const [loading, setLoading] = useState(false);

  const tokenPackages: TokenPurchaseOption[] = [
    {
      id: 'starter',
      tokens: 10,
      price: 2.50,
      bonus: 0
    },
    {
      id: 'popular',
      tokens: 22,
      price: 5.00,
      bonus: 2,
      popular: true
    },
    {
      id: 'value',
      tokens: 45,
      price: 10.00,
      bonus: 5
    },
    {
      id: 'great',
      tokens: 69,
      price: 15.00,
      bonus: 9
    },
    {
      id: 'premium',
      tokens: 94,
      price: 20.00,
      bonus: 14
    },
    {
      id: 'ultimate',
      tokens: 120,
      price: 25.00,
      bonus: 20
    }
  ];

  const handlePurchase = (packageOption: TokenPurchaseOption) => {
    setSelectedPackage(packageOption);
    // PayPal button will handle the actual payment
    // The webhook will award tokens when payment is completed
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Buy Tokens</h2>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>
          <div className="mt-2 flex items-center text-purple-400">
            <span className="text-2xl mr-2">🪙</span>
            <span className="text-lg">Current Balance: {currentBalance} tokens</span>
          </div>
        </div>

        {/* Pricing Info */}
        <div className="p-6 bg-gray-800/50">
          <h3 className="text-lg font-semibold text-white mb-3">Token Usage</h3>
          <div className="space-y-2 text-sm text-gray-300">
            <div className="flex justify-between">
              <span>SFW Photo (Bikini/Lingerie)</span>
              <span className="text-purple-400">2 tokens ($0.50)</span>
            </div>
            <div className="flex justify-between">
              <span>Topless Photo</span>
              <span className="text-pink-400">3 tokens ($0.75)</span>
            </div>
            <div className="flex justify-between">
              <span>Nude Photo</span>
              <span className="text-red-400">4 tokens ($1.00)</span>
            </div>
            <div className="flex justify-between border-t border-gray-600 pt-2 mt-2">
              <span>30-Minute Chat Session</span>
              <span className="text-blue-400">20 tokens ($5.00)</span>
            </div>
          </div>
        </div>

        {/* Token Packages */}
        <div className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Choose Package</h3>
          <div className="space-y-3">
            {tokenPackages.map((pkg) => (
              <div 
                key={pkg.id}
                className={`relative rounded-xl border-2 p-4 cursor-pointer transition-all ${
                  pkg.popular 
                    ? 'border-purple-500 bg-purple-900/20' 
                    : 'border-gray-600 hover:border-purple-400 bg-gray-800/50'
                }`}
                onClick={() => handlePurchase(pkg)}
              >
                {pkg.popular && (
                  <div className="absolute -top-2 left-4 bg-purple-600 text-white text-xs px-2 py-1 rounded-full">
                    MOST POPULAR
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-bold text-lg">
                      {pkg.tokens + (pkg.bonus || 0)} Tokens
                    </div>
                    <div className="text-gray-400 text-sm">
                      {pkg.tokens - pkg.bonus} base + {pkg.bonus} bonus
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-bold text-xl">
                      ${pkg.price}
                    </div>
                    {pkg.bonus && pkg.bonus > 0 && (
                      <div className="text-purple-400 text-sm">
                        +{pkg.bonus} FREE
                      </div>
                    )}
                  </div>
                </div>

                {loading && selectedPackage?.id === pkg.id && (
                  <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 text-center">
          <p className="text-gray-400 text-sm">
            Secure payment processed via PayPal
          </p>
        </div>
      </div>
    </div>
  );
};

export default TokenStore;
