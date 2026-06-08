import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Activity } from '../lib/types';
import { useCart } from '../lib/cartStore';
import { useLang, getLang } from '../lib/i18n';
import {
  getDayCapacity, checkFishingCapacity, isLocoBlockedByFishing,
  getCapacityColor, FISHING_MAX_ANGLERS, FISHING_MAX_GROUPS_PER_DAY,
  BEACH_MAX_CAPACITY, BOAT_MAX_CAPACITY,
} from '../lib/capacityService';
import {
  subscribeSyncState, syncNow, getBlockedFishingDates,
} from '../lib/syncService';


const { width } = Dimensions.get('window');

interface FishingDetailModalProps {
  visible: boolean;
  fishingActivities: Activity[];
  onClose: () => void;
  onBook: (activity: Activity) => void;
  onBookInshore?: () => void;
  onOpenCart?: () => void;
}

const FISHING_OVERRIDES: Record<string, { price: number; priceSub: string }> = {
  'Inshore Fishing': { price: 300, priceSub: '' },
  'Reef Fishing': { price: 300, priceSub: '' },
  'Offshore Fishing': { price: 900, priceSub: '+$100/extra angler' },
  'Big Game Fishing': { price: 1200, priceSub: '+$150/extra angler' },
};

const fishingIcons: Record<string, { icon: string; lib: 'ion' | 'mci'; color: string; bgColor: string; subtitleKey: string; displayNameKey: string }> = {
  'Inshore Fishing': { icon: 'fish', lib: 'ion', color: '#2563EB', bgColor: '#EFF6FF', subtitleKey: 'inshore_subtitle', displayNameKey: 'inshore' },
  'Reef Fishing': { icon: 'fish', lib: 'ion', color: '#2563EB', bgColor: '#EFF6FF', subtitleKey: 'inshore_subtitle', displayNameKey: 'inshore' },
  'Offshore Fishing': { icon: 'boat', lib: 'ion', color: '#0369A1', bgColor: '#E0F2FE', subtitleKey: 'offshore_subtitle', displayNameKey: 'offshore' },
  'Big Game Fishing': { icon: 'trophy', lib: 'ion', color: '#D97706', bgColor: '#FEF3C7', subtitleKey: 'biggame_subtitle', displayNameKey: 'big_game' },
};

// ─── Calendar helper (same as BeachBookingCard) ───
const getCalendarMonths = (count: number) => {
  const months: { year: number; month: number; label: string; days: { day: number; date: string; isPast: boolean; isToday: boolean }[] }[] = [];
  const today = new Date();
  const locale = getLang() === 'es' ? 'es-ES' : 'en-US';
  for (let m = 0; m < count; m++) {
    const d = new Date(today.getFullYear(), today.getMonth() + m, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const label = d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = d.getDay();
    const days: { day: number; date: string; isPast: boolean; isToday: boolean }[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) days.push({ day: 0, date: '', isPast: true, isToday: false });
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isPast = dateObj < new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const isToday = dateObj.getTime() === new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      days.push({ day, date: dateStr, isPast, isToday });
    }
    months.push({ year, month, label, days });
  }
  return months;
};

