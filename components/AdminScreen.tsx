import React from 'react';

interface AdminScreenProps {
  onBack: () => void;
}

const AdminScreen: React.FC<AdminScreenProps> = ({ onBack }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-white p-6">
      <div className="w-full max-w-lg p-8 bg-gray-800 rounded-2xl shadow-lg">
        <h1 className="text-3xl font-bold mb-4 text-center">Creator Studio</h1>
        <p className="text-gray-400 text-center mb-6">Admin functionality coming soon!</p>
        <div className="flex justify-center">
          <button 
            onClick={onBack}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-full transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminScreen;