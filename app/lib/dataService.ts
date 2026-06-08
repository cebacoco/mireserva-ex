/**
 * dataService.ts — Config-driven data service with platform-aware caching
 *
 * All data comes from GitHub config:
 *   https://raw.githubusercontent.com/cebacoco/configs/main/cebacoco-config.ini
 *
 * Caching:
 *   - WEB: IndexedDB (async, large quota, proper database)
 *   - NATIVE: expo-file-system (documentDirectory)
 *   - On load: fetch remote, compare per-section _updated timestamps
 *   - If ALL sections match → use cached data (fast)
 *   - If SOME sections newer → SELECTIVE MERGE:
 *     • Keep old data for unchanged sections
 *     • Use new data only for sections with newer timestamps
 *   - If fetch fails + cache exists → use cache
 *   - If fetch fails + no cache → error (NO FALLBACKS)
 *
 * REFRESH MODES:
 *   smartRefresh() — clears in-memory cache only, preserves cache timestamps
 *                    → fetchConfig() re-fetches from GitHub, compares timestamps properly
 *                    → only sections with NEWER timestamps get updated
 *                    → everything reloads from scratch (use for error recovery only)
 */

import { Beach, Activity, MenuItem, AvailabilityData, Booking } from './types';

import { fetchConfig, getCachedConfig, getTimestampInfo, getConfigVersion, getLastFetchError, getConfigDebugInfo, getRawINI, clearCache, clearInMemoryOnly } from './configService';
import { AppConfig, ConfigFishingItem } from './configParser';
import { applyConfigToI18n } from './i18n';

export const FISHING_ACTIVITY_IDS = [1, 2, 3];
const HIDDEN_ACTIVITY_IDS = [4];

// ═══════════════════════════════════════════════════════════════
// CONFIG → TYPE CONVERTERS
// ═══════════════════════════════════════════════════════════════

function configBeachesToBeaches(configBeaches: AppConfig['beaches']): Beach[] {
  return configBeaches.map((cb, index) => ({
    id: index + 1,
    name: cb.name,
    island: cb.island,
    description: cb.description,
    privacy_score: cb.privacy_score,
    capacity: cb.capacity,
    current_occupancy: 0,
    amenities: cb.amenities,
    panga_available: cb.panga_available,
    panga_schedule: cb.panga_schedule,
    image_url: cb.image,
  }));
}

function configFishingToActivities(config: AppConfig): Activity[] {
  if (!config.fishing) return [];
  return config.fishing.items.map((fi, index) => ({
    id: index + 1,
    name: fi.name,
    category: 'fishing',
    description: fi.description,
    price: fi.price,
    duration: fi.duration,
    max_participants: fi.max_participants,
    equipment: fi.equipment,
    image_url: fi.image,
    available: true,
  }));
}

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════

let _currentConfig: AppConfig | null = null;
let _i18nApplied = false;

// ═══════════════════════════════════════════════════════════════
// LOAD CONFIG (GitHub → filesystem cache, no fallbacks)
// ═══════════════════════════════════════════════════════════════

/**
 * Load config from GitHub with filesystem cache support.
 * Returns the config, whether it came from cache, and any errors.
 */
export async function loadConfig(): Promise<{
  config: AppConfig | null;
  changedSections: string[];
  fromCache: boolean;
  error: string;
  verification: string[];
}> {
  console.log('[dataService] loadConfig() — fetching from GitHub (filesystem cache)');
  
  const result = await fetchConfig();
  
  console.log('[dataService] fetchConfig result:', {
    hasConfig: !!result.config,
    version: result.version,
    fromCache: result.fromCache,
    error: result.error || '(none)',
    changedSections: result.changedSections,
  });

  _currentConfig = result.config;

  // Apply config strings to i18n if we got a config
  if (result.config) {
    applyConfigToI18n(result.config);
    _i18nApplied = true;
    console.log('[dataService] Config applied to i18n');
    console.log('[dataService] Beaches:', result.config.beaches.length);
    console.log('[dataService] From cache:', result.fromCache);
    if (result.changedSections.length > 0) {
      console.log('[dataService] Changed sections:', result.changedSections.join(', '));
    }
  } else {
    console.error('[dataService] CONFIG IS NULL — app will show error (no fallbacks)');
  }

  return {
    config: result.config,
    changedSections: result.changedSections,
    fromCache: result.fromCache,
    error: result.error || '',
    verification: result.verification || [],
  };
}