export default function FishingDetailModal({ visible, fishingActivities, onClose, onBook, onBookInshore, onOpenCart }: FishingDetailModalProps) {
  const { t } = useLang();
  const { addItem } = useCart();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedDates, setSelectedDates] = useState<Record<number, string>>({});
  const [calendarMonths2, setCalendarMonths2] = useState<Record<number, number>>({});
  const [extraAnglers, setExtraAnglers] = useState<Record<number, number>>({});
  const [bookingError, setBookingError] = useState('');
  const [syncStatus, setSyncStatus] = useState<'loading' | 'synced' | 'error'>('loading');
  const [syncVer, setSyncVer] = useState(0);

  useEffect(() => {
    const unsub = subscribeSyncState(() => {
      setSyncVer(v => v + 1);
      setSyncStatus('synced');
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (visible) {
      setSyncStatus('loading');
      setSyncVer(v => v + 1);
      syncNow().then(() => {
        setSyncStatus('synced');
        setSyncVer(v => v + 1);
      }).catch(() => {
        setSyncStatus('error');
        setSyncVer(v => v + 1);
      });
    }
  }, [visible]);

  // ═══════════════════════════════════════════════════════════════
  // Get blocked fishing dates from syncService (single source of truth)
  // This is the SAME data the boat calendar uses
  // ═══════════════════════════════════════════════════════════════
  const blockedFishingMap = useMemo(() => {
    return getBlockedFishingDates();
  }, [syncVer]);

  // Clear selected dates that are now blocked
  useEffect(() => {
    setSelectedDates(prev => {
      const updated = { ...prev };
      let changed = false;
      for (const [actId, date] of Object.entries(updated)) {
        if (date && blockedFishingMap[date]) {
          delete updated[Number(actId)];
          changed = true;
        }
      }
      return changed ? updated : prev;
    });
  }, [blockedFishingMap]);

  const calendarData = getCalendarMonths(3);
  const calDays = [t('cal_su'), t('cal_mo'), t('cal_tu'), t('cal_we'), t('cal_th'), t('cal_fr'), t('cal_sa')];

  const isInshore = (name: string) => name === 'Inshore Fishing' || name === 'Reef Fishing';
  const isOffshoreOrBigGame = (name: string) => name === 'Offshore Fishing' || name === 'Big Game Fishing';

  const handleAddToCart = (activity: Activity) => {
    const override = FISHING_OVERRIDES[activity.name];
    const basePrice = override?.price || Number(activity.price) || 0;
    const date = selectedDates[activity.id] || '';
    if (!date) return;
    const extra = extraAnglers[activity.id] || 0;
    const totalAnglers = 1 + extra;
    const extraCost = activity.name === 'Big Game Fishing' ? extra * 150 : extra * 100;
    const total = basePrice + extraCost;

    // SAFETY CHECK 1: blocked fishing dates
    const freshBlocked = getBlockedFishingDates();
    if (freshBlocked[date]) {
      setBookingError(`This date is blocked: ${freshBlocked[date]}`);
      return;
    }

    // SAFETY CHECK 2: check overnight
    const dayCap = getDayCapacity(date);
    if (dayCap.overnightBooked) {
      setBookingError('This date has an overnight booking — cannot book fishing.');
      return;
    }

    // SAFETY CHECK 3: capacity service check
    const fishCheck = checkFishingCapacity(date, totalAnglers, activity.name);
    if (!fishCheck.canBook) {
      setBookingError(fishCheck.message);
      return;
    }

    setBookingError('');

    const extraStr = extra > 0 ? ` + ${extra} extra angler${extra > 1 ? 's' : ''}` : '';

    addItem({
      id: `fishing-${activity.id}-${date}-${Date.now()}`,
      type: 'activity',
      name: `${activity.name}${extraStr} - ${date}`,
      price: total,
      quantity: 1,
      date,
      participants: totalAnglers,
      image_url: activity.image_url,
    });

    if (onOpenCart) onOpenCart();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.overlay}>
        <View style={s.container}>
          <View style={s.handle} />
          <View style={s.header}>
            <View style={s.headerLeft}>
              <View style={s.headerIcon}><MaterialCommunityIcons name="fish" size={24} color="#fff" /></View>
              <View><Text style={s.title}>{t('tab_fishing')}</Text><Text style={s.subtitle}>{t('fishing_intro')}</Text></View>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}><Ionicons name="close" size={22} color="#64748B" /></TouchableOpacity>
          </View>

          <ScrollView style={s.body} showsVerticalScrollIndicator={false}>
            {/* Sync status */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: syncStatus === 'synced' ? '#F0FDF4' : syncStatus === 'loading' ? '#FFF7ED' : '#FEF2F2',
              borderRadius: 8, padding: 8, marginBottom: 8,
              borderWidth: 1,
              borderColor: syncStatus === 'synced' ? '#BBF7D0' : syncStatus === 'loading' ? '#FED7AA' : '#FECACA',
            }}>
              <Ionicons
                name={syncStatus === 'synced' ? 'checkmark-circle' : syncStatus === 'loading' ? 'sync' : 'alert-circle'}
                size={14}
                color={syncStatus === 'synced' ? '#16A34A' : syncStatus === 'loading' ? '#EA580C' : '#DC2626'}
              />
              <Text style={{
                fontSize: 10, fontWeight: '600',
                color: syncStatus === 'synced' ? '#16A34A' : syncStatus === 'loading' ? '#EA580C' : '#DC2626',
              }}>
                {syncStatus === 'synced' ? 'Availability data synced' : syncStatus === 'loading' ? 'Syncing availability...' : 'Sync failed — using cached data'}
              </Text>
            </View>

            {/* Info banners */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#BFDBFE' }}>
              <Ionicons name="location" size={16} color="#2563EB" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#1E40AF' }}>All fishing departs from Coco Loco</Text>
                <Text style={{ fontSize: 11, color: '#1E40AF', marginTop: 3, lineHeight: 16 }}>
                  Any fishing trip reserves Loco for the fishing day AND the next day. No other tourists or overnights at Loco during this time.
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#F0FDF4', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#BBF7D0' }}>
              <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: '#166534', lineHeight: 16 }}>
                  Max 1 fishing trip per day, max {FISHING_MAX_ANGLERS} anglers. Calendar shows boat availability — only free dates can be selected.
                </Text>
              </View>
            </View>

            {fishingActivities.map((activity) => {
              const cfg = fishingIcons[activity.name] || fishingIcons['Inshore Fishing'];
              const override = FISHING_OVERRIDES[activity.name];
              const price = override?.price || Number(activity.price) || 0;
              const isExpanded = expandedId === activity.id;
              const inshore = isInshore(activity.name);
              const offBig = isOffshoreOrBigGame(activity.name);
              const curMonth = calendarMonths2[activity.id] || 0;
              const curDate = selectedDates[activity.id] || '';
              const extra = extraAnglers[activity.id] || 0;
              const extraCost = activity.name === 'Big Game Fishing' ? extra * 150 : extra * 100;
              const totalAnglers = 1 + extra;

              const dateFishCheck = curDate ? checkFishingCapacity(curDate, totalAnglers, activity.name) : null;

              return (
                <View key={activity.id} style={[s.card, isExpanded && { borderColor: cfg.color }]}>
                  <TouchableOpacity style={s.cardHeader} onPress={() => { setExpandedId(isExpanded ? null : activity.id); setBookingError(''); }} activeOpacity={0.7}>
                    <View style={[s.iconCircle, { backgroundColor: cfg.bgColor }]}>
                      {cfg.lib === 'ion' ? <Ionicons name={cfg.icon as any} size={22} color={cfg.color} /> : <MaterialCommunityIcons name={cfg.icon as any} size={22} color={cfg.color} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle}>{t(cfg.displayNameKey)}</Text>
                      <Text style={s.cardSub}>{t(cfg.subtitleKey)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[s.cardPrice, { color: cfg.color }]}>${price}</Text>
                      {override?.priceSub ? <Text style={s.cardPriceSub}>{override.priceSub}</Text> : null}
                    </View>
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#94A3B8" style={{ marginLeft: 8 }} />
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={s.cardBody}>
                      <Text style={s.desc}>{activity.description}</Text>

                      {/* INSHORE → redirect to boat booking */}
                      {inshore && (
                        <View>
                          <View style={s.inshoreNote}>
                            <Ionicons name="information-circle" size={16} color="#2563EB" />
                            <Text style={s.inshoreNoteText}>{t('inshore_note')}</Text>
                          </View>
                          <TouchableOpacity
                            style={[s.bookBtn, { backgroundColor: '#2563EB' }]}
                            onPress={() => { if (onBookInshore) onBookInshore(); onClose(); }}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="boat" size={18} color="#fff" />
                            <Text style={s.bookBtnText}>{t('book_with_boat')}</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* ═══════════════════════════════════════════════════════════
                          OFFSHORE / BIG GAME — SAME CALENDAR AS BOOK THE BOAT
                          Only whitelisted dates (no overnight, no fishing) are selectable
                         ═══════════════════════════════════════════════════════════ */}
                      {offBig && (
                        <View>
                          <View style={s.fishingLimitNote}>
                            <Ionicons name="information-circle" size={14} color="#0369A1" />
                            <Text style={s.fishingLimitText}>
                              Max {FISHING_MAX_GROUPS_PER_DAY} fishing group/day, max {FISHING_MAX_ANGLERS} anglers
                            </Text>
                          </View>

                          <Text style={s.sectionLabel}>{t('select_date')}</Text>
                          <View style={s.calContainer}>
                            {/* Month navigation */}
                            <View style={s.calNav}>
                              <TouchableOpacity
                                style={[s.calNavBtn, curMonth === 0 && { opacity: 0.3 }]}
                                onPress={() => setCalendarMonths2({ ...calendarMonths2, [activity.id]: Math.max(0, curMonth - 1) })}
                                disabled={curMonth === 0}
                              >
                                <Ionicons name="chevron-back" size={16} color="#0369A1" />
                              </TouchableOpacity>
                              <Text style={s.calMonthLabel}>{calendarData[curMonth]?.label}</Text>
                              <TouchableOpacity
                                style={[s.calNavBtn, curMonth >= 2 && { opacity: 0.3 }]}
                                onPress={() => setCalendarMonths2({ ...calendarMonths2, [activity.id]: Math.min(2, curMonth + 1) })}
                                disabled={curMonth >= 2}
                              >
                                <Ionicons name="chevron-forward" size={16} color="#0369A1" />
                              </TouchableOpacity>
                            </View>

                            {/* Weekday headers */}
                            <View style={s.calWeekRow}>
                              {calDays.map(d => <Text key={d} style={s.calWeekDay}>{d}</Text>)}
                            </View>

                            {/* ═══ CALENDAR DAYS — SAME AS BOAT CALENDAR ═══ */}
                            <View style={s.calDaysGrid}>
                              {calendarData[curMonth]?.days.map((day, idx) => {
                                if (day.day === 0) return <View key={`e-${idx}`} style={s.calDayCell} />;

                                const isSel = curDate === day.date;

                                // ─── READ THE SAME DATA AS BOAT CALENDAR ───
                                const dayCap = !day.isPast ? getDayCapacity(day.date) : null;
                                const locoLocked = !day.isPast ? isLocoBlockedByFishing(day.date) : false;
                                const dayCapColor = !day.isPast ? getCapacityColor(day.date) : undefined;
                                const hasOvernight = dayCap ? dayCap.overnightBooked : false;
                                const hasFishing = dayCap ? dayCap.fishingGroupsBooked > 0 : false;
                                const dayIsFull = dayCap ? dayCap.isFull : false;

                                // ─── FISHING BLOCKED MAP (same as boat calendar) ───
                                const fishingBlockReason = !day.isPast ? blockedFishingMap[day.date] : undefined;
                                const hasFishingBlock = !!fishingBlockReason;

                                // ═══════════════════════════════════════════════
                                // WHITELIST LOGIC:
                                // A date is AVAILABLE only if:
                                //   1. Not past
                                //   2. No overnight booked
                                //   3. No fishing block (no fishing on this day,
                                //      no 2-day lock from adjacent days)
                                // Everything else is BLOCKED (shown but not selectable)
                                // ═══════════════════════════════════════════════
                                const isWhitelisted = !day.isPast && !hasOvernight && !hasFishingBlock;
                                const isDisabled = day.isPast || !isWhitelisted;

                                // Determine block reason for UI
                                let blockReason = '';
                                if (!day.isPast && !isWhitelisted) {
                                  if (hasFishingBlock) blockReason = fishingBlockReason || 'Fishing conflict';
                                  else if (hasOvernight) blockReason = 'Overnight booked';
                                }

                                return (
                                  <TouchableOpacity
                                    key={day.date}
                                    style={[
                                      s.calDayCell,
                                      // Selected
                                      isSel && isWhitelisted && { backgroundColor: cfg.color, borderRadius: 10 },
                                      // Today
                                      day.isToday && !isSel && isWhitelisted && { backgroundColor: '#F0FDFA', borderRadius: 10 },
                                      // Fishing blocked — red tint (same as boat calendar)
                                      hasFishingBlock && !day.isPast && { backgroundColor: '#FEE2E2', borderRadius: 10 },
                                      // Loco locked (fishing lock) — red tint
                                      !hasFishingBlock && locoLocked && !isSel && !day.isPast && { backgroundColor: '#FEF2F2', borderRadius: 10 },
                                      // Overnight — purple tint
                                      !hasFishingBlock && !locoLocked && hasOvernight && !day.isPast && { backgroundColor: '#F5F3FF', borderRadius: 10 },
                                    ]}
                                    onPress={() => {
                                      if (isDisabled) {
                                        if (blockReason) {
                                          setBookingError(`${day.date}: ${blockReason}`);
                                        }
                                        return;
                                      }
                                      setSelectedDates({ ...selectedDates, [activity.id]: day.date });
                                      setBookingError('');
                                    }}
                                    disabled={isDisabled}
                                  >
                                    <Text style={[
                                      s.calDayText,
                                      isSel && isWhitelisted && { color: '#fff', fontWeight: '800' },
                                      day.isPast && { color: '#CBD5E1' },
                                      day.isToday && !isSel && isWhitelisted && { color: '#0D9488', fontWeight: '800' },
                                      // Fishing blocked — red strikethrough
                                      hasFishingBlock && !day.isPast && { color: '#DC2626', fontWeight: '800', textDecorationLine: 'line-through' },
                                      // Loco locked
                                      !hasFishingBlock && locoLocked && !isSel && !day.isPast && { color: '#DC2626', fontWeight: '700' },
                                      // Overnight — purple
                                      !hasFishingBlock && !locoLocked && hasOvernight && !day.isPast && { color: '#7C3AED', fontWeight: '700' },
                                      // Full
                                      !hasFishingBlock && !locoLocked && !hasOvernight && dayIsFull && !isSel && !day.isPast && { color: '#EF4444' },
                                    ]}>
                                      {day.day}
                                    </Text>

                                    {/* Fishing lock indicator — red dot */}
                                    {(hasFishingBlock || locoLocked) && !day.isPast && (
                                      <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#DC2626', marginTop: 1 }} />
                                    )}
                                    {/* Overnight indicator — purple dot */}
                                    {!hasFishingBlock && !locoLocked && hasOvernight && !day.isPast && (
                                      <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#7C3AED', marginTop: 1 }} />
                                    )}
                                    {/* Capacity dot (same as boat calendar) */}
                                    {!hasFishingBlock && !locoLocked && !hasOvernight && dayCap && dayCap.bookedPersons > 0 && !day.isPast && (
                                      <View style={{
                                        width: 5, height: 5, borderRadius: 2.5,
                                        backgroundColor: isSel ? '#fff' : dayCapColor,
                                        marginTop: 1,
                                      }} />
                                    )}
                                  </TouchableOpacity>
                                );
                              })}
                            </View>

                            {/* Legend — same as boat calendar + fishing-specific */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap', paddingHorizontal: 4 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#10B981' }} />
                                <Text style={{ fontSize: 9, color: '#64748B' }}>Available</Text>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#F59E0B' }} />
                                <Text style={{ fontSize: 9, color: '#64748B' }}>Filling up</Text>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#DC2626' }} />
                                <Text style={{ fontSize: 9, color: '#64748B' }}>Fishing/Locked</Text>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#7C3AED' }} />
                                <Text style={{ fontSize: 9, color: '#64748B' }}>Overnight</Text>
                              </View>
                            </View>

                            {/* Selected date badge */}
                            {curDate ? (
                              <View style={[s.selectedBadge, { backgroundColor: cfg.bgColor }]}>
                                <Ionicons name="calendar" size={14} color={cfg.color} />
                                <Text style={[s.selectedBadgeText, { color: cfg.color }]}>{curDate}</Text>
                              </View>
                            ) : null}
                          </View>

                          {/* Capacity info for selected date */}
                          {curDate && dateFishCheck && (
                            <View style={{
                              flexDirection: 'row', alignItems: 'center', gap: 8,
                              backgroundColor: dateFishCheck.canBook ? '#F0FDF4' : '#FEF2F2',
                              borderRadius: 10, padding: 10, marginTop: 8,
                              borderWidth: 1,
                              borderColor: dateFishCheck.canBook ? '#BBF7D0' : '#FECACA',
                            }}>
                              <Ionicons
                                name={dateFishCheck.canBook ? 'checkmark-circle' : 'close-circle'}
                                size={18}
                                color={dateFishCheck.canBook ? '#16A34A' : '#DC2626'}
                              />
                              <View style={{ flex: 1 }}>
                                <Text style={{
                                  fontSize: 11, fontWeight: '600',
                                  color: dateFishCheck.canBook ? '#16A34A' : '#DC2626',
                                }}>
                                  {dateFishCheck.canBook
                                    ? `Fishing available! ${totalAnglers} angler${totalAnglers > 1 ? 's' : ''} on this trip.`
                                    : dateFishCheck.message
                                  }
                                </Text>
                              </View>
                            </View>
                          )}

                          {/* Extra anglers */}
                          <Text style={s.sectionLabel}>{t('number_of_anglers')}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                            <Ionicons name="people" size={12} color="#64748B" />
                            <Text style={{ fontSize: 10, color: '#64748B' }}>Max {FISHING_MAX_ANGLERS} anglers per group</Text>
                          </View>
                          <View style={s.anglerRow}>
                            <TouchableOpacity style={s.anglerBtn} onPress={() => setExtraAnglers({ ...extraAnglers, [activity.id]: Math.max(0, extra - 1) })}><Ionicons name="remove" size={16} color={cfg.color} /></TouchableOpacity>
                            <Text style={s.anglerNum}>{extra}</Text>
                            <TouchableOpacity
                              style={[s.anglerBtn, (1 + extra) >= FISHING_MAX_ANGLERS && { opacity: 0.3 }]}
                              onPress={() => setExtraAnglers({ ...extraAnglers, [activity.id]: Math.min(FISHING_MAX_ANGLERS - 1, extra + 1) })}
                              disabled={(1 + extra) >= FISHING_MAX_ANGLERS}
                            >
                              <Ionicons name="add" size={16} color={cfg.color} />
                            </TouchableOpacity>
                            {extra > 0 && <Text style={s.anglerCost}>+${extraCost}</Text>}
                            <Text style={{ fontSize: 10, color: '#94A3B8', marginLeft: 'auto' }}>
                              {totalAnglers}/{FISHING_MAX_ANGLERS} anglers
                            </Text>
                          </View>

                          {/* Booking error */}
                          {bookingError ? (
                            <View style={{
                              flexDirection: 'row', alignItems: 'center', gap: 6,
                              backgroundColor: '#FEF2F2', borderRadius: 10, padding: 10, marginBottom: 8,
                              borderWidth: 1, borderColor: '#FECACA',
                            }}>
                              <Ionicons name="close-circle" size={16} color="#DC2626" />
                              <Text style={{ fontSize: 11, color: '#DC2626', flex: 1, fontWeight: '600' }}>{bookingError}</Text>
                            </View>
                          ) : null}

                          {/* Total + Add to Cart */}
                          <View style={[s.totalRow, { backgroundColor: cfg.bgColor }]}>
                            <Text style={[s.totalLabel, { color: cfg.color }]}>{t('trip_total')}</Text>
                            <Text style={[s.totalPrice, { color: cfg.color }]}>${price + extraCost}</Text>
                          </View>

                          <TouchableOpacity
                            style={[s.bookBtn, {
                              backgroundColor: cfg.color,
                              opacity: curDate && (dateFishCheck?.canBook !== false) ? 1 : 0.4,
                            }]}
                            onPress={() => curDate && handleAddToCart(activity)}
                            disabled={!curDate || dateFishCheck?.canBook === false}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="cart" size={18} color="#fff" />
                            <Text style={s.bookBtnText}>{t('add_to_cart')} — ${price + extraCost}</Text>
                          </TouchableOpacity>
                          {!curDate && <Text style={s.hint}>{t('select_date_first')}</Text>}
                        </View>
                      )}

                      {/* Equipment */}
                      {activity.equipment?.length > 0 && (
                        <View style={s.equipSection}>
                          <Text style={s.equipTitle}>{t('equipment_included')}</Text>
                          {activity.equipment.map((eq, i) => (
                            <View key={i} style={s.equipRow}><Ionicons name="checkmark-circle" size={14} color={cfg.color} /><Text style={s.equipText}>{eq}</Text></View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  container: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%', paddingBottom: 20 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#0369A1', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 20, paddingTop: 16 },

  card: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, borderWidth: 1.5, borderColor: '#E2E8F0', overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  iconCircle: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  cardSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  cardPrice: { fontSize: 20, fontWeight: '800' },
  cardPriceSub: { fontSize: 10, color: '#64748B', marginTop: 1 },

  cardBody: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  desc: { fontSize: 13, color: '#475569', lineHeight: 19, marginTop: 10, marginBottom: 12 },

  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginTop: 12, marginBottom: 8 },

  fishingLimitNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#E0F2FE', borderRadius: 10, padding: 8, marginBottom: 8,
    borderWidth: 1, borderColor: '#BAE6FD',
  },
  fishingLimitText: { fontSize: 11, color: '#0369A1', fontWeight: '600' },

  calContainer: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 10, marginBottom: 4 },
  calNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  calNavBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  calMonthLabel: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  calWeekRow: { flexDirection: 'row', marginBottom: 4 },
  calWeekDay: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '600', color: '#94A3B8' },
  calDaysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDayCell: { width: `${100/7}%` as any, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  calDayText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  selectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, padding: 8, marginTop: 8, alignSelf: 'flex-start' },
  selectedBadgeText: { fontSize: 12, fontWeight: '700' },

  anglerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  anglerBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F0F9FF', borderWidth: 1.5, borderColor: '#0369A1', alignItems: 'center', justifyContent: 'center' },
  anglerNum: { fontSize: 20, fontWeight: '800', color: '#0F172A', minWidth: 24, textAlign: 'center' },
  anglerCost: { fontSize: 13, fontWeight: '700', color: '#64748B' },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 10, padding: 12, marginBottom: 10 },
  totalLabel: { fontSize: 14, fontWeight: '700' },
  totalPrice: { fontSize: 22, fontWeight: '800' },

  bookBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, gap: 8, marginTop: 4 },
  bookBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  hint: { fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: 6 },

  inshoreNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#BFDBFE' },
  inshoreNoteText: { fontSize: 12, color: '#1E40AF', flex: 1, lineHeight: 18 },

  equipSection: { marginTop: 12, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 10 },
  equipTitle: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 },
  equipRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  equipText: { fontSize: 12, color: '#475569' },
});
