
import { NASAImage, CelestialSidecar } from '../types';

/**
 * GROUNDING PROTOCOL: PRE-FLIGHT VALIDATOR
 * Ensures that the imagery and its sidecar metadata are geometrically aligned
 * before the AI or the rendering engine attempts to ground POIs.
 */
export const validateGroundingManifest = (image: NASAImage, sidecar: CelestialSidecar): {
    valid: boolean,
    errors: string[],
    integrityScore: number
} => {
    const errors: string[] = [];
    let score = 100;

    // 1. CRS Authority Check
    if (!['WCS', 'EQ_RECT', 'PIXEL'].includes(sidecar.envelope.crs)) {
        errors.push("INVALID_CRS: Only WCS, Equirectangular, or Pixel-relative coordinate systems are supported.");
        score -= 40;
    }

    // 2. Extent Sanity Check
    const { xmin, xmax, ymin, ymax } = sidecar.envelope;
    if (xmax <= xmin || ymax <= ymin) {
        errors.push("DEGENERATE_EXTENT: Bounding envelope has zero or negative area.");
        score -= 50;
    }

    // 3. Coordinate System Origin Check (Top-Left 0,0 Enforcement)
    if (sidecar.envelope.crs === 'PIXEL') {
        if (xmin !== 0 || ymin !== 0) {
            errors.push("NON_STANDARD_ORIGIN: Pixel-relative envelopes must start at (0,0).");
            score -= 20;
        }
    }

    // 4. Metadata Linkage
    if (!image.url.includes(sidecar.source) && sidecar.source !== 'GENERIC') {
        errors.push("SOURCE_MISMATCH: Sidecar 'source' field does not match imagery URL pattern.");
        score -= 10;
    }

    // 5. Semantic Validation (RA/Dec range)
    if (sidecar.envelope.centerRA !== undefined) {
        if (sidecar.envelope.centerRA < 0 || sidecar.envelope.centerRA > 360) {
            errors.push("RA_OUT_OF_BOUNDS: Right Ascension must be in range [0, 360].");
            score -= 15;
        }
    }

    return {
        valid: score > 60,
        errors,
        integrityScore: Math.max(0, score)
    };
};
