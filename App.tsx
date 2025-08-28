import React, { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { GameState, BattleImage } from './types';
import GameUI from './components/GameUI';
import { TOTAL_ROUNDS } from './constants';
import { supabase, BUCKET_NAME, NSFW_BUCKET_NAME, IS_CONFIGURED, getStripe } from './supabaseClient';
import AuthScreen from './components/AuthScreen';
import SubscriptionModal from './components/SubscriptionModal';

type GameMode = 'sfw' | 'nsfw';

const StartScreen: React.FC<{ 
  onStart: (mode: GameMode) => void; 
  user: Session['user'] | null; 
  onLogout: () => void;
  isPremium: boolean;
  gameMode: GameMode;
  setGameMode: (mode: GameMode) => void;
  onUpgrade: () => void;
}> = ({ onStart, user, onLogout, isPremium, gameMode, setGameMode, onUpgrade }) => (
  <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-gray-900 text-white animate-fade-in relative">
     <div className="absolute top-4 right-4 flex items-center gap-4">
      <span className="text-gray-400 text-sm hidden sm:block">{user?.email}</span>
      <button 
        onClick={onLogout} 
        className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-transform duration-200 transform hover:scale-105"
      >
        Logout
      </button>
    </div>
    <h1 className="text-5xl md:text-6xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">Image Swipe Battle</h1>
    <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-md">Two images appear. Swipe for the one you like best. Your score is based on picking the most popular choice!</p>
    
    <div className="mb-8 p-4 bg-gray-800/50 rounded-xl flex items-center gap-4 relative">
        <span className={`font-semibold ${gameMode === 'sfw' ? 'text-blue-400' : 'text-gray-500'}`}>SFW</span>
        <label htmlFor="gameModeToggle" className={`relative inline-flex items-center cursor-pointer`}>
            <input 
                type="checkbox" 
                id="gameModeToggle" 
                className="sr-only peer"
                checked={gameMode === 'nsfw'}
                onChange={() => {
                  if (isPremium) {
                    setGameMode(gameMode === 'sfw' ? 'nsfw' : 'sfw')
                  } else {
                    onUpgrade();
                  }
                }}
            />
            <div className={`w-14 h-8 bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-pink-600 ${!isPremium ? 'cursor-not-allowed' : ''}`}></div>
        </label>
        <span className={`font-semibold ${gameMode === 'nsfw' ? 'text-pink-400' : 'text-gray-500'}`}>
            NSFW
        </span>
         {!isPremium && <div className="absolute -top-3 -right-3 transform rotate-12 cursor-pointer" onClick={onUpgrade}><span className="text-xs font-bold text-yellow-400 bg-yellow-600 px-2 py-1 rounded">PRO</span></div>}
    </div>

    <button
      onClick={() => onStart(gameMode)}
      className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-8 rounded-full text-xl transition-transform duration-300 transform hover:scale-105 shadow-lg shadow-purple-500/50"
    >
      Start Game
    </button>
  </div>
);

const EndScreen: React.FC<{ score: number; onRestart: () => void; onShowWinners: () => void; hasWinners: boolean; }> = ({ score, onRestart, onShowWinners, hasWinners }) => (
  <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-gray-900 text-white animate-fade-in">
    <h2 className="text-4xl font-bold mb-2">Game Over!</h2>
    <p className="text-xl text-gray-300 mb-4">Your final score is</p>
    <p className="text-7xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">{score}</p>
    <div className="flex flex-col sm:flex-row gap-4">
      <button
        onClick={onRestart}
        className="bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-8 rounded-full text-xl transition-transform duration-300 transform hover:scale-105 shadow-lg shadow-green-500/50"
      >
        Play Again
      </button>
      {hasWinners && (
         <button
          onClick={onShowWinners}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 px-8 rounded-full text-xl transition-transform duration-300 transform hover:scale-105 shadow-lg shadow-blue-500/50"
        >
          See Your Winners
        </button>
      )}
    </div>
  </div>
);

const WinnersScreen: React.FC<{ winners: BattleImage[]; onRestart: () => void }> = ({ winners, onRestart }) => (
  <div className="flex flex-col w-full h-full p-4 sm:p-8 bg-gray-900 text-white animate-fade-in">
    <div className="text-center mb-6">
      <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">Your Winners</h1>
      <p className="text-gray-300">A gallery of your choices from this session.</p>
    </div>
    <div className="flex-grow overflow-y-auto pr-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {winners.map((winner, index) => (
          <div key={`${winner.url}-${index}`} className="relative rounded-lg overflow-hidden shadow-lg animate-fade-in" style={{ animationDelay: `${index * 50}ms`}}>
            <img src={winner.url} alt={winner.name} className="w-full h-48 object-cover" />
            <div className="absolute bottom-0 left-0 right-0 p-2 text-center bg-gradient-to-t from-black/80 to-transparent">
              <span className="text-white text-md font-semibold truncate">{winner.name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
    <div className="text-center mt-6">
        <button
          onClick={onRestart}
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-full text-lg transition-transform duration-300 transform hover:scale-105 shadow-lg shadow-green-500/50"
        >
          Play Again
        </button>
    </div>
  </div>
);


const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [gameState, setGameState] = useState<GameState>('start');
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [sessionWinners, setSessionWinners] = useState<BattleImage[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>('sfw');
  const [activeBucket, setActiveBucket] = useState(BUCKET_NAME);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsPremium(session?.user?.user_metadata?.is_premium ?? false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsPremium(session?.user?.user_metadata?.is_premium ?? false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubscribe = async () => {
    if (!session) return;
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        headers: { 'Content-Type': 'application/json' },
      });
      if (error) throw error;
      const { sessionId } = data;
      const stripe = await getStripe();
      if (stripe) {
        await stripe.redirectToCheckout({ sessionId });
      } else {
        throw new Error("Stripe.js not loaded");
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Could not initiate subscription. Please try again.');
    } finally {
        setShowSubscriptionModal(false);
    }
  };


  const handleStartGame = useCallback((mode: GameMode) => {
    if (mode === 'nsfw' && !isPremium) {
      setShowSubscriptionModal(true);
      return;
    }
    setActiveBucket(mode === 'nsfw' ? NSFW_BUCKET_NAME : BUCKET_NAME);
    setGameState('playing');
  }, [isPremium]);

  const handleRestartGame = useCallback(() => {
    setScore(0);
    setRound(1);
    setSessionWinners([]);
    setGameState('start');
  }, []);

  const handleShowWinners = useCallback(() => {
    setGameState('winners');
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const handleChoiceMade = useCallback(async (winner: BattleImage, loser: BattleImage) => {
    let points = 0;
    if (IS_CONFIGURED) {
       try {
        const { count: countWinner, error: errorWinner } = await supabase
            .from('battles')
            .select('*', { count: 'exact', head: true })
            .eq('winner_name', winner.name)
            .eq('loser_name', loser.name);

        const { count: countLoser, error: errorLoser } = await supabase
            .from('battles')
            .select('*', { count: 'exact', head: true })
            .eq('winner_name', loser.name)
            .eq('loser_name', winner.name);

        if (errorWinner || errorLoser) throw new Error("Failed to fetch head-to-head stats.");

        const winnerWins = countWinner ?? 0;
        const loserWins = countLoser ?? 0;

        if (winnerWins > loserWins) {
            points = 100; // Picked the majority winner
        } else if (winnerWins < loserWins) {
            points = 25; // Picked the underdog
        } else {
            points = 50; // First matchup or a tie
        }

      } catch (e) {
        console.error("Could not calculate popular vote score:", e);
        points = 50; // Default points on error
      }
    }
    
    setScore(prevScore => prevScore + points);
    setSessionWinners(prev => [...prev, winner]);

    if (round < TOTAL_ROUNDS) {
      setRound(prevRound => prevRound + 1);
    } else {
      setGameState('end');
    }
  }, [round]);

  const renderGameContent = () => {
    switch (gameState) {
      case 'start':
        return <StartScreen onStart={handleStartGame} user={session?.user ?? null} onLogout={handleLogout} isPremium={isPremium} gameMode={gameMode} setGameMode={setGameMode} onUpgrade={() => setShowSubscriptionModal(true)} />;
      case 'playing':
        return <GameUI round={round} score={score} onChoiceMade={handleChoiceMade} bucketName={activeBucket} />;
      case 'end':
        return <EndScreen score={score} onRestart={handleRestartGame} onShowWinners={handleShowWinners} hasWinners={sessionWinners.length > 0} />;
      case 'winners':
        return <WinnersScreen winners={sessionWinners} onRestart={handleRestartGame} />;
      default:
        return <StartScreen onStart={handleStartGame} user={session?.user ?? null} onLogout={handleLogout} isPremium={isPremium} gameMode={gameMode} setGameMode={setGameMode} onUpgrade={() => setShowSubscriptionModal(true)} />;
    }
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-gray-900 font-sans">
      {!session ? (
         <AuthScreen />
      ) : (
        <>
            {renderGameContent()}
            {showSubscriptionModal && (
                <SubscriptionModal 
                    onClose={() => setShowSubscriptionModal(false)}
                    onSubscribe={handleSubscribe}
                />
            )}
        </>
      )}
    </div>
  );
};

export default App;