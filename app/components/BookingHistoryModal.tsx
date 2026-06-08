import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLang, getLang } from '../lib/i18n';
import { syncNow, isConfirmed, getLastSyncedTime } from '../lib/syncService';




export interface BookingRecord {
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
    category?: string; // 'boat', 'food', 'activity', 'fishing', 'overnight'
  }[];
  total: number;
  date: string; // ISO string of when booking was made
  emailSent: boolean;
  // Detailed breakdown
  boatDetails?: {
    beach: string;
    tripDate: string;
    adults: number;
    kidsUnder8: number;
    addons: string[];
    overnightNights?: number;
  };
}

interface BookingHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  bookings: BookingRecord[];
}

// ─── Parse item name to extract details ───
function categorizeItem(item: { name: string; price: number; quantity: number; date?: string | null }) {
  const name = item.name.toLowerCase();
  if (name.startsWith('boat to ')) return { ...item, category: 'boat' as const, icon: 'boat' as const, color: '#0D9488' };
  if (name.includes('fishing')) return { ...item, category: 'fishing' as const, icon: 'fish' as const, color: '#2563EB' };
  if (name.includes('island stay') || name.includes('overnight')) return { ...item, category: 'overnight' as const, icon: 'moon' as const, color: '#7C3AED' };
  if (name.includes('kayak') || name.includes('snorkel') || name.includes('surf') || name.includes('towing') || name.includes('sup') || name.includes('windsurf') || name.includes('transparent')) return { ...item, category: 'water' as const, icon: 'water' as const, color: '#0891B2' };
  if (name.includes('jungle') || name.includes('coconut') || name.includes('off-grid') || name.includes('chill') || name.includes('gym') || name.includes('workshop') || name.includes('trail')) return { ...item, category: 'island' as const, icon: 'leaf' as const, color: '#16A34A' };
  // Default to food
  return { ...item, category: 'food' as const, icon: 'restaurant' as const, color: '#EA580C' };
}

// ─── Parse boat item name for details ───
function parseBoatDetails(itemName: string): { beach: string; addons: string[] } {
  // "Boat to Coco Loco + Overnight x2 nights, Internet x1, Inshore Fishing"
  const parts = itemName.split(' + ');
  const beachPart = parts[0] || '';
  const beach = beachPart.replace('Boat to ', '');
  const addons = parts.length > 1 ? parts[1].split(', ') : [];
  return { beach, addons };
}

