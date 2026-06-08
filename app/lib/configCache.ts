/**
 * configCache.ts — Platform-aware cache for the GitHub config
 *
 * WEB:              IndexedDB (async, large quota, proper database)
 * NATIVE (iOS/Android): expo-file-system → documentDirectory
 *
 * Stores:
 *   - Raw INI text (the full config file)
 *   - Per-section _updated timestamps as JSON
 *   - Global config_updated timestamp
 *   - Cache write timestamp (when we last saved)
 *
 * STRATEGY:
 *   On load → fetch from GitHub → extract per-section timestamps →
 *   compare each section with cached timestamps →
 *   if ANY section newer or not cached → save full INI + timestamps →
 *   always load/parse from cache
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import {
  idbGet,
  idbSet,
  idbRemove,
  idbSetMultiple,
  idbRemoveMultiple,
  idbIsAvailable,
  idbGetStorageEstimate,
} from './indexedDBCache';

// ═══════════════════════════════════════════════════════════════
// FILE PATHS (native) / KEYS (web IndexedDB)
// ═══════════════════════════════════════════════════════════════

const CACHE_DIR = FileSystem.documentDirectory
  ? FileSystem.documentDirectory + 'config_cache/'
  : '';

const FILE_INI = CACHE_DIR + 'config.ini';
const FILE_GLOBAL_TS = CACHE_DIR + 'config_timestamp.txt';
const FILE_SECTION_TS = CACHE_DIR + 'section_timestamps.json';
const FILE_SAVED_AT = CACHE_DIR + 'config_saved_at.txt';

// IndexedDB keys (same naming convention, used as keys in the store)
const IDB_KEY_INI = 'cebaco_config_cache_ini';
const IDB_KEY_GLOBAL_TS = 'cebaco_config_cache_timestamp';
const IDB_KEY_SECTION_TS = 'cebaco_config_cache_section_timestamps';
const IDB_KEY_SAVED_AT = 'cebaco_config_cache_saved_at';

// ═══════════════════════════════════════════════════════════════
// PLATFORM DETECTION
// ═══════════════════════════════════════════════════════════════

function isWeb(): boolean {
  return Platform.OS === 'web';
}

// ═══════════════════════════════════════════════════════════════
// NATIVE: expo-file-system helpers
// ═══════════════════════════════════════════════════════════════

async function ensureCacheDir(): Promise<void> {
  if (isWeb() || !CACHE_DIR) return;
  try {
    const info = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
      console.log('[configCache] Created cache directory:', CACHE_DIR);
    }
  } catch (e) {
    console.warn('[configCache] Failed to create cache dir:', e);
  }
}

async function fsRead(filePath: string): Promise<string | null> {
  try {
    const info = await FileSystem.getInfoAsync(filePath);
    if (!info.exists) return null;
    return await FileSystem.readAsStringAsync(filePath);
  } catch (e) {
    console.warn('[configCache] fsRead failed:', filePath, e);
    return null;
  }
}

async function fsWrite(filePath: string, content: string): Promise<void> {
  try {
    await ensureCacheDir();
    await FileSystem.writeAsStringAsync(filePath, content);
  } catch (e) {
    console.warn('[configCache] fsWrite failed:', filePath, e);
  }
}

async function fsDelete(filePath: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(filePath);
    if (info.exists) {
      await FileSystem.deleteAsync(filePath, { idempotent: true });
    }
  } catch {}
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API — All async, platform-aware
// ═══════════════════════════════════════════════════════════════

/**
 * Get the cached raw INI text.
 */
export async function getCachedINI(): Promise<string | null> {
  if (isWeb()) {
    const ini = await idbGet(IDB_KEY_INI);
    if (ini && ini.includes('[config]')) return ini;
    return null;
  }
  const ini = await fsRead(FILE_INI);
  if (ini && ini.includes('[config]')) return ini;
  return null;
}

/**
 * Get the cached global config_updated timestamp.
 */
export async function getCachedGlobalTimestamp(): Promise<string | null> {
  if (isWeb()) return await idbGet(IDB_KEY_GLOBAL_TS);
  return await fsRead(FILE_GLOBAL_TS);
}

/**
 * Get per-section cached timestamps.
 * Returns Record<sectionName, timestampString>
 */
