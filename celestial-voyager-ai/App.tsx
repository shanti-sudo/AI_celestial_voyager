
import React, { useState, useEffect } from 'react';
import { fetchSpaceImage, imageToBase64 } from './services/nasaService';
import { analyzeSpaceImage } from './services/geminiService';
import GameWorld from './components/GameWorld';
import { NASAImage, POI } from './types';

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState('Initializing Deep Space Link...');
  const [isHyperjumping, setIsHyperjumping] = useState(false);
  const [image, setImage] = useState<NASAImage | null>(null);
  const [points, setPoints] = useState<POI[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [missionId, setMissionId] = useState(0);

  const initGame = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setIsHyperjumping(true);
      } else {
        setLoading(true);
      }

      setError(null);
      setLoadingStep('Searching Star Charts...');

      // 1. Fetch metadata and URL from NASA
      const nasaImg = await fetchSpaceImage();

      setLoadingStep('Calculating Warp Trajectory...');
      // 2. Prepare for analysis
      const base64 = await imageToBase64(nasaImg.url);

      setLoadingStep('Gemini AI Mapping Sector...');
      // 3. AI analysis of the new image
      const analyzedPoints = await analyzeSpaceImage(base64, nasaImg.title, nasaImg.description);

      // 4. Update all state at once
      setImage(nasaImg);
      setPoints(analyzedPoints);
      setMissionId(prev => prev + 1);

      setLoading(false);
      // Brief delay to ensure the new component has mounted behind the flash
      setTimeout(() => setIsHyperjumping(false), 1200);
    } catch (err) {
      console.error(err);
      setError('Signal Lost. Re-establishing link...');
      setTimeout(() => initGame(isManualRefresh), 3000);
    }
  };

  useEffect(() => {
    initGame();
  }, []);

  // Initial Boot Loader
  if (loading && !isHyperjumping) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center space-y-8 z-[1000]">
        <div className="relative">
          <div className="w-32 h-32 border-4 border-cyan-500/10 rounded-full"></div>
          <div className="absolute inset-0 w-32 h-32 border-t-4 border-cyan-500 rounded-full animate-spin"></div>
          <div className="absolute inset-4 w-24 h-24 border-r-4 border-blue-400 rounded-full animate-[spin_3s_linear_infinite]"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></div>
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-cyan-400 font-mono tracking-[0.3em] text-xs uppercase mb-3 animate-pulse">
            System Boot: Voyager AI
          </h2>
          <p className="text-white font-medium text-lg tracking-tight">
            {loadingStep}
          </p>
        </div>

        {error && <p className="text-red-500 font-mono text-[10px] bg-red-500/10 px-3 py-1 rounded border border-red-500/20">{error}</p>}

        <div className="max-w-xs w-full h-0.5 bg-slate-900 rounded-full overflow-hidden">
          <div className="h-full bg-cyan-500 transition-all duration-500" style={{ width: loadingStep.includes('Mapping') ? '80%' : '40%' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-black relative">
      {/* Warp/Hyperjump Overlay Effect */}
      {isHyperjumping && (
        <div className="fixed inset-0 z-[999] bg-slate-950 pointer-events-none flex items-center justify-center animate-[pulse_0.4s_ease-in-out_infinite]">
          <div className="absolute inset-0 bg-white/10 mix-blend-overlay"></div>
          <div className="flex flex-col items-center gap-4">
            <div className="text-white font-black italic text-5xl tracking-tighter animate-pulse scale-110">WARP DRIVE ACTIVE</div>
            <div className="text-cyan-400 font-mono text-xs tracking-[0.5em]">{loadingStep.toUpperCase()}</div>
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_20%,black_100%)]"></div>
        </div>
      )}

      {/* 
        CRITICAL: Using image.url as a KEY ensures the GameWorld 
        remounts from scratch whenever a new mission starts.
      */}
      {image && (
        <GameWorld
          key={`${image.url}-${missionId}`}
          image={image}
          points={points}
        />
      )}

      {/* New Mission Button - HUD Integrated */}
      <div className="absolute bottom-8 right-8 flex flex-col items-end gap-2 z-[60]">
        <div className="text-[9px] text-cyan-500/50 font-mono uppercase tracking-[0.2em]">Navigation Command</div>
        <button
          onClick={() => initGame(true)}
          disabled={isHyperjumping}
          className={`group relative overflow-hidden px-8 py-3 bg-slate-950 border border-cyan-500/30 text-cyan-400 transition-all duration-500 hover:border-cyan-400 hover:text-white hover:shadow-[0_0_20px_rgba(34,211,238,0.3)] rounded-sm disabled:opacity-50`}
        >
          <div className="absolute inset-0 bg-cyan-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
          <span className="relative z-10 font-black text-[11px] uppercase tracking-[0.25em]">Next Mission Area</span>
        </button>
      </div>
    </div>
  );
};

export default App;
