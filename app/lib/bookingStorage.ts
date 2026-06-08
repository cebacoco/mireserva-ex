/**
 * bookingStorage.ts — Booking history persistence
 *
 * WEB:    IndexedDB (async, large quota)
 * NATIVE: In-memory (persists during app session)
 *
 * All public functions are async to support IndexedDB.
 */

import { Platform } from 'react-native';
import { idbGet, idbSet, idbRemove } from './indexedDBCache';

const IDB_KEY = 'cebaco_booking_history';

export interface StoredBooking {
  id: string;
  confirmationNumber: string;
  customerName: string;
  customerEmail: string;
  customerWhatsapp: string;
  items: {
    name: string;
    price: number;
    quantity: number;
    date?: string | null;
  }[];
  total: number;
  date: string;
  emailSent: boolean;
}

// In-memory store (always available, acts as cache for web + primary for native)
let memoryStore: StoredBooking[] = [];
let _memoryInitialized = false;

/**
 * Load bookings from storage.
 * Web: IndexedDB → memory cache
 * Native: memory only
 */
export async function loadBookings(): Promise<StoredBooking[]> {
  // If already loaded into memory, return immediately
  if (_memoryInitialized) return memoryStore;

  if (Platform.OS === 'web') {
    try {
      const raw = await idbGet(IDB_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          memoryStore = parsed;
          _memoryInitialized = true;
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[bookingStorage] Failed to load from IndexedDB:', e);
    }
  }

  _memoryInitialized = true;
  return memoryStore;
}

/**
 * Synchronous load from memory cache (for components that already called loadBookings).
 * Falls back to empty array if not yet initialized.
 */
export function loadBookingsSync(): StoredBooking[] {
  return memoryStore;
}

/**
 * Save bookings to storage.
 * Web: memory + IndexedDB
 * Native: memory only
 */
export async function saveBookings(bookings: StoredBooking[]): Promise<void> {
  memoryStore = bookings;
  _memoryInitialized = true;

  if (Platform.OS === 'web') {
    try {
      await idbSet(IDB_KEY, JSON.stringify(bookings));
    } catch (e) {
      console.warn('[bookingStorage] Failed to save to IndexedDB:', e);
    }
  }
}

/**
 * Add a single booking and persist.
 */
export async function addBooking(booking: StoredBooking): Promise<StoredBooking[]> {
  const current = await loadBookings();
  const updated = [...current, booking];
  await saveBookings(updated);
  return updated;
}

/**
 * Clear all bookings from storage.
 */
export async function clearBookings(): Promise<void> {
  memoryStore = [];
  _memoryInitialized = true;

  if (Platform.OS === 'web') {
    try {
      await idbRemove(IDB_KEY);
    } catch (e) {
      console.warn('[bookingStorage] Failed to clear IndexedDB:', e);
    }
  }
}