export async function getCachedSectionTimestamps(): Promise<Record<string, string>> {
  let raw: string | null = null;
  if (isWeb()) {
    raw = await idbGet(IDB_KEY_SECTION_TS);
  } else {
    raw = await fsRead(FILE_SECTION_TS);
  }
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Get when the cache was last written (ISO string).
 */
export async function getCacheSavedAt(): Promise<string | null> {
  if (isWeb()) return await idbGet(IDB_KEY_SAVED_AT);
  return await fsRead(FILE_SAVED_AT);
}

/**
 * Save config to cache with per-section timestamps.
 * Web: IndexedDB (single transaction for all 4 keys)
 * Native: expo-file-system (4 separate file writes)
 */
export async function saveConfigToCache(
  rawINI: string,
  globalTimestamp: string,
  sectionTimestamps: Record<string, string>,
): Promise<void> {
  const savedAt = new Date().toISOString();
  const storageType = isWeb() ? 'IndexedDB' : 'filesystem';

  console.log('[configCache] Saving to', storageType, ':', {
    iniLength: rawINI.length,
    globalTimestamp,
    sections: Object.keys(sectionTimestamps).length,
    savedAt,
  });

  if (isWeb()) {
    // Single IndexedDB transaction for all 4 keys — atomic & efficient
    await idbSetMultiple({
      [IDB_KEY_INI]: rawINI,
      [IDB_KEY_GLOBAL_TS]: globalTimestamp,
      [IDB_KEY_SECTION_TS]: JSON.stringify(sectionTimestamps),
      [IDB_KEY_SAVED_AT]: savedAt,
    });
  } else {
    await fsWrite(FILE_INI, rawINI);
    await fsWrite(FILE_GLOBAL_TS, globalTimestamp);
    await fsWrite(FILE_SECTION_TS, JSON.stringify(sectionTimestamps));
    await fsWrite(FILE_SAVED_AT, savedAt);
  }

  console.log('[configCache] Saved successfully to', storageType);
}

/**
 * Clear the entire config cache.
 * Web: IndexedDB (single transaction)
 * Native: expo-file-system (delete files)
 */
export async function clearConfigCache(): Promise<void> {
  console.log('[configCache] Clearing all cache');

  if (isWeb()) {
    await idbRemoveMultiple([
      IDB_KEY_INI,
      IDB_KEY_GLOBAL_TS,
      IDB_KEY_SECTION_TS,
      IDB_KEY_SAVED_AT,
    ]);
  } else {
    await fsDelete(FILE_INI);
    await fsDelete(FILE_GLOBAL_TS);
    await fsDelete(FILE_SECTION_TS);
    await fsDelete(FILE_SAVED_AT);
  }
}

/**
 * Compare per-section timestamps between remote and cached.
 *
 * Returns:
 *   - changedSections: sections that are newer in remote or not in cache
 *   - needsUpdate: true if any section changed (cache needs updating)
 *
 * Timestamp format: YYYY-MM-DD-HH-mm (lexicographic comparison works)
 */
export function compareSectionTimestamps(
  remoteTimestamps: Record<string, string>,
  cachedTimestamps: Record<string, string>,
): { changedSections: string[]; needsUpdate: boolean } {
  const changedSections: string[] = [];

  for (const [section, remoteTs] of Object.entries(remoteTimestamps)) {
    const cachedTs = cachedTimestamps[section];
    if (!cachedTs) {
      // Section not in cache → new section
      changedSections.push(section);
      console.log(`[configCache] Section "${section}": NOT CACHED → needs update`);
    } else if (remoteTs.trim() > cachedTs.trim()) {
      // Remote is newer
      changedSections.push(section);
      console.log(`[configCache] Section "${section}": remote=${remoteTs} > cached=${cachedTs} → needs update`);
    } else {
      // Same or cached is newer (shouldn't happen)
      // console.log(`[configCache] Section "${section}": up to date (${cachedTs})`);
    }
  }

  return {
    changedSections,
    needsUpdate: changedSections.length > 0,
  };
}

/**
 * Quick extract of config_updated from raw INI text without full parse.
 */
export function extractGlobalTimestampFromRawINI(rawINI: string): string | null {
  const match = rawINI.match(/config_updated\s*=\s*(\S+)/);
  return match?.[1]?.trim() || null;
}

/**
 * Quick extract of ALL per-section _updated timestamps from raw INI.
 * Returns Record<sectionName, timestamp>
 */
export function extractSectionTimestampsFromRawINI(rawINI: string): Record<string, string> {
  const timestamps: Record<string, string> = {};
  let currentSection = '';

  for (const rawLine of rawINI.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';')) continue;

    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      continue;
    }

    if (currentSection && line.startsWith('_updated=')) {
      const value = line.substring('_updated='.length).trim();
      if (value) {
        timestamps[currentSection] = value;
      }
    }
  }

  return timestamps;
}

/**
 * Get cache status info for debugging.
 */
export async function getCacheStatus(): Promise<{
  hasCachedINI: boolean;
  globalTimestamp: string | null;
  sectionTimestamps: Record<string, string>;
  cachedSavedAt: string | null;
  cachedINILength: number;
  storageType: string;
  storageEstimate?: { usage: string; quota: string } | null;
}> {
  const ini = await getCachedINI();
  const globalTs = await getCachedGlobalTimestamp();
  const sectionTs = await getCachedSectionTimestamps();
  const savedAt = await getCacheSavedAt();

  let storageEstimate: { usage: string; quota: string } | null = null;
  if (isWeb()) {
    const estimate = await idbGetStorageEstimate();
    if (estimate) {
      storageEstimate = {
        usage: estimate.usageFormatted,
        quota: estimate.quotaFormatted,
      };
    }
  }

  return {
    hasCachedINI: !!ini,
    globalTimestamp: globalTs,
    sectionTimestamps: sectionTs,
    cachedSavedAt: savedAt,
    cachedINILength: ini ? ini.length : 0,
    storageType: isWeb() ? 'IndexedDB' : 'filesystem',
    storageEstimate,
  };
}
