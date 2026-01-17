
export interface POI {
  id: string;
  name: string;
  description: string;
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  type: 'star' | 'nebula' | 'galaxy' | 'planet' | 'other';
  thoughtSignature?: string; // AI reasoning/triangulation data
  explored?: boolean; // Track if POI has been visited
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number; // Index of correct option (0-3)
  relatedPOI?: string; // Optional reference to POI name
}

export interface NASAImage {
  url: string;
  title: string;
  description: string;
  date: string;
}

export interface GameState {
  posX: number;
  posY: number;
  velocity: { x: number; y: number };
  activePOI: POI | null;
}
