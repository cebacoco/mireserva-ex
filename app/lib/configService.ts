/**
 * configService.ts — GitHub config loader with per-section filesystem caching
 *
 * Fetches cebacoco-config.ini from:
 *   https://raw.githubusercontent.com/cebacoco/configs/main/cebacoco-config.ini
 *
 * STRATEGY:
 *  1. Fetch full INI from GitHub
 *  2. Extract per-section _updated timestamps from remote INI
 *  3. Load cached per-section timestamps from filesystem
 *  4. Compare EACH section: remote vs cached
 *     - If ALL sections match → use cached data (fast, no changes)
 *     - If SOME sections newer → SELECTIVE MERGE:
 *       • Parse old cached INI + new remote INI
 *       • For sections with SAME timestamp → keep OLD data
 *       • For sections with NEWER timestamp → use NEW data
 *       • Save merged result to filesystem cache
 *     - If NO cache exists → save full remote INI (first load)
 *  5. If GitHub fetch fails → try filesystem cache (offline mode)
 *  6. If both fail → return null → app shows error (NO FALLBACKS)
 *
 * NO embedded fallbacks. NO bundled configs. GitHub is the ONLY source.
 */

import {
  parseINI,
  buildAppConfig,
  extractTimestamps,
  extractConfigVersion,
  AppConfig,
  SectionTimestamps,
  ParsedConfig,
} from './configParser';
import {
  getCachedINI,
  getCachedSectionTimestamps,
  saveConfigToCache,
  clearConfigCache,
  compareSectionTimestamps,
  extractGlobalTimestampFromRawINI,
  extractSectionTimestampsFromRawINI,
  getCacheStatus,
} from './configCache';

// ═══════════════════════════════════════════════════════════════
// SINGLE SOURCE OF TRUTH
// ═══════════════════════════════════════════════════════════════
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/cebacoco/configs/main/cebacoco-config.ini';

let _timestamps: SectionTimestamps = {};
let _version: string = '';
let _lastError: string = '';
let _rawINI: string = '';
let _cachedParsedConfig: AppConfig | null = null;

// ─── Helpers ───

