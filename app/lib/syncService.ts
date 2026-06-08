/**
 * syncService.ts — Direct GitHub sync loader
 *
 * Fetches sync.ini ONLY from:
 *   https://raw.githubusercontent.com/cebacoco/configs/main/sync.ini
 *
 * RULES:
 *   1. NO bundled data — starts empty
 *   2. NO localStorage caching — always fetch fresh
 *   3. NO Supabase, NO edge functions, NO proxies, NO databases
 *   4. If fetch fails → empty state → app shows what it has (nothing)
 *   5. On startup: clears any stale localStorage sync keys
 */

import { Platform } from 'react-native';

// ─── Clear stale localStorage on module load ───
try {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.removeItem('cebaco_sync_raw_v2');
    localStorage.removeItem('cebaco_sync_ts_v2');
    localStorage.removeItem('cebaco_sync_raw');
    localStorage.removeItem('cebaco_sync_ts');
    console.log('[SyncService] Cleared ALL stale localStorage sync keys');
  }
} catch (e) {
  // ignore
}

export interface BookingEntry {
  beach: string;
  adults: number;
  kids: number;
  food: string;
  activities: string;
  overnight_nights: number;
  return_boat_persons: number;
}

export interface FishingEntry {
  type: string;
  anglers: number;
  food: string;
}

export interface DaySyncData {
  date: string;
  bookings: BookingEntry[];
  fishing: FishingEntry[];
  confirmed: string[];
  beach: string;
  persons: number;
  kitchen_reservations: number;
  fishing_trips: number;
  fishing_types: string[];
  anglers_count: number;
  workshop_type: string;
  workshop_count: number;
  overnights: number;
}

export interface SyncState {
  days: Record<string, DaySyncData>;
  lastSynced: number;
  rawINI: string;
}

const SYNC_INTERVAL = 5 * 60 * 1000;
const DEFAULT_SYNC_URL = 'https://raw.githubusercontent.com/cebacoco/configs/main/sync.ini';

let _syncVersion = 0;
let _syncUrl = DEFAULT_SYNC_URL;
let _syncTimer: ReturnType<typeof setInterval> | null = null;
let _listeners: Array<(state: SyncState) => void> = [];

// ─── Start EMPTY — no bundled data, no cache ───
let _syncState: SyncState = {
  days: {},
  lastSynced: 0,
  rawINI: '',
};

console.log('[SyncService] Initialized EMPTY — waiting for GitHub fetch');

function createEmptyDay(date: string): DaySyncData {
  return { date, bookings: [], fishing: [], confirmed: [], beach: '', persons: 0, kitchen_reservations: 0, fishing_trips: 0, fishing_types: [], anglers_count: 0, workshop_type: '', workshop_count: 0, overnights: 0 };
}

