
export interface POI {
  id: string;
  name: string;
  description: string;
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  hard_anchor?: {
    pixelX: number;
    pixelY: number;
    originalImageWidth: number;
    originalImageHeight: number;
  };
  type: 'star' | 'nebula' | 'galaxy' | 'planet' | 'other';
  thoughtSignature?: string; // AI reasoning/triangulation data
  registrationStatus?: string; // Tracks 'SYNCED' or 'ADJUSTED' after Image Registration
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
  analysisUrl: string; // Low-res version for faster AI processing
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