function cacheBuster(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function getLastFetchError(): string { return _lastError; }
export function getRawINI(): string { return _rawINI; }
export function getConfigDebugInfo() {
  return {
    version: _version,
    rawLength: _rawINI.length,
    rawFirst200: _rawINI.substring(0, 200),
    error: _lastError,
    url: GITHUB_RAW_URL,
    sectionTimestamps: { ..._timestamps },
  };
}

// ═══════════════════════════════════════════════════════════════
// FETCH FROM GITHUB
// ═══════════════════════════════════════════════════════════════

async function tryFetch(url: string): Promise<string | null> {
  try {
    const fullUrl = url + '?v=' + cacheBuster();
    console.log('[Config] fetch() →', fullUrl);

    const response = await Promise.race([
      fetch(fullUrl),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout 20s')), 20000)),
    ]);

    if (!response.ok) {
      console.warn('[Config] fetch() HTTP', response.status, response.statusText);
      return null;
    }

    const text = await response.text();
    console.log('[Config] fetch() received', text.length, 'bytes');

    if (!text.includes('[config]')) {
      console.warn('[Config] Response missing [config] section');
      return null;
    }
    if (text.trim().startsWith('<')) {
      console.warn('[Config] Response starts with < — probably HTML');
      return null;
    }

    return text;
  } catch (err: any) {
    console.warn('[Config] fetch() failed:', err?.message || String(err));
    return null;
  }
}

function tryXHR(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      if (typeof XMLHttpRequest === 'undefined') {
        resolve(null);
        return;
      }

      const fullUrl = url + '?x=' + cacheBuster();
      console.log('[Config] XHR →', fullUrl);

      const xhr = new XMLHttpRequest();
      xhr.open('GET', fullUrl, true);
      xhr.timeout = 20000;

      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          const text = xhr.responseText;
          console.log('[Config] XHR received', text.length, 'bytes');
          if (text.includes('[config]') && !text.trim().startsWith('<')) {
            resolve(text);
          } else {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };
      xhr.onerror = () => resolve(null);
      xhr.ontimeout = () => resolve(null);
      xhr.send();
    } catch {
      resolve(null);
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// VERIFICATION
// ═══════════════════════════════════════════════════════════════

function verifyConfigContent(rawINI: string): { valid: boolean; checks: string[] } {
  const checks: string[] = [];
  let valid = true;

  if (rawINI.includes('[config]')) {
    checks.push('[config] section found');
  } else {
    checks.push('[config] section MISSING');
    valid = false;
  }

  if (rawINI.includes('[strings_en]')) checks.push('[strings_en] found');
  if (rawINI.includes('[strings_es]')) checks.push('[strings_es] found');
  if (rawINI.includes('[footer]')) checks.push('[footer] found');
  if (rawINI.includes('[hero]')) checks.push('[hero] found');

  return { valid, checks };
}

// ═══════════════════════════════════════════════════════════════
// PARSE RAW INI → AppConfig
// ═══════════════════════════════════════════════════════════════

function parseRawINI(rawINI: string): {
  config: AppConfig;
  version: string;
  timestamps: SectionTimestamps;
} {
  const parsed = parseINI(rawINI);
  const config = buildAppConfig(parsed);
  const timestamps = extractTimestamps(parsed);
  const version = extractConfigVersion(parsed) || 'unknown';
  return { config, version, timestamps };
}

// ═══════════════════════════════════════════════════════════════
// SELECTIVE MERGE — merge old + new ParsedConfig based on changed sections
//
// For sections with SAME timestamp → keep OLD data (not deployed yet)
// For sections with NEWER timestamp → use NEW data (deployed)
// For sections without _updated → always use NEW data (meta sections)
// For sections only in NEW → use NEW data (new sections)
// ═══════════════════════════════════════════════════════════════

function mergeConfigs(
  oldParsed: ParsedConfig,
  newParsed: ParsedConfig,
  changedSections: string[],
): ParsedConfig {
  const merged: ParsedConfig = {};
  const changedSet = new Set(changedSections);

  // Sections that never have _updated timestamps — always take from new
  const alwaysUpdateSections = new Set([
    'config', 'strings_en', 'strings_es',
  ]);

  // Collect all section names from both old and new
  const allSections = new Set([
    ...Object.keys(oldParsed),
    ...Object.keys(newParsed),
  ]);

  for (const section of allSections) {
    const existsInOld = section in oldParsed;
    const existsInNew = section in newParsed;

    if (!existsInNew) {
      // Section removed in new config — don't include
      console.log(`[Config:Merge] Section "${section}": REMOVED in remote → dropping`);
      continue;
    }

    if (!existsInOld) {
      // New section — use new data
      merged[section] = newParsed[section];
      console.log(`[Config:Merge] Section "${section}": NEW → using remote`);
      continue;
    }

    // Section exists in both old and new
    if (alwaysUpdateSections.has(section)) {
      // Meta sections — always use new
      merged[section] = newParsed[section];
      continue;
    }

    if (changedSet.has(section)) {
      // This section has a NEWER timestamp → use new data
      merged[section] = newParsed[section];
      console.log(`[Config:Merge] Section "${section}": CHANGED → using remote data`);
    } else {
      // This section has the SAME timestamp → keep old data
      merged[section] = oldParsed[section];
      console.log(`[Config:Merge] Section "${section}": UNCHANGED → keeping cached data`);
    }
  }

  return merged;
}

/**
 * Reconstruct INI text from ParsedConfig.
 * Lossy (comments/formatting lost) but preserves all key-value data.
 */
function reconstructINI(parsed: ParsedConfig): string {
  const lines: string[] = [];
  for (const [section, data] of Object.entries(parsed)) {
    lines.push(`[${section}]`);
    for (const [key, value] of Object.entries(data)) {
      lines.push(`${key}=${value}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════
// MAIN: fetchConfig()
//
// Flow:
//   1. Fetch from GitHub
//   2. Extract per-section timestamps from remote
//   3. Compare with cached per-section timestamps
//   4. If ALL match → use cached data
//   5. If SOME changed → SELECTIVE MERGE (old + new)
//   6. If NO cache → save full remote
//   7. If fetch fails → try FS cache (offline)
//   8. If both fail → null (no fallbacks)
// ═══════════════════════════════════════════════════════════════

export async function fetchConfig(): Promise<{
  config: AppConfig | null;
  changedSections: string[];
  fromCache: boolean;
  version: string;
  error: string;
  verification: string[];
}> {
  _lastError = '';

  const cacheStatus = await getCacheStatus();
  console.log('');
  console.log('[Config] ════════════════════════════════════════════════');
  console.log('[Config] LOADING CONFIG — per-section timestamp check');
  console.log('[Config] URL:', GITHUB_RAW_URL);
  console.log('[Config] Cache:', cacheStatus.hasCachedINI
    ? `YES (${cacheStatus.cachedINILength} bytes, ${Object.keys(cacheStatus.sectionTimestamps).length} sections cached)`
    : 'EMPTY');
  console.log('[Config] Storage:', cacheStatus.storageType);
  console.log('[Config] ════════════════════════════════════════════════');

  // ─── Step 1: Try to fetch from GitHub ───
  let remoteINI: string | null = null;
  const fetchErrors: string[] = [];

  remoteINI = await tryFetch(GITHUB_RAW_URL);
  if (!remoteINI) {
    fetchErrors.push('fetch() failed');
    remoteINI = await tryXHR(GITHUB_RAW_URL);
    if (!remoteINI) {
      fetchErrors.push('XHR failed');
    }
  }

  // ─── Step 2: If we got remote data, compare per-section timestamps ───

  if (remoteINI) {
    const remoteGlobalTs = extractGlobalTimestampFromRawINI(remoteINI);
    const remoteSectionTs = extractSectionTimestampsFromRawINI(remoteINI);
    const cachedSectionTs = cacheStatus.sectionTimestamps;

    console.log('[Config] Remote global timestamp:', remoteGlobalTs);
    console.log('[Config] Remote sections with _updated:', Object.keys(remoteSectionTs).length);
    console.log('[Config] Cached sections with _updated:', Object.keys(cachedSectionTs).length);

    // Compare per-section timestamps
    const comparison = compareSectionTimestamps(remoteSectionTs, cachedSectionTs);

    if (!comparison.needsUpdate && cacheStatus.hasCachedINI) {
      // ─── ALL sections up to date → load from FS cache ───
      console.log('[Config] All sections up to date → loading from filesystem cache');

      // If we have a parsed config in memory, use it (fastest)
      if (_cachedParsedConfig) {
        console.log('[Config] Using in-memory parsed config (all sections current)');
        _rawINI = remoteINI;
        const verification = verifyConfigContent(remoteINI);
        return {
          config: _cachedParsedConfig,
          changedSections: [],
          fromCache: true,
          version: _version,
          error: '',
          verification: verification.checks,
        };
      }

      // Parse from FS cache
      const cachedINI = await getCachedINI();
      if (cachedINI) {
        try {
          _rawINI = cachedINI;
          const result = parseRawINI(cachedINI);
          _cachedParsedConfig = result.config;
          _version = result.version;
          _timestamps = result.timestamps;
          const verification = verifyConfigContent(cachedINI);
          logSuccess(result.config, result.version, cachedINI.length, true, []);
          return {
            config: result.config,
            changedSections: [],
            fromCache: true,
            version: result.version,
            error: '',
            verification: verification.checks,
          };
        } catch (e: any) {
          console.warn('[Config] FS cache parse failed, will re-save remote:', e?.message);
        }
      }
    }

    // ─── Some sections changed OR no cache ───
    const verification = verifyConfigContent(remoteINI);

    try {
      let finalConfig: AppConfig;
      let finalINI: string;

      if (comparison.changedSections.length > 0 && cacheStatus.hasCachedINI) {
        // ═══════════════════════════════════════════════════════
        // SELECTIVE MERGE — only update sections with newer timestamps
        // ═══════════════════════════════════════════════════════
        console.log('[Config] ╔══════════════════════════════════════════╗');
        console.log('[Config] ║  SELECTIVE MERGE — only changed sections  ║');
        console.log('[Config] ╚══════════════════════════════════════════╝');
        console.log('[Config] Changed sections:', comparison.changedSections.join(', '));
        console.log('[Config] Unchanged sections will keep CACHED data');

        const cachedINI = await getCachedINI();
        if (cachedINI) {
          const oldParsed = parseINI(cachedINI);
          const newParsed = parseINI(remoteINI);

          // Merge: old data for unchanged sections, new data for changed sections
          const mergedParsed = mergeConfigs(oldParsed, newParsed, comparison.changedSections);

          // Build AppConfig from merged ParsedConfig
          finalConfig = buildAppConfig(mergedParsed);

          // Reconstruct merged INI for filesystem cache
          finalINI = reconstructINI(mergedParsed);

          console.log('[Config] Merged config built — changed:', comparison.changedSections.length,
            'sections, kept cached:', Object.keys(oldParsed).length - comparison.changedSections.length, 'sections');
        } else {
          // Cache INI disappeared — fall back to full remote
          console.warn('[Config] Cached INI not found during merge — using full remote');
          finalConfig = buildAppConfig(parseINI(remoteINI));
          finalINI = remoteINI;
        }
      } else {
        // ═══════════════════════════════════════════════════════
        // NO CACHE — first load, save full remote INI
        // ═══════════════════════════════════════════════════════
        console.log('[Config] No cached INI found → saving full remote INI');
        finalConfig = buildAppConfig(parseINI(remoteINI));
        finalINI = remoteINI;
      }

      // Save merged (or full) INI + remote timestamps to filesystem
      // The timestamps file always gets the REMOTE timestamps (for future comparisons)
      // The INI file gets the MERGED data (so unchanged sections keep old text)
      await saveConfigToCache(finalINI, remoteGlobalTs || '', remoteSectionTs);
      console.log('[Config] Filesystem cache updated with', Object.keys(remoteSectionTs).length, 'section timestamps');

      _rawINI = finalINI;
      _cachedParsedConfig = finalConfig;
      _version = extractConfigVersion(parseINI(finalINI)) || 'unknown';
      _timestamps = extractTimestamps(parseINI(finalINI));

      logSuccess(finalConfig, _version, finalINI.length, false, comparison.changedSections);
      return {
        config: finalConfig,
        changedSections: comparison.changedSections,
        fromCache: false,
        version: _version,
        error: '',
        verification: verification.checks,
      };
    } catch (parseErr: any) {
      const errMsg = `Parse error: ${parseErr?.message || String(parseErr)}`;
      _lastError = errMsg;
      console.error('[Config] PARSE FAILED:', errMsg);
      return { config: null, changedSections: [], fromCache: false, version: '', error: errMsg, verification: verification.checks };
    }

  } else {
    // ─── GitHub fetch FAILED — try filesystem cache (offline mode) ───
    const cachedINI = await getCachedINI();

    if (cachedINI) {
      console.log('[Config] ╔══════════════════════════════════════════╗');
      console.log('[Config] ║  FETCH FAILED — USING FILESYSTEM CACHE   ║');
      console.log('[Config] ╚══════════════════════════════════════════╝');
      console.log('[Config] Cache size:', cachedINI.length, 'bytes');

      _rawINI = cachedINI;
      const verification = verifyConfigContent(cachedINI);

      try {
        if (_cachedParsedConfig) {
          console.log('[Config] Using in-memory parsed config (offline)');
          return {
            config: _cachedParsedConfig,
            changedSections: [],
            fromCache: true,
            version: _version,
            error: '',
            verification: verification.checks,
          };
        }

        const result = parseRawINI(cachedINI);
        _cachedParsedConfig = result.config;
        _version = result.version;
        _timestamps = result.timestamps;

        logSuccess(result.config, result.version, cachedINI.length, true, []);
        return {
          config: result.config,
          changedSections: [],
          fromCache: true,
          version: result.version,
          error: '',
          verification: verification.checks,
        };
      } catch (parseErr: any) {
        const errMsg = `Cache parse error: ${parseErr?.message || String(parseErr)}`;
        _lastError = errMsg;
        console.error('[Config] FILESYSTEM CACHE PARSE FAILED:', errMsg);
        await clearConfigCache();
        return { config: null, changedSections: [], fromCache: false, version: '', error: errMsg, verification: verification.checks };
      }

    } else {
      // No cache, no remote → error (NO FALLBACK)
      const errorMsg = fetchErrors.join(' → ') + ' (no filesystem cache available)';
      _lastError = errorMsg;
      console.error('');
      console.error('[Config] ╔══════════════════════════════════════════╗');
      console.error('[Config] ║  ALL FETCH FAILED + NO CACHE             ║');
      console.error('[Config] ║  APP WILL NOT LOAD — NO FALLBACKS        ║');
      console.error('[Config] ╚══════════════════════════════════════════╝');
      console.error('[Config] URL:', GITHUB_RAW_URL);
      console.error('[Config] Errors:', errorMsg);
      return { config: null, changedSections: [], fromCache: false, version: '', error: errorMsg, verification: [] };
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// LOG HELPER
// ═══════════════════════════════════════════════════════════════

function logSuccess(config: AppConfig, version: string, bytes: number, fromCache: boolean, changedSections: string[]) {
  console.log('');
  console.log('[Config] ════════════════════════════════════════════════');
  console.log('[Config] SUCCESS —', fromCache ? 'Loaded from FILESYSTEM CACHE' : 'Loaded from GITHUB (fresh)');
  console.log('[Config] Version:', version);
  console.log('[Config] Bytes:', bytes);
  console.log('[Config] Beaches:', config.beaches.length, '→', config.beaches.map(b => b.name).join(', '));
  console.log('[Config] Food:', config.food.length, 'items');
  console.log('[Config] Water:', config.water.length, 'items');
  console.log('[Config] Island:', config.island.length, 'items');
  console.log('[Config] Fishing:', config.fishing?.items.length || 0, 'items');
  console.log('[Config] Hero title:', config.hero?.title?.substring(0, 60) || '(none)');
  if (changedSections.length > 0) {
    console.log('[Config] ── CHANGED sections:', changedSections.join(', '));
  } else if (!fromCache) {
    console.log('[Config] ── First load (no cache) — all sections loaded fresh');
  }
  console.log('[Config] Section timestamps:');
  if (config.timestamps) {
    for (const [section, ts] of Object.entries(config.timestamps)) {
      const marker = changedSections.includes(section) ? ' ← UPDATED' : '';
      console.log(`[Config]   ${section}: ${ts}${marker}`);
    }
  }
  console.log('[Config] ════════════════════════════════════════════════');
  console.log('');
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

export function getCachedConfig(): AppConfig | null {
  return _cachedParsedConfig;
}

/**
 * Clear ONLY the in-memory parsed config.
 * Filesystem cache (INI + timestamps) is preserved.
 * This forces fetchConfig() to re-fetch from GitHub and compare timestamps,
 * but the cached timestamps are still there for proper comparison.
 */
export function clearInMemoryOnly(): void {
  _cachedParsedConfig = null;
  console.log('[Config] In-memory parsed config cleared (filesystem cache preserved for timestamp comparison)');
}

export async function getTimestampInfo() {
  const cache = await getCacheStatus();
  return {
    lastFetch: cache.cachedSavedAt || 'N/A',
    configVersion: _version,
    sectionTimestamps: { ..._timestamps },
    cachedSectionTimestamps: cache.sectionTimestamps,
    storageType: cache.storageType,
  };
}

export function getConfigVersion(): string { return _version || 'not loaded'; }
export function getCachedVersion(): string { return _version; }

/**
 * Clear ALL caches — memory + filesystem.
 * Use only for error recovery or full reset.
 * For normal refresh, use clearInMemoryOnly() instead.
 */
export async function clearCache(): Promise<void> {
  _timestamps = {};
  _version = '';
  _lastError = '';
  _rawINI = '';
  _cachedParsedConfig = null;
  await clearConfigCache();
  console.log('[Config] All caches cleared (memory + filesystem)');
}

export function isSectionStale(): boolean {
  return !_cachedParsedConfig;
}
