
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NASAImage, POI, GameState, QuizQuestion } from '../types';
import SpaceCharacter from './SpaceCharacter';
import QuizModal from './QuizModal';
import DiscoveryJournal from './DiscoveryJournal';
import { generateQuiz } from '../services/geminiService';
import { getWCSForNasaId } from '../services/mastService';
import { pixelToRADec, formatCoords, WCSParams } from '../services/wcsService';

interface Props {
  image: NASAImage;
  points: POI[];
  onSectorComplete?: () => void;
  onDeepScan?: () => void;
  sectorCompleted?: boolean;
}

const INTERACTION_RADIUS = 6; // percentage to enter/trigger
const EXIT_RADIUS = 12; // percentage to exit/close (hysteresis)

const GameWorld: React.FC<Props> = ({ image, points, onSectorComplete, onDeepScan, sectorCompleted }) => {
  const [gameState, setGameState] = useState<GameState>({
    posX: 50,
    posY: 50,
    velocity: { x: 0, y: 0 },
    activePOI: null
  });

  // Filter points to ensure only safe/visible ones are used throughout the component
  const validPoints = React.useMemo(() =>
    points.filter(poi => poi.x >= 0 && poi.x <= 100 && poi.y >= 0 && poi.y <= 100),
    [points]);

  const [rotation, setRotation] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const keysPressed = useRef<Set<string>>(new Set());

  // POI Exploration Tracking
  const [exploredPOIs, setExploredPOIs] = useState<Set<string>>(new Set());
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizScore, setQuizScore] = useState<{ score: number, total: number } | null>(null);
  const [quizCompleted, setQuizCompleted] = useState(false);

  // Responsive Alignment States
  const [imageSize, setImageSize] = useState({ width: 1920, height: 1080 }); // Default fallback
  const [renderedSize, setRenderedSize] = useState({ width: 0, height: 0 });
  const [snappedSize, setSnappedSize] = useState({ width: 0, height: 0 });
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [wcs, setWcs] = useState<WCSParams | null>(null);
  const [hoverCoords, setHoverCoords] = useState<{ ra: number; dec: number } | null>(null);
  const [isSyncingWCS, setIsSyncingWCS] = useState(false);

  const imageRef = useRef<HTMLImageElement>(null);

  // Device Pixel Snapping Logic
  const snap = (n: number) => {
    const dpr = window.devicePixelRatio || 1;
    return Math.round(n * dpr) / dpr;
  };

  // Track rendered image dimensions for pixel-perfect anchoring
  useEffect(() => {
    if (!imageRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === imageRef.current) {
          const width = entry.contentRect.width;
          const height = entry.contentRect.height;

          setRenderedSize({ width, height });

          // Medical Imaging Snap: Force the dimensions to the hardware device grid
          setSnappedSize({
            width: snap(width),
            height: snap(height)
          });
        }
      }
    });

    observer.observe(imageRef.current);
    return () => observer.disconnect();
  }, []);

  // Audio Component: Synthesized "Ping" for interaction feedback
  const playPing = useCallback((freq = 880, type: OscillatorType = 'sine', duration = 0.15) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) { }
  }, []);

  // Load image dimensions to calculate aspect ratio
  useEffect(() => {
    if (image.videoUrl) {
      const vid = document.createElement('video');
      vid.onloadedmetadata = () => {
        setImageSize({ width: vid.videoWidth, height: vid.videoHeight });
      };
      vid.src = image.videoUrl;
    } else {
      const img = new Image();
      img.onload = () => {
        setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.src = image.url;
    }

    // Fetch WCS Data from MAST
    const fetchWCS = async () => {
      if (!image.nasaId) return;
      setIsSyncingWCS(true);
      try {
        const wcsData = await getWCSForNasaId(image.nasaId);
        if (wcsData) setWcs(wcsData);
      } catch (e) {
        console.error("Failed to sync WCS:", e);
      } finally {
        setIsSyncingWCS(false);
      }
    };
    fetchWCS();
  }, [image.url, image.nasaId]);

  // Handle Window Resize
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });

      // Keep WASD in viewport
      setWasdPos(prev => ({
        x: Math.min(prev.x, window.innerWidth - 100),
        y: Math.min(prev.y, window.innerHeight - 100)
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const updatePosition = useCallback(() => {
    setGameState(prev => {
      let vx = prev.velocity.x;
      let vy = prev.velocity.y;

      // Normal exploration pace
      const accel = 0.025;
      const friction = 0.94;

      if (keysPressed.current.has('ArrowUp')) vy -= accel;
      if (keysPressed.current.has('ArrowDown')) vy += accel;
      if (keysPressed.current.has('ArrowLeft')) vx -= accel;
      if (keysPressed.current.has('ArrowRight')) vx += accel;

      vx *= friction;
      vy *= friction;

      let nextX = prev.posX + vx;
      let nextY = prev.posY + vy;

      const buffer = 5;
      if (nextX < buffer) { nextX = buffer; vx = 0; }
      if (nextX > 100 - buffer) { nextX = 100 - buffer; vx = 0; }
      if (nextY < buffer) { nextY = buffer; vy = 0; }
      if (nextY > 100 - buffer) { nextY = 100 - buffer; vy = 0; }

      // Check POI collisions with hysteresis (sticky tooltips)
      let activePOI = prev.activePOI;

      // If we have an active POI, check if we've moved far enough away to close it
      if (activePOI) {
        // Use pixel-relative distance for circular interaction regardless of aspect ratio
        const dxPx = ((activePOI.x - nextX) / 100) * snappedSize.width;
        const dyPx = ((activePOI.y - nextY) / 100) * snappedSize.height;
        const distPx = Math.sqrt(dxPx * dxPx + dyPx * dyPx);

        // INTERACTION_RADIUS is in percentage relative to viewport height or width?
        // Let's use a fixed pixel threshold for consistent "feel"
        const interactionThresholdPx = (INTERACTION_RADIUS / 100) * Math.min(snappedSize.width, snappedSize.height);
        const exitThresholdPx = (EXIT_RADIUS / 100) * Math.min(snappedSize.width, snappedSize.height);

        if (distPx > exitThresholdPx) {
          activePOI = null;
        }
      }

      // If no POI is active (or we just closed one), check for new collisions
      if (!activePOI) {
        const interactionThresholdPx = (INTERACTION_RADIUS / 100) * Math.min(snappedSize.width, snappedSize.height);

        for (const poi of validPoints) {
          const dxPx = ((poi.x - nextX) / 100) * snappedSize.width;
          const dyPx = ((poi.y - nextY) / 100) * snappedSize.height;
          const distPx = Math.sqrt(dxPx * dxPx + dyPx * dyPx);

          if (distPx < interactionThresholdPx) {
            activePOI = poi;
            // Mark POI as explored
            setExploredPOIs(prevExplored => {
              if (!prevExplored.has(poi.id)) {
                const newExplored = new Set(prevExplored);
                newExplored.add(poi.id);
                return newExplored;
              }
              return prevExplored;
            });
            break;
          }
        }
      }

      if (Math.abs(vx) > 0.01 || Math.abs(vy) > 0.01) {
        setRotation(Math.atan2(vy, vx) * 180 / Math.PI + 90);
      }

      return {
        ...prev,
        posX: nextX,
        posY: nextY,
        velocity: { x: vx, y: vy },
        activePOI: activePOI
      };
    });
  }, [validPoints, snappedSize]); // RELIANCE ON SNAPPED SIZE FIXED

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => keysPressed.current.add(e.key);
    const handleKeyUp = (e: KeyboardEvent) => keysPressed.current.delete(e.key);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let frameId: number;
    const loop = () => {
      // Support WASD mapping
      if (keysPressed.current.has('w') || keysPressed.current.has('W')) keysPressed.current.add('ArrowUp');
      if (keysPressed.current.has('s') || keysPressed.current.has('S')) keysPressed.current.add('ArrowDown');
      if (keysPressed.current.has('a') || keysPressed.current.has('A')) keysPressed.current.add('ArrowLeft');
      if (keysPressed.current.has('d') || keysPressed.current.has('D')) keysPressed.current.add('ArrowRight');

      updatePosition();
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(frameId);
    };
  }, [updatePosition]);

  // Manual Control Helpers
  const startMove = (key: string) => keysPressed.current.add(key);
  const stopMove = (key: string) => keysPressed.current.delete(key);

  // Draggable WASD State
  const [wasdPos, setWasdPos] = useState({ x: 32, y: window.innerHeight - 160 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // HUD Visibility State
  const [showHUD, setShowHUD] = useState(true);
  const [showJournal, setShowJournal] = useState(false);

  // Check for sector completion
  useEffect(() => {
    if (exploredPOIs.size === validPoints.length && validPoints.length > 0 && !sectorCompleted) {
      playPing(880, 'sine', 0.2); // High-frequency success ping
      onSectorComplete?.();
      // Trigger quiz generation
      const exploredPOIData = validPoints.filter(p => exploredPOIs.has(p.id));
      generateQuiz(exploredPOIData).then(questions => {
        setQuizQuestions(questions);
      });
    }
  }, [exploredPOIs, points, sectorCompleted]);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    dragOffset.current = {
      x: clientX - wasdPos.x,
      y: clientY - wasdPos.y
    };
  };

  const handleDrag = useCallback((e: MouseEvent | TouchEvent) => {
    if (isDragging) {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      setWasdPos({
        x: clientX - dragOffset.current.x,
        y: clientY - dragOffset.current.y
      });
    }
  }, [isDragging, wasdPos.x, wasdPos.y]);

  const handleDragEnd = () => setIsDragging(false);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDrag);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDrag);
      window.addEventListener('touchend', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDrag);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDrag);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleDrag]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!wcs || !imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
      const coords = pixelToRADec(x, y, rect.width, rect.height, wcs);
      setHoverCoords(coords);
    } else {
      setHoverCoords(null);
    }
  };

  // Dynamic height calculation for Tooltip
  const isTooltipFlipped = gameState.posY > 60;
  const tooltipMaxHeight = isTooltipFlipped ? gameState.posY - 10 : 90 - gameState.posY;

  // Rigid Aspect Frame helper
  const frameStyle: React.CSSProperties = {
    position: 'relative',
    margin: '0',
    padding: '0',
    maxWidth: '100%',
    maxHeight: '100%',
    aspectRatio: `${imageSize.width} / ${imageSize.height}`,
    width: snappedSize.width > 0 ? undefined : '100%',
    height: snappedSize.height > 0 ? undefined : 'auto',
    contain: 'layout paint'
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-screen overflow-hidden bg-black transition-colors duration-700 ${gameState.activePOI ? 'bg-cyan-950/20' : ''}`}
    >
      {/* Skybox / State-Aware Background */}
      {/* Parallax Container: Moves opposite to player position to create depth */}
      <div
        className="absolute transition-transform duration-700 ease-out will-change-transform flex items-center justify-center overflow-hidden"
        style={{
          width: '100%',
          height: '100%',
          left: '0%',
          top: '0%',
          // Combined Visual Stack: Parallax and Zoom applied ONCE at the top wrapper to ensure coordinate locking.
          transform: `translate3d(${(50 - gameState.posX) * 0.0005 * windowSize.width}px, ${(50 - gameState.posY) * 0.0005 * windowSize.height}px, 0) scale(${1 + (gameState.activePOI ? 0.05 : 0)})`,
          transformOrigin: 'top left', // RIGID GROUNDING: Force top-left origin
          imageRendering: 'pixelated', // RIGID GROUNDING: Bypass scaling anti-aliasing
          contain: 'layout paint'
        }}
      >
        {/* Aspect-Ratio-Aware Container: Layout only, no transforms here to avoid rounding drift. */}
        {/* RIGID GROUNDING: POI placement must be performed in the same coordinate space and resolution 
            as the final rendered raster, with no intermediate scaling, cropping, rotation, or aspect adjustment. */}
        <div
          className="relative shadow-2xl flex-none overflow-hidden"
          style={frameStyle}
        >
          {image.videoUrl ? (
            <video
              ref={imageRef as any}
              src={image.videoUrl}
              autoPlay
              loop
              muted
              playsInline
              className="block select-none m-0 p-0"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'fill',
                imageRendering: 'pixelated',
                filter: gameState.activePOI ? 'brightness(1.1) contrast(1.15)' : 'brightness(1) contrast(1)',
                transition: 'filter 0.7s ease-out'
              }}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoverCoords(null)}
            />
          ) : (
            <img
              ref={imageRef}
              src={image.url}
              className="block select-none m-0 p-0"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'fill', // Force-align pixels to the snapped container manifest
                imageRendering: 'pixelated',
                filter: gameState.activePOI ? 'brightness(1.1) contrast(1.15)' : 'brightness(1) contrast(1)',
                transition: 'filter 0.7s ease-out'
              }}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoverCoords(null)}
              draggable={false}
            />
          )}

          {/* POI Markers and Tooltips - Now perfectly aligned in image space */}
          {validPoints.map(poi => {
            const isNearby = gameState.activePOI?.id === poi.id;

            // PIXEL-PERFECT GROUNDING PROTOCOL:
            // 1. Calculate absolute display pixels from source percentage.
            // 2. Use 'snappedSize' as the authoritative Render Image Space.
            // 3. Keep accuracy within 0.1px.
            const xPx = (poi.x / 100) * snappedSize.width;
            const yPx = (poi.y / 100) * snappedSize.height;

            const POI_SIZE = 40; // matches w-10 h-10 (40px)
            const OFFSET = POI_SIZE / 2;

            const isFlippedY = poi.y > 50;
            const isFlippedX = poi.x > 50;

            return (
              <React.Fragment key={poi.id}>
                {/* Overlay Space: Marker */}
                <div
                  className="absolute flex items-center justify-center z-40 will-change-transform w-10 h-10"
                  style={{
                    position: 'absolute',
                    left: `${xPx - OFFSET}px`,
                    top: `${yPx - OFFSET}px`,
                    transition: 'opacity 0.5s ease-out, transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    // Using translate3d(0,0,0) with sub-pixel values for high precision
                    transform: `translate3d(0, 0, 0) ${isNearby ? 'scale(1.2)' : 'scale(1)'}`,
                    opacity: isNearby ? 1 : 0.5,
                    willChange: 'transform',
                    pointerEvents: 'auto',
                    transformOrigin: 'center center'
                  }}
                >
                  <div className={`w-10 h-10 rounded-full border-[3px] transition-all duration-500 ${isNearby
                    ? 'border-cyan-300 bg-cyan-400/30 shadow-[0_0_30px_#22d3ee,0_0_60px_#22d3ee]'
                    : exploredPOIs.has(poi.id)
                      ? 'border-slate-400 bg-slate-500/20 shadow-[0_0_10px_rgba(148,163,184,0.5)]'
                      : 'border-cyan-400 bg-cyan-400/10 shadow-[0_0_20px_#22d3ee,0_0_40px_rgba(34,211,238,0.4)] poi-pulse'
                    } flex items-center justify-center ring-4 ring-cyan-500/10`}>
                    <div className={`w-2 h-2 rounded-full ${isNearby ? 'bg-white shadow-[0_0_10px_white]' : 'bg-cyan-400/50'} transition-all`} />
                    {isNearby && <div className="absolute inset-0 w-full h-full rounded-full border border-white/50 animate-ping" />}
                  </div>
                  <div className={`absolute -bottom-10 whitespace-nowrap text-[10px] uppercase tracking-tighter font-black transition-all px-3 py-1 rounded-full border backdrop-blur-sm ${isNearby
                    ? 'text-cyan-300 translate-y-[-4px] drop-shadow-[0_0_5px_cyan] bg-slate-950/80 border-cyan-500/30'
                    : exploredPOIs.has(poi.id)
                      ? 'text-slate-200 bg-slate-900/80 border-slate-500/30 shadow-md'
                      : 'hidden'
                    }`}>
                    {isNearby ? 'SIGNAL DETECTED' : (exploredPOIs.has(poi.id) ? poi.name : '')}
                  </div>
                </div>

                {/* Overlay Space: Tooltip (Anchored to exact display pixel) */}
                {isNearby && (
                  <div
                    className="absolute z-[100] p-5 bg-slate-950/90 border-l-4 border-cyan-500 backdrop-blur-2xl rounded shadow-2xl w-80 overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-500/30 scrollbar-track-transparent transition-all duration-500 animate-in fade-in zoom-in-95"
                    style={{
                      left: `${xPx}px`,
                      top: `${yPx}px`,
                      // Smart Positioning: Absolute Pixel Offset to prevent drift
                      transform: `translate(${isFlippedX ? 'calc(-100% - 35px)' : '35px'}, ${isFlippedY ? 'calc(-100% + 20px)' : 'calc(20px)'})`,
                      maxHeight: isFlippedY ? `${yPx - 20}px` : `${snappedSize.height - yPx - 20}px`,
                      maxWidth: isFlippedX ? `${xPx - 20}px` : `${snappedSize.width - xPx - 20}px`,
                      pointerEvents: 'auto'
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex flex-col gap-1">
                        <h3 className="text-cyan-50 text-2xl font-black tracking-tight uppercase drop-shadow-[0_0_10px_rgba(8,145,178,0.8)]">
                          {poi.name}
                        </h3>
                      </div>
                      <div className="text-[9px] font-mono text-cyan-400 animate-pulse border border-cyan-800 px-1 self-start mt-1">ACTIVE SCAN</div>
                    </div>

                    <div className="text-slate-300 text-sm leading-relaxed font-normal antialiased whitespace-pre-wrap space-y-3">
                      {poi.description.split('\n').map((line, idx) => {
                        const lowLine = line.toLowerCase().trim();
                        const isPhysics = lowLine.includes('the physics') && lowLine.indexOf('the physics') < 3;
                        const isStory = lowLine.includes('the story') && lowLine.indexOf('the story') < 3;
                        const isProof = lowLine.includes('the proof') && lowLine.indexOf('the proof') < 3;

                        if (isPhysics || isStory || isProof) {
                          const colonIdx = line.indexOf(':');
                          const label = colonIdx > -1 ? line.substring(0, colonIdx + 1) : (isPhysics ? 'The Physics:' : isStory ? 'The Story:' : 'The Proof:');
                          const content = colonIdx > -1 ? line.substring(colonIdx + 1) : (colonIdx === -1 ? line.replace(/the (physics|story|proof):?/i, '') : '');

                          let colorClass = 'text-cyan-400';
                          let glowClass = 'drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]';

                          if (isStory) {
                            colorClass = 'text-fuchsia-400';
                            glowClass = 'drop-shadow-[0_0_8px_rgba(232,121,249,0.8)]';
                          } else if (isProof) {
                            colorClass = 'text-emerald-400';
                            glowClass = 'drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]';
                          }

                          return (
                            <div key={idx} className="block mt-2 first:mt-0">
                              <span className={`${colorClass} font-black uppercase tracking-wider ${glowClass} mr-2`}>
                                {label}
                              </span>
                              <span className="text-slate-100">{content}</span>
                            </div>
                          );
                        }
                        return line.trim() ? <div key={idx}>{line}</div> : null;
                      })}
                    </div>

                    {poi.thoughtSignature && (
                      <div className="mt-3 p-2 rounded bg-cyan-950/40 border border-cyan-500/20">
                        <div className="text-[9px] text-cyan-500 uppercase font-black tracking-widest mb-1 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
                          AI Triangulation Logic
                        </div>
                        {poi.ra !== undefined && poi.dec !== undefined && (
                          <div className="mb-2 px-1.5 py-1 bg-cyan-500/10 border-l border-cyan-500/40 font-mono text-[9px] text-cyan-200">
                            COORD_SYNC: {formatCoords(poi.ra, poi.dec)}
                          </div>
                        )}
                        <p className="text-[10px] text-cyan-200/80 font-mono leading-relaxed italic">
                          "{poi.thoughtSignature}"
                        </p>

                      </div>
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })}

          {/* Character - Now in the same image-space as POIs */}
          <SpaceCharacter
            x={gameState.posX}
            y={gameState.posY}
            pixelX={(gameState.posX / 100) * snappedSize.width}
            pixelY={(gameState.posY / 100) * snappedSize.height}
            rotation={rotation}
            isThrusting={keysPressed.current.size > 0}
            isBraking={keysPressed.current.size === 0 && (Math.abs(gameState.velocity.x) > 0.01 || Math.abs(gameState.velocity.y) > 0.01)}
            turnDirection={0}
            key={String(keysPressed.current.size > 0)}
          />
        </div>
      </div>

      {/* Aesthetic HUD Scanlines */}
      <div className="scanline" />
      <div className="absolute inset-0 pointer-events-none opacity-20"
        style={{ background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 255, 0, 0.06))', backgroundSize: '100% 4px, 3px 100%' }} />

      {/* Grid Overlay - Also State Aware (Parallax) */}

      {/* Top Left: Telemetry (Title Truncation Fixed, Fixed Width) */}
      {showHUD && (
        <div className="absolute top-8 left-8 w-[196px] p-6 bg-slate-950/80 backdrop-blur-md border border-white/5 font-mono text-xs shadow-2xl ring-1 ring-cyan-500/20 z-[60] transition-opacity duration-300 animate-in fade-in slide-in-from-left-4 rounded-xl">
          <div className="text-cyan-400 font-black mb-3 tracking-widest text-[11px] border-b border-cyan-900 pb-2">VOYAGER TELEMETRY v2.6</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 font-black">
            <div className="text-cyan-500/90 text-[10px] tracking-tight">POS_LAT:</div><div className="text-white text-right drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]">{gameState.posY.toFixed(3)}°</div>
            <div className="text-cyan-500/90 text-[10px] tracking-tight">POS_LNG:</div><div className="text-white text-right drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]">{gameState.posX.toFixed(3)}°</div>
          </div>
          <div className="mt-4 p-2 bg-white/5 rounded border border-white/5">
            <div className="text-[10px] text-cyan-300 uppercase font-black tracking-widest leading-relaxed mb-1">
              CURRENT TARGET:
            </div>
            <div className="text-white text-[11px] font-black leading-tight border-l-2 border-cyan-500 pl-2 py-0.5">
              {image.title}
            </div>
          </div>

          {/* Deep Scan Trigger Button */}
          {onDeepScan && (
            <button
              onClick={onDeepScan}
              className="mt-3 w-full py-2 bg-slate-900 border border-cyan-500/30 rounded-lg flex flex-col items-center justify-center group hover:border-cyan-400 hover:bg-cyan-500/10 transition-all active:scale-95"
            >
              <div className="text-[8px] text-cyan-500 font-black tracking-[0.2em] group-hover:text-cyan-300">SYSTEM ANALYZER</div>
              <div className="text-[10px] text-white font-bold group-hover:text-cyan-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-[ping_1.5s_infinite]" />
                DEEP SCAN READOUT
              </div>
            </button>
          )}



          {/* Quiz Status - Highlighted */}
          <div
            onClick={() => {
              if ((sectorCompleted || quizCompleted) && quizQuestions.length > 0) {
                setShowQuiz(true);
              }
            }}
            className={`mt-4 pt-4 pb-3 px-3 -mx-2 rounded-lg border-2 transition-all duration-500 overflow-hidden relative group ${quizCompleted && quizScore
              ? quizScore.score / quizScore.total >= 0.8
                ? 'border-green-500/60 bg-green-950/30 shadow-[0_0_20px_rgba(34,197,94,0.4)] cursor-pointer hover:bg-green-950/50'
                : quizScore.score / quizScore.total >= 0.5
                  ? 'border-cyan-500/60 bg-cyan-950/30 shadow-[0_0_20px_rgba(34,211,238,0.4)] cursor-pointer hover:bg-cyan-950/50'
                  : 'border-amber-500/60 bg-amber-950/30 shadow-[0_0_20px_rgba(251,191,36,0.4)] cursor-pointer hover:bg-amber-950/50'
              : sectorCompleted
                ? 'border-cyan-400 bg-cyan-500/20 shadow-[0_0_30px_#22d3ee] animate-[pulse_2s_infinite] cursor-pointer hover:bg-cyan-500/30 scale-105 transition-transform'
                : 'border-cyan-900/40 bg-transparent opacity-60 cursor-not-allowed'
              }`}>

            {/* Animated accent for sector completed */}
            {sectorCompleted && !quizCompleted && (
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-[progress-scan_2s_linear_infinite]" />
            )}

            <div className={`text-[10px] uppercase tracking-wider mb-2 font-black flex items-center gap-2 ${sectorCompleted ? 'text-cyan-300' : 'text-cyan-500/70'}`}>
              <span className={sectorCompleted ? 'animate-bounce' : ''}>⚡</span> KNOWLEDGE ASSESSMENT
            </div>
            {quizCompleted && quizScore ? (
              <div className="text-white font-black text-sm">
                SCORE: <span className={`${quizScore.score / quizScore.total >= 0.8 ? 'text-green-400' : quizScore.score / quizScore.total >= 0.5 ? 'text-cyan-400' : 'text-amber-400'}`}>
                  {quizScore.score}/{quizScore.total}
                </span>
                <span className="text-[10px] text-slate-400 ml-2">({Math.round((quizScore.score / quizScore.total) * 100)}%)</span>
              </div>
            ) : sectorCompleted ? (
              quizQuestions.length > 0 ? (
                <div className="text-cyan-300 text-[11px] font-black italic tracking-tighter animate-pulse">🎯 SECTOR BRIEFING READY</div>
              ) : (
                <div className="text-cyan-500/50 text-[10px] font-mono animate-pulse flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-ping" />
                  SYNCING KNOWLEDGE DATA...
                </div>
              )
            ) : (
              <div className="text-slate-400 text-[9px] font-mono">EXPLORATION IN PROGRESS...</div>
            )}

            {sectorCompleted && !quizCompleted && (
              <div className="mt-2 text-[8px] text-cyan-400/80 font-bold uppercase tracking-widest text-right group-hover:text-white transition-colors">
                Click to Initiate Sync →
              </div>
            )}
          </div>
        </div>
      )}

      {/* Draggable WASD Controls */}
      <div
        className={`fixed flex flex-col items-center gap-2 z-[60] p-2 rounded-xl transition-shadow ${isDragging ? 'shadow-[0_0_20px_rgba(34,211,238,0.3)] bg-slate-900/50 cursor-grabbing' : 'bg-transparent cursor-grab'}`}
        style={{ left: wasdPos.x, top: wasdPos.y }}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        {/* Grip Handle */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-1 bg-slate-700/50 rounded-full mb-2"></div>

        {/* Real-time WCS Readout */}
        {wcs && (
          <div className="absolute bottom-full mb-8 left-1/2 -translate-x-1/2 w-80 p-3 bg-slate-950/90 border border-cyan-500/30 rounded-lg backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black text-cyan-400 tracking-widest uppercase">MAST FITS Sync: ACTIVE</span>
              <div className="flex gap-1">
                <div className="w-1 h-1 rounded-full bg-cyan-500 animate-pulse"></div>
                <div className="w-1 h-1 rounded-full bg-cyan-700"></div>
              </div>
            </div>
            <div className="font-mono text-[11px] text-white py-1.5 border-y border-white/5 flex flex-col gap-1">
              {hoverCoords ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-cyan-500/70">WCS_COORD:</span>
                    <span>{formatCoords(hoverCoords.ra, hoverCoords.dec)}</span>
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>EPOCH: J2000</span>
                    <span>PROJ: {wcs.ctype1?.split('-')[0] || 'TAN'}</span>
                  </div>
                </>
              ) : (
                <div className="text-center text-slate-500 italic pb-1">HOVER OVER {image.videoUrl ? 'VIDEO' : 'IMAGE'} FOR RA/DEC</div>
              )}
            </div>
            <div className="mt-2 text-[8px] text-cyan-500/50 font-mono flex justify-between uppercase">
              <span>NASA_ID: {image.nasaId}</span>
              <span>SC: {((wcs.cdelt1 || 0) * 3600).toFixed(4)}"/px</span>
            </div>
          </div>
        )}

        {/* Up Arrow */}
        <button
          className="w-12 h-12 bg-slate-900/40 border border-cyan-500/50 rounded flex items-center justify-center text-cyan-400 font-bold text-xl hover:bg-cyan-900/40 active:bg-cyan-500 active:text-black transition-all shadow-[0_0_10px_rgba(34,211,238,0.1)] select-none pointer-events-auto cursor-pointer backdrop-blur-sm"
          onMouseDown={(e) => { e.stopPropagation(); startMove('ArrowUp'); }}
          onMouseUp={(e) => { e.stopPropagation(); stopMove('ArrowUp'); }}
          onMouseLeave={(e) => { e.stopPropagation(); stopMove('ArrowUp'); }}
          onTouchStart={(e) => { e.stopPropagation(); startMove('ArrowUp'); }}
          onTouchEnd={(e) => { e.stopPropagation(); stopMove('ArrowUp'); }}
        >
          ↑
        </button>
        <div className="flex gap-2">
          {/* Left Arrow */}
          <button
            className="w-12 h-12 bg-slate-900/40 border border-cyan-500/50 rounded flex items-center justify-center text-cyan-400 font-bold text-xl hover:bg-cyan-900/40 active:bg-cyan-500 active:text-black transition-all shadow-[0_0_10px_rgba(34,211,238,0.1)] select-none pointer-events-auto cursor-pointer backdrop-blur-sm"
            onMouseDown={(e) => { e.stopPropagation(); startMove('ArrowLeft'); }}
            onMouseUp={(e) => { e.stopPropagation(); stopMove('ArrowLeft'); }}
            onMouseLeave={(e) => { e.stopPropagation(); stopMove('ArrowLeft'); }}
            onTouchStart={(e) => { e.stopPropagation(); startMove('ArrowLeft'); }}
            onTouchEnd={(e) => { e.stopPropagation(); stopMove('ArrowLeft'); }}
          >
            ←
          </button>
          {/* Down Arrow */}
          <button
            className="w-12 h-12 bg-slate-900/40 border border-cyan-500/50 rounded flex items-center justify-center text-cyan-400 font-bold text-xl hover:bg-cyan-900/40 active:bg-cyan-500 active:text-black transition-all shadow-[0_0_10px_rgba(34,211,238,0.1)] select-none pointer-events-auto cursor-pointer backdrop-blur-sm"
            onMouseDown={(e) => { e.stopPropagation(); startMove('ArrowDown'); }}
            onMouseUp={(e) => { e.stopPropagation(); stopMove('ArrowDown'); }}
            onMouseLeave={(e) => { e.stopPropagation(); stopMove('ArrowDown'); }}
            onTouchStart={(e) => { e.stopPropagation(); startMove('ArrowDown'); }}
            onTouchEnd={(e) => { e.stopPropagation(); stopMove('ArrowDown'); }}
          >
            ↓
          </button>
          {/* Right Arrow */}
          <button
            className="w-12 h-12 bg-slate-900/40 border border-cyan-500/50 rounded flex items-center justify-center text-cyan-400 font-bold text-xl hover:bg-cyan-900/40 active:bg-cyan-500 active:text-black transition-all shadow-[0_0_10px_rgba(34,211,238,0.1)] select-none pointer-events-auto cursor-pointer backdrop-blur-sm"
            onMouseDown={(e) => { e.stopPropagation(); startMove('ArrowRight'); }}
            onMouseUp={(e) => { e.stopPropagation(); stopMove('ArrowRight'); }}
            onMouseLeave={(e) => { e.stopPropagation(); stopMove('ArrowRight'); }}
            onTouchStart={(e) => { e.stopPropagation(); startMove('ArrowRight'); }}
            onTouchEnd={(e) => { e.stopPropagation(); stopMove('ArrowRight'); }}
          >
            →
          </button>
        </div>
      </div>

      {/* Top Center: Mission UI (Moved from Top-Left) */}
      {showHUD && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 text-center pointer-events-none z-10 transition-opacity duration-300 animate-in fade-in slide-in-from-top-4">
          <h1 className="text-4xl font-black italic tracking-tighter text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]">
            CELESTIAL <span className="text-cyan-500 underline decoration-cyan-500/30">VOYAGER</span>
          </h1>
          <div className="flex items-center gap-3 mt-2 justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_10px_cyan]"></div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black bg-black/40 px-2 py-0.5 rounded border border-white/5">
              Gemini Neural Map Sync: ONLINE
            </p>
          </div>
        </div>
      )}

      {/* Top Right Controls */}
      <div className="absolute top-3 right-8 z-[70] flex gap-3">
        {/* Journal Button */}
        <button
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/50 hover:bg-slate-800/80 border border-white/10 hover:border-cyan-500/50 text-[10px] font-mono text-slate-400 hover:text-cyan-400 transition-all uppercase tracking-wider backdrop-blur-sm cursor-pointer select-none"
          onClick={() => setShowJournal(true)}
        >
          <span className="text-lg leading-none">📖</span>
          JOURNAL
        </button>

        {/* HUD Toggle Button */}
        <button
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/50 hover:bg-slate-800/80 border border-white/10 hover:border-cyan-500/50 text-[10px] font-mono text-slate-400 hover:text-cyan-400 transition-all uppercase tracking-wider backdrop-blur-sm cursor-pointer select-none"
          onClick={() => setShowHUD(!showHUD)}
        >
          <span className={`w-2 h-2 rounded-full ${showHUD ? 'bg-cyan-500' : 'bg-slate-600'}`}></span>
          {showHUD ? 'HUD: ON' : 'HUD: OFF'}
        </button>
      </div>

      {/* Sector Progress with Gradient Padding */}
      <div className={`absolute top-8 right-8 p-4 rounded-xl backdrop-blur-md transition-all duration-500 border ${sectorCompleted
        ? 'bg-cyan-500/10 border-cyan-400/50 shadow-[0_0_40px_rgba(34,211,238,0.2)]'
        : 'bg-slate-950/60 border-white/5'
        }`}
        style={{
          padding: '16px 24px',
          background: sectorCompleted
            ? 'linear-gradient(135deg, rgba(8, 145, 178, 0.2) 0%, rgba(15, 23, 42, 0.8) 100%)'
            : 'rgba(15, 23, 42, 0.6)'
        }}>
        <div className="text-right font-mono">
          <div className="text-[11px] text-slate-300 uppercase font-black mb-2 tracking-[0.2em] flex items-center justify-end gap-2">
            {sectorCompleted && <span className="text-cyan-400 animate-pulse">●</span>}
            SECTOR PROGRESS
            {sectorCompleted && (
              <span className="text-green-400 bg-green-950/50 px-2 py-0.5 rounded border border-green-500/30 text-[9px]">
                ✓ COMPLETE
              </span>
            )}
          </div>
          <div className="flex gap-2 mt-2 justify-end">
            {validPoints.map((p, i) => {
              const isExplored = exploredPOIs.has(p.id);
              const isActive = gameState.activePOI?.id === p.id;
              return (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-500 ${isActive
                    ? 'bg-cyan-300 w-8 shadow-[0_0_12px_#22d3ee] animate-pulse'
                    : isExplored
                      ? 'bg-green-400 w-4 shadow-[0_0_8px_rgba(74,222,128,0.5)]'
                      : 'bg-slate-800 w-3 opacity-30 shadow-inner'
                    }`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Quiz Modal */}
      {showQuiz && quizQuestions.length > 0 && (
        <QuizModal
          questions={quizQuestions}
          onClose={(score, total) => {
            setShowQuiz(false);
            setQuizScore({ score, total });
            setQuizCompleted(true);
          }}
          poiCount={validPoints.length}
        />
      )}

      {/* Discovery Journal Modal */}
      {showJournal && (
        <DiscoveryJournal
          exploredPOIs={validPoints.filter(p => exploredPOIs.has(p.id))}
          onClose={() => setShowJournal(false)}
        />
      )}

      {/* Instruction Overlay moved to WASD area */}
    </div>
  );
};


export default GameWorld;
