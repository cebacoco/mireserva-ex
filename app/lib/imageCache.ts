/**
 * imageCache.ts — Proactive image caching for offline use
 *
 * On app startup, extracts ALL image URLs from the loaded config
 * and pre-downloads them using expo-image's built-in disk cache.
 *
 * This means even if the user loses internet (common on remote islands),
 * all images they need are already stored locally on the device.
 *
 * STRATEGY:
 *  1. expo-image's Image component uses disk caching by default
 *  2. Image.prefetch(urls) proactively downloads images to disk cache
 *  3. Once cached, images load from disk even without internet
 *  4. Cache persists across app restarts
 *
 * ADDITIONAL WEB FALLBACK:
 *  For web, we also store image blob URLs in memory as a secondary cache.
 */

import { Platform } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { AppConfig } from './configParser';

// ─── Cache state ───
let _prefetchedUrls: Set<string> = new Set();
let _prefetchInProgress = false;
let _prefetchComplete = false;
let _totalImages = 0;
let _cachedImages = 0;
let _listeners: Array<(progress: number, total: number) => void> = [];

// Web blob cache (secondary fallback for web platform)
const _webBlobCache: Map<string, string> = new Map();

// ═══════════════════════════════════════════════════════════════
// URL EXTRACTION — Pulls every image URL from the config
// ═══════════════════════════════════════════════════════════════

export function extractAllImageUrls(config: AppConfig): string[] {
  const urls: Set<string> = new Set();

  // Helper to add non-empty URLs
  const add = (url: string | undefined | null) => {
    if (url && url.startsWith('http')) urls.add(url);
  };

  // Hero
  if (config.hero) {
    add(config.hero.background_image);
  }

  // Beaches
  for (const beach of config.beaches) {
    add(beach.image);
    add(beach.booking_image);
  }

  // Beach Gallery
  for (const photo of config.beachGallery) {
    add(photo.url);
  }

  // Food items
  for (const food of config.food) {
    add(food.image);
  }

  // Water activities
  for (const water of config.water) {
    add(water.image);
  }

  // Island activities
  for (const island of config.island) {
    add(island.image);
    for (const galleryUrl of island.gallery) {
      add(galleryUrl);
    }
  }

  // Fishing
  if (config.fishing) {
    add(config.fishing.central_image);
    for (const item of config.fishing.items) {
      add(item.image);
    }
  }

  // Overnight
  if (config.overnight) {
    add(config.overnight.image);
    for (const g of config.overnight.gallery) {
      add(g.url);
    }
  }

  return Array.from(urls);
}

// ═══════════════════════════════════════════════════════════════
// HARDCODED IMAGE URLS — Images referenced in code, not config
// ═══════════════════════════════════════════════════════════════

const HARDCODED_URLS = [
  // Island map
  'https://d64gsuwffb70l.cloudfront.net/696db551c4a8ae4c4c238cbd_1771007256665_f9737b0f.png',
  // Fishing central image fallback
  'https://d64gsuwffb70l.cloudfront.net/698b1e0a79f9514b9ba08463_1771039055400_1c77e443.jpg',
  // Activity gallery images
  'https://d64gsuwffb70l.cloudfront.net/696db551c4a8ae4c4c238cbd_1770947428408_3d0d1ded.jpeg',
  'https://d64gsuwffb70l.cloudfront.net/696db551c4a8ae4c4c238cbd_1770947430993_34217727.jpeg',
  'https://d64gsuwffb70l.cloudfront.net/696db551c4a8ae4c4c238cbd_1770947432777_2051dc6e.jpeg',
  // Activity image overrides
  'https://d64gsuwffb70l.cloudfront.net/696db551c4a8ae4c4c238cbd_1771003933333_33bb00f5.jpeg',
  'https://d64gsuwffb70l.cloudfront.net/698b1e0a79f9514b9ba08463_1770949714245_dbbc6ecf.jpg',
  // Beach booking card images
  'https://d64gsuwffb70l.cloudfront.net/698b1e0a79f9514b9ba08463_1770988126877_ed7fc986.png',
  'https://d64gsuwffb70l.cloudfront.net/698b1e0a79f9514b9ba08463_1770988104299_4f6b47fe.jpg',
  // Fallback beach images from dataService
  'https://d64gsuwffb70l.cloudfront.net/696db551c4a8ae4c4c238cbd_1770953507887_17bf4d95.jpeg',
  'https://d64gsuwffb70l.cloudfront.net/696db551c4a8ae4c4c238cbd_1770953992332_2e8144f8.jpg',
  // Fallback activity images
  'https://d64gsuwffb70l.cloudfront.net/696db551c4a8ae4c4c238cbd_1771036908332_30e8c522.jpeg',
];

