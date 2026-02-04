
import React, { useState, useEffect } from 'react';
import { fetchSpaceImage, imageToBase64, fetchHighFidelitySpaceAsset } from './services/nasaService';
import { analyzeSpaceImage, generateMissionOptions, validateImageContent, MissionOption } from './services/geminiService';
import { validateGroundingManifest } from './services/groundingValidator';
import GameWorld from './components/GameWorld';
import MissionSelector from './components/MissionSelector';
import { NASAImage, POI } from './types';
import { getWCSForNasaId } from './services/mastService';
import { JWSTScientificData } from './types';
import { fetchResearchData } from './services/researchService';
import DeepScanArtifact from './components/DeepScanArtifact';

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
  const [showDeepScan, setShowDeepScan] = useState(false);
  const [deepScanData, setDeepScanData] = useState<JWSTScientificData | null>(null);

  // Guard against duplicate initialization and handle unmounting
  const isInitializing = React.useRef(false);
  const isMounted = React.useRef(true);
  const retryTimeoutRef = React.useRef<number | null>(null);
  // Pre-fetch cache for mission images, base64 data, and AI points
  const prefetchedImages = React.useRef<Record<string, NASAImage>>({});
  const prefetchedBase64 = React.useRef<Record<string, string>>({});
  const prefetchedPoints = React.useRef<Record<string, POI[]>>({});
  const [prefetchedState, setPrefetchedState] = useState<Record<string, 'loading' | 'ready' | 'error'>>({});
  const missionHistory = React.useRef<string[]>([]);

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
    "Pre-heating fusion cores for efficient energy flow.",
    "Defragmenting cosmic ray interference patterns.",
    "Calibrating gravimetric sensors for local distortions.",
    "Calculating dark matter density in the forward sector.",
    "Synchronizing time-dilation buffers for warp exit.",
    "Analyzing spectral shift of neighboring star clusters.",
    "Adjusting hull polarization for high-energy radiation.",
    "Optimizing neutrino detectors for silent signatures.",
    "Mapping relativistic corridors for safe hyperjump.",
    "Initializing interstellar beacon handshake protocol.",
    "Verifying vacuum seal integrity for warp transit."
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
      // 2. Fetch AI options with exclusion of history
      const rawOptions = await generateMissionOptions(missionHistory.current.slice(-10));

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

          // Continue background processing (Base64 + Sentry + Gemini)
          (async () => {
            try {
              const { data: b64, width, height } = await imageToBase64(img.analysisUrl);
              prefetchedBase64.current[opt.id] = b64;

              // Patch sidecar dimensions in prefetch cache
              if (img.sidecar) {
                img.sidecar.envelope.xmax = width;
                img.sidecar.envelope.ymax = height;
              }

              // AI Sentry Validation for Mission Options
              const isValid = await validateImageContent(b64);
              if (!isValid) {
                console.warn(`Mission option '${opt.topic}' failed Sentry validation. Removing from selectable list.`);

                // Immediately remove this option from the UI
                setMissionOptions(currentOptions => currentOptions.filter(o => o.id !== opt.id));
                setPrefetchedState(prev => ({ ...prev, [opt.id]: 'error' }));
                return;
              }

              const pts = await analyzeSpaceImage(b64, img);
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

      // 1. Fetch metadata (fastest)
      const nasaImg = missionId_key && prefetchedImages.current[missionId_key]
        ? prefetchedImages.current[missionId_key]
        : (specificTopic ? await fetchHighFidelitySpaceAsset(specificTopic) : await fetchSpaceImage());

      if (!isMounted.current) return;

      // 2. Start WCS fetch in background - DO NOT AWAIT YET
      const wcsPromise = nasaImg.nasaId ? getWCSForNasaId(nasaImg.nasaId) : Promise.resolve(null);

      // 3. Process Image and start AI Analysis
      setLoadingProgress(30);
      setLoadingStep('Synchronizing Systems...');

      const base64Result = await imageToBase64(nasaImg.analysisUrl);
      const { data: base64, width, height } = base64Result;

      // Update the sidecar with REAL dimensions
      if (nasaImg.sidecar) {
        nasaImg.sidecar.envelope.xmax = width;
        nasaImg.sidecar.envelope.ymax = height;
      }

      if (!isMounted.current) return;

      // 4. Run AI Analysis and WCS Fetch in parallel
      const isAlreadyVerified = missionId_key && prefetchedPoints.current[missionId_key];
      let analyzedPoints: POI[];

      if (isAlreadyVerified) {
        analyzedPoints = prefetchedPoints.current[missionId_key];
        // Ensure WCS is finished anyway for consistency
        await wcsPromise;
        setLoadingProgress(90);
      } else {
        setLoadingStep('Performing Neural Analysis...');
        setLoadingProgress(50);

        // This is the big parallel block: AI Validation + AI Analysis + WCS Sync
        const [validationResult, aiPoints, wcsData] = await Promise.all([
          validateImageContent(base64),
          analyzeSpaceImage(base64, nasaImg), // Call without WCS for now to speed up start
          wcsPromise
        ]);

        if (!isMounted.current) return;

        if (!validationResult) {
          console.warn('Image rejected by Sentry. Retrying jump...');
          setLoadingStep('Contamination Detected. Re-routing...');
          isInitializing.current = false;
          retryTimeoutRef.current = window.setTimeout(() => initGame(mission), 1500);
          return;
        }

        // Apply WCS mapping to AI points after both are ready
        if (wcsData) {
          const { pixelToRADec } = await import('./services/wcsService');
          aiPoints.forEach(p => {
            const coords = pixelToRADec(p.hard_anchor.pixelX, p.hard_anchor.pixelY, width, height, wcsData);
            p.ra = coords.ra;
            p.dec = coords.dec;
            p.registrationStatus = 'SYNCED';
          });
        }

        // Geometric Grounding Validation
        if (nasaImg.sidecar) {
          const grounding = validateGroundingManifest(nasaImg, nasaImg.sidecar);
          if (!grounding.valid) {
            console.warn('Image rejected due to Geometric Noise:', grounding.errors);
            setLoadingStep('Geometric Drift Detected. Recalibrating...');
            isInitializing.current = false;
            retryTimeoutRef.current = window.setTimeout(() => initGame(mission), 1500);
            return;
          }
        }

        analyzedPoints = aiPoints;
      }

      setLoadingProgress(100);

      // 5. Update state
      setImage(nasaImg);
      setPoints(analyzedPoints);
      setMissionId(prev => prev + 1);
      setLoading(false);
      isInitializing.current = false;
      retryTimeoutRef.current = window.setTimeout(() => setIsHyperjumping(false), 800);

      // Automatically attempt to fetch deep scientific data in background
      if (nasaImg.nasaId) {
        fetchResearchData(nasaImg.nasaId).then(data => {
          if (data) setDeepScanData(data);
        });
      }
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
          options={missionOptions.filter(opt => prefetchedState[opt.id] !== 'error')}
          onSelect={(mission) => initGame(mission)}
          isLoading={isHyperjumping}
          prefetchedState={prefetchedState}
        />
      )}

      {image && points.length > 0 && !loading && (
        <GameWorld
          key={`${image.url}-${missionId}`}
          image={image}
          points={points}
          onSectorComplete={() => setIsSectorComplete(true)}
          onDeepScan={() => setShowDeepScan(true)}
          sectorCompleted={isSectorComplete}
        />
      )}

      {showDeepScan && image && deepScanData && (
        <DeepScanArtifact
          image={image}
          data={deepScanData}
          onClose={() => setShowDeepScan(false)}
        />
      )}

      {/* New Mission Button - HUD Integrated */}
      <div className="absolute bottom-8 right-8 flex flex-col items-end gap-2 z-[60]">
        <button
          onClick={startMissionDiscovery}
          disabled={isHyperjumping || isFetchingOptions || showMissionSelector || !isSectorComplete}
          className={`group relative overflow-hidden px-8 py-3 bg-slate-950 border transition-all duration-500 rounded-xl disabled:opacity-50 ${isSectorComplete
            ? 'border-cyan-400 text-white shadow-[0_0_20px_rgba(34,211,238,0.5)] animate-pulse'
            : 'border-slate-800 text-slate-500 cursor-not-allowed grayscale'}`}
        >
          <div className="absolute inset-0 bg-cyan-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
          <span className="relative z-10 font-black text-[11px] uppercase tracking-[0.25em]">
            {!isSectorComplete ? 'Sector Locked' : isFetchingOptions ? 'Scanning Sectors...' : 'Next Mission Area'}
          </span>
        </button>
      </div>
    </div>
  );
};

export default App;
