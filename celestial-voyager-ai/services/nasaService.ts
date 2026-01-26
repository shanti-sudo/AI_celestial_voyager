
import { NASAImage } from '../types';

/**
 * Service to fetch high-resolution celestial imagery from the NASA Image and Video Library.
 */
export const fetchSpaceImage = async (customTopic?: string): Promise<NASAImage> => {
  // Original API Logic Enabled
  // Stricter keywords focused on deep space structures
  // Stricter keywords focused on deep space structures AND Earth as requested
  // Added Earth-specific terms for "latest happening" context
  const keywords = [
    // Deep Space
    'nebula', 'spiral galaxy', 'elliptical galaxy', 'supernova remnant', 'globular cluster',
    'open star cluster', 'planetary nebula', 'molecular cloud', 'dark nebula',
    'james webb deep field', 'hubble ultra deep field', 'pillars of creation',
    'carina nebula', 'orion nebula', 'tarantula nebula', 'whirlpool galaxy', 'sombrero galaxy',
    // Earth / Recent Events
    'earth from space', 'aurora borealis', 'hurricane view from space', 'earth limb',
    'earth night lights', 'blue marble', 'atmosphere'
  ];
  const keyword = customTopic || keywords[Math.floor(Math.random() * keywords.length)];
  const NASA_API_KEY = 'DEMO_KEY';

  // Banned terms preventing "people", "machines", or "launches"
  const BANNED_TERMS = [
    'person', 'people', 'human', 'engineer', 'scientist', 'astronaut', 'crowd', 'face', 'man', 'woman',
    'technician', 'employee', 'portrait', 'ceremony', 'spacewalk', 'crew', 'suit', 'helmet',
    'meeting', 'conference', 'laboratory', 'building', 'facility', 'center',
    'diagram', 'chart', 'graph', 'plot', 'artist concept', 'illustration', 'artist\'s impression', 'animation',
    'airplane', 'aircraft', 'rocket', 'vehicle',
    'hand', 'hands', 'leg', 'legs', 'finger', 'fingers', 'profile', 'selfie', 'body'
  ];

  const validateImageItem = (item: any): boolean => {
    const text = (item.data[0].title + " " + (item.data[0].description || "") + " " + (item.data[0].keywords || []).join(" ")).toLowerCase();
    const hasBannedTerm = BANNED_TERMS.some(term => text.includes(term));
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

    if (!items || items.length === 0) {
      throw new Error(`No NASA images found for keyword: ${keyword}`);
    }

    // Filter items using our strict validation (No humans/machines)
    const validItems = items.filter(validateImageItem);

    if (validItems.length === 0) {
      console.warn(`All images for '${keyword}' contained banned terms. Trying safer fallback keywords...`);
      // Instead of throwing, try a safer fallback keyword that's less likely to have banned content
      const safeFallbacks = ['nebula', 'galaxy cluster', 'deep space', 'star field', 'cosmic dust'];
      const fallbackKeyword = safeFallbacks[Math.floor(Math.random() * safeFallbacks.length)];

      // Retry with fallback keyword (without restrictive year filter)
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
        analysisUrl: lowResUrl!,
        title: itemData.title || "Unknown Stellar Object",
        description: itemData.description || "Captured by deep space observation arrays.",
        date: itemData.date_created || new Date().toISOString()
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

    const isStandardImage = (url: string) => {
      const lower = url.toLowerCase();
      // Exclude .tif or other heavy formats if present, prefer web-ready
      return lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png');
    };

    // Stricter High-Res Priority: verify we actually get a decent size
    // Prefer Large/Medium for web performance, only use Orig if others missing
    const highResUrl = assets.find(url => url.includes('~large') && isStandardImage(url))
      || assets.find(url => url.includes('~medium') && isStandardImage(url))
      || assets.find(url => url.includes('~orig') && isStandardImage(url));

    const lowResUrl = assets.find(url => url.includes('~small') && isStandardImage(url))
      || assets.find(url => url.includes('~thumb') && isStandardImage(url))
      || assets.find(url => url.includes('~medium') && isStandardImage(url))
      || highResUrl;

    if (!highResUrl) {
      // If no medium/large/orig found, skip this item (treat as error to trigger fallback or retry in a real loop)
      // For simple implementation, we throw to use global fallback, which we know is safe.
      throw new Error("No high-resolution image asset found");
    }

    const finalLowResUrl = lowResUrl || highResUrl;

    if (!finalLowResUrl) {
      throw new Error("No image assets found for this NASA item");
    }

    return {
      url: highResUrl,
      analysisUrl: finalLowResUrl,
      title: itemData.title || "Unknown Stellar Object",
      description: itemData.description || "Captured by deep space observation arrays.",
      date: itemData.date_created || new Date().toISOString()
    };
  } catch (error) {
    console.error("Error fetching NASA image:", error);
    throw error; // Propagate error to trigger App.tsx retry logic instead of showing fallback
  }

};

/**
 * Converts a remote NASA image to a base64 string for Gemini AI analysis.
 */
export const imageToBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      } else {
        reject("Base64 conversion failed");
      }
    };
    reader.onerror = () => reject("Image reading failed");
    reader.readAsDataURL(blob);
  });
};
