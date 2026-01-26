
import { GoogleGenAI, Type } from "@google/genai";
import { POI, QuizQuestion } from "../types";

export interface MissionOption {
  id: string;
  topic: string;
  title: string;
  description: string;
  type: 'DEEP_SPACE' | 'EARTH' | 'TRENDING';
}

export const analyzeSpaceImage = async (base64Image: string, imageTitle: string, imageDescription: string): Promise<POI[]> => {
  // Support both standard Vite env vars and the manual define in vite.config.ts
  const apiKey = import.meta.env?.VITE_GEMINI_API_KEY || process.env.API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'DEMO_KEY') {
    console.warn("Gemini API Key missing or set to DEMO_KEY. Capabilities limited.");
    // We allow proceed to attempt, but it might fail if key is invalid. 
    // Ideally, we should prompt user for key, but here we will try to proceed or fail gracefully.
    // However, user specifically asked to enable services, so we will NOT force early return unless absolutely missing.
    if (!apiKey) return getFallbackData();
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Role: You are a Forensic Physics Analyst.
  Objective: Perform a Measured Deep Scan on the NASA space image entitled "${imageTitle}" to identify POIs (Points of Interest).
  Official Description: "${imageDescription}"

  Instructions to Prevent Hallucination:
  1. Zero-Probability Threshold: Do not label any feature if its existence is purely probabilistic. Only identify features with a Radiometric Signature or Geometric Proof.
  2. VISUAL CENTER LOCK: For any identified feature, coordinates MUST point to the **Visual Center of Mass** (e.g., the brightest pixel or the geometric center of the specific visible shape). Do not point to the centroid of a diffuse "zone" if a distinct object (like a moon or star) is the primary visual anchor.
  3. Spectral Constraints: If scanning Earth/Space features, identify the specific Bands (e.g., 557.7nm for green airglow). If the pixel color does not match a known atmospheric chemical emission, mark it as "Unidentified/Noise."
  4. Coordinate Precision: Output all POIs ensuring normalized coordinates are correctly mapped to a 0-100 percentage scale for the system.

  Return the results as a JSON array of objects.
  For each object, provide:
  - id: unique string
  - name: scientific or common name
  - description: Narrative text representing "The Physics", "The Story", and "The Proof". STRICTLY follow this format: Start directly with "The Physics" content. Then on the IMMEDIATE NEXT LINE (single newline, no vertical gap), start "The Story: [content]". Then on the IMMEDIATE NEXT LINE, start "The Proof: [content]".
  - x: horizontal position as a percentage (0-100)
  - y: vertical position as a percentage (0-100)
  - type: one of ['star', 'nebula', 'galaxy', 'planet', 'other']
  - thoughtSignature: A short string explaining your verification process (e.g., "Radiometric signature confirmed at 557.7nm; Geometric proof via shadow triangulation").
  
  Ensure coordinates (x, y) are accurate and reflect the true visual center of the feature (0-100 scale). Do not artificially compress coordinates away from edges.
  Distribute points across the image to avoid clustering.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash", // Reverted to stable model
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER },
              type: { type: Type.STRING },
              thoughtSignature: { type: Type.STRING }
            },
            required: ["id", "name", "description", "x", "y", "type", "thoughtSignature"]
          }
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Empty response from AI");

    let points: POI[] = JSON.parse(jsonText);

    // POST-PROCESSING: Physics Repulsion REMOVED
    // The "Forensic Physics Analyst" model provides high-precision coordinates.
    // Artificial repulsion causes markers to drift from their actual geological/celestial targets.
    // We strictly trust the AI's "Geometric Proof" coordinates.

    // Simple bounds check REMOVED to allow full edge-to-edge accuracy.
    // relying on the AI's "0-100 scale" adherence.

    return points;
  } catch (error) {
    console.error("Gemini analysis error:", error);
    // Return fallback data so the game feature remains active even if API fails
    return getFallbackData();
  }
};

// Fallback data to ensure the UI is always populated
const getFallbackData = (): POI[] => {
  return [
    {
      id: "fallback-error",
      name: "Deep Space Sensor Offline",
      description: "Unable to establish neural link with Gemini. Please verify API key configuration to enable deep space analysis.",
      x: 50,
      y: 50,
      type: "other",
      thoughtSignature: "System Offline. Connection Protocol Failed."
    }
  ];
};

// Generate quiz questions based on explored POIs
export const generateQuiz = async (exploredPOIs: POI[]): Promise<QuizQuestion[]> => {
  const apiKey = import.meta.env?.VITE_GEMINI_API_KEY || process.env.API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'DEMO_KEY' || exploredPOIs.length === 0) {
    console.warn("Gemini API Key missing or no POIs explored. Using fallback quiz.");
    return getFallbackQuiz(exploredPOIs);
  }

  // Generate 1-5 questions based on POI count (min 1, max 5)
  const questionCount = Math.min(5, Math.max(1, exploredPOIs.length));

  const ai = new GoogleGenAI({ apiKey });

  // Create context from explored POIs
  const poiContext = exploredPOIs.map(poi =>
    `${poi.name} (${poi.type}): ${poi.description}`
  ).join('\n\n');

  const prompt = `Based on these celestial objects that were explored:

${poiContext}

Generate exactly ${questionCount} multiple-choice quiz questions to test understanding of these objects.
Each question should:
- Test knowledge about the specific objects mentioned above
- Have exactly 4 answer options
- Include interesting facts from the descriptions
- Be educational and engaging

Return as JSON array of objects with:
- question: the question text
- options: array of exactly 4 possible answers
- correctAnswer: index (0-3) of the correct option
- relatedPOI: name of the POI the question is about`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              correctAnswer: { type: Type.NUMBER },
              relatedPOI: { type: Type.STRING }
            },
            required: ["question", "options", "correctAnswer"]
          }
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Empty response from AI");
    const questions = JSON.parse(jsonText);

    // Ensure we have the right number of questions
    return questions.slice(0, questionCount);
  } catch (error) {
    console.error("Quiz generation error:", error);
    return getFallbackQuiz(exploredPOIs);
  }
};

