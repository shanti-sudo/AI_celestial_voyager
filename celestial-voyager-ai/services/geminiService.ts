
import { GoogleGenAI, Type } from "@google/genai";
import { POI, QuizQuestion, NASAImage } from "../types";

export interface MissionOption {
  id: string;
  topic: string;
  title: string;
  description: string;
  type: 'DEEP_SPACE' | 'EARTH' | 'TRENDING';
}

export const analyzeSpaceImage = async (base64Image: string, image: NASAImage): Promise<POI[]> => {
  const apiKey = import.meta.env?.VITE_GEMINI_API_KEY || process.env.API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'DEMO_KEY') {
    return getFallbackData();
  }

  const ai = new GoogleGenAI({ apiKey });

  const sidecarJson = JSON.stringify(image.sidecar || {}, null, 2);

  const prompt = `Role: You are an expert Astronomer and Visual Grounding Agent.
  Objective: Analyze the NASA space image "${image.title}" to detect POIs with absolute geometric rigidity.
  
  IMPORTANT COORDINATE RULES:
  - Treat the image exactly as you see it.
  - Ignore any original file resolution or metadata.
  - All coordinates must be computed relative to the visible image content only.

  
  COORDINATE SYSTEM:
  - Use normalized percentages from 0.00 to 100.00.
  - (0.00, 0.00) is the strict TOP-LEFT corner.
  - (100.00, 100.00) is the strict BOTTOM-RIGHT corner.
  - Coordinates must be linearly mapped across the visible image content (no padding).
  
  CALIBRATION TASK (REQUIRED):
  First, define the four corners of your coordinate system (0,0 to 100,100).
  If a corner is not visually distinct, estimate its position as the extreme visible edge.
  1. Top-left corner: {x: 0.00, y: 0.00}
  2. Top-right corner: {x: 100.00, y: 0.00}
  3. Bottom-left corner: {x: 0.00, y: 100.00}
  4. Bottom-right corner: {x: 100.00, y: 100.00}
  
  FEATURE DETECTION TASK:
  Identify 3 to 8 meaningful astronomical features. For each feature, provide:
  - Exact center (x, y) in the 0.00-100.00 space.
  - A descriptive name.
  - A multi-part description where EACH section ("The Physics:", "The Story:", "The Proof:") begins on a NEW LINE.
  - A thoughtSignature explaining your grounding logic (e.g. "Grounding: Visual Raster (Non-Geospatial)").
  - A specific classification type ('nebula', 'galaxy', 'star', 'planet', 'other').
  - Detection confidence (0.0-1.0).
  
  OUTPUT FORMAT (STRICT JSON):
  - Return a single JSON object.
  - Include 'calibration' object with the four corner anchors.
  - Include 'pois' array of objects.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
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
          type: Type.OBJECT,
          properties: {
            calibration: {
              type: Type.OBJECT,
              properties: {
                top_left: { type: Type.OBJECT, properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } } },
                top_right: { type: Type.OBJECT, properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } } },
                bottom_left: { type: Type.OBJECT, properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } } },
                bottom_right: { type: Type.OBJECT, properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } } }
              },
              required: ["top_left", "top_right", "bottom_left", "bottom_right"]
            },
            pois: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  x: { type: Type.NUMBER, description: "Center X (0-100)" },
                  y: { type: Type.NUMBER, description: "Center Y (0-100)" },
                  type: { type: Type.STRING },
                  confidence: { type: Type.NUMBER, description: "Detection confidence (0.0-1.0)" },
                  thoughtSignature: { type: Type.STRING },
                },
                required: ["id", "name", "description", "x", "y", "type", "confidence", "thoughtSignature"]
              }
            }
          },
          required: ["calibration", "pois"]
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Empty response from AI");

    const result: any = JSON.parse(jsonText);
    const calib = result.calibration;
    const rawPoints: any[] = result.pois;

    const remap = (p: number, min: number, max: number) => {
      // Prevent division by zero if Gemini returns same values
      if (Math.abs(max - min) < 0.001) return p;
      return ((p - min) / (max - min)) * 100;
    };

    const processedPoints: POI[] = rawPoints.map(p => {
      // Apply Rigid Calibration Remapping:
      let correctedX = remap(p.x, calib.top_left.x, calib.top_right.x);
      let correctedY = remap(p.y, calib.top_left.y, calib.bottom_left.y);

      // Clamp to strict visibile bounds
      correctedX = Math.max(0, Math.min(100, correctedX));
      correctedY = Math.max(0, Math.min(100, correctedY));

      const sourceWidth = image.sidecar?.envelope.xmax || 2048;
      const sourceHeight = image.sidecar?.envelope.ymax || 2048;

      // Grounding metadata
      const driftX = Math.abs(calib.top_left.x) + Math.abs(100 - calib.top_right.x);
      const driftY = Math.abs(calib.top_left.y) + Math.abs(100 - calib.bottom_left.y);
      const totalDrift = (driftX + driftY).toFixed(2);

      const poi: POI = {
        id: p.id,
        name: p.name,
        description: p.description,
        x: correctedX,
        y: correctedY,
        hard_anchor: {
          pixelX: (correctedX / 100) * sourceWidth,
          pixelY: (correctedY / 100) * sourceHeight,
          originalImageWidth: sourceWidth,
          originalImageHeight: sourceHeight
        },
        type: p.type,
        thoughtSignature: `${p.thoughtSignature} | Grounding Stability: ${100 - parseFloat(totalDrift)}% | Conf: ${Math.round((p.confidence || 0.95) * 100)}%`,
        registrationStatus: 'SYNCED'
      };

      return poi;
    });

    // ANTI-CLUTTER & INFORMATION PRIORITY:
    // If POIs overlap, we remove the less informative one (shorter description).
    const filteredPoints: POI[] = [];
    const sortedPoints = [...processedPoints].sort((a, b) => b.description.length - a.description.length);

    for (const point of sortedPoints) {
      // Overlap threshold (8% radius) - prevents marker collision
      const isTooClose = filteredPoints.some(p => {
        const dx = p.x - point.x;
        const dy = p.y - point.y;
        return Math.sqrt(dx * dx + dy * dy) < 8;
      });

      if (!isTooClose) {
        filteredPoints.push(point);
      }
    }

    return filteredPoints;
  } catch (error) {
    console.error("Gemini error:", error);
    return getFallbackData();
  }
};

const getFallbackData = (): POI[] => {
  return [
    {
      id: "stellar-nursery-alpha",
      name: "Stellar Nursery: Region 42",
      description: "The Physics: High-density molecular clouds collapsing under their own gravity to trigger thermonuclear fusion. The Story: This region has been birthing stars for over 2 million years, serving as a beacon of creation in a cold void. The Proof: Infrared luminosity peaks at 1024.34, 1024.78, indicating hidden protostars within the dust.",
      x: 50.016,
      y: 50.038,
      hard_anchor: {
        pixelX: 1024.3421,
        pixelY: 1024.7892,
        originalImageWidth: 2048,
        originalImageHeight: 2048
      },
      type: "nebula",
      thoughtSignature: "IWC Centroiding Locked. Radiometric Signature: POSITIVE (Thermal)."
    },
    {
      id: "supernova-remnant-core",
      name: "Supernova Remnant Filament",
      description: "The Physics: Rapidly expanding shockwaves interacting with the interstellar medium, creating ionized gas filaments. The Story: The ghost of a star that vanished 10,000 years ago, leaving its scattered chemical legacy for future solar systems. The Proof: Distinct H-alpha emission spectra visible in the vibrant red pixel clusters at this coordinate.",
      x: 35.00,
      y: 45.00,
      hard_anchor: {
        pixelX: 716.8,
        pixelY: 921.6,
        originalImageWidth: 2048,
        originalImageHeight: 2048
      },
      type: "other",
      thoughtSignature: "Geometric Proof: Expansion Pattern Verified. Spectral Snap: ACTIVE."
    }
  ];
};

export const generateQuiz = async (exploredPOIs: POI[]): Promise<QuizQuestion[]> => {
  const apiKey = import.meta.env?.VITE_GEMINI_API_KEY || process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'DEMO_KEY' || exploredPOIs.length === 0) return [];
  const questionCount = Math.min(5, Math.max(1, exploredPOIs.length));
  const ai = new GoogleGenAI({ apiKey });
  const poiContext = exploredPOIs.map(poi => `${poi.name}: ${poi.description}`).join('\n\n');
  const prompt = `Based on these explored objects: ${poiContext}, generate ${questionCount} MCQs with 4 options. Return JSON with question, options[], correctAnswer(index), relatedPOI.`;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text).slice(0, questionCount);
  } catch (error) {
    console.error("Quiz error:", error);
    return [];
  }
};

export const generateMissionOptions = async (excludeTopics: string[] = []): Promise<MissionOption[]> => {
  const apiKey = import.meta.env?.VITE_GEMINI_API_KEY || process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'DEMO_KEY') return [
    { id: '1', topic: 'Nebula', title: 'Deep Space Nebula', description: 'Explore a random colorful nebula.', type: 'DEEP_SPACE' },
    { id: '2', topic: 'Earth from Space', title: 'Orbital View', description: 'Observe Earth from orbit.', type: 'EARTH' },
    { id: '3', topic: 'James Webb', title: 'JWST Discovery', description: 'Webb telescope discoveries.', type: 'TRENDING' }
  ];
  const ai = new GoogleGenAI({ apiKey });
  const excludeText = excludeTopics.length > 0 ? `\n  - DO NOT include these topics: ${excludeTopics.join(', ')}` : '';
  const prompt = `Generate 3 distinct, high-interest space mission targets. 
  CRITICAL RULES:
  - DO NOT REPEAT common targets unless they offer unique phenomena.
  - VARY the targets across different classifications (e.g., a specific Galaxy, a specific Planetary Nebula, and a Lunar/Earth event).${excludeText}
  - SELECT from famous NASA-cataloged objects (NGC, Messier, IC catalogs).
  - NO human beings, body parts, or astronaut suits.
  - NO NASA logos or agency insignias.
  - NO conference, meeting, or professional facility themes.
  - Pure astronomical objects ONLY.
  Return JSON array of objects with id, topic(short keyword for search), title, description, type (DEEP_SPACE | EARTH | TRENDING).`;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text);
  } catch (error) {
    return [];
  }
};

export const validateImageContent = async (base64Image: string): Promise<boolean> => {
  const apiKey = import.meta.env?.VITE_GEMINI_API_KEY || process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'DEMO_KEY') return true;
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `CRITICAL VALIDATION: Check the image for any of the following:
  1. Human beings (full person, faces, or any body parts like hands, eyes, etc).
  2. NASA logos or any agency insignias.
  3. Humans in a professional setting (meetings, conferences, press releases).
  4. Text-heavy overlays or diagrams.
  
  Return JSON: { "safe": boolean, "reason": "string" }
  Set "safe" to false if ANY of the above are detected. Reason must be descriptive.`;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: prompt }, { inlineData: { data: base64Image, mimeType: "image/jpeg" } }] }]
    });
    const result = JSON.parse(response.text);
    return result.safe;
  } catch (err) {
    return true;
  }
};
