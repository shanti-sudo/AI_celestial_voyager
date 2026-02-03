
import React from 'react';

interface Props {
  x: number;
  y: number;
  rotation: number;
  isThrusting: boolean;
  isBraking: boolean;
  turnDirection: number; // -1, 0, 1
  pixelX?: number;
  pixelY?: number;
}

const SpaceCharacter: React.FC<Props> = ({ x, y, rotation, isThrusting, isBraking, turnDirection, pixelX, pixelY }) => {
  return (
    <div
      className="absolute transition-transform duration-75 z-50 pointer-events-none"
      style={{
        left: pixelX !== undefined ? `${pixelX}px` : `${x}%`,
        top: pixelY !== undefined ? `${pixelY}px` : `${y}%`,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        transformOrigin: 'center center',
        imageRendering: 'pixelated'
      }}
    >
      <div className="relative">
        <style>
          {`
            @keyframes ignition-pulse {
              0% { transform: scale(0.2); opacity: 1; filter: blur(2px); }
              40% { transform: scale(3) translateY(5px); opacity: 0.8; filter: blur(4px); }
              100% { transform: scale(4) translateY(10px); opacity: 0; filter: blur(8px); }
            }
            .ignition-flow {
              animation: ignition-pulse 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
            }
            @keyframes core-flicker {
              0%, 100% { opacity: 0.8; filter: drop-shadow(0 0 2px orange); }
              50% { opacity: 1; filter: drop-shadow(0 0 5px orange); }
            }
            .engine-core {
              animation: core-flicker 0.1s infinite;
            }
          `}
        </style>

        {/* Ship Body - Increased Size (44px) */}
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Ignition Flow Effect (Triggered on state start) */}
          {(isThrusting || isBraking) && (
            <g className="ignition-flow" style={{ transformOrigin: '22px 22px' }}>
              <circle cx="22" cy="22" r="4" fill="orange" />
              <circle cx="22" cy="22" r="2" fill="white" />
            </g>
          )}

          {/* Main Hull */}
          <path d="M22 2L39 34L22 28L5 34L22 2Z" fill="#3B82F6" stroke="white" strokeWidth="2" />

          {/* Asymmetric Braking Flaps */}
          {/* Left Flap */}
          <path
            d="M5 34L2 40L10 38Z"
            fill={isBraking ? (turnDirection === 1 ? '#ff0000' : '#880000') : '#1e3a8a'} // Right turn -> Left flap drags (bright red)
            className="transition-colors duration-200"
          />
          {/* Right Flap */}
          <path
            d="M39 34L42 40L34 38Z"
            fill={isBraking ? (turnDirection === -1 ? '#ff0000' : '#880000') : '#1e3a8a'} // Left turn -> Right flap drags (bright red)
            className="transition-colors duration-200"
          />

          {/* Cockpit */}
          <circle cx="22" cy="22" r="4" fill="#93C5FD" />

          {/* Main Thrusters (Respond to flight inputs) */}
          {(isThrusting || isBraking) && (
            <g className="engine-core">
              {/* Central Glow */}
              <path d="M15 32L22 44L29 32" fill="#f97316" filter="blur(1px)" />
              <path d="M18 32L22 40L26 32" fill="#ffffff" filter="blur(0.5px)" />

              {/* Heat Haze / Halo */}
              <circle cx="22" cy="38" r="8" fill="rgba(249, 115, 22, 0.2)" filter="blur(4px)" />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};

export default SpaceCharacter;
