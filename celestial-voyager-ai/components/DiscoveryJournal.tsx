import React, { useState } from 'react';
import { POI } from '../types';

interface Props {
    exploredPOIs: POI[];
    onClose: () => void;
}

const DiscoveryJournal: React.FC<Props> = ({ exploredPOIs, onClose }) => {
    const [selectedPOI, setSelectedPOI] = useState<POI | null>(exploredPOIs.length > 0 ? exploredPOIs[0] : null);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-5xl h-[80vh] flex bg-slate-950 border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(8,145,178,0.2)] overflow-hidden relative">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-slate-900 border border-white/10 text-slate-400 hover:text-white hover:bg-red-900/50 hover:border-red-500/50 flex items-center justify-center transition-all"
                >
                    ✕
                </button>

                {/* Sidebar List */}
                <div className="w-1/3 border-r border-white/5 bg-black/20 overflow-y-auto">
                    <div className="p-6 border-b border-white/5 sticky top-0 bg-slate-950/95 backdrop-blur z-10">
                        <h2 className="text-xl font-black italic tracking-tighter text-white">
                            DISCOVERY <span className="text-cyan-500">JOURNAL</span>
                        </h2>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">
                            LOGGED ENTRIES: {exploredPOIs.length}
                        </p>
                    </div>

                    <div className="p-4 space-y-2">
                        {exploredPOIs.map(poi => (
                            <button
                                key={poi.id}
                                onClick={() => setSelectedPOI(poi)}
                                className={`w-full text-left p-4 rounded-lg border transition-all duration-300 group ${selectedPOI?.id === poi.id
                                    ? 'bg-cyan-950/40 border-cyan-500/50 shadow-[0_0_15px_rgba(8,145,178,0.2)]'
                                    : 'bg-slate-900/20 border-white/5 hover:bg-slate-800/40 hover:border-white/10'
                                    }`}
                            >
                                <div className="flex justify-between items-center mb-1">
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${selectedPOI?.id === poi.id ? 'text-cyan-400' : 'text-slate-500 group-hover:text-cyan-400/70'
                                        }`}>
                                        {/* Type removed */}
                                    </span>
                                    {selectedPOI?.id === poi.id && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                                </div>
                                <h3 className={`font-bold text-sm truncate ${selectedPOI?.id === poi.id ? 'text-white' : 'text-slate-300'
                                    }`}>
                                    {poi.name}
                                </h3>
                            </button>
                        ))}

                        {exploredPOIs.length === 0 && (
                            <div className="p-8 text-center text-slate-600 italic text-sm border border-dashed border-slate-800 rounded-lg">
                                No discoveries logged yet.<br />Explore the sector to populate the journal.
                            </div>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <div className="w-2/3 p-8 overflow-y-auto bg-[url('/grid-pattern.png')] bg-repeat relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-950/95 to-cyan-950/10 pointer-events-none" />

                    {selectedPOI ? (
                        <div className="relative z-0 max-w-2xl mx-auto mt-8">
                            {/* Classification Badge Removed */}

                            <h1 className="text-4xl font-black text-white mb-8 tracking-tight leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
                                {selectedPOI.name}
                            </h1>

                            <div className="space-y-8 text-slate-300 leading-relaxed font-light text-lg">
                                {/*  Render with paragraph awareness */}
                                <div className="whitespace-pre-wrap">
                                    {selectedPOI.description}
                                </div>
                            </div>

                            {selectedPOI.thoughtSignature && (
                                <div className="mt-12 p-6 rounded-xl bg-black/40 border border-white/5 relative overflow-hidden group">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/50 group-hover:bg-cyan-400 transition-colors" />
                                    <div className="text-[10px] text-cyan-500 uppercase font-black tracking-widest mb-3 flex items-center gap-2">
                                        <span className="text-lg">❖</span> AI TRIANGULATION LOGIC
                                    </div>
                                    <p className="text-sm text-cyan-100/70 font-mono italic">
                                        "{selectedPOI.thoughtSignature}"
                                    </p>
                                </div>
                            )}

                            <div className="mt-12 pt-8 border-t border-white/5 flex gap-8 text-[10px] uppercase tracking-widest text-slate-500 font-mono">
                                <div>
                                    COORD_X: <span className="text-slate-300">{selectedPOI.x.toFixed(2)}</span>
                                </div>
                                <div>
                                    COORD_Y: <span className="text-slate-300">{selectedPOI.y.toFixed(2)}</span>
                                </div>
                                <div>
                                    SECTOR_ID: <span className="text-slate-300">{selectedPOI.id.substring(0, 8)}</span>
                                </div>
                            </div>

                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 relative z-0">
                            <div className="w-16 h-16 border-2 border-slate-800 rounded-full flex items-center justify-center mb-4 opacity-50">
                                <span className="text-2xl">?</span>
                            </div>
                            <p className="tracking-widest uppercase text-xs">Select a discovery to view details</p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default DiscoveryJournal;
