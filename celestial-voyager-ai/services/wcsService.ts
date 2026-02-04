
/**
 * Service to handle WCS (World Coordinate System) transformations.
 * Converts pixel coordinates to RA/Dec (Right Ascension and Declination).
 */

export interface WCSParams {
    crval1: number;
    crval2: number;
    crpix1: number;
    crpix2: number;
    cdelt1: number;
    cdelt2: number;
    pc1_1?: number;
    pc1_2?: number;
    pc2_1?: number;
    pc2_2?: number;
    cd1_1?: number;
    cd1_2?: number;
    cd2_1?: number;
    cd2_2?: number;
    naxis1: number;
    naxis2: number;
    ctype1?: string;
    ctype2?: string;
}

/**
 * Converts pixel (x, y) on a potentially scaled image to RA/Dec.
 * 
 * @param x Pixel X on the display element
 * @param y Pixel Y on the display element
 * @param viewWidth Width of the display element
 * @param viewHeight Height of the display element
 * @param wcs WCS parameters from FITS
 */
export const pixelToRADec = (
    x: number,
    y: number,
    viewWidth: number,
    viewHeight: number,
    wcs: WCSParams
): { ra: number; dec: number } => {
    // 1. Map viewport pixel to FITS pixel (NAXIS units)
    // Note: FITS pixels are 1-based and usually origin is bottom-left. 
    // Browser pixels are 0-based, origin top-left.

    const fitsX = (x / viewWidth) * wcs.naxis1 + 0.5;
    const fitsY = (1 - (y / viewHeight)) * wcs.naxis2 + 0.5; // Flip Y

    // 2. Calculate relative distance from reference pixel
    const dx = fitsX - wcs.crpix1;
    const dy = fitsY - wcs.crpix2;

    // 3. Apply rotation/scale matrix
    // Priorities: CD Matrix > (PC Matrix * CDELT) > CDELT
    let xi = 0;
    let eta = 0;

    if (wcs.cd1_1 !== undefined) {
        xi = (wcs.cd1_1 * dx + (wcs.cd1_2 || 0) * dy);
        eta = ((wcs.cd2_1 || 0) * dx + (wcs.cd2_2 || 0) * dy);
    } else {
        const pc11 = wcs.pc1_1 ?? 1;
        const pc12 = wcs.pc1_2 ?? 0;
        const pc21 = wcs.pc2_1 ?? 0;
        const pc22 = wcs.pc2_2 ?? 1;
        const cdelt1 = wcs.cdelt1 ?? 1;
        const cdelt2 = wcs.cdelt2 ?? 1;

        xi = (pc11 * dx + pc12 * dy) * cdelt1;
        eta = (pc21 * dx + pc22 * dy) * cdelt2;
    }

    // Convert to Radians
    const deg2rad = Math.PI / 180;
    xi *= deg2rad;
    eta *= deg2rad;
    const ra0 = wcs.crval1 * deg2rad;
    const dec0 = wcs.crval2 * deg2rad;

    // 4. Spherical projection (TAN - Gnomonic)
    // RA = ra0 + atan2(xi, cos(dec0) - eta*sin(dec0))
    // Dec = atan2((eta*cos(dec0) + sin(dec0))*cos(RA-ra0), cos(dec0) - eta*sin(dec0))

    const ra = ra0 + Math.atan2(xi, Math.cos(dec0) - eta * Math.sin(dec0));
    const dec = Math.atan2(
        (eta * Math.cos(dec0) + Math.sin(dec0)) * Math.cos(ra - ra0),
        Math.cos(dec0) - eta * Math.sin(dec0)
    );

    return {
        ra: ra / deg2rad,
        dec: dec / deg2rad
    };
};

/**
 * Formats RA/Dec to sexagesimal (HH:MM:SS, DD:MM:SS)
 */
export const formatCoords = (ra: number, dec: number): string => {
    const raHours = ra / 15;
    const h = Math.floor(raHours);
    const m = Math.floor((raHours - h) * 60);
    const s = ((raHours - h) * 60 - m) * 60;

    const d = Math.floor(Math.abs(dec));
    const dm = Math.floor((Math.abs(dec) - d) * 60);
    const ds = ((Math.abs(dec) - d) * 60 - dm) * 60;
    const sign = dec >= 0 ? '+' : '-';

    return `RA: ${h}h ${m}m ${s.toFixed(2)}s | Dec: ${sign}${d}° ${dm}' ${ds.toFixed(1)}"`;
};

/**
 * Converts RA/Dec back to pixel (x, y) coordinates relative to the original FITS grid.
 */
export const raDecToPixel = (
    ra: number,
    dec: number,
    wcs: WCSParams
): { fitsX: number; fitsY: number } => {
    const deg2rad = Math.PI / 180;
    const ra0 = wcs.crval1 * deg2rad;
    const dec0 = wcs.crval2 * deg2rad;
    const raRad = ra * deg2rad;
    const decRad = dec * deg2rad;

    // Inverse Gnomonic projection
    const cosD = Math.cos(dec0);
    const sinD = Math.sin(dec0);
    const cosDeltaRA = Math.cos(raRad - ra0);

    const denominator = sinD * Math.sin(decRad) + cosD * Math.cos(decRad) * cosDeltaRA;

    // xi and eta in radians
    const xi = (Math.cos(decRad) * Math.sin(raRad - ra0)) / denominator;
    const eta = (cosD * Math.sin(decRad) - sinD * Math.cos(decRad) * cosDeltaRA) / denominator;

    // Convert back to degrees and apply inverse PC matrix
    const xiDeg = xi / deg2rad;
    const etaDeg = eta / deg2rad;

    const pc11 = wcs.pc1_1 ?? 1;
    const pc12 = wcs.pc1_2 ?? 0;
    const pc21 = wcs.pc2_1 ?? 0;
    const pc22 = wcs.pc2_2 ?? 1;

    // Solve for dx, dy:
    // xiDeg = (pc11 * dx + pc12 * dy) * cdelt1
    // etaDeg = (pc21 * dx + pc22 * dy) * cdelt2
    const det = pc11 * pc22 - pc12 * pc21;
    const dx = (xiDeg / wcs.cdelt1 * pc22 - etaDeg / wcs.cdelt2 * pc12) / det;
    const dy = (etaDeg / wcs.cdelt2 * pc11 - xiDeg / wcs.cdelt1 * pc21) / det;

    return {
        fitsX: dx + wcs.crpix1,
        fitsY: dy + wcs.crpix2
    };
};
