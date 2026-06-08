/**
 * capacityService.ts — Capacity checking for beaches, overnights, and fishing
 *
 * RULES:
 *   1. Each beach has its OWN 10 spots (per-beach, NOT global)
 *   2. OVERNIGHT SPILLOVER: overnight=N on date D → persons at beach D through D+(N-1)
 *   3. PLAIN OVERNIGHT (no fishing): Does NOT block Loco
 *   4. FISHING (inshore, offshore, big game) — ALL types:
 *      - Locks Coco Loco for 2 days (fishing day + next day)
 *      - Max 1 fishing trip per day, max 5 anglers per group
 *   5. OVERNIGHT EXCLUSIVITY: Max 1 overnight per day
 *   6. INSHORE FISHING: Add-on to beach trip, still blocks Loco for 2 days
 */

import { getSyncState, DaySyncData, BookingEntry } from './syncService';

// ─── Constants ───
export const BEACH_MAX_CAPACITY = 10;
export const BOAT_MAX_CAPACITY = 10;
export const FISHING_MAX_GROUPS_PER_DAY = 1;
export const FISHING_MAX_ANGLERS = 5;

const LOCO_BEACH_KEYS = ['coco_loco', 'coco loco', 'loco'];

// ─── Types ───
export interface BeachDayCapacity {
  beach: string;
  date: string;
  bookedPersons: number;
  remainingSpots: number;
  isFull: boolean;
  capacityPercent: number;
}

export interface OvernightInfo {
  beach: string;
  persons: number;
  nights: number;
  fromDate: string;
  isFishing: boolean;
}

export interface DayCapacity {
  date: string;
  bookedPersons: number;
  remainingSpots: number;
  isFull: boolean;
  capacityPercent: number;
  fishingGroupsBooked: number;
  fishingAnglersBooked: number;
  fishingAvailable: boolean;
  fishingAnglersRemaining: number;
  locoBlockedByFishing: boolean;
  locoBlockedByOvernight: boolean;
  locoPersons: number;
  locoRemainingSpots: number;
  overnightBooked: boolean;
  overnightInfos: OvernightInfo[];
  canBookNewOvernight: boolean;
  beachBookings: { beach: string; persons: number }[];
  beachCapacities: Record<string, BeachDayCapacity>;
}

// ─── Helpers ───

function isLocoBeach(beachName: string): boolean {
  const lower = beachName.toLowerCase().trim();
  return LOCO_BEACH_KEYS.some(key => lower.includes(key));
}

