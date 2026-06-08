/**
 * indexedDBCache.ts — IndexedDB wrapper for web platform
 *
 * Replaces localStorage with IndexedDB for config caching on web.
 * IndexedDB advantages over localStorage:
 *   - Much larger storage quota (hundreds of MB vs ~5-10MB)
 *   - Truly async (doesn't block the main thread)
 *   - Structured data support
 *   - More reliable for large config files
 *
 * Simple key-value store interface matching the old localStorage API
 * but fully async.
 */

const DB_NAME = 'cebaco_config_cache';
const DB_VERSION = 1;
const STORE_NAME = 'cache';

let _db: IDBDatabase | null = null;
let _dbPromise: Promise<IDBDatabase | null> | null = null;

// ═══════════════════════════════════════════════════════════════
// DATABASE INITIALIZATION
// ═══════════════════════════════════════════════════════════════

function openDB(): Promise<IDBDatabase | null> {
  // Return existing promise if already opening
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        console.warn('[IndexedDB] indexedDB not available in this environment');
        resolve(null);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        // Create the key-value object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
          console.log('[IndexedDB] Created object store:', STORE_NAME);
        }
      };

      request.onsuccess = (event) => {
        _db = (event.target as IDBOpenDBRequest).result;

        // Handle unexpected close (e.g., browser clearing storage)
        _db.onclose = () => {
          console.warn('[IndexedDB] Database connection closed unexpectedly');
          _db = null;
          _dbPromise = null;
        };

        console.log('[IndexedDB] Database opened successfully');
        resolve(_db);
      };

      request.onerror = (event) => {
        console.warn('[IndexedDB] Failed to open database:', (event.target as IDBOpenDBRequest).error);
        _dbPromise = null;
        resolve(null);
      };

      request.onblocked = () => {
        console.warn('[IndexedDB] Database open blocked (another tab may have an older version open)');
        _dbPromise = null;
        resolve(null);
      };
    } catch (err) {
      console.warn('[IndexedDB] Exception opening database:', err);
      _dbPromise = null;
      resolve(null);
    }
  });

  return _dbPromise;
}

/**
 * Get the database instance, opening it if necessary.
 */
async function getDB(): Promise<IDBDatabase | null> {
  if (_db) return _db;
  return openDB();
}

// ═══════════════════════════════════════════════════════════════
// CORE OPERATIONS — get / set / remove / clear
// ═══════════════════════════════════════════════════════════════

/**
 * Get a value from IndexedDB by key.
 * Returns null if key doesn't exist or on error.
 */
export async function idbGet(key: string): Promise<string | null> {
  try {
    const db = await getDB();
    if (!db) return null;

    return new Promise<string | null>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
          const value = request.result;
          if (value === undefined || value === null) {
            resolve(null);
          } else {
            resolve(String(value));
          }
        };

        request.onerror = () => {
          console.warn('[IndexedDB] Get failed for key:', key, request.error);
          resolve(null);
        };
      } catch (txErr) {
        console.warn('[IndexedDB] Transaction error on get:', key, txErr);
        resolve(null);
      }
    });
  } catch (err) {
    console.warn('[IndexedDB] idbGet exception:', key, err);
    return null;
  }
}

/**
 * Set a value in IndexedDB.
 */
export async function idbSet(key: string, value: string): Promise<void> {
  try {
    const db = await getDB();
    if (!db) {
      console.warn('[IndexedDB] Cannot set — database not available');
      return;
    }

    return new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(value, key);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          console.warn('[IndexedDB] Set failed for key:', key, request.error);
          resolve();
        };

        tx.onerror = () => {
          console.warn('[IndexedDB] Transaction error on set:', key, tx.error);
          resolve();
        };
      } catch (txErr) {
        console.warn('[IndexedDB] Transaction exception on set:', key, txErr);
        resolve();
      }
    });
  } catch (err) {
    console.warn('[IndexedDB] idbSet exception:', key, err);
  }
}

/**
 * Remove a key from IndexedDB.
 */