/**
 * Get the currently loaded config (synchronous).
 * Returns null if no config has been loaded.
 */
export function getConfig(): AppConfig | null {
  if (_currentConfig) {
    if (!_i18nApplied) {
      _i18nApplied = true;
      applyConfigToI18n(_currentConfig);
    }
    return _currentConfig;
  }
  // Try in-memory cached config from configService
  const cached = getCachedConfig();
  if (cached) {
    _currentConfig = cached;
    if (!_i18nApplied) {
      _i18nApplied = true;
      applyConfigToI18n(cached);
    }
    return cached;
  }
  return null;
}

/**
 * Smart refresh — clears ONLY in-memory parsed config.
 * Filesystem cache (INI + timestamps) is PRESERVED.
 *
 * This means fetchConfig() will:
 *   1. Re-fetch from GitHub (bypasses in-memory cache)
 *   2. Compare remote timestamps with PRESERVED cached timestamps
 *   3. Only update sections where remote timestamp is NEWER
 *   4. Keep old data for sections with same timestamp
 *
 * Use this for normal refresh (footer button, pull-to-refresh).
 */
export function smartRefresh(): void {
  _currentConfig = null;
  _i18nApplied = false;
  clearInMemoryOnly();
  console.log('[dataService] Smart refresh — in-memory cleared, filesystem timestamps preserved');
}

/**
 * Force clear all caches (memory + filesystem) and reload from GitHub.
 * ALL sections will appear as "new" since there are no cached timestamps to compare.
 * Use only for error recovery or full reset.
 */
export async function forceReload(): Promise<void> {
  _currentConfig = null;
  _i18nApplied = false;
  await clearCache();
  console.log('[dataService] Force reload — all caches cleared (memory + filesystem)');
}

export { getTimestampInfo, getConfigVersion, getLastFetchError, getConfigDebugInfo, getRawINI } from './configService';

export async function fetchBeaches(): Promise<Beach[]> {
  if (_currentConfig && _currentConfig.beaches.length > 0) {
    return configBeachesToBeaches(_currentConfig.beaches);
  }
  console.warn('[dataService] No config loaded — returning empty beaches');
  return [];
}

export async function fetchActivities(): Promise<Activity[]> {
  if (_currentConfig && _currentConfig.fishing && _currentConfig.fishing.items.length > 0) {
    const fishingActivities = configFishingToActivities(_currentConfig);
    return fishingActivities.filter(a => !HIDDEN_ACTIVITY_IDS.includes(a.id));
  }
  console.warn('[dataService] No config loaded — returning empty activities');
  return [];
}

export async function fetchMenuItems(): Promise<MenuItem[]> {
  return [];
}

export async function fetchAvailability(): Promise<AvailabilityData | null> {
  if (!_currentConfig) {
    console.warn('[dataService] No config loaded — returning null availability');
    return null;
  }
  return {
    beaches: {},
    boats: {},
    activities: {},
    reservations: {
      total_today: '0',
      total_tomorrow: '0',
      reef_fishing_today: '0',
      offshore_fishing_today: '0',
      big_game_fishing_today: '0',
      surfing_today: '0',
      last_updated: new Date().toISOString(),
    },
  };
}

export async function createBooking(booking: Booking): Promise<{ success: boolean; error?: string }> {
  console.log('[dataService] createBooking called — handled by email + local storage');
  return { success: true };
}

export const ACTIVITY_GALLERY: Record<number, string[]> = {};
