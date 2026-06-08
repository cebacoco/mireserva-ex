import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  ScrollView,
  Platform,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Beach } from '../lib/types';
import { useCart } from '../lib/cartStore';
import { useLang } from '../lib/i18n';
import { getBeachTags } from '../lib/beachTags';

interface BeachDetailModalProps {
  visible: boolean;
  beach: Beach | null;
  beaches?: Beach[];
  onClose: () => void;
  preselectedForBooking?: boolean;
}

function getPrivacyColor(score: number): string {
  if (score >= 80) return '#10B981';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
}

const amenityDetails: Record<string, { icon: string; label: string }> = {
  shade: { icon: 'umbrella', label: 'Shade Available' },
  food: { icon: 'restaurant', label: 'Food & Drinks' },
  sports: { icon: 'football', label: 'Sports Equipment' },
  snorkeling: { icon: 'fish', label: 'Snorkeling Gear' },
  restrooms: { icon: 'water', label: 'Restrooms' },
  lifeguard: { icon: 'shield-checkmark', label: 'Lifeguard on Duty' },
  hammocks: { icon: 'bed', label: 'Hammocks' },
  wildlife: { icon: 'paw', label: 'Wildlife Viewing' },
  surfing: { icon: 'boat', label: 'Surf Spot' },
  kayak: { icon: 'boat', label: 'Kayak Rental' },
  sup: { icon: 'boat', label: 'SUP Rental' },
  meditation: { icon: 'flower', label: 'Meditation Area' },
  watersports: { icon: 'water', label: 'Water Sports Hub' },
};

const getNextDays = (count: number): { label: string; value: string }[] => {
  const days = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    days.push({ label, value: d.toISOString().split('T')[0] });
  }
  return days;
};