export async function idbRemove(key: string): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;

    return new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.warn('[IndexedDB] Remove failed for key:', key, request.error);
          resolve();
        };
      } catch (txErr) {
        console.warn('[IndexedDB] Transaction exception on remove:', key, txErr);
        resolve();
      }
    });
  } catch (err) {
    console.warn('[IndexedDB] idbRemove exception:', key, err);
  }
}

/**
 * Clear ALL data from the cache store.
 */
export async function idbClear(): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;

    return new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
          console.log('[IndexedDB] Store cleared');
          resolve();
        };
        request.onerror = () => {
          console.warn('[IndexedDB] Clear failed:', request.error);
          resolve();
        };
      } catch (txErr) {
        console.warn('[IndexedDB] Transaction exception on clear:', txErr);
        resolve();
      }
    });
  } catch (err) {
    console.warn('[IndexedDB] idbClear exception:', err);
  }
}

// ═══════════════════════════════════════════════════════════════
// BATCH OPERATIONS — for efficiency
// ═══════════════════════════════════════════════════════════════

/**
 * Set multiple key-value pairs in a single transaction.
 * More efficient than calling idbSet() multiple times.
 */
export async function idbSetMultiple(entries: Record<string, string>): Promise<void> {
  try {
    const db = await getDB();
    if (!db) {
      console.warn('[IndexedDB] Cannot setMultiple — database not available');
      return;
    }

    return new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        for (const [key, value] of Object.entries(entries)) {
          store.put(value, key);
        }

        tx.oncomplete = () => {
          resolve();
        };

        tx.onerror = () => {
          console.warn('[IndexedDB] Batch set transaction error:', tx.error);
          resolve();
        };
      } catch (txErr) {
        console.warn('[IndexedDB] Transaction exception on setMultiple:', txErr);
        resolve();
      }
    });
  } catch (err) {
    console.warn('[IndexedDB] idbSetMultiple exception:', err);
  }
}

/**
 * Remove multiple keys in a single transaction.
 */
export async function idbRemoveMultiple(keys: string[]): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;

    return new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        for (const key of keys) {
          store.delete(key);
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => {
          console.warn('[IndexedDB] Batch remove transaction error:', tx.error);
          resolve();
        };
      } catch (txErr) {
        console.warn('[IndexedDB] Transaction exception on removeMultiple:', txErr);
        resolve();
      }
    });
  } catch (err) {
    console.warn('[IndexedDB] idbRemoveMultiple exception:', err);
  }
}

// ═══════════════════════════════════════════════════════════════
// DIAGNOSTICS
// ═══════════════════════════════════════════════════════════════

/**
 * Get all keys currently stored in IndexedDB.
 * Useful for debugging.
 */
export async function idbGetAllKeys(): Promise<string[]> {
  try {
    const db = await getDB();
    if (!db) return [];

    return new Promise<string[]>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAllKeys();

        request.onsuccess = () => {
          resolve((request.result || []).map(k => String(k)));
        };
        request.onerror = () => {
          console.warn('[IndexedDB] getAllKeys failed:', request.error);
          resolve([]);
        };
      } catch (txErr) {
        console.warn('[IndexedDB] Transaction exception on getAllKeys:', txErr);
        resolve([]);
      }
    });
  } catch (err) {
    console.warn('[IndexedDB] idbGetAllKeys exception:', err);
    return [];
  }
}

/**
 * Check if IndexedDB is available and working.
 */
export async function idbIsAvailable(): Promise<boolean> {
  try {
    const db = await getDB();
    return db !== null;
  } catch {
    return false;
  }
}

/**
 * Get approximate storage usage info (if available).
 */
export async function idbGetStorageEstimate(): Promise<{
  usage: number;
  quota: number;
  usageFormatted: string;
  quotaFormatted: string;
} | null> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      };
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
        usageFormatted: formatBytes(estimate.usage || 0),
        quotaFormatted: formatBytes(estimate.quota || 0),
      };
    }
  } catch {}
  return null;
}
