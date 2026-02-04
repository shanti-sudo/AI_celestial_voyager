
import { NASAImage, CelestialSidecar } from '../types';

// ========================================
// CONSTANTS
// ========================================

const NASA_API_KEY = 'DEMO_KEY';

const SEARCH_KEYWORDS = [
    'cosmic cliffs webb', 'pillars of creation jwst', 'stephans quintet jwst', 'southern ring nebula webb',
    'cartwheel galaxy webb', 'jupiter jwst high res', 'tarantula nebula jwst', 'wolf-rayet 124 jwst',
    'cassiopeia a jwst', 'saturn rings jwst', 'uranus rings jwst', 'serpens nebula jwst',
    'einstein cross jwst', 'horsehead nebula jwst', 'esa hubble deep field', 'esa planetary nebula',
    'esa galaxy merger', 'esa xmm-newton milky way', 'esa gaia star map', 'esa chew-chew nebula'
];

const BANNED_TERMS = [
    // Humans & People
    'person', 'people', 'human', 'engineer', 'scientist', 'astronaut', 'crowd', 'face', 'man', 'woman',
    'technician', 'employee', 'portrait', 'ceremony', 'spacewalk', 'crew', 'suit', 'helmet',
    'selfie', 'body', 'hand', 'hands', 'leg', 'legs', 'finger', 'fingers', 'silhouette', 'profile',
    'researcher', 'staff', 'audience', 'participant', 'speaker', 'presenter', 'visitor', 'adult', 'child',
    'professional', 'group', 'standing', 'sitting', 'pointing', 'holding', 'wearing', 'dress', 'shirt', 'pants',
    // Machines & Structures (Ground-based or Internal)
    'machine', 'machinery', 'robot', 'robotic', 'satellite', 'spacecraft', 'probe', 'rover', 'lander',
    'station', 'iss', 'telescope', 'shuttle', 'rocket', 'launch', 'vehicle', 'airplane', 'aircraft',
    'instrument', 'antenna', 'computer', 'console', 'laboratory', 'lab', 'building', 'facility', 'center',
    'meeting', 'conference', 'diagram', 'chart', 'graph', 'plot', 'blueprint', 'logo', 'insignia',
    'room', 'hall', 'auditorium', 'office', 'desk', 'screen', 'monitor', 'keyboard', 'control room',
    'interior', 'simulator', 'clean room', 'assembly', 'construction', 'ground', 'runway', 'pad',
    // Art Concepts & Text
    'artist concept', 'illustration', 'artist\'s impression', 'animation', 'drawing', 'sketch', 'model'
];

const CRITICAL_BANNED_TERMS = [
    'person', 'people', 'human', 'face', 'man', 'woman', 'selfie', 'astronaut', 'group', 'body'
];

const SAFE_FALLBACK_KEYWORDS = [
    'nebula', 'galaxy cluster', 'deep space', 'star field', 'cosmic dust', 'molecular cloud'
];

const VIDEO_TOPICS = [
    'hubble', 'webb', 'supernova simulation', 'black hole', 'nebula flythrough'
];

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Extract celestial metadata from NASA item data
 */
const extractSidecar = (itemData: any, width: number = 2048, height: number = 2048): CelestialSidecar => {
    const searchableText = `${itemData.title} ${itemData.description || ''} ${(itemData.keywords || []).join(' ')}`.toLowerCase();

    const raMatch = searchableText.match(/ra\s*[:=]\s*([\d\.]+)/i);
    const decMatch = searchableText.match(/dec\s*[:=]\s*([+-]?[\d\.]+)/i);

    return {
        originalFormat: 'JPG',
        source: 'NASA_IMAGE_LIBRARY',
        protocolVersion: '1.0-GROUNDED',
        envelope: {
            xmin: 0,
            ymin: 0,
            xmax: width,
            ymax: height,
            crs: 'PIXEL',
            centerRA: raMatch ? parseFloat(raMatch[1]) : undefined,
            centerDec: decMatch ? parseFloat(decMatch[1]) : undefined
        },
        instrument: searchableText.match(/(hubble|hst|webb|jwst|chandra|spitzer|wise)/i)?.[0] || 'Unknown',
        fov: searchableText.match(/fov\s*[:=]\s*([\d\.]+\s*(?:arcmin|arcsec|deg))/i)?.[0],
        keywords: itemData.keywords || []
    };
};

/**
 * Validate that an image item doesn't contain banned content
 */
const validateImageItem = (item: any, bannedTermsList: string[] = BANNED_TERMS): boolean => {
    const searchableText = (
        item.data[0].title +
        " " + (item.data[0].description || "") +
        " " + (item.data[0].keywords || []).join(" ")
    ).toLowerCase();

    const hasBannedTerm = bannedTermsList.some(term => {
        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wordBoundaryRegex = new RegExp(`\\b${escapedTerm}\\b`, 'i');
        return wordBoundaryRegex.test(searchableText);
    });

    return !hasBannedTerm;
};

