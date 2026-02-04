
/**
 * Service to interact with the Mikulski Archive for Space Telescopes (MAST) and Earthdata API.
 */

export interface MASTObservation {
    obs_id: string;
    target_name: string;
    instrument_name: string;
    s_ra: number;
    s_dec: number;
    dataURL?: string;
}

export const searchMASTByNasaId = async (nasaId: string): Promise<MASTObservation | null> => {
    // Strip common prefixes from NASA Library IDs to match MAST obs_id
    // Examples: 'STScI-2023-01' -> '2023-01', or it might be a direct match
    const cleanId = nasaId.replace(/^STScI-/i, '');

    const mastUrl = 'https://mast.stsci.edu/api/v0/invoke';

    // Try searching by obs_id
    const query = {
        service: 'Mast.Caom.Filtered',
        params: {
            columns: '*',
            filters: [
                {
                    paramName: 'obs_id',
                    values: [cleanId, nasaId]
                }
            ]
        },
        format: 'json'
    };

    try {
        const response = await fetch(`${mastUrl}?request=${encodeURIComponent(JSON.stringify(query))}`);
        const data = await response.json();

        if (data.data && data.data.length > 0) {
            return data.data[0];
        }

        // Fallback: Search by target name if we can extract it from the id/metadata
        // For now, return null and let the caller handle fallback
        return null;
    } catch (error) {
        console.error("MAST Query error:", error);
        return null;
    }
};

export const getFITSProducts = async (obs_id: string): Promise<any[]> => {
    const mastUrl = 'https://mast.stsci.edu/api/v0/invoke';
    const query = {
        service: 'Mast.Caom.Products',
        params: {
            obsid: obs_id // Note: Caom.Products often takes the internal 'obsid' (integer), but Filtered returns it
        },
        format: 'json'
    };

    try {
        const response = await fetch(`${mastUrl}?request=${encodeURIComponent(JSON.stringify(query))}`);
        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error("MAST Products error:", error);
        return [];
    }
};

export const fetchFITSHeader = async (productUri: string): Promise<string | null> => {
    // Use the header=true parameter to get only the metadata
    const url = `https://mast.stsci.edu/api/v0.1/Download/file?uri=${productUri}&header=true`;

    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        return await response.text();
    } catch (error) {
        console.error("FITS Header fetch error:", error);
        return null;
    }
};

export const parseWCSFromHeader = (header: string): any => {
    const wcs: any = {};
    const keywords = [
        'CRVAL1', 'CRVAL2', 'CRPIX1', 'CRPIX2', 'CDELT1', 'CDELT2',
        'CTYPE1', 'CTYPE2', 'PC1_1', 'PC1_2', 'PC2_1', 'PC2_2',
        'CD1_1', 'CD1_2', 'CD2_1', 'CD2_2',
        'NAXIS1', 'NAXIS2'
    ];

    // FITS headers are strictly 80 characters per line.
    const lines = header.split(/\r?\n/).filter(l => l.length >= 8);
    lines.forEach(line => {
        const key = line.substring(0, 8).trim().toUpperCase();
        if (keywords.includes(key)) {
            // Find the '=' which is usually at index 8 or 9
            const eqIdx = line.indexOf('=', 8);
            if (eqIdx !== -1) {
                let valPart = line.substring(eqIdx + 1).split('/')[0].trim();
                // Remove quotes for strings
                valPart = valPart.replace(/^'|'$/g, '').trim();
                wcs[key.toLowerCase()] = isNaN(Number(valPart)) ? valPart : Number(valPart);
            }
        }
    });

    // Post-process: If CDELT is missing but CD matrix is present, estimate scale (optional but good for SC readout)
    if (wcs.cd1_1 !== undefined && wcs.cdelt1 === undefined) {
        wcs.cdelt1 = Math.sqrt(Math.pow(wcs.cd1_1, 2) + Math.pow(wcs.cd1_2 || 0, 2));
        wcs.cdelt2 = Math.sqrt(Math.pow(wcs.cd2_2 || 0, 2) + Math.pow(wcs.cd2_1 || 0, 2));
    }

    return Object.keys(wcs).length > 0 ? wcs : null;
};

/**
 * High-level helper to fetch WCS data for a NASA ID.
 */
export const getWCSForNasaId = async (nasaId: string): Promise<any | null> => {
    try {
        const obs = await searchMASTByNasaId(nasaId);
        if (!obs) return null;

        const products = await getFITSProducts(obs.obs_id);
        // Prioritize science-grade or drizzled images
        const fits = products.find(p => p.productSubGroupDescription === 'DRZ' || p.productSubGroupDescription === 'FLT')
            || products.find(p => p.uri.endsWith('.fits'));

        if (!fits) return null;

        const header = await fetchFITSHeader(fits.uri);
        if (!header) return null;

        return parseWCSFromHeader(header);
    } catch (e) {
        console.error("WCS sync failed:", e);
        return null;
    }
};