// ═══════════════════════════════════════════════════════════════
// PREFETCH — Download all images to disk cache
// ═══════════════════════════════════════════════════════════════

/**
 * Prefetch all images from the config + hardcoded URLs.
 * Uses expo-image's built-in disk caching.
 * Safe to call multiple times — skips already-cached URLs.
 */
export async function prefetchAllImages(config: AppConfig | null): Promise<{
  total: number;
  cached: number;
  failed: number;
  alreadyCached: number;
}> {
  if (_prefetchInProgress) {
    console.log('[ImageCache] Prefetch already in progress, skipping');
    return { total: 0, cached: 0, failed: 0, alreadyCached: _prefetchedUrls.size };
  }

  _prefetchInProgress = true;

  // Collect all URLs
  const configUrls = config ? extractAllImageUrls(config) : [];
  const allUrls = [...new Set([...configUrls, ...HARDCODED_URLS])];

  // Filter out already-prefetched URLs
  const newUrls = allUrls.filter(url => !_prefetchedUrls.has(url));
  const alreadyCached = allUrls.length - newUrls.length;

  _totalImages = allUrls.length;
  _cachedImages = alreadyCached;

  if (newUrls.length === 0) {
    console.log(`[ImageCache] All ${allUrls.length} images already cached`);
    _prefetchInProgress = false;
    _prefetchComplete = true;
    return { total: allUrls.length, cached: 0, failed: 0, alreadyCached };
  }

  console.log(`[ImageCache] Prefetching ${newUrls.length} new images (${alreadyCached} already cached)`);

  let cached = 0;
  let failed = 0;

  // Prefetch in batches of 5 to avoid overwhelming the network
  const BATCH_SIZE = 5;
  for (let i = 0; i < newUrls.length; i += BATCH_SIZE) {
    const batch = newUrls.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (url) => {
        try {
          // expo-image prefetch — downloads to disk cache
          await ExpoImage.prefetch(url);
          _prefetchedUrls.add(url);
          _cachedImages++;
          notifyListeners();
          return true;
        } catch (err) {
          // If expo-image prefetch fails, try web fetch as fallback
          if (Platform.OS === 'web') {
            try {
              const response = await fetch(url);
              if (response.ok) {
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                _webBlobCache.set(url, blobUrl);
                _prefetchedUrls.add(url);
                _cachedImages++;
                notifyListeners();
                return true;
              }
            } catch {}
          }
          console.warn(`[ImageCache] Failed to prefetch: ${url.substring(0, 60)}...`);
          return false;
        }
      })
    );

    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value) cached++;
      else failed++;
    });
  }

  _prefetchInProgress = false;
  _prefetchComplete = true;

  console.log(
    `[ImageCache] Prefetch complete: ${cached} cached, ${failed} failed, ${alreadyCached} already cached (${allUrls.length} total)`
  );

  return { total: allUrls.length, cached, failed, alreadyCached };
}

// ═══════════════════════════════════════════════════════════════
// CACHE STATUS
// ═══════════════════════════════════════════════════════════════

export function getCacheStatus(): {
  total: number;
  cached: number;
  inProgress: boolean;
  complete: boolean;
  percentage: number;
} {
  const percentage = _totalImages > 0 ? Math.round((_cachedImages / _totalImages) * 100) : 0;
  return {
    total: _totalImages,
    cached: _cachedImages,
    inProgress: _prefetchInProgress,
    complete: _prefetchComplete,
    percentage,
  };
}

/**
 * Subscribe to cache progress updates.
 * Returns an unsubscribe function.
 */
export function onCacheProgress(listener: (cached: number, total: number) => void): () => void {
  _listeners.push(listener);
  return () => {
    _listeners = _listeners.filter(l => l !== listener);
  };
}

function notifyListeners() {
  for (const listener of _listeners) {
    listener(_cachedImages, _totalImages);
  }
}

/**
 * Get a cached blob URL for web platform (fallback).
 * Returns the original URL if no blob cache exists.
 */
export function getWebCachedUrl(url: string): string {
  if (Platform.OS === 'web' && _webBlobCache.has(url)) {
    return _webBlobCache.get(url)!;
  }
  return url;
}

/**
 * Check if a specific URL has been prefetched.
 */
export function isImageCached(url: string): boolean {
  return _prefetchedUrls.has(url);
}

/**
 * Clear the in-memory tracking (does NOT clear expo-image's disk cache).
 * Useful for testing or forcing a re-prefetch.
 */
export function clearCacheTracking(): void {
  _prefetchedUrls.clear();
  _prefetchComplete = false;
  _cachedImages = 0;
  _totalImages = 0;

  // Clean up web blob URLs
  for (const blobUrl of _webBlobCache.values()) {
    try { URL.revokeObjectURL(blobUrl); } catch {}
  }
  _webBlobCache.clear();
}
