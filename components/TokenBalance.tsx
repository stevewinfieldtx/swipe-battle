import React from 'react';

interface TokenBalanceProps {
  balance: number;
  onClick?: () => void;
  size?: 'small' | 'medium' | 'large';
  showPlusButton?: boolean;
  isCreator?: boolean;
}

const TokenBalance: React.FC<TokenBalanceProps> = ({ 
  balance, 
  onClick, 
  size = 'medium',
  showPlusButton = true,
  isCreator = false
}) => {
  const sizeClasses = {
    small: 'text-sm px-2 py-1',
    medium: 'text-base px-3 py-2',
    large: 'text-lg px-4 py-3'
  };

  const iconSizes = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-xl'
  };

  return (
    <div 
      className={`inline-flex items-center ${
        isCreator 
          ? 'bg-gradient-to-r from-yellow-500 to-orange-500' 
          : 'bg-gradient-to-r from-purple-600 to-pink-600'
      } text-white rounded-full font-semibold transition-all ${sizeClasses[size]} ${
        onClick ? 'hover:from-purple-700 hover:to-pink-700 cursor-pointer transform hover:scale-105' : ''
      }`}
      onClick={onClick}
    >
      <span className={`mr-2 ${iconSizes[size]}`}>
        {isCreator ? '👑' : '🪙'}
      </span>
      <span>{isCreator ? 'UNLIMITED' : balance.toLocaleString()}</span>
      {showPlusButton && onClick && !isCreator && (
        <span className={`ml-2 ${iconSizes[size]} opacity-80`}>+</span>
      )}
    </div>
  );
};

export default TokenBalance;