function parseSyncINI(raw: string): Record<string, DaySyncData> {
  const days: Record<string, DaySyncData> = {};
  let currentSection = '';
  const sectionData: Record<string, Record<string, string>> = {};
  const lines = raw.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) continue;
    const sectionMatch = trimmed.match(/^\[(.+)\]$/);
    if (sectionMatch) { currentSection = sectionMatch[1].trim(); if (!sectionData[currentSection]) sectionData[currentSection] = {}; continue; }
    if (!currentSection) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim().toLowerCase();
    const value = trimmed.substring(eqIdx + 1).trim();
    sectionData[currentSection][key] = value;
  }
  for (const [dateStr, data] of Object.entries(sectionData)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
    
    const day = createEmptyDay(dateStr);
    const bookingNums = new Set<number>();
    for (const key of Object.keys(data)) { const match = key.match(/^booking_(\d+)_/); if (match) bookingNums.add(parseInt(match[1])); }
    for (const num of Array.from(bookingNums).sort((a, b) => a - b)) {
      const prefix = `booking_${num}_`;
      day.bookings.push({ beach: data[`${prefix}beach`] || '', adults: parseInt(data[`${prefix}adults`]) || 0, kids: parseInt(data[`${prefix}kids`]) || 0, food: data[`${prefix}food`] || '', activities: data[`${prefix}activities`] || '', overnight_nights: parseInt(data[`${prefix}overnight`]) || 0, return_boat_persons: parseInt(data[`${prefix}return_boat`]) || 0 });
    }
    const fishingNums = new Set<number>();
    for (const key of Object.keys(data)) { const match = key.match(/^fishing_(\d+)_/); if (match) fishingNums.add(parseInt(match[1])); }
    for (const num of Array.from(fishingNums).sort((a, b) => a - b)) {
      const prefix = `fishing_${num}_`;
      day.fishing.push({ type: data[`${prefix}type`] || '', anglers: parseInt(data[`${prefix}anglers`]) || 0, food: data[`${prefix}food`] || '' });
    }
    if (data.confirmed) day.confirmed = data.confirmed.split(',').map(s => s.trim()).filter(Boolean);
    if (day.bookings.length > 0) { day.beach = day.bookings[0].beach; day.persons = day.bookings.reduce((sum, b) => sum + b.adults + b.kids, 0); day.overnights = day.bookings.reduce((sum, b) => sum + b.overnight_nights, 0); }
    if (day.fishing.length > 0) { day.fishing_trips = day.fishing.length; day.fishing_types = day.fishing.map(f => f.type); day.anglers_count = day.fishing.reduce((sum, f) => sum + f.anglers, 0); day.persons += day.anglers_count; }
    if (data.beach && day.bookings.length === 0) day.beach = data.beach;
    if (data.persons && day.bookings.length === 0) day.persons = parseInt(data.persons) || 0;
    if (data.kitchen_reservations) day.kitchen_reservations = parseInt(data.kitchen_reservations) || 0;
    if (data.fishing_trips && day.fishing.length === 0) day.fishing_trips = parseInt(data.fishing_trips) || 0;
    if (data.fishing_types && day.fishing.length === 0) day.fishing_types = data.fishing_types.split(',').map(s => s.trim()).filter(Boolean);
    if (data.anglers_count && day.fishing.length === 0) day.anglers_count = parseInt(data.anglers_count) || 0;
    if (data.workshop_type) day.workshop_type = data.workshop_type;
    if (data.workshop_count) day.workshop_count = parseInt(data.workshop_count) || 0;
    if (data.overnights && day.bookings.length === 0) day.overnights = parseInt(data.overnights) || 0;
    days[dateStr] = day;
  }
  return days;
}

function isValidSyncContent(raw: string): boolean {
  if (!raw || raw.length < 10) return false;
  if (!/\[\d{4}-\d{2}-\d{2}\]/.test(raw)) return false;
  if (raw.trim().startsWith('<')) return false;
  if (raw.includes('<html') || raw.includes('<!DOCTYPE')) return false;
  return true;
}

// ═══════════════════════════════════════════════════════════════
// FETCH FROM GITHUB — plain fetch, no headers, no cache option
// ═══════════════════════════════════════════════════════════════

function cacheBuster(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

async function fetchFromGitHub(): Promise<string | null> {
  try {
    const fullUrl = _syncUrl + '?v=' + cacheBuster();
    console.log('[SyncService] fetch() →', fullUrl);
    
    const response = await Promise.race([
      fetch(fullUrl),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout 20s')), 20000)),
    ]);
    
    if (!response.ok) {
      console.warn('[SyncService] fetch() HTTP', response.status);
      return null;
    }
    const text = await response.text();
    console.log('[SyncService] fetch() received', text.length, 'bytes');
    return text;
  } catch (e: any) {
    console.warn('[SyncService] fetch() failed:', e?.message || e);
    return null;
  }
}

function fetchWithXHR(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      if (typeof XMLHttpRequest === 'undefined') { resolve(null); return; }
      const fullUrl = _syncUrl + '?x=' + cacheBuster();
      console.log('[SyncService] XHR →', fullUrl);
      const xhr = new XMLHttpRequest();
      xhr.open('GET', fullUrl, true);
      xhr.timeout = 20000;
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log('[SyncService] XHR received', xhr.responseText.length, 'bytes');
          resolve(xhr.responseText);
        } else {
          console.warn('[SyncService] XHR HTTP', xhr.status);
          resolve(null);
        }
      };
      xhr.onerror = () => { console.warn('[SyncService] XHR error'); resolve(null); };
      xhr.ontimeout = () => { console.warn('[SyncService] XHR timeout'); resolve(null); };
      xhr.send();
    } catch (e) { console.warn('[SyncService] XHR exception:', e); resolve(null); }
  });
}