export default function BookingHistoryModal({ visible, onClose, bookings }: BookingHistoryModalProps) {
  const { t } = useLang();
  const sortedBookings = [...bookings].reverse(); // newest first
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ─── Online confirmation state ───
  const [syncing, setSyncing] = useState(false);
  const [confirmedMap, setConfirmedMap] = useState<Record<string, boolean>>({});
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  const locale = getLang() === 'es' ? 'es-ES' : 'en-US';

  // ─── Check confirmations against online sync.ini every time modal opens ───
  const checkConfirmations = useCallback(async () => {
    if (bookings.length === 0) return;
    
    setSyncing(true);
    try {
      // Force fresh sync from GitHub
      await syncNow();
      
      // Check each booking's confirmation number against the synced data
      const newMap: Record<string, boolean> = {};
      for (const booking of bookings) {
        if (booking.confirmationNumber) {
          newMap[booking.confirmationNumber] = isConfirmed(booking.confirmationNumber);
        }
      }
      setConfirmedMap(newMap);
      setLastSyncTime(getLastSyncedTime());
    } catch (err) {
      console.warn('[BookingHistory] Sync failed, using cached data:', err);
      // Still check against whatever data we have
      const newMap: Record<string, boolean> = {};
      for (const booking of bookings) {
        if (booking.confirmationNumber) {
          newMap[booking.confirmationNumber] = isConfirmed(booking.confirmationNumber);
        }
      }
      setConfirmedMap(newMap);
    } finally {
      setSyncing(false);
    }
  }, [bookings]);

  // Trigger check every time modal becomes visible
  useEffect(() => {
    if (visible) {
      checkConfirmations();
    }
  }, [visible, checkConfirmations]);

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const formatTripDate = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-');
      const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return d.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <Ionicons name="receipt-outline" size={20} color="#0D9488" />
              </View>
              <View>
                <Text style={styles.title}>{t('booking_history')}</Text>
                <Text style={styles.subtitle}>
                  {t('bookings_count', { count: bookings.length })}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Sync status bar */}
          {bookings.length > 0 && (
            <View style={styles.syncBar}>
              {syncing ? (
                <View style={styles.syncRow}>
                  <ActivityIndicator size="small" color="#0D9488" />
                  <Text style={styles.syncText}>{t('syncing_reservations')}</Text>
                </View>
              ) : (
                <View style={styles.syncRow}>
                  <Ionicons name="cloud-done-outline" size={14} color="#64748B" />
                  <Text style={styles.syncText}>
                    {lastSyncTime ? t('last_synced', { time: lastSyncTime }) : t('syncing')}
                  </Text>
                  <TouchableOpacity onPress={checkConfirmations} style={styles.refreshSyncBtn}>
                    <Ionicons name="refresh" size={14} color="#0D9488" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {sortedBookings.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="document-text-outline" size={48} color="#CBD5E1" />
                </View>
                <Text style={styles.emptyTitle}>{t('no_bookings')}</Text>
                <Text style={styles.emptyText}>
                  {t('no_bookings_sub')}
                </Text>
              </View>
            ) : (
              sortedBookings.map((booking) => {
                const isExpanded = expandedId === booking.id;
                const categorizedItems = booking.items.map(categorizeItem);
                const boatItems = categorizedItems.filter(i => i.category === 'boat');
                const foodItems = categorizedItems.filter(i => i.category === 'food');
                const waterItems = categorizedItems.filter(i => i.category === 'water');
                const islandItems = categorizedItems.filter(i => i.category === 'island');
                const fishingItems = categorizedItems.filter(i => i.category === 'fishing');
                const overnightItems = categorizedItems.filter(i => i.category === 'overnight');

                // Parse boat details from first boat item
                const boatDetail = boatItems.length > 0 ? parseBoatDetails(boatItems[0].name) : null;
                const tripDate = boatItems[0]?.date || booking.items.find(i => i.date)?.date;

                // Confirmation status from online sync check
                const isOnlineConfirmed = confirmedMap[booking.confirmationNumber] === true;
                const confirmationChecked = booking.confirmationNumber in confirmedMap;

                return (
                  <TouchableOpacity
                    key={booking.id}
                    style={styles.bookingCard}
                    onPress={() => setExpandedId(isExpanded ? null : booking.id)}
                    activeOpacity={0.7}
                  >
                    {/* Booking header with confirmation number */}
                    <View style={styles.bookingHeader}>
                      <View style={styles.confirmWrap}>
                        <Text style={styles.confirmNumber}>{booking.confirmationNumber}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.bookingName}>{booking.customerName}</Text>
                        <Text style={styles.bookingDate}>{formatDate(booking.date)}</Text>
                      </View>
                      <View style={styles.bookingTotalWrap}>
                        <Text style={styles.bookingTotalLabel}>{t('total')}</Text>
                        <Text style={styles.bookingTotal}>${booking.total.toFixed(2)}</Text>
                      </View>
                    </View>

                    {/* Quick summary row */}
                    <View style={styles.quickSummary}>
                      {boatDetail && (
                        <View style={styles.quickChip}>
                          <Ionicons name="boat" size={11} color="#0D9488" />
                          <Text style={styles.quickChipText}>{boatDetail.beach}</Text>
                        </View>
                      )}
                      {tripDate && (
                        <View style={styles.quickChip}>
                          <Ionicons name="calendar" size={11} color="#7C3AED" />
                          <Text style={styles.quickChipText}>{tripDate}</Text>
                        </View>
                      )}
                      {foodItems.length > 0 && (
                        <View style={styles.quickChip}>
                          <Ionicons name="restaurant" size={11} color="#EA580C" />
                          <Text style={styles.quickChipText}>{t('food_count', { count: foodItems.length })}</Text>
                        </View>
                      )}
                    </View>

                    {/* Status — based on ONLINE sync.ini confirmation check */}
                    <View style={styles.statusRow}>
                      {syncing ? (
                        <View style={[styles.statusBadge, styles.statusSyncing]}>
                          <ActivityIndicator size={10} color="#0D9488" />
                          <Text style={[styles.statusText, styles.statusTextSyncing]}>
                            {t('syncing')}
                          </Text>
                        </View>
                      ) : confirmationChecked ? (
                        isOnlineConfirmed ? (
                          <View style={[styles.statusBadge, styles.statusConfirmed]}>
                            <Ionicons name="checkmark-circle" size={12} color="#059669" />
                            <Text style={[styles.statusText, styles.statusTextConfirmed]}>
                              {t('confirmed_badge')}
                            </Text>
                          </View>
                        ) : (
                          <View style={[styles.statusBadge, styles.statusPending]}>
                            <Ionicons name="time" size={12} color="#D97706" />
                            <Text style={[styles.statusText, styles.statusTextPending]}>
                              {t('pending_badge')}
                            </Text>
                          </View>
                        )
                      ) : (
                        <View style={[styles.statusBadge, styles.statusPending]}>
                          <Ionicons name="time" size={12} color="#D97706" />
                          <Text style={[styles.statusText, styles.statusTextPending]}>
                            {t('pending_badge')}
                          </Text>
                        </View>
                      )}
                      <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#94A3B8" />
                    </View>

                    {/* ─── Expanded Details ─── */}
                    {isExpanded && (
                      <View style={styles.expandedSection}>
                        {/* Contact info */}
                        <View style={styles.contactRow}>
                          {booking.customerEmail ? (
                            <View style={styles.contactItem}>
                              <Ionicons name="mail-outline" size={13} color="#64748B" />
                              <Text style={styles.contactText} numberOfLines={1}>{booking.customerEmail}</Text>
                            </View>
                          ) : null}
                          {booking.customerWhatsapp ? (
                            <View style={styles.contactItem}>
                              <Ionicons name="logo-whatsapp" size={13} color="#25D366" />
                              <Text style={styles.contactText}>{booking.customerWhatsapp}</Text>
                            </View>
                          ) : null}
                        </View>

                        {/* ─── Confirmation status detail ─── */}
                        <View style={[
                          styles.confirmDetailBox,
                          isOnlineConfirmed ? styles.confirmDetailConfirmed : styles.confirmDetailPending
                        ]}>
                          <View style={styles.confirmDetailRow}>
                            <Ionicons
                              name={isOnlineConfirmed ? 'shield-checkmark' : 'shield-outline'}
                              size={16}
                              color={isOnlineConfirmed ? '#059669' : '#D97706'}
                            />
                            <View style={{ flex: 1, marginLeft: 8 }}>
                              <Text style={[
                                styles.confirmDetailTitle,
                                { color: isOnlineConfirmed ? '#059669' : '#D97706' }
                              ]}>
                                {isOnlineConfirmed ? t('reservation_confirmed') : t('reservation_pending')}
                              </Text>
                              <Text style={styles.confirmDetailSub}>
                                {isOnlineConfirmed
                                  ? (getLang() === 'es'
                                    ? `${booking.confirmationNumber} encontrado en sync.ini`
                                    : `${booking.confirmationNumber} found in sync.ini`)
                                  : (getLang() === 'es'
                                    ? `${booking.confirmationNumber} no encontrado en sync.ini aún`
                                    : `${booking.confirmationNumber} not found in sync.ini yet`)}
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* ─── Boat / Transport ─── */}
                        {boatItems.length > 0 && (
                          <View style={styles.detailSection}>
                            <View style={[styles.detailSectionHeader, { backgroundColor: '#F0FDFA' }]}>
                              <Ionicons name="boat" size={14} color="#0D9488" />
                              <Text style={[styles.detailSectionTitle, { color: '#0D9488' }]}>{t('boat_transfer')}</Text>
                            </View>
                            {boatItems.map((item, idx) => {
                              const detail = parseBoatDetails(item.name);
                              return (
                                <View key={idx} style={styles.detailItem}>
                                  <View style={styles.detailItemLeft}>
                                    <Text style={styles.detailItemName}>{detail.beach}</Text>
                                    {item.date && (
                                      <Text style={styles.detailItemDate}>{formatTripDate(item.date)}</Text>
                                    )}
                                    {detail.addons.length > 0 && (
                                      <View style={styles.addonsList}>
                                        {detail.addons.map((addon, ai) => (
                                          <View key={ai} style={styles.addonChip}>
                                            <Ionicons name="add-circle" size={10} color="#64748B" />
                                            <Text style={styles.addonChipText}>{addon}</Text>
                                          </View>
                                        ))}
                                      </View>
                                    )}
                                  </View>
                                  <Text style={styles.detailItemPrice}>${(item.price * item.quantity).toFixed(2)}</Text>
                                </View>
                              );
                            })}
                          </View>
                        )}

                        {/* ─── Overnight ─── */}
                        {overnightItems.length > 0 && (
                          <View style={styles.detailSection}>
                            <View style={[styles.detailSectionHeader, { backgroundColor: '#F5F3FF' }]}>
                              <MaterialCommunityIcons name="sleep" size={14} color="#7C3AED" />
                              <Text style={[styles.detailSectionTitle, { color: '#7C3AED' }]}>{t('overnight_stay_label')}</Text>
                            </View>
                            {overnightItems.map((item, idx) => (
                              <View key={idx} style={styles.detailItem}>
                                <View style={styles.detailItemLeft}>
                                  <Text style={styles.detailItemName}>{item.name}</Text>
                                  {item.date && <Text style={styles.detailItemDate}>{formatTripDate(item.date)}</Text>}
                                </View>
                                <Text style={styles.detailItemPrice}>${(item.price * item.quantity).toFixed(2)}</Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* ─── Fishing ─── */}
                        {fishingItems.length > 0 && (
                          <View style={styles.detailSection}>
                            <View style={[styles.detailSectionHeader, { backgroundColor: '#EFF6FF' }]}>
                              <Ionicons name="fish" size={14} color="#2563EB" />
                              <Text style={[styles.detailSectionTitle, { color: '#2563EB' }]}>{t('fishing_label')}</Text>
                            </View>
                            {fishingItems.map((item, idx) => (
                              <View key={idx} style={styles.detailItem}>
                                <View style={styles.detailItemLeft}>
                                  <Text style={styles.detailItemName}>{item.name}</Text>
                                  {item.date && <Text style={styles.detailItemDate}>{formatTripDate(item.date)}</Text>}
                                </View>
                                <Text style={styles.detailItemPrice}>${(item.price * item.quantity).toFixed(2)}</Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* ─── Water Activities ─── */}
                        {waterItems.length > 0 && (
                          <View style={styles.detailSection}>
                            <View style={[styles.detailSectionHeader, { backgroundColor: '#ECFEFF' }]}>
                              <Ionicons name="water" size={14} color="#0891B2" />
                              <Text style={[styles.detailSectionTitle, { color: '#0891B2' }]}>{t('water_activities_label')}</Text>
                            </View>
                            {waterItems.map((item, idx) => (
                              <View key={idx} style={styles.detailItem}>
                                <View style={styles.detailItemLeft}>
                                  <Text style={styles.detailItemName}>{item.name}</Text>
                                </View>
                                <Text style={styles.detailItemPrice}>
                                  {item.price === 0 ? t('free') : `$${(item.price * item.quantity).toFixed(2)}`}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* ─── Island Activities ─── */}
                        {islandItems.length > 0 && (
                          <View style={styles.detailSection}>
                            <View style={[styles.detailSectionHeader, { backgroundColor: '#F0FDF4' }]}>
                              <Ionicons name="leaf" size={14} color="#16A34A" />
                              <Text style={[styles.detailSectionTitle, { color: '#16A34A' }]}>{t('island_activities_label')}</Text>
                            </View>
                            {islandItems.map((item, idx) => (
                              <View key={idx} style={styles.detailItem}>
                                <View style={styles.detailItemLeft}>
                                  <Text style={styles.detailItemName}>{item.name}</Text>
                                </View>
                                <Text style={styles.detailItemPrice}>${(item.price * item.quantity).toFixed(2)}</Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* ─── Food Items ─── */}
                        {foodItems.length > 0 && (
                          <View style={styles.detailSection}>
                            <View style={[styles.detailSectionHeader, { backgroundColor: '#FFF7ED' }]}>
                              <Ionicons name="restaurant" size={14} color="#EA580C" />
                              <Text style={[styles.detailSectionTitle, { color: '#EA580C' }]}>{t('food_drinks_label')}</Text>
                            </View>
                            {foodItems.map((item, idx) => (
                              <View key={idx} style={styles.detailItem}>
                                <View style={styles.detailItemLeft}>
                                  <Text style={styles.detailItemName}>{item.name}</Text>
                                  {item.quantity > 1 && (
                                    <Text style={styles.detailItemDate}>x{item.quantity}</Text>
                                  )}
                                </View>
                                <Text style={styles.detailItemPrice}>${(item.price * item.quantity).toFixed(2)}</Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* ─── Total ─── */}
                        <View style={styles.totalSection}>
                          <Text style={styles.totalLabel}>{t('grand_total')}</Text>
                          <Text style={styles.totalValue}>${booking.total.toFixed(2)}</Text>
                        </View>

                        {/* Confirmation footer */}
                        <View style={styles.confirmFooter}>
                          <Ionicons name="shield-checkmark" size={14} color="#94A3B8" />
                          <Text style={styles.confirmFooterText}>
                            {t('confirmation')}: {booking.confirmationNumber}
                          </Text>
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sync status bar
  syncBar: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FAFBFC',
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
    flex: 1,
  },
  refreshSyncBtn: {
    padding: 4,
  },

  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#475569',
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 260,
    lineHeight: 20,
  },

  // Booking card
  bookingCard: {
    backgroundColor: '#FAFBFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  confirmWrap: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  confirmNumber: {
    color: '#5EEAD4',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  bookingName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  bookingDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  bookingTotalWrap: {
    alignItems: 'flex-end',
  },
  bookingTotalLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bookingTotal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0D9488',
  },

  // Quick summary chips
  quickSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },

  // Status
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statusConfirmed: {
    backgroundColor: '#D1FAE5',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusSyncing: {
    backgroundColor: '#F0FDFA',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statusTextConfirmed: {
    color: '#059669',
  },
  statusTextPending: {
    color: '#D97706',
  },
  statusTextSyncing: {
    color: '#0D9488',
  },

  // Expanded section
  expandedSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },

  // Contact
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  contactText: {
    fontSize: 12,
    color: '#64748B',
    maxWidth: 180,
  },

  // Confirmation detail box
  confirmDetailBox: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
  },
  confirmDetailConfirmed: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  confirmDetailPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  confirmDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  confirmDetailTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  confirmDetailSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Detail sections
  detailSection: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  detailSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  detailSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  detailItemLeft: {
    flex: 1,
    marginRight: 10,
  },
  detailItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  detailItemDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  detailItemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },

  // Addons list
  addonsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  addonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  addonChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0D9488',
  },

  // Total
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0D9488',
  },

  // Confirmation footer
  confirmFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  confirmFooterText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