export default function BeachDetailModal({ visible, beach, beaches, onClose, preselectedForBooking }: BeachDetailModalProps) {
  const { addItem } = useCart();
  const { t } = useLang();
  const [showBooking, setShowBooking] = useState(preselectedForBooking || false);
  const [selectedBeachId, setSelectedBeachId] = useState<number | null>(beach?.id || null);
  const [selectedDate, setSelectedDate] = useState(0);
  const [participants, setParticipants] = useState(2);
  const [guestName, setGuestName] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Reset state when modal opens
  React.useEffect(() => {
    if (visible) {
      setSelectedBeachId(beach?.id || null);
      setShowBooking(preselectedForBooking || false);
      setBookingSuccess(false);
    }
  }, [visible, beach, preselectedForBooking]);

  if (!beach && !showBooking) return null;

  const days = getNextDays(7);
  const currentBeach = beach || (beaches || []).find(b => b.id === selectedBeachId) || null;
  const occupancyPercent = currentBeach ? Math.round((currentBeach.current_occupancy / currentBeach.capacity) * 100) : 0;
  const privacyColor = currentBeach ? getPrivacyColor(currentBeach.privacy_score) : '#94A3B8';
  const beachTags = currentBeach ? getBeachTags(currentBeach.name) : [];

  const handleBookBeach = () => {

    if (!selectedBeachId) {
      Alert.alert('Select Beach', 'Please select a beach first.');
      return;
    }
    if (!guestName.trim()) {
      Alert.alert('Name Required', 'Please enter your name.');
      return;
    }
    const selectedBeach = (beaches || []).find(b => b.id === selectedBeachId) || currentBeach;
    addItem({
      id: `boat-${selectedBeachId}-${days[selectedDate].value}-${Date.now()}`,
      type: 'activity',
      name: `Boat to ${selectedBeach.name} - ${days[selectedDate].label}`,
      price: 0,
      quantity: participants,
      date: days[selectedDate].value,
      participants,
      image_url: selectedBeach.image_url,
    });


    setBookingSuccess(true);
    setTimeout(() => {
      setBookingSuccess(false);
      setShowBooking(false);
      onClose();
    }, 1500);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {currentBeach && (
              <>
                <Image source={{ uri: currentBeach.image_url }} style={styles.heroImage} />
                
                <TouchableOpacity onPress={onClose} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={22} color="#fff" />
                </TouchableOpacity>

                <View style={styles.content}>
                  <View style={styles.header}>
                    <View style={styles.islandBadge}>
                      <Ionicons name="location" size={12} color="#0D9488" />
                      <Text style={styles.islandText}>
                        {currentBeach.island === 'Cristal' ? 'Isla Cristal' : 'Isla Coco'}
                      </Text>
                    </View>
                    <Text style={styles.name}>{currentBeach.name}</Text>
                    <Text style={styles.description}>{currentBeach.description}</Text>

                    {/* Beach Tags */}
                    {beachTags.length > 0 && (
                      <View style={styles.tagsRow}>
                        {beachTags.map((tag, idx) => (
                          <View key={idx} style={[styles.tagChip, { backgroundColor: tag.bgColor }]}>
                            <Ionicons name={tag.icon as any} size={13} color={tag.color} />
                            <Text style={[styles.tagText, { color: tag.color }]}>{t(tag.key)}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Privacy & Occupancy */}
                  <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                      <View style={[styles.statCircle, { borderColor: privacyColor }]}>
                        <Text style={[styles.statCircleText, { color: privacyColor }]}>
                          {currentBeach.privacy_score}%
                        </Text>
                      </View>
                      <Text style={styles.statCardLabel}>Privacy Score</Text>
                    </View>
                    <View style={styles.statCard}>
                      <View style={[styles.statCircle, { borderColor: getPrivacyColor(100 - occupancyPercent) }]}>
                        <Text style={[styles.statCircleText, { color: getPrivacyColor(100 - occupancyPercent) }]}>
                          {currentBeach.current_occupancy}
                        </Text>
                      </View>
                      <Text style={styles.statCardLabel}>Current Guests</Text>
                    </View>
                    <View style={styles.statCard}>
                      <View style={[styles.statCircle, { borderColor: '#6366F1' }]}>
                        <Text style={[styles.statCircleText, { color: '#6366F1' }]}>
                          {currentBeach.capacity}
                        </Text>
                      </View>
                      <Text style={styles.statCardLabel}>Max Capacity</Text>
                    </View>
                  </View>

                  {/* Occupancy bar */}
                  <View style={styles.occupancySection}>
                    <Text style={styles.sectionTitle}>Current Occupancy</Text>
                    <View style={styles.occupancyBarBg}>
                      <View
                        style={[
                          styles.occupancyBarFill,
                          {
                            width: `${occupancyPercent}%`,
                            backgroundColor: getPrivacyColor(100 - occupancyPercent),
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.occupancyText}>{occupancyPercent}% full</Text>
                  </View>

                  {/* Amenities */}
                  <Text style={styles.sectionTitle}>Amenities</Text>
                  <View style={styles.amenitiesGrid}>
                    {currentBeach.amenities.map((amenity, idx) => {
                      const detail = amenityDetails[amenity] || { icon: 'ellipse', label: amenity };
                      return (
                        <View key={idx} style={styles.amenityItem}>
                          <View style={styles.amenityIcon}>
                            <Ionicons name={detail.icon as any} size={20} color="#0D9488" />
                          </View>
                          <Text style={styles.amenityLabel}>{detail.label}</Text>
                        </View>
                      );
                    })}
                  </View>

                  {/* Panga Info */}
                  <View style={styles.pangaCard}>
                    <View style={styles.pangaHeader}>
                      <Ionicons name="boat" size={24} color={currentBeach.panga_available ? '#0D9488' : '#94A3B8'} />
                      <View style={{ marginLeft: 12 }}>
                        <Text style={styles.pangaTitle}>Panga Shuttle</Text>
                        <Text style={[styles.pangaStatus, { color: currentBeach.panga_available ? '#10B981' : '#EF4444' }]}>
                          {currentBeach.panga_available ? 'Available' : 'Not Available'}
                        </Text>
                      </View>
                    </View>
                    {currentBeach.panga_available && (
                      <View style={styles.pangaSchedule}>
                        <Ionicons name="time-outline" size={14} color="#64748B" />
                        <Text style={styles.pangaScheduleText}>{currentBeach.panga_schedule}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </>
            )}

            {/* Booking Section */}
            {showBooking && (
              <View style={styles.bookingSection}>
                <View style={styles.bookingSectionHeader}>
                  <Ionicons name="boat" size={20} color="#0D9488" />
                  <Text style={styles.bookingSectionTitle}>Book Your Boat Transfer</Text>

                </View>

                {/* Beach selector - if we have multiple beaches */}
                {beaches && beaches.length > 0 && (
                  <>
                    <Text style={styles.bookingLabel}>Select Beach</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.beachSelector}>
                      {beaches.map((b) => (
                        <TouchableOpacity
                          key={b.id}
                          style={[
                            styles.beachChip,
                            selectedBeachId === b.id && styles.beachChipActive,
                          ]}
                          onPress={() => setSelectedBeachId(b.id)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.beachChipCheck}>
                            {selectedBeachId === b.id ? (
                              <Ionicons name="checkmark-circle" size={18} color="#0D9488" />
                            ) : (
                              <Ionicons name="ellipse-outline" size={18} color="#CBD5E1" />
                            )}
                          </View>
                          <Image source={{ uri: b.image_url }} style={styles.beachChipImage} />
                          <Text style={[
                            styles.beachChipName,
                            selectedBeachId === b.id && styles.beachChipNameActive,
                          ]} numberOfLines={1}>
                            {b.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}

                {/* Date selection */}
                <Text style={styles.bookingLabel}>Select Date</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.datesScroll}>
                  {days.map((day, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.dateChip, selectedDate === idx && styles.dateChipActive]}
                      onPress={() => setSelectedDate(idx)}
                    >
                      <Text style={[styles.dateText, selectedDate === idx && styles.dateTextActive]}>
                        {day.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Participants */}
                <Text style={styles.bookingLabel}>Guests</Text>
                <View style={styles.participantRow}>
                  <TouchableOpacity
                    style={styles.participantBtn}
                    onPress={() => setParticipants(Math.max(1, participants - 1))}
                  >
                    <Ionicons name="remove" size={20} color="#0D9488" />
                  </TouchableOpacity>
                  <View style={styles.participantCount}>
                    <Text style={styles.participantNumber}>{participants}</Text>
                    <Text style={styles.participantLabel}>{participants === 1 ? 'guest' : 'guests'}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.participantBtn}
                    onPress={() => setParticipants(Math.min(20, participants + 1))}
                  >
                    <Ionicons name="add" size={20} color="#0D9488" />
                  </TouchableOpacity>
                </View>

                {/* Name */}
                <Text style={styles.bookingLabel}>Your Name</Text>
                <TextInput
                  style={styles.input}
                  value={guestName}
                  onChangeText={setGuestName}
                  placeholder="Enter your name"
                  placeholderTextColor="#94A3B8"
                />

                {/* Book button */}
                {bookingSuccess ? (
                  <View style={styles.successBanner}>
                    <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                    <Text style={styles.successText}>Boat transfer booked!</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.bookBeachBtn} onPress={handleBookBeach} activeOpacity={0.8}>
                    <Ionicons name="boat" size={18} color="#fff" />
                    <Text style={styles.bookBeachBtnText}>Book Boat Transfer</Text>
                  </TouchableOpacity>

                )}
              </View>
            )}

            {!showBooking && currentBeach && (
              <View style={styles.bookingToggleContainer}>
                <TouchableOpacity
                  style={styles.bookingToggleBtn}
                  onPress={() => setShowBooking(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="boat" size={18} color="#fff" />
                  <Text style={styles.bookingToggleBtnText}>Book Boat Transfer</Text>
                </TouchableOpacity>
              </View>
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
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: Platform.OS === 'ios' ? 50 : 30,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 240,
  },
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  islandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  islandText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D9488',
  },
  name: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: '#64748B',
    lineHeight: 22,
    marginBottom: 4,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
  },
  statCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statCircleText: {
    fontSize: 16,
    fontWeight: '800',
  },
  statCardLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
  },
  occupancySection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  occupancyBarBg: {
    height: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 4,
  },
  occupancyBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  occupancyText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  amenityItem: {
    alignItems: 'center',
    width: 80,
  },
  amenityIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  amenityLabel: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '600',
    textAlign: 'center',
  },
  pangaCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  pangaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pangaTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  pangaStatus: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  pangaSchedule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  pangaScheduleText: {
    fontSize: 13,
    color: '#64748B',
  },

  // Booking toggle
  bookingToggleContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  bookingToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D9488',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bookingToggleBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Booking section
  bookingSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  bookingSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  bookingSectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  bookingLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10,
    marginTop: 8,
  },
  beachSelector: {
    marginBottom: 12,
  },
  beachChip: {
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    width: 100,
  },
  beachChipActive: {
    borderColor: '#0D9488',
    backgroundColor: '#F0FDFA',
  },
  beachChipCheck: {
    marginBottom: 6,
  },
  beachChipImage: {
    width: 60,
    height: 40,
    borderRadius: 8,
    marginBottom: 6,
  },
  beachChipName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  beachChipNameActive: {
    color: '#0D9488',
    fontWeight: '700',
  },
  datesScroll: {
    marginBottom: 16,
  },
  dateChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  dateChipActive: {
    backgroundColor: '#0D9488',
  },
  dateText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  dateTextActive: {
    color: '#fff',
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 16,
  },
  participantBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0FDFA',
    borderWidth: 2,
    borderColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantCount: {
    alignItems: 'center',
  },
  participantNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
  },
  participantLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 20,
  },
  bookBeachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D9488',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bookBeachBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#D1FAE5',
    paddingVertical: 16,
    borderRadius: 16,
  },
  successText: {
    color: '#059669',
    fontSize: 15,
    fontWeight: '700',
  },
});
