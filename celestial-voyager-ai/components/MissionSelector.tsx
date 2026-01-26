import React from 'react';
import { MissionOption } from '../services/geminiService';

interface Props {
    options: MissionOption[];
    onSelect: (mission: MissionOption) => void;
    isLoading?: boolean;
    prefetchedState?: Record<string, 'loading' | 'ready' | 'error'>;
}

const MissionSelector: React.FC<Props> = ({ options, onSelect, isLoading, prefetchedState }) => {
    return (
        <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
            <div className="text-center mb-12">
                <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter drop-shadow-[0_0_15px_rgba(34,211,238,0.5)] mb-2">
                    Mission <span className="text-cyan-400 decoration-cyan-500/30 underline">Command</span>
                </h2>
                <p className="text-cyan-500/70 font-mono text-xs tracking-[0.3em] uppercase">Select Hyperjump Coordinates</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl w-full">
                {options.map((option, idx) => (
                    <button
                        key={option.id}
                        onClick={() => !isLoading && onSelect(option)}
                        disabled={isLoading}
                        className={`group relative overflow-hidden bg-black/40 border-2 border-slate-800 hover:border-cyan-500/50 rounded-lg p-6 text-left transition-all duration-300 hover:shadow-[0_0_30px_rgba(34,211,238,0.15)] hover:-translate-y-1 ${isLoading ? 'opacity-50 cursor-not-allowed animate-pulse' : 'cursor-pointer'
                            }`}
                    >
                        {/* Hover Gradient Background */}
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 via-cyan-500/0 to-cyan-500/5 group-hover:via-cyan-900/10 group-hover:to-cyan-500/10 transition-all duration-500"></div>

                        {/* Header / Type */}
                        <div className="relative z-10 flex justify-between items-start mb-4">
                            <div className="flex flex-col gap-2">
                                <span className={`text-[10px] font-black tracking-widest uppercase px-2 py-1 rounded border ${option.type === 'DEEP_SPACE' ? 'text-purple-400 border-purple-500/30 bg-purple-900/20' :
                                    option.type === 'EARTH' ? 'text-green-400 border-green-500/30 bg-green-900/20' :
                                        'text-amber-400 border-amber-500/30 bg-amber-900/20'
                                    }`}>
                                    {option.type.replace('_', ' ')}
                                </span>
                                {prefetchedState?.[option.id] === 'ready' && (
                                    <span className="text-[9px] font-black text-cyan-400 bg-cyan-950/40 border border-cyan-500/40 px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                                        COORDINATES LOCKED
                                    </span>
                                )}
                            </div>
                            <span className="text-slate-600 font-mono text-[10px]">CMD-{idx + 1}</span>
                        </div>

                        {/* Content */}
                        <div className="relative z-10">
                            <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">
                                {option.title}
                            </h3>
                            <p className="text-slate-400 text-sm leading-relaxed border-l-2 border-slate-800 pl-3 group-hover:border-cyan-500/50 transition-colors">
                                {option.description}
                            </p>
                        </div>

                        {/* Decorative Tech Lines */}
                        <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-slate-800 group-hover:border-cyan-500/30 rounded-br-lg transition-colors"></div>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default MissionSelector;
