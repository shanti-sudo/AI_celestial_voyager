
import { NASAImage, POI, JWSTScientificData } from '../types';

/**
 * Service to aggregate scientific metadata from NASA archives with AI synthesis fallback.
 */
export const fetchResearchData = async (nasaId: string): Promise<JWSTScientificData | null> => {
    const results: JWSTScientificData = {
        id: nasaId,
        title: "Deep Space Analysis",
        description: "",
        keywords: [],
        sources: []
    };

    // 1. NASA Metadata Lookup (Official Archive)
    try {
        const response = await fetch(`https://images-assets.nasa.gov/image/${nasaId}/metadata.json`);
        if (response.ok) {
            const metadata = await response.json();
            const desc = metadata['AVAIL:Description'] || metadata['AVAIL:Title'] || metadata['Description'] || metadata['description'];
            if (desc) {
                results.sources.push({
                    type: 'NASA_METADATA',
                    description: desc,
                    credit: metadata['AVAIL:Credit'] || "NASA/JPL",
                    keywords: metadata['AVAIL:Keywords'] || []
                });
                results.title = metadata['AVAIL:Title'] || results.title;
            }
        }
    } catch (e) {
        console.warn(`NASA Metadata lookup failed for ${nasaId}`);
    }

    // 2. AI Synthesis (Strict Fallback for NASA_METADATA failure)
    const nasaSourceFoundDuringFetch = results.sources.some(s => s.type === 'NASA_METADATA');

    if (!nasaSourceFoundDuringFetch) {
        try {
            const { GoogleGenAI } = await import("@google/genai");
            const apiKey = import.meta.env?.VITE_GEMINI_API_KEY || process.env.API_KEY || process.env.GEMINI_API_KEY;

            if (apiKey && apiKey !== 'DEMO_KEY') {
                const ai = new GoogleGenAI({ apiKey });
                const prompt = `Role: Senior Astrophysicist & Data Scientist.
                Task: Synthesize a high-fidelity scientific description for the celestial target with ID: ${nasaId}.
                Target ID: ${nasaId}
                Current Context: ${results.title}
                Format: Professional scientific readout. 
                Output JSON: { "description": "string (html paragraph)", "keywords": ["string"] }`;

                const response = await ai.models.generateContent({
                    model: "gemini-3-pro-preview",
                    contents: [{ parts: [{ text: prompt }] }],
                    config: { responseMimeType: "application/json" }
                });

                const text = response.text;
                if (text) {
                    const aiData = JSON.parse(text);
                    results.sources.push({
                        type: 'AI_FALLBACK',
                        description: aiData.description,
                        credit: 'Voyager AI Synthesis (Gemini 3 Pro)',
                        keywords: aiData.keywords || []
                    });
                }
            }
        } catch (e) {
            console.error("AI Supplemental Synthesis failed", e);
        }
    }

    if (results.sources.length === 0) return null;

    const groupedDesc: string[] = [];
    const nasaSource = results.sources.find(s => s.type === 'NASA_METADATA');
    const aiSource = results.sources.find(s => s.type === 'AI_FALLBACK');

    if (nasaSource) {
        const header = `<div class="source-header text-[10px] font-black tracking-widest uppercase mb-2 text-blue-400">RESEARCH ARCHIVE (NASA)</div>`;
        const creditLine = `<div class="text-[9px] text-white/40 mt-2 italic">Data Credits: ${nasaSource.credit}</div>`;

        groupedDesc.push(`<div class="source-segment mb-8 pb-8 border-b border-white/5 last:border-0 last:mb-0 last:pb-0">
            ${header}
            <div class="description-body space-y-4 text-slate-200">
                <p><span class="text-blue-400 font-bold">[NASA ARCHIVE]</span> ${nasaSource.description}</p>
            </div>
            ${creditLine}
        </div>`);
    }

    if (aiSource) {
        const header = `<div class="source-header text-[10px] font-black tracking-widest uppercase mb-2 text-amber-400">AI DATA STREAM</div>`;
        const creditLine = `<div class="text-[9px] text-white/40 mt-2 italic">Source: ${aiSource.credit}</div>`;

        groupedDesc.push(`<div class="source-segment mb-8 pb-8 border-b border-white/5 last:border-0 last:mb-0 last:pb-0">
            ${header}
            <div class="description-body text-slate-200">${aiSource.description}</div>
            ${creditLine}
        </div>`);
    }

    results.description = groupedDesc.join('');
    results.keywords = Array.from(new Set(results.sources.flatMap(s => s.keywords)));

    return results;
};
