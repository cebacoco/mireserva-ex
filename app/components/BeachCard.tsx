import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Beach } from '../lib/types';
import { useLang } from '../lib/i18n';
import { getBeachTags } from '../lib/beachTags';
import {
  getBeachDayCapacity,
  getBeachCapacityColor,
  isLocoBlockedByFishing,
  getDayCapacity,
  BEACH_MAX_CAPACITY,
} from '../lib/capacityService';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width > 600 ? (width - 60) / 2 : width - 60;

interface BeachCardProps {
  beach: Beach;
  onPress: (beach: Beach) => void;
}

const amenityIcons: Record<string, string> = {
  shade: 'umbrella',
  food: 'restaurant',
  sports: 'football',
  snorkeling: 'fish',
  restrooms: 'water',
  lifeguard: 'shield-checkmark',
  hammocks: 'bed',
  wildlife: 'paw',
  surfing: 'boat',
  kayak: 'boat',
  sup: 'boat',
  meditation: 'flower',
  watersports: 'water',
};

function getPrivacyColor(score: number): string {
  if (score >= 80) return '#10B981';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
}

function getPrivacyLabel(score: number): string {
  if (score >= 80) return 'Very Private';
  if (score >= 50) return 'Moderate';
  return 'Social';
}

function isLocoBeachName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes('loco');
}

/**
 * Normalize beach name to a consistent key (same as capacityService)
 */
function normalizeBeachKey(beachName: string): string {
  return beachName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

/**
 * Map beach display name to the sync.ini beach key
 */
function getBeachSyncKey(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('loco')) return 'coco_loco';
  if (lower.includes('privado')) return 'coco_privado';
  if (lower.includes('blanco')) return 'coco_blanco';
  if (lower.includes('escondido')) return 'coco_escondido';
  if (lower.includes('doble')) return 'coco_doble';
  if (lower.includes('cristal')) return 'coco_cristal';
  return name.toLowerCase().replace(/\s+/g, '_');
}


// ─── Get next N days starting from today ───
function getUpcomingDays(count: number): { date: string; label: string; dayName: string }[] {
  const days: { date: string; label: string; dayName: string }[] = [];
  const today = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = 0; i < count; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const label = `${monthNames[d.getMonth()]} ${d.getDate()}`;
    const dayName = i === 0 ? 'Today' : i === 1 ? 'Tmrw' : dayNames[d.getDay()];
    days.push({ date: dateStr, label, dayName });
  }
  return days;
}

