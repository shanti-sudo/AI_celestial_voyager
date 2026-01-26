
import React, { useState, useEffect } from 'react';
import { fetchSpaceImage, imageToBase64 } from './services/nasaService';
import { analyzeSpaceImage, generateMissionOptions, validateImageContent, MissionOption } from './services/geminiService';
import GameWorld from './components/GameWorld';
import MissionSelector from './components/MissionSelector';
import { NASAImage, POI } from './types';

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState('Initializing Deep Space Link...');
  const [loadingProgress, setLoadingProgress] = useState(10);
  const [isHyperjumping, setIsHyperjumping] = useState(false);
  const [image, setImage] = useState<NASAImage | null>(null);
  const [points, setPoints] = useState<POI[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [missionId, setMissionId] = useState(0);

  // Mission Selection State
  const [showMissionSelector, setShowMissionSelector] = useState(false);
  const [missionOptions, setMissionOptions] = useState<MissionOption[]>([]);
  const [isFetchingOptions, setIsFetchingOptions] = useState(false);
  const [isSectorComplete, setIsSectorComplete] = useState(false);

  // Guard against duplicate initialization and handle unmounting
  const isInitializing = React.useRef(false);
  const isMounted = React.useRef(true);
  const retryTimeoutRef = React.useRef<number | null>(null);
  // Pre-fetch cache for mission images, base64 data, and AI points
  const prefetchedImages = React.useRef<Record<string, NASAImage>>({});
  const prefetchedBase64 = React.useRef<Record<string, string>>({});
  const prefetchedPoints = React.useRef<Record<string, POI[]>>({});
  const [prefetchedState, setPrefetchedState] = useState<Record<string, 'loading' | 'ready' | 'error'>>({});

  // Flavor Text Logic
  const FLAVOR_TEXTS = [
    "Calibrating navigation sensors for optimal discovery.",
    "Engaging sub-space frequencies for clear transmission.",
    "Initializing starmap matrix for your next adventure.",
    "Stabilizing ion drives for a smooth arrival.",
    "Synchronizing shield harmonics for safe passage.",
    "Charging photon banks for bright illumination.",
    "Scanning sector quadrants for fascinating anomalies.",
    "Aligning warp coils for rapid transit.",
    "Buffering celestial data for high-resolution clarity.",
    "Pre-heating fusion cores for efficient energy flow."
  ];

  const availableFlavorIndices = React.useRef<number[]>([]);

  const getFlavorText = React.useCallback(() => {
    if (availableFlavorIndices.current.length === 0) {
      // Refill and shuffle
      availableFlavorIndices.current = Array.from({ length: FLAVOR_TEXTS.length }, (_, i) => i);
      // Simple shuffle
      for (let i = availableFlavorIndices.current.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [availableFlavorIndices.current[i], availableFlavorIndices.current[j]] =
          [availableFlavorIndices.current[j], availableFlavorIndices.current[i]];
      }
    }
    const index = availableFlavorIndices.current.pop()!;
    return FLAVOR_TEXTS[index];
  }, []);

  const startMissionDiscovery = async () => {
    // 1. Show loading state for options
    setIsFetchingOptions(true);
    setLoadingStep(getFlavorText());
    setLoadingProgress(20);

    try {
      // 2. Fetch AI options
      const rawOptions = await generateMissionOptions();

      // 3. VALIDATION PHASE: Check if NASA actually has images for these topics (Strict Mode)
      // We run this in parallel to be fast.
      const validationResults = await Promise.allSettled(
        rawOptions.map(async (opt) => {
          const img = await fetchSpaceImage(opt.topic, true); // Strict Mode = True
          return { opt, img };
        })
      );

      const validOptions: MissionOption[] = [];

      // Process results and populate cache immediately for the valid ones
      for (const result of validationResults) {
        if (result.status === 'fulfilled') {
          const { opt, img } = result.value;
          validOptions.push(opt);

          // Populate cache since we already have the image!
          prefetchedImages.current[opt.id] = img;
          setPrefetchedState(prev => ({ ...prev, [opt.id]: 'loading' })); // Already loaded image, but processing AI

          // Continue background processing (Base64 + Gemini)
          // We don't await this part, we let it run in background to speed up UI
          (async () => {
            try {
              const b64 = await imageToBase64(img.analysisUrl);
              prefetchedBase64.current[opt.id] = b64;

              const pts = await analyzeSpaceImage(b64, img.title, img.description);
              prefetchedPoints.current[opt.id] = pts;
              setPrefetchedState(prev => ({ ...prev, [opt.id]: 'ready' }));
            } catch (e) {
              console.error(`Post-validation processing failed for ${opt.topic}`, e);
              setPrefetchedState(prev => ({ ...prev, [opt.id]: 'error' }));
            }
          })();

        } else {
          console.warn(`Option '${result.reason?.message || "Unknown"}' rejected: No valid images found.`);
        }
      }

      if (validOptions.length === 0) {
        throw new Error("No valid mission targets found in this sector scan.");
      }

      setMissionOptions(validOptions);

      // 4. Show selector
      setIsFetchingOptions(false);
      setShowMissionSelector(true);
    } catch (err) {
      console.error("Discovery failed", err);
      setIsFetchingOptions(false);
    }
  };

  const initGame = async (mission?: MissionOption) => {
    // Prevent concurrent initialization
    if (isInitializing.current || !isMounted.current) {
      return;
    }

    const specificTopic = mission?.topic;
    const missionId_key = mission?.id;

    try {
      isInitializing.current = true;
      setShowMissionSelector(false); // Close selector if open

      if (specificTopic) {
        setIsHyperjumping(true);
      } else {
        setLoading(true);
      }

      setError(null);
      setIsSectorComplete(false);

      if (specificTopic) {
        setLoadingStep(`Targeting Sector: ${specificTopic}...`);
      } else {
        setLoadingStep(getFlavorText());
      }
      setLoadingProgress(15);

      let nasaImg: NASAImage;
      if (missionId_key && prefetchedImages.current[missionId_key]) {
        nasaImg = prefetchedImages.current[missionId_key];
      } else {
        nasaImg = await fetchSpaceImage(specificTopic);
      }

      if (!isMounted.current) return;

      setLoadingStep(getFlavorText());
      setLoadingProgress(45);
      let base64: string;
      if (missionId_key && prefetchedBase64.current[missionId_key]) {
        base64 = prefetchedBase64.current[missionId_key];
      } else {
        base64 = await imageToBase64(nasaImg.analysisUrl);
      }

      if (!isMounted.current) return;

      // 2.5 AI Sentry Validation
      // We validate ALL images that aren't already AI-verified (pre-fetched ones aren't strictly validated by Sentry yet)
      const isAlreadyVerified = missionId_key && prefetchedPoints.current[missionId_key];
      if (!isAlreadyVerified) {
        setLoadingStep(getFlavorText());
        setLoadingProgress(60);
        const isValid = await validateImageContent(base64);
        if (!isMounted.current) return;

        if (!isValid) {
          console.warn('Image rejected by Sentry. Retrying jump...');
          setLoadingStep('Contamination Detected. Re-routing...');
          isInitializing.current = false;
          // For missions, we might want to go back to selector, but for now retry works
          retryTimeoutRef.current = window.setTimeout(() => initGame(mission), 1500);
          return;
        }
      }

      setLoadingProgress(80);
      let analyzedPoints: POI[];
      if (missionId_key && prefetchedPoints.current[missionId_key]) {
        analyzedPoints = prefetchedPoints.current[missionId_key];
      } else {
        analyzedPoints = await analyzeSpaceImage(base64, nasaImg.title, nasaImg.description);
      }
      if (!isMounted.current) return;

      // 4. Update all state at once
      setImage(nasaImg);
      setPoints(analyzedPoints);
      setMissionId(prev => prev + 1);
      setLoadingProgress(100);

      setLoading(false);
      isInitializing.current = false;
      retryTimeoutRef.current = window.setTimeout(() => setIsHyperjumping(false), 800);
    } catch (err) {
      console.error(err);
      if (!isMounted.current) return;

      setError('Signal Lost. Re-establishing link...');
      isInitializing.current = false;
      retryTimeoutRef.current = window.setTimeout(() => initGame(mission), 3000);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    initGame();
    return () => {
      isMounted.current = false;
      if (retryTimeoutRef.current) window.clearTimeout(retryTimeoutRef.current);
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
          <div className="h-full bg-cyan-500 transition-all duration-500" style={{ width: `${loadingProgress}%` }}></div>
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
          onSelect={(mission) => initGame(mission)}
          isLoading={isHyperjumping}
          prefetchedState={prefetchedState}
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
          onSectorComplete={() => setIsSectorComplete(true)}
        />
      )}

      {/* New Mission Button - HUD Integrated */}
      <div className="absolute bottom-8 right-8 flex flex-col items-end gap-2 z-[60]">
        <button
          onClick={startMissionDiscovery}
          disabled={isHyperjumping || isFetchingOptions || showMissionSelector}
          className={`group relative overflow-hidden px-8 py-3 bg-slate-950 border transition-all duration-500 rounded-xl disabled:opacity-50 ${isSectorComplete
            ? 'border-cyan-400 text-white shadow-[0_0_20px_rgba(34,211,238,0.5)] animate-pulse'
            : 'border-cyan-500/30 text-cyan-400 hover:border-cyan-400 hover:text-white hover:shadow-[0_0_20px_rgba(34,211,238,0.3)]'}`}
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
