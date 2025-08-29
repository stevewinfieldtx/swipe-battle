import React, { useState, useEffect } from 'react';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import { supabase, IS_CONFIGURED, BUCKET_NAME, NSFW_BUCKET_NAME } from './supabaseClient';
import type { Session, User } from '@supabase/supabase-js';
import { GameState, BattleImage } from './types';
import { TOTAL_ROUNDS } from './constants';
import GameUI from './components/GameUI';
import AuthScreen from './components/AuthScreen';
import SubscriptionModal from './components/SubscriptionModal';
import StatsScreen from './components/StatsScreen.tsx';
import AdminScreen from './components/AdminScreen';
import ModelProfileScreen from './components/ModelProfileScreen';

// --- SUB-COMPONENTS FOR CLARITY ---

const ConfigurationErrorScreen: React.FC = () => (
    <div className="flex flex-col items-center justify-center h-full text-white p-6 bg-red-900/20">
      <div className="w-full max-w-lg p-8 bg-gray-800 rounded-2xl shadow-lg border border-red-500/50">
        <h1 className="text-3xl font-bold mb-4 text-center text-red-400">Configuration Error</h1>
        {!IS_CONFIGURED && (
          <div className="mb-4">
            <p className="text-gray-300 mb-2">Supabase credentials are not configured.</p>
            <p className="text-sm text-gray-400">Please create a <code className="bg-gray-700 p-1 rounded">.env.local</code> file and add your Supabase URL and public anon key.</p>
          </div>
        )}
        {!IS_STRIPE_CONFIGURED && (
          <div>
            <p className="text-gray-300 mb-2">Stripe is not configured.</p>
            <p className="text-sm text-gray-400">Please add your Stripe Publishable Key and Price ID to your <code className="bg-gray-700 p-1 rounded">.env.local</code> file.</p>
          </div>
        )}
      </div>
    </div>
);

