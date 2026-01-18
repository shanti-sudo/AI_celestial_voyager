
import React, { useState, useEffect } from 'react';
import { fetchSpaceImage, imageToBase64 } from './services/nasaService';
import { analyzeSpaceImage, generateMissionOptions, validateImageContent, MissionOption } from './services/geminiService';
import GameWorld from './components/GameWorld';
import MissionSelector from './components/MissionSelector';
import { NASAImage, POI } from './types';

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState('Initializing Deep Space Link...');
  const [isHyperjumping, setIsHyperjumping] = useState(false);
  const [image, setImage] = useState<NASAImage | null>(null);
  const [points, setPoints] = useState<POI[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [missionId, setMissionId] = useState(0);

  // Mission Selection State
  const [showMissionSelector, setShowMissionSelector] = useState(false);
  const [missionOptions, setMissionOptions] = useState<MissionOption[]>([]);
  const [isFetchingOptions, setIsFetchingOptions] = useState(false);

  // Guard against duplicate initialization
  const isInitializing = React.useRef(false);

  const startMissionDiscovery = async () => {
    // 1. Show loading state for options
    setIsFetchingOptions(true);
    setLoadingStep('Scanning for Mission Targets...');

    // 2. Fetch AI options
    const options = await generateMissionOptions();
    setMissionOptions(options);

    // 3. Keep loading false (so main game loop doesn't restart yet), but show selector
    setIsFetchingOptions(false);
    setShowMissionSelector(true);
  };

  const initGame = async (specificTopic?: string) => {
    // Prevent concurrent initialization
    if (isInitializing.current) {
      console.log('Init already in progress, skipping duplicate call');
      return;
    }

    try {
      isInitializing.current = true;
      setShowMissionSelector(false); // Close selector if open

      if (specificTopic) {
        // Manual Jump
        setIsHyperjumping(true);
      } else {
        // Initial Load
        setLoading(true);
      }

      setError(null);
      setLoadingStep(specificTopic ? `Targeting Sector: ${specificTopic}...` : 'Searching Star Charts...');

      // 1. Fetch metadata and URL from NASA (Using specific topic if provided)
      const nasaImg = await fetchSpaceImage(specificTopic);

      setLoadingStep('Calculating Warp Trajectory...');
      // 2. Prepare for analysis
      const base64 = await imageToBase64(nasaImg.url);

      // 2.5 AI Sentry Validation (Visual Content Filter)
      // Skip validation for user-selected missions to improve load time
      // (AI-generated topics are pre-vetted, only validate random selections)
      if (!specificTopic) {
        setLoadingStep('AI Sentry: Verifying Visuals...');
        const isValid = await validateImageContent(base64);
        if (!isValid) {
          console.warn('Image rejected by Sentry. Retrying jump...');
          setLoadingStep('Contamination Detected. Re-routing...');
          // Reset the flag before retry
          isInitializing.current = false;
          // Recursive retry with a small delay to prevent rapid-fire API limits
          setTimeout(() => initGame(specificTopic), 1500);
          return;
        }
      }

      setLoadingStep('Gemini AI Mapping Sector...');
      // 3. AI analysis of the new image
      const analyzedPoints = await analyzeSpaceImage(base64, nasaImg.title, nasaImg.description);

      // 4. Update all state at once
      // 4. Update all state at once - ONLY after all validations pass
      setImage(nasaImg);
      setPoints(analyzedPoints);
      setMissionId(prev => prev + 1);

      setLoading(false);
      isInitializing.current = false;
      // Brief delay to ensure the new component has mounted behind the flash
      setTimeout(() => setIsHyperjumping(false), 1200);
    } catch (err) {
      console.error(err);
      setError('Signal Lost. Re-establishing link...');
      isInitializing.current = false;
      setTimeout(() => initGame(specificTopic), 3000);
    }
  };

  useEffect(() => {
    let isMounted = true;
    initGame();
    return () => {
      isMounted = false;
    };
  }, []);

  // Initial Boot Loader
  if (loading && !isHyperjumping && !showMissionSelector) {
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

      {/* Mission Selector Overlay */}
      {showMissionSelector && (
        <MissionSelector
          options={missionOptions}
          onSelect={(topic) => initGame(topic)}
          isLoading={isHyperjumping}
        />
      )}

      {/* 
        CRITICAL: Using image.url as a KEY ensures the GameWorld 
        remounts from scratch whenever a new mission starts.
      */}
      {image && !showMissionSelector && (
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
          onClick={startMissionDiscovery}
          disabled={isHyperjumping || isFetchingOptions || showMissionSelector}
          className={`group relative overflow-hidden px-8 py-3 bg-slate-950 border border-cyan-500/30 text-cyan-400 transition-all duration-500 hover:border-cyan-400 hover:text-white hover:shadow-[0_0_20px_rgba(34,211,238,0.3)] rounded-sm disabled:opacity-50`}
        >
          <div className="absolute inset-0 bg-cyan-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
          <span className="relative z-10 font-black text-[11px] uppercase tracking-[0.25em]">
            {isFetchingOptions ? 'Scanning Sectors...' : 'Next Mission Area'}
          </span>
        </button>
      </div>
    </div>
  );
};

export default App;
