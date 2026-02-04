
import React from 'react';
import { NASAImage, JWSTScientificData } from '../types';

interface Props {
    image: NASAImage;
    data: JWSTScientificData;
    onClose: () => void;
}

const DeepScanArtifact: React.FC<Props> = ({ image, data, onClose }) => {
    // Simple keyword highlighting logic
    const highlightKeywords = (text: string) => {
        const keywords = ['NGC', 'star', 'nebula', 'galaxy', 'infrared', 'protostar', 'cluster', 'JWST', 'Hubble'];
        let highlighted = text;
        keywords.forEach(word => {
            const regex = new RegExp(`\\b(${word}[s]?)\\b`, 'gi');
            highlighted = highlighted.replace(regex, '<span class="text-cyan-400 font-bold border-b border-cyan-500/30">$1</span>');
        });
        return highlighted;
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-500 p-8">
            <div className="relative w-full max-w-6xl h-[85vh] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex overflow-hidden ring-1 ring-cyan-500/20">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-[110] w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-white hover:bg-red-500 transition-colors"
                >
                    ✕
                </button>

                {/* Left: Image Panel */}
                <div className="w-1/2 relative bg-black flex items-center justify-center overflow-hidden border-r border-white/5">
                    <img
                        src={image.url}
                        alt={image.title}
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-slate-900/40 pointer-events-none" />

                    {/* Scanline Overlay */}
                    <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,255,0,0.06))] bg-[length:100%_4px,3px_100%]" />

                    <div className="absolute bottom-6 left-6 p-4 bg-slate-950/60 backdrop-blur-md rounded border border-white/10 max-w-sm">
                        <div className="text-[10px] text-cyan-400 font-black tracking-widest uppercase mb-1">Observation Target</div>
                        <div className="text-white font-bold text-lg leading-tight uppercase tracking-tighter">{image.title}</div>
                    </div>
                </div>

                {/* Right: Scientific Breakdown */}
                <div className="w-1/2 h-full flex flex-col p-10 overflow-y-auto scrollbar-thin">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="px-3 py-1 bg-cyan-500/20 border border-cyan-500/40 rounded text-cyan-400 text-[10px] font-black tracking-widest">DEEP_SCAN v4.2</div>
                        <div className="h-px flex-1 bg-gradient-to-r from-cyan-500/40 to-transparent" />
                    </div>

                    <h1 className="text-3xl font-black text-white mb-6 uppercase tracking-tighter leading-none italic">
                        Scientific Analysis
                    </h1>

                    <div className="space-y-8 text-slate-300 font-light leading-relaxed">
                        <section>
                            <h2 className="text-xs font-black text-cyan-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                                Technical Description
                            </h2>
                            <div
                                className="text-sm leading-8 text-slate-200"
                                dangerouslySetInnerHTML={{ __html: highlightKeywords(data.description) }}
                            />
                        </section>

                        {data.altText && (
                            <section className="p-4 bg-white/5 rounded-lg border border-white/10">
                                <h2 className="text-[10px] font-black text-fuchsia-400 uppercase tracking-widest mb-2">Accessibility Data (Alt Text)</h2>
                                <div className="text-[11px] font-mono leading-relaxed italic text-fuchsia-100/70">
                                    {data.altText}
                                </div>
                            </section>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-slate-950 border border-white/5 rounded">
                                <div className="text-[9px] text-slate-500 uppercase font-black mb-1">NASA_ID</div>
                                <div className="text-xs font-mono text-cyan-400">{image.nasaId}</div>
                            </div>
                            <div className="p-3 bg-slate-950 border border-white/5 rounded">
                                <div className="text-[9px] text-slate-500 uppercase font-black mb-1">DATA STREAMS</div>
                                <div className="flex gap-1 flex-wrap">
                                    {data.sources.map((s, idx) => (
                                        <span key={idx} className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${s.type === 'ESA_API' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                                            s.type === 'JWST_API' ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' :
                                                s.type === 'NASA_METADATA' ? 'bg-blue-500/10 border-blue-400/30 text-blue-400' :
                                                    'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                            }`}>
                                            {s.type.replace('_', ' ')}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <section>
                            <h2 className="text-xs font-black text-cyan-500 uppercase tracking-widest mb-3">Classification Keywords</h2>
                            <div className="flex flex-wrap gap-2">
                                {data.keywords.map((kw, i) => (
                                    <span key={i} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[9px] text-slate-400 font-bold uppercase tracking-tight">
                                        {kw}
                                    </span>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeepScanArtifact;
