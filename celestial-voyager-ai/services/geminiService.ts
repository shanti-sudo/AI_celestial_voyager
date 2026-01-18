
import { GoogleGenAI, Type } from "@google/genai";
import { POI, QuizQuestion } from "../types";

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

  const prompt = `Analyze this NASA space image entitled "${imageTitle}".
  Official Description: "${imageDescription}"

  Your task is to identify exactly 5-8 interesting celestial objects (stars, nebulae, galaxies, clusters) visible in this image.
  
  CRITICAL INSTRUCTION - TRIANGULATION:
  1. Cross-reference the visual features in the provided image with the official NASA data provided above.
  2. Use your internal astronomical knowledge base to "triangulate" and verify the specific identity of objects (e.g., if the image is Carina Nebula, identify specific known pillars or stars within it).
  3. Ensure every POI is a scientifically accurate feature of THIS specific celestial object.
  
  Return the results as a JSON array of objects.
  For each object, provide:
  - id: unique string
  - name: scientific or common name
  - description: Narrative text representing "The Physics", "The Story", and "The Proof". STRICTLY follow this format: Start directly with "The Physics" content. Then on the IMMEDIATE NEXT LINE (single newline, no vertical gap), start "The Story: [content]". Then on the IMMEDIATE NEXT LINE, start "The Proof: [content]".
  - x: horizontal position as a percentage (0-100)
  - y: vertical position as a percentage (0-100)
  - type: one of ['star', 'nebula', 'galaxy', 'planet', 'other']
  - thoughtSignature: A short string explaining your triangulation process (e.g. "Visual match confirmed against Hubble Catalog data for [Object Name]").
  
  Make sure the coordinates accurately reflect the location of the objects in the image.
  CRITICAL: DISTRIBUTE targets across the image. AVOID clustering. Ensure POIs are separated by at least 15% of the screen width from each other. Coordinate layout must be spacious.`;

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

    // POST-PROCESSING: Enforcement of Non-Overlap (Physics Repulsion)
    const MIN_DISTANCE = 15; // Minimum percentage distance between POIs
    const ITERATIONS = 3; // multiple passes to settle

    for (let iter = 0; iter < ITERATIONS; iter++) {
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const p1 = points[i];
          const p2 = points[j];
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < MIN_DISTANCE && dist > 0) {
            // Calculate repulsion vector
            const overlap = MIN_DISTANCE - dist;
            const angle = Math.atan2(dy, dx);

            // Move p2 away
            const moveX = Math.cos(angle) * overlap;
            const moveY = Math.sin(angle) * overlap;

            p2.x += moveX;
            p2.y += moveY;

            // Keep within bounds (5-95%)
            p2.x = Math.max(5, Math.min(95, p2.x));
            p2.y = Math.max(5, Math.min(95, p2.y));
          } else if (dist === 0) {
            // Handle exact overlap with random nudge
            p2.x += 5;
          }
        }
      }
    }

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