export const generateMissionOptions = async (): Promise<MissionOption[]> => {
  const apiKey = import.meta.env?.VITE_GEMINI_API_KEY || process.env.API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'DEMO_KEY') {
    return [
      { id: '1', topic: 'Nebula', title: 'Deep Space Nebula', description: 'Explore a random colorful nebula in deep space.', type: 'DEEP_SPACE' },
      { id: '2', topic: 'Earth from Space', title: 'Orbital View', description: 'Observe Earth from a low-orbit perspective.', type: 'EARTH' },
      { id: '3', topic: 'James Webb', title: 'JWST Discovery', description: 'See the latest from the James Webb Space Telescope.', type: 'TRENDING' }
    ];
  }

  const ai = new GoogleGenAI({ apiKey });
  const seed = Date.now();
  const prompt = `Generate 3 distinct, UNIQUE space exploration mission targets for a sci-fi interface. 
  Random Seed context: ${seed}.

  CORE REQUIREMENT: The targets must be well-documented objects or events with a high probability of having high-resolution photography in the NASA Image Library.
  
  Categories:
  1. DEEP_SPACE: A specific, visually stunning Nebula, Galaxy, or Star Cluster from the Hubble or JWST catalogs (e.g., "Carina Nebula", "Sombrero Galaxy", "Pillars of Creation").
  2. EARTH: A specific, visually distinct Earth phenomenon captured by orbital assets (e.g., "Aurora Borealis", "Saharan Dust", "Mount Etna Eruption").
  3. TRENDING: A famous historical mission or recent landmark discovery that has extensive NASA imagery (e.g., "Cassini Saturn", "Mars Perseverance", "Juno Jupiter", "James Webb Deep Field").
  
  Return JSON array of 3 objects with:
  - id: unique string
  - topic: A SIMPLE, PROVEN keyword search string optimized for the NASA Images API (e.g. "Enceladus", "Messier 81", "Mars Rover"). Avoid phrases; use names.
  - title: A cool, sci-fi mission name.
  - description: Very short, punchy briefing (max 12 words).
  - type: One of ['DEEP_SPACE', 'EARTH', 'TRENDING']
  
  Ensure the TRENDING option is significantly different from common generic space terms.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              topic: { type: Type.STRING },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              type: { type: Type.STRING, enum: ['DEEP_SPACE', 'EARTH', 'TRENDING'] }
            },
            required: ["id", "topic", "title", "description", "type"]
          }
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Empty response from AI for missions");
    return JSON.parse(jsonText);
  } catch (error) {
    console.warn("Mission generation failed, using fallbacks", error);
    return [
      { id: '1', topic: 'Spiral Galaxy', title: 'Galactic Core', description: 'Investigate a massive spiral galaxy.', type: 'DEEP_SPACE' },
      { id: '2', topic: 'Blue Marble', title: 'Home Planet', description: 'Standard orbit survey of Earth.', type: 'EARTH' },
      { id: '3', topic: 'Supernova', title: 'Stellar Remnant', description: 'Analyze the aftermath of a star explosion.', type: 'TRENDING' }
    ];
  }
};

// Fallback quiz questions
const getFallbackQuiz = (exploredPOIs: POI[]): QuizQuestion[] => {
  if (exploredPOIs.length === 0) {
    return [{
      question: "What type of celestial exploration did you just complete?",
      options: [
        "Deep space reconnaissance",
        "Planetary surface mapping",
        "Asteroid mining survey",
        "Stellar classification"
      ],
      correctAnswer: 0,
      relatedPOI: "Mission"
    }];
  }

  // Generate simple questions based on explored POIs
  return exploredPOIs.slice(0, 5).map((poi, idx) => ({
    question: `What type of celestial object is ${poi.name}?`,
    options: [
      poi.type.charAt(0).toUpperCase() + poi.type.slice(1),
      poi.type === 'star' ? 'Nebula' : 'Star',
      poi.type === 'planet' ? 'Galaxy' : 'Planet',
      poi.type === 'nebula' ? 'Galaxy' : 'Nebula'
    ],
    correctAnswer: 0,
    relatedPOI: poi.name
  }));
};

export const validateImageContent = async (base64Image: string): Promise<boolean> => {
  const apiKey = import.meta.env?.VITE_GEMINI_API_KEY || process.env.API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'DEMO_KEY') {
    return true;
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Analyze this image for a space exploration game background.
  Strictly check for:
  1. Humans or human faces.
  2. Human body parts (hands, fingers, legs, silhouettes).
  3. Man-made structures dominating the view (conference rooms, labs, rockets on launchpad).
  
  Question: Is this image free of humans, body parts, and non-space clutter?
  Answer JSON: { "safe": boolean, "reason": "short string" }`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { data: base64Image, mimeType: "image/jpeg" } }
        ]
      }]
    });

    const text = response.text;
    const jsonMatch = text.match(/\{.*?\}/s);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      if (!result.safe) {
        console.warn("Image rejected by AI Sentry:", result.reason);
        return false;
      }
      return true;
    }
    return true;
  } catch (err) {
    console.error("Validation error", err);
    return true;
  }
};

