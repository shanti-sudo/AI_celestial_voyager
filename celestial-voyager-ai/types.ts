
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
  ra?: number; // Right Ascension (Decimal Degrees)
  dec?: number; // Declination (Decimal Degrees)
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

export interface GeoEnvelope {
  xmin: number; // Viewport Left (px or arbitrary)
  ymin: number; // Viewport Top
  xmax: number; // Viewport Right
  ymax: number; // Viewport Bottom
  crs: 'WCS' | 'EQ_RECT' | 'PIXEL'; // Coordinate Reference System
  centerRA?: number; // Decimal degrees
  centerDec?: number; // Decimal degrees
  pixelScale?: number; // arcsec/pixel
}

export interface CelestialSidecar {
  originalFormat: string;
  source: string;
  envelope: GeoEnvelope;
  instrument?: string;
  fov?: string;
  keywords?: string[];
  protocolVersion: '1.0-GROUNDED';
  wcs?: {
    crval1: number;
    crval2: number;
    crpix1: number;
    crpix2: number;
    cdelt1: number;
    cdelt2: number;
    ctype1: string;
    ctype2: string;
    pc1_1?: number;
    pc1_2?: number;
    pc2_1?: number;
    pc2_2?: number;
    naxis1: number;
    naxis2: number;
  };
}

export interface NASAImage {
  url: string;
  analysisUrl: string;
  videoUrl?: string; // 4K .mp4 manifest
  metadataUrl?: string; // Point to scientific metadata.json
  nasaId: string;
  title: string;
  description: string;
  date: string;
  sidecar?: CelestialSidecar;
}

export interface GameState {
  posX: number;
  posY: number;
  velocity: { x: number; y: number };
  activePOI: POI | null;
}

export interface JWSTScientificData {
  id: string;
  title: string;
  description: string;
  altText?: string;
  keywords: string[];
  sources: {
    type: 'NASA_METADATA' | 'ESA_API' | 'JWST_API' | 'AI_FALLBACK';
    description: string;
    credit: string;
    keywords: string[];
  }[];
}
