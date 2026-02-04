
import { NASAImage, CelestialSidecar } from '../types';

/**
 * Service to fetch high-resolution celestial imagery from the NASA Image and Video Library.
 */
export const fetchSpaceImage = async (customTopic?: string, strictMode: boolean = false): Promise<NASAImage> => {
  const keywords = [
    // Famous Nebulae & Regions
    'pillars of creation', 'carina nebula', 'orion nebula', 'tarantula nebula', 'crab nebula',
    'eagle nebula', 'lagoon nebula', 'ring nebula', 'helix nebula', 'butterfly nebula',
    'horsehead nebula', 'veil nebula', 'rosette nebula', 'omega nebula', 'trifid nebula',
    'bubble nebula', 'cone nebula', 'flaming star nebula', 'ghost nebula hubble',
    // Famous Galaxies & Clusters
    'whirlpool galaxy', 'sombrero galaxy', 'andromeda galaxy', 'triangulum galaxy',
    'centaurus a', 'messier 81', 'messier 82', 'cartwheel galaxy', 'stephans quintet',
    'spiral galaxy', 'barred spiral galaxy', 'interacting galaxies', 'hoags object',
    'large magellanic cloud', 'small magellanic cloud', 'pinwheel galaxy', 'cigar galaxy',
    // Deep Field, Lensing & Large Scale
    'hubble deep field', 'webb deep field', 'cosmic cliffs', 'stellar nursery',
    'globular cluster messier 13', 'pleiades', 'supernova remnant cas a', 'planetary nebula ngc',
    'einstein ring gravitational lens', 'galaxy filament', 'protostellar disk',
    // Solar System Wonders (Strictly High Res)
    'jupiter great red spot', 'saturn rings high res', 'mars olympus mons', 'venus surface clouds',
    'titan atmosphere', 'europa ice crust', 'enceladus plumes', 'neptune voyager high res',
    'iotas planetary nebula', 'sun loop prominence', 'comet neowise tail',
    // Earth Phenomenon (High Orbit)
    'earth limb aurora', 'airglow atmospheric', 'cloud deck from space',
    'sahara desert richat structure', 'amazon river from space', 'phytoplankton bloom space',
    'moon shadow on earth eclipse', 'olympus mons mars high res'
  ];
  const keyword = customTopic || keywords[Math.floor(Math.random() * keywords.length)];
  const NASA_API_KEY = 'DEMO_KEY';

  // Stricter Banned terms preventing "people", "machines", or "launches"
  const BANNED_TERMS = [
    // Humans & People
    'person', 'people', 'human', 'engineer', 'scientist', 'astronaut', 'crowd', 'face', 'man', 'woman',
    'technician', 'employee', 'portrait', 'ceremony', 'spacewalk', 'crew', 'suit', 'helmet',
    'selfie', 'body', 'hand', 'hands', 'leg', 'legs', 'finger', 'fingers', 'silhouette', 'profile',
    'researcher', 'staff', 'audience', 'participant', 'speaker', 'presenter', 'visitor',
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

  const validateImageItem = (item: any): boolean => {
    const text = (item.data[0].title + " " + (item.data[0].description || "") + " " + (item.data[0].keywords || []).join(" ")).toLowerCase();

    // Strict whole-word matching to avoid false positives (e.g. "face" in "surface")
    const hasBannedTerm = BANNED_TERMS.some(term => {
      // Escape special regex characters if any (though our list is simple)
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedTerm}\\b`, 'i');
      return regex.test(text);
    });
    return !hasBannedTerm;
  };

  try {
    const page = Math.floor(Math.random() * 2) + 1; // Limit to first 2 pages for better relevancy
    // Removed year_start filter as it was too restrictive and preventing valid images from being found
    const searchUrl = `https://images-api.nasa.gov/search?q=${encodeURIComponent(keyword)}&media_type=image&page=${page}`;
    const response = await fetch(searchUrl);

    if (!response.ok) {
      throw new Error(`NASA Search API error: ${response.status}`);
    }

    const data = await response.json();
    const items = data.collection.items;

    // Filter items using our strict validation (No humans/machines)
    let validItems: any[] = [];

    if (items && items.length > 0) {
      validItems = items.filter(validateImageItem);
    } else {
      console.warn(`No raw results found for '${keyword}' (possibly a typo). Proceeding to fallback.`);
    }

    // INTELLIGENT FALLBACK:
    // If we have a custom topic but strict validation killed all results (likely due to "artist concept" or similiar),
    // we try to relax the filter SLIGHTLY for that specific topic before giving up and showing random "nebula".
    if (validItems.length === 0 && customTopic) {
      console.warn(`Strict validation removed all results for '${customTopic}'. Retrying with relaxed filter.`);
      // Relaxed filter: Only ban obviously human terms, allow "illustration/machines" for specific queries like "Voyager" or "Rover"
      const CRITICAL_BANS = ['person', 'people', 'human', 'face', 'man', 'woman', 'selfie'];
      const validateRelaxed = (item: any) => {
        const text = (item.data[0].title + " " + (item.data[0].description || "")).toLowerCase();
        return !CRITICAL_BANS.some(term => new RegExp(`\\b${term}\\b`, 'i').test(text));
      };
      validItems = items.filter(validateRelaxed);
    }

    if (validItems.length === 0) {
      if (strictMode) {
        throw new Error(`Strict Mode: No valid images found for '${keyword}' after filtering.`);
      }

      const safeFallbacks = ['nebula', 'galaxy cluster', 'deep space', 'star field', 'cosmic dust', 'molecular cloud'];
      const fallbackKeyword = safeFallbacks[Math.floor(Math.random() * safeFallbacks.length)];
      const fallbackUrl = `https://images-api.nasa.gov/search?q=${encodeURIComponent(fallbackKeyword)}&media_type=image&page=1`;
      const fallbackResponse = await fetch(fallbackUrl);

      if (!fallbackResponse.ok || !fallbackResponse.json) {
        throw new Error(`Fallback search also failed for: ${fallbackKeyword}`);
      }

      const fallbackData = await fallbackResponse.json();
      const fallbackItems = fallbackData.collection.items || [];
      const validFallback = fallbackItems.filter(validateImageItem);

      if (validFallback.length === 0) {
        throw new Error("Even fallback keywords returned no valid images");
      }

      // Use fallback items
      const randomItem = validFallback[Math.floor(Math.random() * Math.min(validFallback.length, 20))];
      const itemData = randomItem.data[0];

      const assetManifestUrl = `${randomItem.href}${randomItem.href.includes('?') ? '&' : '?'}api_key=${NASA_API_KEY}`;
      const assetResponse = await fetch(assetManifestUrl);

      if (!assetResponse.ok) {
        throw new Error(`NASA Asset Manifest error: ${assetResponse.status}`);
      }

      const assets: string[] = await assetResponse.json();
      const isStandardImage = (url: string) => {
        const lower = url.toLowerCase();
        return lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png');
      };

      const highResUrl = assets.find(url => url.includes('~large') && isStandardImage(url))
        || assets.find(url => url.includes('~medium') && isStandardImage(url))
        || assets.find(url => url.includes('~orig') && isStandardImage(url));

      const lowResUrl = assets.find(url => url.includes('~small') && isStandardImage(url))
        || assets.find(url => url.includes('~thumb') && isStandardImage(url))
        || assets.find(url => url.includes('~medium') && isStandardImage(url))
        || highResUrl;

      if (!highResUrl) {
        throw new Error("No high-resolution image asset found in fallback");
      }

      return {
        url: highResUrl,
        analysisUrl: finalLowResUrl,
        metadataUrl: assets.find(url => url.endsWith('metadata.json')),
        nasaId: itemData.nasa_id,
        title: itemData.title || "Unknown Stellar Object",
        description: itemData.description || "Captured by deep space observation arrays.",
        date: itemData.date_created || new Date().toISOString(),
        sidecar: extractSidecar(itemData)
      };
    }

    // Pick a random VALID item
    const randomItem = validItems[Math.floor(Math.random() * Math.min(validItems.length, 20))];
    const itemData = randomItem.data[0];

    const assetManifestUrl = `${randomItem.href}${randomItem.href.includes('?') ? '&' : '?'}api_key=${NASA_API_KEY}`;
    const assetResponse = await fetch(assetManifestUrl);

    if (!assetResponse.ok) {
      throw new Error(`NASA Asset Manifest error: ${assetResponse.status}`);
    }

    const assets: string[] = await assetResponse.json();

    // GEOMETRIC IDENTITY PROTOCOL:
    // Analysis and Display MUST share the same aspect ratio. 
    // We prioritize using the exact same asset for both to ensure zero 'pipeline leakage'.
    // We explicitly exclude '~thumb' as it is often a square crop of non-square imagery.
    const isStandard = (url: string) => {
      const lower = url.toLowerCase();
      return (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png')) && !lower.includes('~thumb');
    };

    const highResUrl = assets.find(url => url.includes('~orig') && isStandard(url))
      || assets.find(url => url.includes('~large') && isStandard(url))
      || assets.find(url => url.includes('~medium') && isStandard(url));

    const analysisUrlCandidate = assets.find(url => url.includes('~medium') && isStandard(url))
      || assets.find(url => url.includes('~small') && isStandard(url))
      || highResUrl;

    if (!highResUrl || !analysisUrlCandidate) {
      throw new Error("No geometrically stable image assets found");
    }

    const finalLowResUrl = analysisUrlCandidate;

    const metadataUrl = assets.find(url => url.endsWith('metadata.json'));

    // UPSTREAM BOUNDS EXTRACTION:
    // Extract implicit "Sidecar" metadata from description/keywords
    const extractSidecar = (data: any, width: number = 2048, height: number = 2048): CelestialSidecar => {
      const text = `${data.title} ${data.description || ''} ${(data.keywords || []).join(' ')}`.toLowerCase();

      const raMatch = text.match(/ra\s*[:=]\s*([\d\.]+)/i);
      const decMatch = text.match(/dec\s*[:=]\s*([+-]?[\d\.]+)/i);

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
        instrument: text.match(/(hubble|hst|webb|jwst|chandra|spitzer|wise)/i)?.[0] || 'Unknown',
        fov: text.match(/fov\s*[:=]\s*([\d\.]+\s*(?:arcmin|arcsec|deg))/i)?.[0],
        keywords: data.keywords || []
      };
    };

    return {
      url: highResUrl,
      analysisUrl: finalLowResUrl,
      metadataUrl,
      nasaId: itemData.nasa_id,
      title: itemData.title || "Unknown Stellar Object",
      description: itemData.description || "Captured by deep space observation arrays.",
      date: itemData.date_created || new Date().toISOString(),
      sidecar: extractSidecar(itemData)
    };
  } catch (error) {
    console.error("Error fetching NASA image:", error);
    throw error; // Propagate error to trigger App.tsx retry logic instead of showing fallback
  }

};

/**
 * Enhanced fetcher for high-fidelity assets (Image + 4K Video + Metadata)
 */
export const fetchHighFidelitySpaceAsset = async (customTopic?: string): Promise<NASAImage> => {
  // We prefer topics likely to have videos (Hubble, Webb, Launches, Simulations)
  const videoTopics = ['hubble', 'webb', 'supernova simulation', 'black hole', 'nebula flythrough'];
  const topic = customTopic || videoTopics[Math.floor(Math.random() * videoTopics.length)];

  // Search for both image and video
  const searchUrl = `https://images-api.nasa.gov/search?q=${encodeURIComponent(topic)}&page=1`;
  const response = await fetch(searchUrl);
  const data = await response.json();
  const items = data.collection.items;

  // Find an item that has video in its media_type (if available) or just a good candidate
  const candidate = items.find((item: any) => item.data[0].media_type === 'video') || items[0];
  const itemData = candidate.data[0];

  const assetResponse = await fetch(candidate.href);
  const assets: string[] = await assetResponse.json();

  const origJpeg = assets.find(url => url.includes('~orig') && url.toLowerCase().endsWith('.jpg'))
    || assets.find(url => url.includes('~large') && url.toLowerCase().endsWith('.jpg'));

  const video4k = assets.find(url => url.includes('~4k.mp4'))
    || assets.find(url => url.includes('~mobile.mp4'))
    || assets.find(url => url.toLowerCase().endsWith('.mp4'));

  const metadataUrl = assets.find(url => url.endsWith('metadata.json'));

  return {
    url: origJpeg || assets[0],
    analysisUrl: assets.find(url => url.includes('~medium')) || assets[0],
    videoUrl: video4k,
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
 */
export const imageToBase64 = async (url: string): Promise<{ data: string, width: number, height: number }> => {
  const response = await fetch(url);
  const blob = await response.blob();
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      } else {
        reject("Base64 conversion failed");
      }
    };
    reader.onerror = () => reject("Image reading failed");
    reader.readAsDataURL(blob);
  });

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ data, width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      resolve({ data, width: 2048, height: 2048 });
    };
    img.src = `data:image/jpeg;base64,${data}`;
  });
};
