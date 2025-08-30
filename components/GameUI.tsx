// Fix: Corrected import statement by removing stray 'a,'.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SwipeDirection, BattleImage } from '../types';
import { TOTAL_ROUNDS } from '../constants';
import { supabase, IS_CONFIGURED } from '../supabaseClient';
import type { FileObject } from '@supabase/storage-js';

interface GameUIProps {
  round: number;
  score: number;
  onChoiceMade: (winner: BattleImage) => void;
  bucketName: string;
  userId: string;
}

interface WinnerInfo {
    winner: BattleImage;
    loser: BattleImage;
}

interface BattleStats {
    overall: string;
    h2h: string;
}

const InfoScreen: React.FC<{ title: string; message: string; }> = ({ title, message }) => (
  <div className="flex flex-col w-full h-full items-center justify-center text-white p-8 text-center bg-gray-800 rounded-2xl">
    <h3 className="text-2xl font-bold text-yellow-400 mb-2">{title}</h3>
    <p className="text-md text-gray-300">{message}</p>
  </div>
);

const LoadingSkeleton: React.FC = () => (
    <div className="flex flex-col w-full h-full items-center justify-center text-white p-4 text-center">
      <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-purple-500 mb-4"></div>
      <p className="text-xl font-semibold">Preparing the battle...</p>
    </div>
);

const StatsDisplay: React.FC<{ stats: BattleStats | null, isLoading: boolean, loserName: string }> = ({ stats, isLoading, loserName }) => {
    if (isLoading) {
        return <div className="w-8 h-8 border-2 border-dashed rounded-full animate-spin border-white mt-4"></div>;
    }
    if (!stats) {
        return <p className="text-gray-400 mt-4 text-sm">Stats could not be loaded.</p>;
    }
    return (
        <div className="flex justify-center gap-4 text-white text-center mt-4 animate-fade-in">
            <div className="bg-white/10 p-3 rounded-lg backdrop-blur-sm">
                <p className="text-2xl font-bold">{stats.overall}</p>
                <p className="text-xs text-gray-300">Overall Win Rate</p>
            </div>
            <div className="bg-white/10 p-3 rounded-lg backdrop-blur-sm">
                <p className="text-2xl font-bold">{stats.h2h}</p>
                <p className="text-xs text-gray-300">vs. {loserName}</p>
            </div>
        </div>
    );
};