// ═══════════════════════════════════════════════════════════════
// SYNC — fetch from GitHub, parse, update state
// ═══════════════════════════════════════════════════════════════

async function doSync(): Promise<SyncState> {
  try {
    let rawINI: string | null = null;

    // Strategy 1: Plain fetch
    rawINI = await fetchFromGitHub();

    // Strategy 2: XHR fallback
    if (!rawINI) rawINI = await fetchWithXHR();

    // ALL failed
    if (!rawINI) {
      console.warn('[SyncService] ALL fetch methods failed. State remains:', Object.keys(_syncState.days).length, 'days');
      return _syncState;
    }

    // Validate
    if (!isValidSyncContent(rawINI)) {
      console.error('[SyncService] REJECTED — not valid sync.ini format');
      return _syncState;
    }

    // Skip if identical
    if (rawINI === _syncState.rawINI) {
      console.log('[SyncService] Content unchanged, skipping re-parse');
      _syncState.lastSynced = Date.now();
      return _syncState;
    }

    // Parse
    const days = parseSyncINI(rawINI);
    _syncState = { days, lastSynced: Date.now(), rawINI };
    _syncVersion++;

    console.log('[SyncService] ═══════════════════════════════════════════');
    console.log('[SyncService] SYNCED FROM GITHUB — version:', _syncVersion);
    console.log('[SyncService] Days:', Object.keys(days).length);
    for (const [dateStr, day] of Object.entries(days)) {
      if (day.fishing.length > 0) {
        console.log(`[SyncService] FISHING: ${dateStr} → ${day.fishing.map(f => `${f.type}(${f.anglers})`).join(', ')}`);
      }
      if (day.bookings.length > 0) {
        console.log(`[SyncService] BOOKING: ${dateStr} → ${day.bookings.length} booking(s), ${day.persons} persons`);
      }
    }
    console.log('[SyncService] ═══════════════════════════════════════════');

    notifyListeners();
    return _syncState;
  } catch (error) {
    console.error('[SyncService] FAILED:', error);
    return _syncState;
  }
}

function notifyListeners() { _listeners.forEach(fn => fn(_syncState)); }

export function initSync(customUrl?: string): void {
  if (customUrl) _syncUrl = customUrl;
  doSync();
  if (_syncTimer) clearInterval(_syncTimer);
  _syncTimer = setInterval(() => doSync(), SYNC_INTERVAL);
}

export async function syncNow(): Promise<SyncState> { return doSync(); }

export function isConfirmed(confirmationNumber: string): boolean {
  if (!confirmationNumber) return false;
  const upper = confirmationNumber.toUpperCase().trim();
  for (const day of Object.values(_syncState.days)) { if (day.confirmed.some(c => c.toUpperCase().trim() === upper)) return true; }
  return false;
}

export function getDaySync(date: string): DaySyncData | null { return _syncState.days[date] || null; }

export function getAllConfirmed(): string[] {
  const all: string[] = [];
  for (const day of Object.values(_syncState.days)) all.push(...day.confirmed);
  return all;
}

export function getSyncState(): SyncState { return _syncState; }
export function getSyncVersion(): number { return _syncVersion; }
export function getLastSyncedTime(): string { return _syncState.lastSynced ? new Date(_syncState.lastSynced).toLocaleTimeString() : 'Never'; }

