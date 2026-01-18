
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NASAImage, POI, GameState, QuizQuestion } from '../types';
import SpaceCharacter from './SpaceCharacter';
import QuizModal from './QuizModal';
import DiscoveryJournal from './DiscoveryJournal';
import { generateQuiz } from '../services/geminiService';

interface Props {
  image: NASAImage;
  points: POI[];
}

const INTERACTION_RADIUS = 6; // percentage

const GameWorld: React.FC<Props> = ({ image, points }) => {
  const [gameState, setGameState] = useState<GameState>({
    posX: 50,
    posY: 50,
    velocity: { x: 0, y: 0 },
    activePOI: null
  });

  const [rotation, setRotation] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const keysPressed = useRef<Set<string>>(new Set());

  // POI Exploration Tracking
  const [exploredPOIs, setExploredPOIs] = useState<Set<string>>(new Set());
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [sectorCompleted, setSectorCompleted] = useState(false);
  const [quizScore, setQuizScore] = useState<{ score: number, total: number } | null>(null);
  const [quizCompleted, setQuizCompleted] = useState(false);

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

      // Boundaries with bounce/stop
      if (nextX < 0) { nextX = 0; vx = 0; }
      if (nextX > 100) { nextX = 100; vx = 0; }
      if (nextY < 0) { nextY = 0; vy = 0; }
      if (nextY > 100) { nextY = 100; vy = 0; }

      // Check POI collisions and mark as explored
      let foundPOI: POI | null = null;
      for (const poi of points) {
        const dist = Math.sqrt(Math.pow(poi.x - nextX, 2) + Math.pow(poi.y - nextY, 2));
        if (dist < INTERACTION_RADIUS) {
          foundPOI = poi;
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

      // Calculate rotation based on velocity
      if (Math.abs(vx) > 0.01 || Math.abs(vy) > 0.01) {
        setRotation(Math.atan2(vy, vx) * 180 / Math.PI + 90);
      }

      return {
        ...prev,
        posX: nextX,
        posY: nextY,
        velocity: { x: vx, y: vy },
        activePOI: foundPOI
      };
    });
  }, [points]);

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
    if (exploredPOIs.size === points.length && points.length > 0 && !sectorCompleted) {
      setSectorCompleted(true);
      // Trigger quiz generation
      const exploredPOIData = points.filter(p => exploredPOIs.has(p.id));
      generateQuiz(exploredPOIData).then(questions => {
        setQuizQuestions(questions);
        // Small delay before showing quiz for better UX
        // setTimeout(() => setShowQuiz(true), 1000); // Removed auto-open per user request
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

  // Dynamic height calculation for Tooltip
  const isTooltipFlipped = gameState.posY > 60;
  // If flipped (above), max height is current Y (minus buffer). If normal (below), max height is 100 - Y (minus buffer).
  const tooltipMaxHeight = isTooltipFlipped ? gameState.posY - 10 : 90 - gameState.posY;

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-screen overflow-hidden cursor-none bg-black transition-colors duration-700 ${gameState.activePOI ? 'bg-cyan-950/20' : ''}`}
    >
      {/* Skybox / State-Aware Background */}
      {/* Parallax Container: Moves opposite to player position to create depth */}
      <div
        className="absolute inset-[-10%] transition-transform duration-75 ease-linear will-change-transform"
        style={{
          transform: `translate(${(50 - gameState.posX) * 0.15}%, ${(50 - gameState.posY) * 0.15}%)`
        }}
      >
        {/* Image Layer: Handles Focus (POI) */}
        <div
          className={`w-full h-full bg-cover bg-center transition-all duration-700 ease-out ${gameState.activePOI ? 'blur-[2px]' : 'blur-0'}`}
          style={{
            backgroundImage: `url(${image.url})`,
            filter: gameState.activePOI ? 'brightness(1.1) contrast(1.2)' : 'brightness(0.7) contrast(1.0)',
            // Subtle zoom when POI is active
            transform: `scale(${1 + (gameState.activePOI ? 0.05 : 0)})`
          }}
        />

        {/* POI Markers - Now part of parallax layer */}
        {points.map(poi => {
          const isNearby = gameState.activePOI?.id === poi.id;
          return (
            <div
              key={poi.id}
              className="absolute flex items-center justify-center transition-all duration-500"
              style={{
                left: `${poi.x}%`,
                top: `${poi.y}%`,
                transform: `translate(-50%, -50%) ${isNearby ? 'scale(1.2)' : 'scale(1)'}`,
                opacity: isNearby ? 1 : 0.5
              }}
            >
              <div className={`w-8 h-8 rounded-full border-2 transition-all duration-500 ${isNearby
                ? 'border-cyan-400 bg-cyan-500/20 shadow-[0_0_15px_cyan]'
                : exploredPOIs.has(poi.id)
                  ? 'border-slate-500 bg-slate-500/10'
                  : 'border-green-400 bg-transparent shadow-[0_0_10px_lime] poi-pulse'
                } flex items-center justify-center`}>
                {isNearby && <div className="w-1 h-1 bg-cyan-400 rounded-full animate-ping" />}
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
          );
        })}
      </div>

      {/* Aesthetic HUD Scanlines */}
      <div className="scanline" />
      <div className="absolute inset-0 pointer-events-none opacity-20"
        style={{ background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 255, 0, 0.06))', backgroundSize: '100% 4px, 3px 100%' }} />

      {/* Grid Overlay - Also State Aware (Parallax) */}
      <div className="absolute inset-[-10%] opacity-10 pointer-events-none transition-transform duration-75 ease-linear will-change-transform"
        style={{
          backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
          backgroundSize: '70px 70px',
          transform: `translate(${(50 - gameState.posX) * 0.05}%, ${(50 - gameState.posY) * 0.05}%)` // Lower parallax factor for "distant" grid? Or higher for "close"? standard grid is usually "floor". leaving as slight shift.
        }} />

      {/* Character */}
      <SpaceCharacter
        x={gameState.posX}
        y={gameState.posY}
        rotation={rotation}
        isThrusting={keysPressed.current.size > 0}
        isBraking={keysPressed.current.size === 0 && (Math.abs(gameState.velocity.x) > 0.01 || Math.abs(gameState.velocity.y) > 0.01)}
        turnDirection={0}
        // Force key reset on thrust initiation for ignition pulse
        key={String(keysPressed.current.size > 0)}
      />

      {/* UI: Interactive Tooltip */}
      {gameState.activePOI && (
        <div
          className="absolute z-[100] p-5 bg-slate-950/90 border-l-4 border-cyan-500 backdrop-blur-2xl rounded shadow-2xl max-w-sm overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-500/30 scrollbar-track-transparent transition-all duration-500 animate-in fade-in zoom-in-95"
          style={{
            left: `${gameState.posX}%`,
            top: `${gameState.posY}%`,
            maxHeight: `${tooltipMaxHeight}vh`, // Use viewport height units
            // Smart Positioning with robust boundary checks
            // Horizontal: Flip to left if past 60% width
            // Vertical: Flip to top (-100%) if past 60% height to prevent bottom overflow
            // Standard: slightly offset to not cover the POI itself
            transform: `translate(${gameState.posX > 60 ? 'calc(-100% - 20px)' : '20px'}, ${isTooltipFlipped ? '-100%' : '0%'})`
          }}
        >    <div className="flex items-center justify-between mb-3">
            <div className="flex flex-col gap-1">
              <h3 className="text-cyan-50 text-2xl font-black tracking-tight uppercase drop-shadow-[0_0_10px_rgba(8,145,178,0.8)]">
                {gameState.activePOI.name}
              </h3>
            </div>
            <div className="text-[9px] font-mono text-cyan-400 animate-pulse border border-cyan-800 px-1 self-start mt-1">ACTIVE SCAN</div>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed font-normal antialiased whitespace-pre-wrap">
            {gameState.activePOI.description}
          </p>

          {gameState.activePOI.thoughtSignature && (
            <div className="mt-3 p-2 rounded bg-cyan-950/40 border border-cyan-500/20">
              <div className="text-[9px] text-cyan-500 uppercase font-black tracking-widest mb-1 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
                AI Triangulation Logic
              </div>
              <p className="text-[10px] text-cyan-200/80 font-mono leading-relaxed italic">
                "{gameState.activePOI.thoughtSignature}"
              </p>
            </div>
          )}

          {/* Analysis Depth Removed */}
        </div>
      )}

      {/* Top Left: Telemetry (Title Truncation Fixed, Fixed Width) */}
      {showHUD && (
        <div className="absolute top-8 left-8 w-[196px] p-6 bg-slate-950/80 backdrop-blur-md border border-white/5 font-mono text-xs shadow-2xl ring-1 ring-cyan-500/20 z-[60] transition-opacity duration-300 animate-in fade-in slide-in-from-left-4">
          <div className="text-cyan-400 font-black mb-3 tracking-widest text-[11px] border-b border-cyan-900 pb-2">VOYAGER TELEMETRY v2.6</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            <div className="text-slate-500">POS_LAT:</div><div className="text-white text-right font-bold">{gameState.posX.toFixed(3)}°</div>
            <div className="text-slate-500">POS_LNG:</div><div className="text-white text-right font-bold">{gameState.posY.toFixed(3)}°</div>
          </div>
          <div className="mt-4 text-[9px] text-slate-500 uppercase tracking-widest leading-relaxed break-words">
            Target: <span className="text-white block mt-1">{image.title}</span>
          </div>

          {/* Quiz Status - Highlighted */}
          <div
            onClick={() => {
              if ((sectorCompleted || quizCompleted) && quizQuestions.length > 0) {
                setShowQuiz(true);
              }
            }}
            className={`mt-4 pt-3 pb-2 px-2 -mx-2 rounded border transition-all duration-300 ${quizCompleted && quizScore
              ? quizScore.score / quizScore.total >= 0.8
                ? 'border-green-500/50 bg-green-950/20 shadow-[0_0_10px_rgba(34,197,94,0.3)] cursor-pointer hover:bg-green-950/40'
                : quizScore.score / quizScore.total >= 0.5
                  ? 'border-cyan-500/50 bg-cyan-950/20 shadow-[0_0_10px_rgba(34,211,238,0.3)] cursor-pointer hover:bg-cyan-950/40'
                  : 'border-amber-500/50 bg-amber-950/20 shadow-[0_0_10px_rgba(251,191,36,0.3)] cursor-pointer hover:bg-amber-950/40'
              : sectorCompleted
                ? 'border-cyan-500/50 bg-cyan-950/20 shadow-[0_0_10px_rgba(34,211,238,0.3)] animate-pulse cursor-pointer hover:bg-cyan-950/40 hover:scale-105'
                : 'border-cyan-900/30 bg-transparent opacity-50 cursor-not-allowed'
              }`}>
            <div className="text-[9px] text-cyan-400 uppercase tracking-wider mb-2 font-black">⚡ Knowledge Assessment</div>
            {quizCompleted && quizScore ? (
              <div className="text-white font-bold">
                Score: <span className={`${quizScore.score / quizScore.total >= 0.8 ? 'text-green-400' : quizScore.score / quizScore.total >= 0.5 ? 'text-cyan-400' : 'text-amber-400'}`}>
                  {quizScore.score}/{quizScore.total}
                </span>
                <span className="text-[8px] text-slate-400 ml-1">({Math.round((quizScore.score / quizScore.total) * 100)}%)</span>
              </div>
            ) : sectorCompleted ? (
              <div className="text-cyan-400 text-[9px] font-bold">🎯 Quiz Available</div>
            ) : (
              <div className="text-white text-[9px]">Complete Exploration</div>
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

      <div className="absolute top-12 right-8 text-right font-mono">
        <div className="text-[10px] text-slate-500 uppercase font-black mb-1">
          Sector Progress {sectorCompleted && <span className="text-green-400">✓ COMPLETE</span>}
        </div>
        <div className="flex gap-1.5 mt-1 justify-end">
          {points.map((p, i) => {
            const isExplored = exploredPOIs.has(p.id);
            const isActive = gameState.activePOI?.id === p.id;
            return (
              <div
                key={i}
                className={`w-4 h-1 rounded-sm transition-all duration-300 ${isActive
                  ? 'bg-cyan-400 w-6 shadow-[0_0_8px_cyan]'
                  : isExplored
                    ? 'bg-green-500 shadow-[0_0_8px_lime]'
                    : 'bg-slate-800'
                  }`}
              />
            );
          })}
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
          poiCount={points.length}
        />
      )}

      {/* Discovery Journal Modal */}
      {showJournal && (
        <DiscoveryJournal
          exploredPOIs={points.filter(p => exploredPOIs.has(p.id))}
          onClose={() => setShowJournal(false)}
        />
      )}

      {/* Instruction Overlay (Fade out) */}
      <div className="absolute bottom-8 right-32 text-right font-mono text-[10px] text-slate-400 animate-pulse">
        [ARROW KEYS] TO NAVIGATE<br />
        APPROACH ANOMALIES TO SCAN
      </div>
    </div>
  );
};


export default GameWorld;