/**
 * Check if a URL is a standard image format (JPG/PNG), excluding thumbnails
 */
const isStandardImageFormat = (url: string, excludeThumbs: boolean = true): boolean => {
    const lowercaseUrl = url.toLowerCase();
    const isValidFormat = lowercaseUrl.endsWith('.jpg') || lowercaseUrl.endsWith('.jpeg') || lowercaseUrl.endsWith('.png');

    if (excludeThumbs) {
        return isValidFormat && !lowercaseUrl.includes('~thumb');
    }

    return isValidFormat;
};

/**
 * Find the best quality image URL from asset list
 */
const selectHighResolutionUrl = (assets: string[]): string | undefined => {
    return assets.find(url => url.includes('~orig') && isStandardImageFormat(url))
        || assets.find(url => url.includes('~large') && isStandardImageFormat(url))
        || assets.find(url => url.includes('~medium') && isStandardImageFormat(url));
};

/**
 * Find the best analysis URL (lower resolution for AI processing)
 */
const selectAnalysisUrl = (assets: string[], highResUrl: string): string => {
    return assets.find(url => url.includes('~small') && isStandardImageFormat(url))
        || assets.find(url => url.includes('~medium') && isStandardImageFormat(url))
        || highResUrl;
};

/**
 * Build a NASAImage object from item data and assets
 */
const buildNASAImage = (
    itemData: any,
    highResUrl: string,
    analysisUrl: string,
    metadataUrl: string | undefined
): NASAImage => {
    return {
        url: highResUrl,
        analysisUrl: analysisUrl,
        metadataUrl,
        nasaId: itemData.nasa_id,
        title: itemData.title || "Unknown Stellar Object",
        description: itemData.description || "Captured by deep space observation arrays.",
        date: itemData.date_created || new Date().toISOString(),
        sidecar: extractSidecar(itemData)
    };
};

/**
 * Fetch assets for a given NASA item
 */
const fetchAssetManifest = async (itemHref: string): Promise<string[]> => {
    const separator = itemHref.includes('?') ? '&' : '?';
    const assetManifestUrl = `${itemHref}${separator}api_key=${NASA_API_KEY}`;

    const response = await fetch(assetManifestUrl);

    if (!response.ok) {
        throw new Error(`NASA Asset Manifest error: ${response.status}`);
    }

    return await response.json();
};

/**
 * Process assets and build NASAImage
 */
const processImageAssets = async (searchResultItem: any): Promise<NASAImage> => {
    const itemData = searchResultItem.data[0];
    const assets = await fetchAssetManifest(searchResultItem.href);

    const highResUrl = selectHighResolutionUrl(assets);

    if (!highResUrl) {
        throw new Error("No high-resolution image asset found");
    }

    const analysisUrl = selectAnalysisUrl(assets, highResUrl);
    const metadataUrl = assets.find(url => url.endsWith('metadata.json'));

    return buildNASAImage(itemData, highResUrl, analysisUrl, metadataUrl);
};

// ========================================
// MAIN EXPORT FUNCTIONS
// ========================================

/**
 * Service to fetch high-resolution celestial imagery from the NASA Image and Video Library.
 */
export const fetchSpaceImage = async (customTopic?: string, strictMode: boolean = false): Promise<NASAImage> => {
    const searchKeyword = customTopic || SEARCH_KEYWORDS[Math.floor(Math.random() * SEARCH_KEYWORDS.length)];

    try {
        const pageNumber = Math.floor(Math.random() * 2) + 1;
        const searchUrl = `https://images-api.nasa.gov/search?q=${encodeURIComponent(searchKeyword)}&media_type=image&page=${pageNumber}`;

        const response = await fetch(searchUrl);

        if (!response.ok) {
            throw new Error(`NASA Search API error: ${response.status}`);
        }

        const apiData = await response.json();
        const searchResults = apiData.collection.items;

        // Guard: No results found
        if (!searchResults || searchResults.length === 0) {
            console.warn(`No raw results found for '${searchKeyword}' (possibly a typo). Proceeding to fallback.`);
            return await fetchFallbackImage(strictMode);
        }

        // Filter using strict validation
        let validSearchResults = searchResults.filter((item: any) => validateImageItem(item));

        // Relaxed validation for custom topics if strict filtering removed everything
        if (validSearchResults.length === 0 && customTopic) {
            console.warn(`Strict validation removed all results for '${customTopic}'. Retrying with relaxed filter.`);
            validSearchResults = searchResults.filter((item: any) => validateImageItem(item, CRITICAL_BANNED_TERMS));
        }

        // Guard: No valid results after filtering
        if (validSearchResults.length === 0) {
            if (strictMode) {
                throw new Error(`Strict Mode: No valid images found for '${searchKeyword}' after filtering.`);
            }
            return await fetchFallbackImage(strictMode);
        }

        // Select random valid item
        const randomValidItem = validSearchResults[Math.floor(Math.random() * Math.min(validSearchResults.length, 20))];

        return await processImageAssets(randomValidItem);

    } catch (error) {
        console.error("Error fetching NASA image:", error);
        throw error;
    }
};