export function getRawSyncINI(): string { return _syncState.rawINI; }

export function getActiveFishingDates(): Record<string, { type: string; anglers: number }[]> {
  const result: Record<string, { type: string; anglers: number }[]> = {};
  for (const [dateStr, day] of Object.entries(_syncState.days)) {
    if (day.fishing.length > 0) {
      result[dateStr] = day.fishing.map(f => ({ type: f.type, anglers: f.anglers }));
    }
  }
  return result;
}

export function getBlockedFishingDates(): Record<string, string> {
  const blocked: Record<string, string> = {};

  function shiftDate(dateStr: string, n: number): string {
    const parts = dateStr.split('-');
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  for (const [dateStr, dayData] of Object.entries(_syncState.days)) {
    if (dayData.fishing && dayData.fishing.length > 0) {
      const types = dayData.fishing.map(f => f.type).join(', ');
      const anglers = dayData.fishing.reduce((sum, f) => sum + f.anglers, 0);

      blocked[dateStr] = `Fishing booked: ${types} (${anglers} anglers)`;

      const nextDay = shiftDate(dateStr, 1);
      if (!blocked[nextDay]) {
        blocked[nextDay] = `Loco reserved from ${dateStr} fishing (${types})`;
      }

      const prevDay = shiftDate(dateStr, -1);
      if (!blocked[prevDay]) {
        blocked[prevDay] = `Fishing on ${dateStr} — would conflict (2-day lock)`;
      }
    }

    if (dayData.bookings) {
      for (const booking of dayData.bookings) {
        if (booking.activities && booking.activities.toLowerCase().includes('inshore')) {
          if (!blocked[dateStr]) {
            blocked[dateStr] = 'Inshore fishing add-on booked';
          }
          const nextDay = shiftDate(dateStr, 1);
          if (!blocked[nextDay]) {
            blocked[nextDay] = `Loco reserved from ${dateStr} inshore fishing`;
          }
          const prevDay = shiftDate(dateStr, -1);
          if (!blocked[prevDay]) {
            blocked[prevDay] = `Inshore fishing on ${dateStr} — would conflict`;
          }
        }
      }
    }
  }

  return blocked;
}

export function getBundledFishingDates(): Record<string, FishingEntry[]> {
  // No bundled data — return empty
  return {};
}

export function debugSyncSummary(): string {
  const lines: string[] = [];
  lines.push(`Sync version: ${_syncVersion}`);
  lines.push(`Last synced: ${_syncState.lastSynced ? new Date(_syncState.lastSynced).toISOString() : 'Never'}`);
  lines.push(`Total days: ${Object.keys(_syncState.days).length}`);
  lines.push(`Source: GitHub ONLY (no bundled data, no cache)`);
  
  const blockedDates = getBlockedFishingDates();
  lines.push(`Blocked fishing dates: ${Object.keys(blockedDates).length}`);
  for (const [date, reason] of Object.entries(blockedDates).sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`  BLOCKED: ${date} → ${reason}`);
  }
  
  for (const [dateStr, day] of Object.entries(_syncState.days)) {
    const parts: string[] = [];
    if (day.fishing.length > 0) parts.push(`FISHING: ${day.fishing.map(f => `${f.type}(${f.anglers})`).join(', ')}`);
    if (day.bookings.length > 0) parts.push(`BOOKINGS: ${day.bookings.length} (${day.persons} persons)`);
    if (parts.length > 0) lines.push(`  ${dateStr}: ${parts.join(' | ')}`);
  }
  
  return lines.join('\n');
}

export function subscribeSyncState(fn: (state: SyncState) => void): () => void {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter(l => l !== fn); };
}

export function stopSync(): void { if (_syncTimer) { clearInterval(_syncTimer); _syncTimer = null; } }
export function setSyncUrl(url: string): void { _syncUrl = url; }