function normalizeBeachKey(beachName: string): string {
  return beachName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

function getPreviousDay(dateStr: string): string {
  const parts = dateStr.split('-');
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getNextDay(dateStr: string): string {
  const parts = dateStr.split('-');
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr: string, n: number): string {
  const parts = dateStr.split('-');
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isDateInOvernightRange(startDate: string, nights: number, targetDate: string): boolean {
  if (nights <= 0) return false;
  for (let i = 0; i < nights; i++) {
    if (addDays(startDate, i) === targetDate) return true;
  }
  return false;
}

// ─── Overnight Spillover ───

function getOvernightSpillover(targetDate: string): OvernightInfo[] {
  const syncState = getSyncState();
  const result: OvernightInfo[] = [];

  for (const [dateStr, dayData] of Object.entries(syncState.days)) {
    for (const booking of dayData.bookings) {
      if (booking.overnight_nights > 0) {
        if (isDateInOvernightRange(dateStr, booking.overnight_nights, targetDate)) {
          result.push({
            beach: booking.beach,
            persons: booking.adults + booking.kids,
            nights: booking.overnight_nights,
            fromDate: dateStr,
            isFishing: false,
          });
        }
      }
    }

    for (const fishing of dayData.fishing) {
      const fishType = fishing.type.toLowerCase();
      if (fishType === 'offshore' || fishType === 'biggame') {
        if (dateStr === targetDate || addDays(dateStr, 1) === targetDate) {
          result.push({
            beach: 'coco_loco',
            persons: fishing.anglers,
            nights: 2,
            fromDate: dateStr,
            isFishing: true,
          });
        }
      }
    }
  }

  return result;
}

/**
 * Check if ANY fishing is booked on a specific date (raw check)
 */
function hasFishingOnDate(date: string): { booked: boolean; anglers: number; types: string[] } {
  const syncState = getSyncState();
  const dayData = syncState.days[date];
  if (!dayData || dayData.fishing.length === 0) {
    return { booked: false, anglers: 0, types: [] };
  }
  const anglers = dayData.fishing.reduce((sum, f) => sum + f.anglers, 0);
  const types = dayData.fishing.map(f => f.type);
  return { booked: true, anglers, types };
}

/**
 * Check if any booking on a date has inshore fishing add-on.
 */
function hasInshoreFishingOnDate(date: string): boolean {
  const syncState = getSyncState();
  const dayData = syncState.days[date];
  if (!dayData) return false;
  
  for (const fishing of dayData.fishing) {
    if (fishing.type.toLowerCase() === 'inshore') return true;
  }
  
  for (const booking of dayData.bookings) {
    if (booking.activities && booking.activities.toLowerCase().includes('inshore')) return true;
  }
  
  return false;
}

/**
 * Check if Loco is blocked on a given date by FISHING.
 */
function checkLocoBlocked(date: string): {
  blocked: boolean;
  reason: string;
  blockedByToday: boolean;
  blockedByYesterday: boolean;
} {
  const todayFishing = hasFishingOnDate(date);
  const todayInshore = hasInshoreFishingOnDate(date);
  
  if (todayFishing.booked || todayInshore) {
    const anglers = todayFishing.anglers;
    return {
      blocked: true,
      reason: `Fishing trip booked today (${anglers} angler${anglers !== 1 ? 's' : ''}) — Loco reserved`,
      blockedByToday: true,
      blockedByYesterday: false,
    };
  }

  const yesterday = getPreviousDay(date);
  const yesterdayFishing = hasFishingOnDate(yesterday);
  const yesterdayInshore = hasInshoreFishingOnDate(yesterday);
  
  if (yesterdayFishing.booked || yesterdayInshore) {
    return {
      blocked: true,
      reason: `Fishing group from yesterday — Loco still reserved`,
      blockedByToday: false,
      blockedByYesterday: true,
    };
  }

  return { blocked: false, reason: '', blockedByToday: false, blockedByYesterday: false };
}

// ─── Main Capacity Function ───

export function getDayCapacity(date: string): DayCapacity {
  const syncState = getSyncState();
  const dayData = syncState.days[date];
  const locoStatus = checkLocoBlocked(date);

  const beachPersons: Record<string, number> = {};
  const beachBookings: { beach: string; persons: number }[] = [];

  if (dayData) {
    for (const booking of dayData.bookings) {
      const persons = booking.adults + booking.kids;
      const key = normalizeBeachKey(booking.beach);
      beachPersons[key] = (beachPersons[key] || 0) + persons;
      beachBookings.push({ beach: booking.beach, persons });
    }
  }

  const overnightInfos = getOvernightSpillover(date);
  for (const info of overnightInfos) {
    if (info.fromDate !== date) {
      const key = normalizeBeachKey(info.beach);
      beachPersons[key] = (beachPersons[key] || 0) + info.persons;
      beachBookings.push({ beach: info.beach, persons: info.persons });
    }
  }

  let fishingGroupsBooked = 0;
  let fishingAnglersBooked = 0;
  if (dayData) {
    for (const fishing of dayData.fishing) {
      fishingGroupsBooked++;
      fishingAnglersBooked += fishing.anglers;
      const locoKey = normalizeBeachKey('coco_loco');
      beachPersons[locoKey] = (beachPersons[locoKey] || 0) + fishing.anglers;
    }
  }

  const beachCapacities: Record<string, BeachDayCapacity> = {};
  let totalPersons = 0;
  let maxCapacityPercent = 0;

  for (const [key, persons] of Object.entries(beachPersons)) {
    totalPersons += persons;
    const remaining = Math.max(0, BEACH_MAX_CAPACITY - persons);
    const percent = Math.min(100, Math.round((persons / BEACH_MAX_CAPACITY) * 100));
    if (percent > maxCapacityPercent) maxCapacityPercent = percent;
    beachCapacities[key] = {
      beach: key,
      date,
      bookedPersons: persons,
      remainingSpots: remaining,
      isFull: remaining <= 0,
      capacityPercent: percent,
    };
  }

  const locoKey = normalizeBeachKey('coco_loco');
  const locoPersons = beachPersons[locoKey] || 0;
  const locoRemaining = locoStatus.blocked ? 0 : Math.max(0, BEACH_MAX_CAPACITY - locoPersons);

  const overnightBooked = overnightInfos.length > 0;
  const canBookNewOvernight = !overnightBooked;

  const fishingAvailable = fishingGroupsBooked < FISHING_MAX_GROUPS_PER_DAY && !locoStatus.blockedByYesterday;

  return {
    date,
    bookedPersons: totalPersons,
    remainingSpots: Math.max(0, BEACH_MAX_CAPACITY - (Object.values(beachPersons).length > 0 ? Math.max(...Object.values(beachPersons)) : 0)),
    isFull: Object.values(beachCapacities).every(bc => bc.isFull) && Object.keys(beachCapacities).length > 0,
    capacityPercent: maxCapacityPercent,
    fishingGroupsBooked,
    fishingAnglersBooked,
    fishingAvailable,
    fishingAnglersRemaining: Math.max(0, FISHING_MAX_ANGLERS - fishingAnglersBooked),
    locoBlockedByFishing: locoStatus.blocked,
    locoBlockedByOvernight: false,
    locoPersons,
    locoRemainingSpots: locoRemaining,
    overnightBooked,
    overnightInfos,
    canBookNewOvernight,
    beachBookings,
    beachCapacities,
  };
}

export function getBeachDayCapacity(date: string, beachName: string): BeachDayCapacity {
  const cap = getDayCapacity(date);
  const key = normalizeBeachKey(beachName);

  if (isLocoBeach(beachName) && cap.locoBlockedByFishing) {
    return {
      beach: beachName,
      date,
      bookedPersons: BEACH_MAX_CAPACITY,
      remainingSpots: 0,
      isFull: true,
      capacityPercent: 100,
    };
  }

  if (cap.beachCapacities[key]) {
    return cap.beachCapacities[key];
  }

  return {
    beach: beachName,
    date,
    bookedPersons: 0,
    remainingSpots: BEACH_MAX_CAPACITY,
    isFull: false,
    capacityPercent: 0,
  };
}

export function isLocoBlockedByFishing(date: string): boolean {
  return checkLocoBlocked(date).blocked;
}

export function getLocoBlockedReason(date: string): string {
  return checkLocoBlocked(date).reason;
}

export function checkBeachAvailability(date: string, beachName: string, newPersons: number, isOvernight?: boolean, overnightNights?: number): {
  canBook: boolean;
  reason: string;
  remainingAfter: number;
} {
  const cap = getDayCapacity(date);

  if (isLocoBeach(beachName) && cap.locoBlockedByFishing) {
    const locoBlock = checkLocoBlocked(date);
    return {
      canBook: false,
      reason: locoBlock.reason || 'Coco Loco is reserved for a fishing trip. Please choose another beach or another day.',
      remainingAfter: 0,
    };
  }

  const beachCap = getBeachDayCapacity(date, beachName);
  const remainingAfter = beachCap.remainingSpots - newPersons;

  if (remainingAfter < 0) {
    if (beachCap.remainingSpots === 0) {
      return {
        canBook: false,
        reason: `${beachName} is fully booked for this day (${beachCap.bookedPersons}/${BEACH_MAX_CAPACITY} spots). Please choose another beach or another day.`,
        remainingAfter: 0,
      };
    }
    return {
      canBook: false,
      reason: `Only ${beachCap.remainingSpots} spot${beachCap.remainingSpots === 1 ? '' : 's'} left at ${beachName} (${beachCap.bookedPersons}/${BEACH_MAX_CAPACITY}). Your group needs ${newPersons}. Please reduce your group or choose another day.`,
      remainingAfter: beachCap.remainingSpots,
    };
  }

  if (isOvernight && overnightNights && overnightNights > 0) {
    for (let i = 0; i < overnightNights; i++) {
      const checkDate = addDays(date, i);
      const checkCap = getDayCapacity(checkDate);
      if (!checkCap.canBookNewOvernight) {
        const existingOvernight = checkCap.overnightInfos[0];
        const existingDesc = existingOvernight
          ? (existingOvernight.isFishing
            ? 'a fishing trip (overnight at Loco)'
            : `an overnight stay at ${existingOvernight.beach}`)
          : 'another overnight booking';
        return {
          canBook: false,
          reason: `${checkDate} already has ${existingDesc}. Only one overnight per day is allowed. Please choose different dates.`,
          remainingAfter: remainingAfter,
        };
      }

      if (isLocoBeach(beachName)) {
        const locoBlock = checkLocoBlocked(checkDate);
        if (locoBlock.blocked) {
          return {
            canBook: false,
            reason: `Coco Loco is reserved by a fishing trip on ${checkDate}. Cannot book overnight at Loco. Please choose another beach or different dates.`,
            remainingAfter: 0,
          };
        }
      }

      if (i > 0) {
        const spillBeachCap = getBeachDayCapacity(checkDate, beachName);
        const spillRemaining = spillBeachCap.remainingSpots - newPersons;
        if (spillRemaining < 0) {
          return {
            canBook: false,
            reason: `${beachName} doesn't have enough spots on ${checkDate} (day ${i + 1} of your stay). ${spillBeachCap.bookedPersons}/${BEACH_MAX_CAPACITY} spots used.`,
            remainingAfter: 0,
          };
        }
      }
    }
  }

  return {
    canBook: true,
    reason: remainingAfter === 0
      ? `This will fill ${beachName} completely!`
      : `${remainingAfter} spot${remainingAfter === 1 ? '' : 's'} will remain at ${beachName} after your booking.`,
    remainingAfter,
  };
}

export function checkBoatCapacity(date: string, newPersons: number, beachName?: string): {
  canBook: boolean;
  remainingAfter: number;
  message: string;
} {
  if (beachName) {
    const result = checkBeachAvailability(date, beachName, newPersons);
    return { canBook: result.canBook, remainingAfter: result.remainingAfter, message: result.reason };
  }
  return { canBook: true, remainingAfter: BEACH_MAX_CAPACITY, message: 'Select a beach to check availability.' };
}

/**
 * Check if a fishing trip can be booked on a given date.
 * ALL fishing departs from Coco Loco.
 * ALL fishing types lock Loco for 2 days.
 */
export function checkFishingCapacity(date: string, anglers: number, fishingType?: string): {
  canBook: boolean;
  message: string;
} {
  const cap = getDayCapacity(date);
  const typeStr = (fishingType || '').toLowerCase();
  const isOffshoreOrBigGame = typeStr === 'offshore' || typeStr === 'biggame' ||
    typeStr === 'offshore fishing' || typeStr === 'big game fishing';

  console.log(`[CapacityService] checkFishingCapacity(${date}, ${anglers}, ${fishingType}) — fishingGroupsBooked: ${cap.fishingGroupsBooked}, locoBlocked: ${cap.locoBlockedByFishing}`);

  if (cap.fishingGroupsBooked >= FISHING_MAX_GROUPS_PER_DAY) {
    console.log(`[CapacityService] BLOCKED: ${date} already has ${cap.fishingGroupsBooked} fishing group(s)`);
    return {
      canBook: false,
      message: 'A fishing group is already booked for this day. Only 1 fishing group per day is allowed. Please choose another day.',
    };
  }

  if (anglers > FISHING_MAX_ANGLERS) {
    return {
      canBook: false,
      message: `Maximum ${FISHING_MAX_ANGLERS} anglers per fishing group. You requested ${anglers}.`,
    };
  }

  const locoBlock = checkLocoBlocked(date);
  if (locoBlock.blockedByYesterday) {
    console.log(`[CapacityService] BLOCKED: ${date} — Loco blocked by yesterday's fishing`);
    return {
      canBook: false,
      message: 'Coco Loco is still reserved from yesterday\'s fishing trip. Please choose another day.',
    };
  }

  if (locoBlock.blockedByToday) {
    console.log(`[CapacityService] BLOCKED: ${date} — Loco blocked by today's fishing`);
    return {
      canBook: false,
      message: 'A fishing trip is already booked today — Loco is reserved. Please choose another day.',
    };
  }

  const nextDay = getNextDay(date);
  const nextDayFishing = hasFishingOnDate(nextDay);
  if (nextDayFishing.booked) {
    console.log(`[CapacityService] BLOCKED: ${date} — next day ${nextDay} has fishing, would conflict with 2-day lock`);
    return {
      canBook: false,
      message: `Fishing is already booked for ${nextDay}. Any fishing trip locks Loco for 2 days (today + next day), which would conflict. Please choose another day.`,
    };
  }

  if (hasInshoreFishingOnDate(nextDay)) {
    return {
      canBook: false,
      message: `Inshore fishing is booked for ${nextDay}. Any fishing trip locks Loco for 2 days. Please choose another day.`,
    };
  }

  // Also check: previous day has fishing → our day is blocked by their 2-day lock
  const prevDay = getPreviousDay(date);
  const prevDayFishing = hasFishingOnDate(prevDay);
  if (prevDayFishing.booked) {
    console.log(`[CapacityService] BLOCKED: ${date} — previous day ${prevDay} has fishing, 2-day lock still active`);
    return {
      canBook: false,
      message: `Fishing was booked on ${prevDay}. Loco is still locked (2-day fishing block). Please choose another day.`,
    };
  }

  const locoCap = getBeachDayCapacity(date, 'coco_loco');
  if (!locoBlock.blocked && locoCap.remainingSpots < anglers) {
    return {
      canBook: false,
      message: `Not enough spots at Coco Loco for ${anglers} anglers (${locoCap.bookedPersons}/${BEACH_MAX_CAPACITY} spots used). Loco has tourists booked.`,
    };
  }

  return {
    canBook: true,
    message: `${fishingType || 'Fishing'} trip available! ${anglers} angler${anglers !== 1 ? 's' : ''} departing from Coco Loco.`,
  };
}

/**
 * Quick check: is a given date blocked for ANY new fishing booking?
 * Used by the fishing calendar to visually mark blocked days.
 *
 * A day is blocked for fishing if:
 *   1. Already has a fishing group booked (max 1/day)
 *   2. Loco is blocked by yesterday's fishing (2-day spillover)
 *   3. The NEXT day already has fishing (our 2-day block would conflict)
 *   4. The PREVIOUS day has fishing (their 2-day block covers today)
 *
 * Returns { blocked, reason } for UI display.
 */
export function isFishingDayBlocked(date: string): { blocked: boolean; reason: string } {
  const syncState = getSyncState();
  const dayData = syncState.days[date];

  // 1. Already has fishing today
  if (dayData && dayData.fishing.length > 0) {
    const types = dayData.fishing.map(f => f.type).join(', ');
    console.log(`[CapacityService] isFishingDayBlocked(${date}): BLOCKED — fishing already booked (${types})`);
    return { blocked: true, reason: `Fishing already booked (${types})` };
  }

  // 2. Check previous day — if it has fishing, today is in the 2-day lock zone
  const prevDay = getPreviousDay(date);
  const prevDayData = syncState.days[prevDay];
  if (prevDayData && prevDayData.fishing.length > 0) {
    const types = prevDayData.fishing.map(f => f.type).join(', ');
    console.log(`[CapacityService] isFishingDayBlocked(${date}): BLOCKED — yesterday ${prevDay} has fishing (${types}), 2-day lock`);
    return { blocked: true, reason: `Loco reserved (yesterday's ${types} fishing)` };
  }

  // 2b. Also check if previous day has inshore fishing add-on
  if (hasInshoreFishingOnDate(prevDay)) {
    console.log(`[CapacityService] isFishingDayBlocked(${date}): BLOCKED — yesterday ${prevDay} has inshore fishing add-on`);
    return { blocked: true, reason: 'Loco reserved (yesterday\'s inshore fishing)' };
  }

  // 3. Next day already has fishing → our 2-day block would conflict
  const nextDay = getNextDay(date);
  const nextDayData = syncState.days[nextDay];
  if (nextDayData && nextDayData.fishing.length > 0) {
    const types = nextDayData.fishing.map(f => f.type).join(', ');
    console.log(`[CapacityService] isFishingDayBlocked(${date}): BLOCKED — tomorrow ${nextDay} has fishing (${types}), would conflict`);
    return { blocked: true, reason: `Fishing booked tomorrow (${types}) — would conflict` };
  }

  // 3b. Next day has inshore fishing add-on
  if (hasInshoreFishingOnDate(nextDay)) {
    console.log(`[CapacityService] isFishingDayBlocked(${date}): BLOCKED — tomorrow ${nextDay} has inshore fishing add-on`);
    return { blocked: true, reason: 'Inshore fishing tomorrow — would conflict' };
  }

  return { blocked: false, reason: '' };
}


/**
 * CRITICAL: Compute a COMPLETE map of ALL blocked fishing dates.
 * This scans every fishing entry in the sync state and marks:
 *   - The fishing day itself (blocked: already has fishing)
 *   - The next day (blocked: 2-day Loco lock spillover)
 *   - The previous day (blocked: would conflict with next day's fishing)
 *
 * Returns a Record<string, string> where key=date, value=reason.
 * This is used by the calendar to show blocked dates WITHOUT calling
 * isFishingDayBlocked() for each day individually.
 *
 * This function is the SINGLE SOURCE OF TRUTH for fishing calendar blocking.
 */
export function computeBlockedFishingDatesMap(): Record<string, string> {
  const syncState = getSyncState();
  const blocked: Record<string, string> = {};

  console.log('[CapacityService] ═══ computeBlockedFishingDatesMap ═══');
  console.log('[CapacityService] Sync state has', Object.keys(syncState.days).length, 'days');

  // Collect all dates that have fishing
  const fishingDates: { date: string; types: string[]; anglers: number }[] = [];

  for (const [dateStr, dayData] of Object.entries(syncState.days)) {
    if (dayData.fishing && dayData.fishing.length > 0) {
      const types = dayData.fishing.map(f => f.type);
      const anglers = dayData.fishing.reduce((sum, f) => sum + f.anglers, 0);
      fishingDates.push({ date: dateStr, types, anglers });
      console.log(`[CapacityService] FOUND FISHING: ${dateStr} → ${types.join(', ')} (${anglers} anglers)`);
    }

    // Also check for inshore fishing in booking activities
    if (dayData.bookings) {
      for (const booking of dayData.bookings) {
        if (booking.activities && booking.activities.toLowerCase().includes('inshore')) {
          if (!fishingDates.find(f => f.date === dateStr)) {
            fishingDates.push({ date: dateStr, types: ['inshore (add-on)'], anglers: 0 });
            console.log(`[CapacityService] FOUND INSHORE ADD-ON: ${dateStr}`);
          }
        }
      }
    }
  }

  console.log(`[CapacityService] Total fishing dates found: ${fishingDates.length}`);

  // For each fishing date, mark the blocked range
  for (const fishing of fishingDates) {
    const { date, types } = fishing;
    const typesStr = types.join(', ');

    // 1. The fishing day itself is blocked
    if (!blocked[date]) {
      blocked[date] = `Fishing already booked (${typesStr})`;
    }

    // 2. Next day is blocked (2-day Loco lock)
    const nextDay = getNextDay(date);
    if (!blocked[nextDay]) {
      blocked[nextDay] = `Loco reserved (${typesStr} fishing on ${date})`;
    }

    // 3. Previous day is blocked for NEW fishing (would conflict with existing fishing's 2-day lock)
    const prevDay = getPreviousDay(date);
    if (!blocked[prevDay]) {
      blocked[prevDay] = `Fishing on ${date} — would conflict (2-day lock)`;
    }
  }

  console.log(`[CapacityService] Total blocked dates: ${Object.keys(blocked).length}`);
  for (const [date, reason] of Object.entries(blocked)) {
    console.log(`[CapacityService] BLOCKED: ${date} → ${reason}`);
  }
  console.log('[CapacityService] ═══ END computeBlockedFishingDatesMap ═══');

  return blocked;
}



/**
 * Get blocked dates for the OFFSHORE / BIG GAME calendar specifically.
 *
 * This is a SIMPLER blocking rule than getBlockedFishingDates / computeBlockedFishingDatesMap.
 * For the offshore/biggame booking calendar we only block:
 *   1. The fishing day itself (already has a fishing trip)
 *   2. The day AFTER (2-day Loco lock — anglers still on island)
 *
 * We do NOT block:
 *   - The day BEFORE a fishing trip (user can still book there)
 *   - Dates with regular overnight stays (offshore/biggame exception —
 *     they can be booked even when there's a regular overnight)
 *
 * Returns Record<dateStr, reason> for every blocked date.
 */
export function getOffshoreCalendarBlockedDates(): Record<string, string> {
  const syncState = getSyncState();
  const blocked: Record<string, string> = {};

  for (const [dateStr, dayData] of Object.entries(syncState.days)) {
    if (dayData.fishing && dayData.fishing.length > 0) {
      const types = dayData.fishing.map(f => f.type).join(', ');
      const anglers = dayData.fishing.reduce((sum, f) => sum + f.anglers, 0);

      // 1. The fishing day itself
      blocked[dateStr] = `Fishing booked: ${types} (${anglers} anglers)`;

      // 2. Next day (2-day Loco lock)
      const nextDay = getNextDay(dateStr);
      if (!blocked[nextDay]) {
        blocked[nextDay] = `Loco reserved from ${dateStr} fishing (${types})`;
      }
      // NOTE: We intentionally do NOT block the previous day here.
    }

    // Also check inshore fishing in booking activities
    if (dayData.bookings) {
      for (const booking of dayData.bookings) {
        if (booking.activities && booking.activities.toLowerCase().includes('inshore')) {
          if (!blocked[dateStr]) {
            blocked[dateStr] = 'Inshore fishing add-on booked';
          }
          const nextDay = getNextDay(dateStr);
          if (!blocked[nextDay]) {
            blocked[nextDay] = `Loco reserved from ${dateStr} inshore fishing`;
          }
        }
      }
    }
  }

  return blocked;
}




// ─── Color Helpers ───

export function getCapacityColor(date: string): string {
  const cap = getDayCapacity(date);
  if (cap.capacityPercent === 0) return '#10B981';
  if (cap.capacityPercent <= 30) return '#22C55E';
  if (cap.capacityPercent <= 60) return '#F59E0B';
  if (cap.capacityPercent <= 80) return '#F97316';
  return '#EF4444';
}

export function getBeachCapacityColor(date: string, beachName: string): string {
  const beachCap = getBeachDayCapacity(date, beachName);
  if (beachCap.capacityPercent === 0) return '#10B981';
  if (beachCap.capacityPercent <= 30) return '#22C55E';
  if (beachCap.capacityPercent <= 60) return '#F59E0B';
  if (beachCap.capacityPercent <= 80) return '#F97316';
  return '#EF4444';
}

// ─── Utility ───

export function getTodayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function getCapacitySummary(date: string): string {
  const cap = getDayCapacity(date);
  if (cap.bookedPersons === 0 && !cap.locoBlockedByFishing && !cap.overnightBooked) return 'Available';
  if (cap.locoBlockedByFishing) return 'Loco Reserved (Fishing)';
  if (cap.overnightBooked && !cap.locoBlockedByFishing) return 'Overnight booked';
  return `${cap.bookedPersons} booked`;
}

export function getLocoAvailability(date: string): {
  available: boolean;
  reason: string;
  fishingBooked: boolean;
  touristsAtLoco: number;
  totalBoatUsed: number;
  blockedByYesterdayFishing: boolean;
  offshoreStillAvailable: boolean;
  overnightBooked: boolean;
  canBookNewOvernight: boolean;
} {
  const cap = getDayCapacity(date);
  const locoBlock = checkLocoBlocked(date);

  const baseResult = {
    totalBoatUsed: cap.bookedPersons,
    overnightBooked: cap.overnightBooked,
    canBookNewOvernight: cap.canBookNewOvernight,
  };

  if (locoBlock.blocked) {
    return {
      ...baseResult,
      available: false,
      reason: locoBlock.reason,
      fishingBooked: locoBlock.blockedByToday,
      touristsAtLoco: 0,
      blockedByYesterdayFishing: locoBlock.blockedByYesterday,
      offshoreStillAvailable: cap.fishingGroupsBooked < FISHING_MAX_GROUPS_PER_DAY && !locoBlock.blockedByYesterday,
    };
  }

  const locoBeachCap = getBeachDayCapacity(date, 'coco_loco');
  if (locoBeachCap.isFull) {
    return {
      ...baseResult,
      available: false,
      reason: `Coco Loco is full (${BEACH_MAX_CAPACITY}/${BEACH_MAX_CAPACITY} spots)`,
      fishingBooked: false,
      touristsAtLoco: locoBeachCap.bookedPersons,
      blockedByYesterdayFishing: false,
      offshoreStillAvailable: true,
    };
  }

  return {
    ...baseResult,
    available: true,
    reason: `${locoBeachCap.remainingSpots} spot${locoBeachCap.remainingSpots === 1 ? '' : 's'} available at Loco`,
    fishingBooked: false,
    touristsAtLoco: locoBeachCap.bookedPersons,
    blockedByYesterdayFishing: false,
    offshoreStillAvailable: true,
  };
}

/**
 * Debug: Get a full capacity report for a date range.
 */
export function debugCapacityReport(startDate: string, numDays: number): string {
  const lines: string[] = [];
  lines.push('═══ CAPACITY DEBUG REPORT ═══');
  
  const syncState = getSyncState();
  lines.push(`Sync state has ${Object.keys(syncState.days).length} days`);
  
  // Also show the blocked map
  const blockedMap = computeBlockedFishingDatesMap();
  lines.push(`Blocked fishing dates map has ${Object.keys(blockedMap).length} entries`);
  
  for (let i = 0; i < numDays; i++) {
    const date = addDays(startDate, i);
    const dayData = syncState.days[date];
    const blocked = isFishingDayBlocked(date);
    const mapBlocked = blockedMap[date];
    const cap = getDayCapacity(date);
    
    const parts: string[] = [`${date}:`];
    
    if (dayData) {
      if (dayData.fishing.length > 0) {
        parts.push(`FISHING[${dayData.fishing.map(f => `${f.type}(${f.anglers})`).join(',')}]`);
      }
      if (dayData.bookings.length > 0) {
        parts.push(`BOOKINGS[${dayData.bookings.length}]`);
      }
    } else {
      parts.push('no sync data');
    }
    
    parts.push(blocked.blocked ? `isFishingDayBlocked=BLOCKED(${blocked.reason})` : 'isFishingDayBlocked=OK');
    parts.push(mapBlocked ? `MAP=BLOCKED(${mapBlocked})` : 'MAP=OK');
    parts.push(`groups:${cap.fishingGroupsBooked} loco:${cap.locoBlockedByFishing ? 'LOCKED' : 'open'}`);
    
    lines.push(parts.join(' | '));
  }
  
  lines.push('═══ END REPORT ═══');
  return lines.join('\n');
}