const StartScreen: React.FC<{ onStart: (bucket: string) => void; onShowStats: () => void; onShowAdmin: () => void; onShowSubscription: () => void; isPremium: boolean; onSignOut: () => void }> = 
({ onStart, onShowStats, onShowAdmin, onShowSubscription, isPremium, onSignOut }) => {
    return (
        <div className="flex flex-col items-center justify-center h-full text-white p-4 animate-fade-in">
          <div className="text-center mb-10">
            <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">Swipe Battle</h1>
            <p className="text-gray-400 mt-2">Choose your champion.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 w-full max-w-sm">
            <button onClick={() => onStart(BUCKET_NAME)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-xl text-lg transition-transform duration-200 transform hover:scale-105">
              Start SFW Battle
            </button>
            <button onClick={() => isPremium ? onStart(NSFW_BUCKET_NAME) : onShowSubscription()} className={`font-bold py-4 rounded-xl text-lg transition-transform duration-200 transform hover:scale-105 text-white ${isPremium ? 'bg-pink-600 hover:bg-pink-700' : 'bg-gray-700 hover:bg-gray-600'}`}>
              {isPremium ? 'Start NSFW Battle' : 'Unlock NSFW Mode ✨'}
            </button>
            <button onClick={onShowStats} className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-xl transition-colors">My Stats</button>
            <button onClick={onShowAdmin} className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-xl transition-colors">Creator Studio</button>
          </div>
          <button onClick={onSignOut} className="absolute top-4 right-4 bg-gray-700/50 hover:bg-gray-600/80 text-white text-xs py-2 px-4 rounded-full transition-colors">
            Sign Out
          </button>
        </div>
      );
};

const WinnersScreen: React.FC<{ winners: BattleImage[]; onRestart: () => void; onShowModelProfile: (modelName: string) => void; }> = ({ winners, onRestart, onShowModelProfile }) => (
    <div className="flex flex-col w-full h-full p-4 sm:p-8 text-white animate-fade-in">
        <div className="text-center mb-6">
            <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">Your Winners!</h1>
            <p className="text-gray-400 mt-2">Click on any winner to view their profile.</p>
        </div>
        <div className="flex-grow overflow-y-auto mb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {winners.map((winner, index) => (
                    <button 
                        key={`${winner.url}-${index}`} 
                        onClick={() => onShowModelProfile(winner.name)} 
                        className="aspect-[3/4] rounded-xl overflow-hidden bg-gray-800 group transform transition-transform duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    >
                        <img src={winner.url} alt={winner.name} className="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-80" />
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                            <p className="font-semibold text-sm truncate">{winner.name}</p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
        <button onClick={onRestart} className="w-full max-w-sm mx-auto bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-xl text-lg transition-transform duration-200 transform hover:scale-105">
            Play Again
        </button>
    </div>
);


// --- MAIN APP COMPONENT ---

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [gameState, setGameState] = useState<GameState>('start');
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [winners, setWinners] = useState<BattleImage[]>([]);
  const [battleBucket, setBattleBucket] = useState(BUCKET_NAME);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsPremium(session?.user?.user_metadata?.is_premium ?? false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsPremium(session?.user?.user_metadata?.is_premium ?? false);
      // Reset to start screen on auth change to prevent being stuck on a protected page
      if (_event === 'SIGNED_OUT') {
        setGameState('start');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleStartGame = (bucket: string) => {
    setBattleBucket(bucket);
    setGameState('playing');
    setRound(1);
    setScore(0);
    setWinners([]);
  };

  const handleChoiceMade = (winner: BattleImage) => {
    setScore(prev => prev + 1);
    setWinners(prev => [...prev, winner]);
    if (round < TOTAL_ROUNDS) {
      setRound(prev => prev + 1);
    } else {
      setGameState('winners');
    }
  };

  const handleRestart = () => {
    setGameState('start');
  };
  
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  }
  
  const handleSubscribe = () => {
    // PayPal subscription logic is now handled in the PayPalSubscription component
    // This function is called after successful PayPal subscription
    console.log('Subscription successful, refreshing user data...');
    
    // Refresh the user session to get updated metadata
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsPremium(session?.user?.user_metadata?.is_premium ?? false);
    });
  }

  const handleShowModelProfile = (modelName: string) => {
    setSelectedModel(modelName);
    setGameState('modelProfile');
  };

  const renderContent = () => {
    if (!IS_CONFIGURED || !IS_STRIPE_CONFIGURED) {
      return <ConfigurationErrorScreen />;
    }

    if (!session || !user) {
      return <AuthScreen />;
    }

    switch (gameState) {
      case 'playing':
        return <GameUI round={round} score={score} onChoiceMade={handleChoiceMade} bucketName={battleBucket} userId={user.id} />;
      case 'winners':
        return <WinnersScreen winners={winners} onRestart={handleRestart} onShowModelProfile={handleShowModelProfile} />;
      case 'stats':
        return <StatsScreen onBack={() => setGameState('start')} onShowModelProfile={handleShowModelProfile} />;
      case 'admin':
        return <AdminScreen onBack={() => setGameState('start')} />;
      case 'modelProfile':
        return <ModelProfileScreen modelName={selectedModel!} onBack={() => setGameState('stats')} />;
      case 'start':
      default:
        return (
          <StartScreen 
            onStart={handleStartGame} 
            isPremium={isPremium}
            onShowSubscription={() => setShowSubscriptionModal(true)}
            onSignOut={handleSignOut}
            onShowStats={() => setGameState('stats')}
            onShowAdmin={() => setGameState('admin')}
          />
        );
    }
  };

  const paypalOptions = {
    clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || "AWU3ejBcjTFRbS_pSMaEU9PRR2OGIMy8GrSqJRT9KL5T9eWJRLFDzL5tcqKh6mgeD-dnKADr_WbhQVS-",
    vault: true,
    intent: "subscription"
  };

  return (
    <PayPalScriptProvider options={paypalOptions}>
      <main className="w-full h-full fixed inset-0 bg-gray-900 overflow-hidden">
        {renderContent()}
        {showSubscriptionModal && (
          <SubscriptionModal 
              onClose={() => setShowSubscriptionModal(false)}
              onSubscribe={handleSubscribe}
          />
        )}
      </main>
    </PayPalScriptProvider>
  );
};

export default App;