const GameUI: React.FC<GameUIProps> = ({ round, score, onChoiceMade, bucketName, userId }) => {
  const [images, setImages] = useState<[BattleImage, BattleImage] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [folders, setFolders] = useState<FileObject[]>([]);

  const [choice, setChoice] = useState<SwipeDirection | null>(null);
  const [winnerInfo, setWinnerInfo] = useState<WinnerInfo | null>(null);
  const [isHidingWinner, setIsHidingWinner] = useState(false);
  const [stats, setStats] = useState<BattleStats | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  
  const [dragState, setDragState] = useState({ isDragging: false, startX: 0, translationX: 0 });
  const isTransitioningRef = useRef(false);

  // Fetch all top-level folders from the bucket on initial mount
  useEffect(() => {
    if (!IS_CONFIGURED) {
      setError("Supabase is not configured. Please open `supabaseClient.ts` and add your project URL and anon key.");
      setIsLoading(false);
      return;
    }

    const fetchFolders = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.storage.from(bucketName).list('', {
          limit: 1000,
        });

        if (error) {
          throw error;
        }

        const folderList = data.filter(item => item.id === null);
        if (folderList.length < 2) {
          setError(`Could not find folders in bucket '${bucketName}'. This is likely a permissions issue. For private buckets, ensure the logged-in user has 'SELECT' permission via RLS policies.`);
          setIsLoading(false);
        } else {
          setFolders(folderList);
        }
      } catch (err: any) {
        setError(`Failed to fetch from Supabase bucket '${bucketName}': ${err.message}`);
        setIsLoading(false);
      }
    };

    fetchFolders();
  }, [bucketName]);

  // Load a new pair of images for the current round
  useEffect(() => {
    if (folders.length < 2) return; 

    isTransitioningRef.current = true;
    setIsLoading(true);
    setChoice(null);
    setWinnerInfo(null);
    setIsHidingWinner(false);
    setStats(null);
    
    const timer = setTimeout(async () => {
      try {
        const folder1Index = Math.floor(Math.random() * folders.length);
        let folder2Index;
        do {
          folder2Index = Math.floor(Math.random() * folders.length);
        } while (folder1Index === folder2Index);

        const folder1 = folders[folder1Index];
        const folder2 = folders[folder2Index];

        const [{ data: files1, error: error1 }, { data: files2, error: error2 }] = await Promise.all([
            supabase.storage.from(bucketName).list(folder1.name),
            supabase.storage.from(bucketName).list(folder2.name)
        ]);
        
        if (error1 || error2) throw new Error(error1?.message || error2?.message);
        if (!files1 || !files2) throw new Error("Could not list files in one of the selected folders.");

        const imageFiles1 = files1.filter(f => f.id !== null);
        const imageFiles2 = files2.filter(f => f.id !== null);
        
        if (imageFiles1.length === 0 || imageFiles2.length === 0) {
            throw new Error(`One of the randomly selected folders ('${folder1.name}', '${folder2.name}') is empty.`);
        }

        const imageFile1 = imageFiles1[Math.floor(Math.random() * imageFiles1.length)];
        const imageFile2 = imageFiles2[Math.floor(Math.random() * imageFiles2.length)];

        const { data: urlData1 } = supabase.storage.from(bucketName).getPublicUrl(`${folder1.name}/${imageFile1.name}`);
        const { data: urlData2 } = supabase.storage.from(bucketName).getPublicUrl(`${folder2.name}/${imageFile2.name}`);

        setImages([
          { url: urlData1.publicUrl, name: folder1.name },
          { url: urlData2.publicUrl, name: folder2.name }
        ]);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsLoading(false);
        isTransitioningRef.current = false;
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [round, folders, bucketName]);

  const handleChoice = useCallback((direction: SwipeDirection) => {
    if (isTransitioningRef.current || !images) return; 
    isTransitioningRef.current = true;

    setChoice(direction);
    const winnerIndex = direction === 'left' ? 0 : 1;
    const loserIndex = direction === 'left' ? 1 : 0;
    const chosenWinner = images[winnerIndex];
    const chosenLoser = images[loserIndex];

    // Record battle result (fire and forget)
    if (IS_CONFIGURED && userId) {
      supabase.from('battles').insert({ 
        winner_name: chosenWinner.name, 
        loser_name: chosenLoser.name,
        user_id: userId
      })
        .then(({ error }) => {
          if (error) console.error("Failed to record battle:", error.message);
          else console.log("Battle recorded:", chosenWinner.name, "vs", chosenLoser.name);
        });
    }

    // Show winner info immediately
    setTimeout(() => {
        setWinnerInfo({ winner: chosenWinner, loser: chosenLoser });
    }, 400);

  }, [images, onChoiceMade]);
  
  // Handle winner display and auto-advance
  useEffect(() => {
    if (!winnerInfo) return;

    // Start hiding animation after 3 seconds (longer to read stats)
    const hideTimer = setTimeout(() => {
      setIsHidingWinner(true);
    }, 3000);

    // Complete transition and advance to next round after animation
    const advanceTimer = setTimeout(() => {
      setWinnerInfo(null);
      setIsHidingWinner(false);
      setChoice(null);
      onChoiceMade(winnerInfo.winner);
    }, 3500);

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(advanceTimer);
    };
  }, [winnerInfo, onChoiceMade]);
  
  useEffect(() => {
    if (!winnerInfo || !IS_CONFIGURED) return;

    // Add small delay to ensure database has been updated
    const timer = setTimeout(async () => {
      const fetchStats = async () => {
        setIsStatsLoading(true);
        try {
            // Overall stats
            const { count: wins, error: winsError } = await supabase
                .from('battles')
                .select('*', { count: 'exact', head: true })
                .eq('winner_name', winnerInfo.winner.name);

            const { count: losses, error: lossesError } = await supabase
                .from('battles')
                .select('*', { count: 'exact', head: true })
                .eq('loser_name', winnerInfo.winner.name);

            if (winsError || lossesError) throw new Error(winsError?.message || lossesError?.message);

            const totalGames = (wins ?? 0) + (losses ?? 0);
            const winPercentage = totalGames > 0 ? ((wins ?? 0) / totalGames) * 100 : 0;
            const overallRate = totalGames > 0 ? winPercentage.toFixed(1) : 'N/A';
            
            // Debug logging
            console.log(`Stats for ${winnerInfo.winner.name}: ${wins} wins, ${losses} losses, ${totalGames} total, ${winPercentage.toFixed(2)}%`);

            // Head-to-head stats
            const { count: h2hWins, error: h2hWinsError } = await supabase
                .from('battles')
                .select('*', { count: 'exact', head: true })
                .eq('winner_name', winnerInfo.winner.name)
                .eq('loser_name', winnerInfo.loser.name);

            const { count: h2hLosses, error: h2hLossesError } = await supabase
                .from('battles')
                .select('*', { count: 'exact', head: true })
                .eq('winner_name', winnerInfo.loser.name)
                .eq('loser_name', winnerInfo.winner.name);

            if (h2hWinsError || h2hLossesError) throw new Error(h2hWinsError?.message || h2hLossesError?.message);
            
            const h2hTotalGames = (h2hWins ?? 0) + (h2hLosses ?? 0);
            const h2hRate = h2hTotalGames > 0 ? (((h2hWins ?? 0) / h2hTotalGames) * 100).toFixed(0) : 'N/A';

            setStats({
                overall: overallRate === 'N/A' ? 'First Game!' : `${overallRate}%`,
                h2h: h2hRate === 'N/A' ? 'First Matchup!' : `${h2hRate}% vs ${winnerInfo.loser.name}`,
            });

        } catch (err: any) {
            console.error("Failed to fetch stats. Did you create the 'battles' table in Supabase?", err.message);
            setStats(null);
        } finally {
            setIsStatsLoading(false);
        }
      };

      await fetchStats();
    }, 500); // 500ms delay to ensure database is updated

    return () => clearTimeout(timer);
  }, [winnerInfo]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTransitioningRef.current) return;
      if (e.key === 'ArrowLeft') handleChoice('left');
      else if (e.key === 'ArrowRight') handleChoice('right');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleChoice]);
  
  const handleInteractionStart = useCallback((clientX: number) => {
    if (isTransitioningRef.current) return;
    setDragState({ isDragging: true, startX: clientX, translationX: 0 });
  }, []);

  const handleInteractionMove = useCallback((clientX: number) => {
    if (!dragState.isDragging) return;
    const currentTranslationX = clientX - dragState.startX;
    setDragState(prev => ({ ...prev, translationX: currentTranslationX }));
  }, [dragState.isDragging, dragState.startX]);
  
  const handleInteractionEnd = useCallback(() => {
    if (!dragState.isDragging) return;
    const swipeThreshold = window.innerWidth / 5;
    if (Math.abs(dragState.translationX) > swipeThreshold) {
      handleChoice(dragState.translationX < 0 ? 'left' : 'right');
    }
    setDragState({ isDragging: false, startX: 0, translationX: 0 });
  }, [dragState.isDragging, dragState.translationX, handleChoice]);
  
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleInteractionMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleInteractionMove(e.touches[0].clientX);
    };
    
    if (dragState.isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', handleInteractionEnd);
      window.addEventListener('touchmove', onTouchMove);
      window.addEventListener('touchend', handleInteractionEnd);
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', handleInteractionEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', handleInteractionEnd);
    };
  }, [dragState.isDragging, handleInteractionMove, handleInteractionEnd]);

  return (
    <>
      <div 
        className={`relative w-full h-full flex flex-col items-center justify-center p-4 overflow-hidden transition-opacity duration-300 ${winnerInfo ? 'opacity-0' : 'opacity-100'}`}
        onTouchStart={(e) => { if (e.touches[0]) handleInteractionStart(e.touches[0].clientX); }}
        onMouseDown={(e) => handleInteractionStart(e.clientX)}
        style={{ touchAction: 'none' }}
      >
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center text-white z-20">
          <div className="bg-black/50 backdrop-blur-sm px-4 py-2 rounded-xl">
            <span className="font-bold text-xl">Round: </span>
            <span className="text-xl">{round} / {TOTAL_ROUNDS}</span>
          </div>
          <div className="bg-black/50 backdrop-blur-sm px-4 py-2 rounded-xl">
            <span className="font-bold text-xl">Score: </span>
            <span className="text-xl">{score}</span>
          </div>
        </div>

        <div
          className="relative w-full max-w-sm h-[60vh] max-h-[500px]"
          style={{ 
            transform: `translateX(${dragState.translationX}px)`,
            transition: dragState.isDragging ? 'none' : 'transform 0.3s ease-out'
          }}
        >
          {isLoading ? (
            <LoadingSkeleton />
          ) : error ? (
            <InfoScreen title="An Error Occurred" message={error} />
          ) : images && (
            <div className={`flex w-full h-full gap-2 touch-none select-none`}>
              {images.map((image, index) => {
                const direction = index === 0 ? 'left' : 'right';
                let animationClass = '';
                if (choice) {
                  animationClass = choice === direction ? 'animate-chosen' : 'animate-rejected';
                }
                return (
                  <div key={image.url} className={`relative w-1/2 h-full rounded-2xl overflow-hidden shadow-2xl bg-gray-800 ${animationClass}`}>
                    <img src={image.url} alt={image.name} className="w-full h-full object-cover" draggable="false" />
                    <div className="absolute bottom-0 left-0 right-0 p-3 text-center bg-gradient-to-t from-black/60 to-transparent">
                      <span className="text-white text-lg font-semibold truncate">{image.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {images && !isLoading && !error && (
          <div className="mt-8 text-center text-gray-400 animate-fade-in" style={{ animationDelay: '300ms' }}>
            <p className="text-md">
              Swipe, or use arrow keys to vote.
            </p>
          </div>
        )}
      </div>
      
      {winnerInfo && (
          <div 
            className={`fixed inset-0 bg-black z-50 flex flex-col items-center justify-center 
            ${isHidingWinner ? 'animate-fullscreen-exit' : 'animate-fullscreen-enter'}`}
            aria-modal="true"
            role="dialog"
          >
              <img src={winnerInfo.winner.url} className="w-full h-full object-contain" alt="Winning choice" />
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent text-center">
                <div className="text-center">
                  <p className="text-4xl font-bold text-white drop-shadow-lg">{winnerInfo.winner.name} wins!</p>
                </div>
                <StatsDisplay stats={stats} isLoading={isStatsLoading} loserName={winnerInfo.loser.name} />
              </div>
          </div>
      )}
    </>
  );
};

export default GameUI;