export default function BeachCard({ beach, onPress }: BeachCardProps) {
  const privacyColor = getPrivacyColor(beach.privacy_score);
  const { t } = useLang();
  const tags = getBeachTags(beach.name);
  const isLoco = isLocoBeachName(beach.name);
  const beachSyncKey = getBeachSyncKey(beach.name);

  // Get upcoming 7 days capacity for THIS beach
  const upcomingDays = getUpcomingDays(7);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(beach)}
      activeOpacity={0.85}
    >
      <Image source={{ uri: beach.image_url }} style={styles.image} />
      
      <View style={styles.islandBadge}>
        <Ionicons name="location" size={12} color="#fff" />
        <Text style={styles.islandText}>
          {beach.island === 'Cristal' ? 'Isla Cristal' : 'Isla Coco'}
        </Text>
      </View>

      <View style={styles.privacyBadge}>
        <View style={[styles.privacyDot, { backgroundColor: privacyColor }]} />
        <Text style={[styles.privacyText, { color: privacyColor }]}>
          {beach.privacy_score}% {getPrivacyLabel(beach.privacy_score)}
        </Text>
      </View>

      {/* Fishing home badge for Loco Beach */}
      {isLoco && (
        <View style={styles.fishingHomeBadge}>
          <Ionicons name="fish" size={10} color="#fff" />
          <Text style={styles.fishingHomeText}>Fishing Base</Text>
        </View>
      )}

      <View style={styles.content}>
        <Text style={styles.name}>{beach.name}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {beach.description}
        </Text>

        {/* Beach Tags */}
        {tags.length > 0 && (
          <View style={styles.tagsRow}>
            {tags.map((tag, idx) => (
              <View key={idx} style={[styles.tagChip, { backgroundColor: tag.bgColor }]}>
                <Ionicons name={tag.icon as any} size={11} color={tag.color} />
                <Text style={[styles.tagText, { color: tag.color }]}>{t(tag.key)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ─── Per-Beach Capacity (10 spots per beach) ─── */}
        <View style={styles.capacityContainer}>
          <View style={styles.capacityHeader}>
            <Ionicons name="people-outline" size={14} color="#0D9488" />
            <Text style={styles.capacityTitle}>
              {beach.name} — {t('availability') || 'Availability'}
            </Text>
            <Text style={styles.capacityMax}>
              max {BEACH_MAX_CAPACITY} spots
            </Text>
          </View>

          {/* 7-day mini calendar with per-beach capacity */}
          <View style={styles.daysRow}>
            {upcomingDays.map((day) => {
              const beachCap = getBeachDayCapacity(day.date, beachSyncKey);
              const color = getBeachCapacityColor(day.date, beachSyncKey);
              const fillPercent = beachCap.capacityPercent;
              const locoBlocked = isLoco && isLocoBlockedByFishing(day.date);
              const dayCap = getDayCapacity(day.date);
              const hasOvernight = dayCap.overnightBooked;
              // Check if THIS beach has overnight guests on this day
              const beachHasOvernight = dayCap.overnightInfos.some(
                o => normalizeBeachKey(o.beach) === normalizeBeachKey(beachSyncKey)
              );

              return (
                <View key={day.date} style={styles.dayCell}>
                  <Text style={styles.dayName}>{day.dayName}</Text>
                  
                  {/* Capacity bar (vertical) */}
                  <View style={[styles.dayBarOuter, locoBlocked && { borderWidth: 1, borderColor: '#EF4444' }]}>
                    {locoBlocked ? (
                      <View style={[styles.dayBarFill, { height: '100%', backgroundColor: '#FCA5A5' }]} />
                    ) : (
                      <View
                        style={[
                          styles.dayBarFill,
                          {
                            height: `${fillPercent}%`,
                            backgroundColor: color,
                          },
                        ]}
                      />
                    )}
                  </View>

                  {/* Count or blocked indicator */}
                  {locoBlocked ? (
                    <Ionicons name="lock-closed" size={9} color="#EF4444" />
                  ) : (
                    <Text style={[
                      styles.dayCount,
                      beachCap.isFull && { color: '#EF4444', fontWeight: '800' },
                      beachCap.bookedPersons === 0 && { color: '#10B981' },
                      beachCap.bookedPersons > 0 && !beachCap.isFull && { color },
                    ]}>
                      {beachCap.bookedPersons > 0 ? `${beachCap.bookedPersons}` : '-'}
                    </Text>
                  )}

                  {/* Overnight indicator */}
                  {beachHasOvernight && !locoBlocked && (
                    <View style={styles.overnightDot}>
                      <Ionicons name="moon" size={7} color="#7C3AED" />
                    </View>
                  )}

                  {/* Fishing indicator (for non-Loco beaches, show if fishing is booked that day) */}
                  {!isLoco && !beachHasOvernight && (() => {
                    return dayCap.fishingGroupsBooked > 0 ? (
                      <View style={styles.fishingDot}>
                        <Ionicons name="fish" size={8} color="#2563EB" />
                      </View>
                    ) : null;
                  })()}
                </View>
              );
            })}
          </View>

          {/* Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.legendText}>{t('available') || 'Free'}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.legendText}>{t('filling') || 'Filling'}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.legendText}>{t('full') || 'Full'}</Text>
            </View>
            {isLoco && (
              <View style={styles.legendItem}>
                <Ionicons name="lock-closed" size={8} color="#EF4444" />
                <Text style={styles.legendText}>Fishing</Text>
              </View>
            )}
            <View style={styles.legendItem}>
              <Ionicons name="moon" size={7} color="#7C3AED" />
              <Text style={styles.legendText}>Overnight</Text>
            </View>
          </View>

          {/* Loco Beach fishing note */}
          {isLoco && (
            <View style={styles.locoFishingNote}>
              <Ionicons name="information-circle" size={12} color="#2563EB" />
              <Text style={styles.locoFishingNoteText}>
                All fishing trips depart from this beach. Any fishing (inshore, offshore, big game) reserves Loco for the fishing day + next day. Plain overnights (no fishing) do not block Loco — it stays open for day visitors.
              </Text>
            </View>
          )}

        </View>


        <View style={styles.amenitiesRow}>
          {beach.amenities.slice(0, 5).map((amenity, idx) => (
            <View key={idx} style={styles.amenityChip}>
              <Ionicons
                name={(amenityIcons[amenity] || 'ellipse') as any}
                size={12}
                color="#0D9488"
              />
              <Text style={styles.amenityText}>{amenity}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <View style={styles.pangaStatus}>
            <Ionicons
              name={beach.panga_available ? 'checkmark-circle' : 'close-circle'}
              size={16}
              color={beach.panga_available ? '#10B981' : '#EF4444'}
            />
            <Text
              style={[
                styles.pangaText,
                { color: beach.panga_available ? '#10B981' : '#EF4444' },
              ]}
            >
              Panga {beach.panga_available ? 'Available' : 'Unavailable'}
            </Text>
          </View>
          {beach.panga_available && (
            <Text style={styles.scheduleText}>{beach.panga_schedule}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 20,
    marginRight: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 180,
  },
  islandBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13,148,136,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  islandText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  privacyBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  privacyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  privacyText: {
    fontSize: 11,
    fontWeight: '700',
  },
  fishingHomeBadge: {
    position: 'absolute',
    top: 42,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(37,99,235,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  fishingHomeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  content: {
    padding: 16,
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  description: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 10,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 12,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  capacityContainer: {
    marginBottom: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  capacityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  capacityTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D9488',
    flex: 1,
  },
  capacityMax: {
    fontSize: 8,
    color: '#94A3B8',
    fontWeight: '600',
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 2,
    marginBottom: 6,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  dayName: {
    fontSize: 8,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dayBarOuter: {
    width: 14,
    height: 28,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  dayBarFill: {
    width: '100%',
    borderRadius: 4,
  },
  dayCount: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
  },
  fishingDot: {
    position: 'absolute',
    top: -1,
    right: 0,
  },
  overnightDot: {
    position: 'absolute',
    top: -1,
    right: 0,
  },

  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  legendDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  legendText: {
    fontSize: 8,
    color: '#94A3B8',
    fontWeight: '600',
  },
  locoFishingNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginTop: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  locoFishingNoteText: {
    fontSize: 8,
    color: '#1E40AF',
    flex: 1,
    lineHeight: 12,
  },
  amenitiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  amenityText: {
    fontSize: 11,
    color: '#0D9488',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  pangaStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pangaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scheduleText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    marginLeft: 22,
  },
});