/**
 * Fetch a safe fallback image when primary search fails
 */
const fetchFallbackImage = async (strictMode: boolean): Promise<NASAImage> => {
    if (strictMode) {
        throw new Error(`Strict Mode: No valid fallback images available.`);
    }

    const fallbackKeyword = SAFE_FALLBACK_KEYWORDS[Math.floor(Math.random() * SAFE_FALLBACK_KEYWORDS.length)];
    const fallbackUrl = `https://images-api.nasa.gov/search?q=${encodeURIComponent(fallbackKeyword)}&media_type=image&page=1`;

    const response = await fetch(fallbackUrl);

    if (!response.ok) {
        throw new Error(`Fallback search also failed for: ${fallbackKeyword}`);
    }

    const fallbackData = await response.json();
    const fallbackResults = fallbackData.collection.items || [];
    const validFallbackResults = fallbackResults.filter((item: any) => validateImageItem(item));

    if (validFallbackResults.length === 0) {
        throw new Error("Even fallback keywords returned no valid images");
    }

    const randomFallbackItem = validFallbackResults[Math.floor(Math.random() * Math.min(validFallbackResults.length, 20))];

    return await processImageAssets(randomFallbackItem);
};

/**
 * Enhanced fetcher for high-fidelity assets (Image + 4K Video + Metadata)
 */
export const fetchHighFidelitySpaceAsset = async (customTopic?: string): Promise<NASAImage> => {
    const searchTopic = customTopic || VIDEO_TOPICS[Math.floor(Math.random() * VIDEO_TOPICS.length)];
    const searchUrl = `https://images-api.nasa.gov/search?q=${encodeURIComponent(searchTopic)}&page=1`;

    const response = await fetch(searchUrl);
    const apiData = await response.json();
    const searchResults = apiData.collection.items;

    // Prefer video items, fallback to first result
    const selectedItem = searchResults.find((item: any) => item.data[0].media_type === 'video') || searchResults[0];
    const itemData = selectedItem.data[0];

    const assets = await fetchAssetManifest(selectedItem.href);

    const highResImageUrl = assets.find(url => url.includes('~orig') && url.toLowerCase().endsWith('.jpg'))
        || assets.find(url => url.includes('~large') && url.toLowerCase().endsWith('.jpg'));

    const video4kUrl = assets.find(url => url.includes('~4k.mp4'))
        || assets.find(url => url.includes('~mobile.mp4'))
        || assets.find(url => url.toLowerCase().endsWith('.mp4'));

    const metadataUrl = assets.find(url => url.endsWith('metadata.json'));

    return {
        url: highResImageUrl || assets[0],
        analysisUrl: assets.find(url => url.includes('~medium')) || assets[0],
        videoUrl: video4kUrl,
        metadataUrl,
        nasaId: itemData.nasa_id,
        title: itemData.title,
        description: itemData.description,
        date: itemData.date_created,
        sidecar: {
            originalFormat: itemData.media_type,
            source: 'NASA_IMAGE_VIDEO_LIBRARY',
            protocolVersion: '1.0-GROUNDED',
            envelope: { xmin: 0, ymin: 0, xmax: 3840, ymax: 2160, crs: 'PIXEL' },
            keywords: itemData.keywords
        }
    };
};

/**
 * Converts a remote NASA image to a base64 string and returns its dimensions.
 * Optimized to perform base64 conversion and dimension fetching concurrently.
 */
export const imageToBase64 = async (url: string): Promise<{ data: string, width: number, height: number }> => {
    const response = await fetch(url);
    const imageBlob = await response.blob();

    // Start base64 conversion
    const base64Promise = new Promise<string>((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.onloadend = () => {
            if (typeof fileReader.result === 'string') {
                resolve(fileReader.result.split(',')[1]);
            } else {
                reject("Base64 conversion failed");
            }
        };
        fileReader.onerror = () => reject("Image reading failed");
        fileReader.readAsDataURL(imageBlob);
    });

    // Start dimension fetching using Object URL (faster than base64 decoding)
    const dimensionsPromise = new Promise<{ width: number, height: number }>((resolve) => {
        const imageElement = new Image();
        const objectUrl = URL.createObjectURL(imageBlob);

        imageElement.onload = () => {
            const dims = {
                width: imageElement.naturalWidth,
                height: imageElement.naturalHeight
            };
            URL.revokeObjectURL(objectUrl);
            resolve(dims);
        };

        imageElement.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve({ width: 2048, height: 2048 });
        };

        imageElement.src = objectUrl;
    });

    const [base64Data, dimensions] = await Promise.all([base64Promise, dimensionsPromise]);

    return {
        data: base64Data,
        width: dimensions.width,
        height: dimensions.height
    };
};
